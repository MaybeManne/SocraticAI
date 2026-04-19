/* ═══════════════════════════════════════════════════════════════════
   Player Controls v2 — Scrubber, milestone dots, keyboard navigation

   Fixes from v1:
   - Bug 1 fix: proper `this` binding (no stale `self` reference)
   - Bug 3 fix: scrubber locked during gate state
   - Scrubber maps to default path only (branch acts don't shift it)
   - Milestone dots use correct closure binding
   ═══════════════════════════════════════════════════════════════════ */
(function() {
"use strict";

var EX = window.EX;
var EventBus = EX.EventBus;
var $ = EX.$;

var PlayerControls = {
  playing: false,
  speeds: [0.5, 0.75, 1, 1.25, 1.5, 2],
  speedIdx: 2,
  firstDone: false,
  _scrubberLocked: false,
  _isDragging: false,
  _graph: null,
  _state: null,

  init: function(graph, state) {
    this._graph = graph;
    this._state = state;
    var self = this; // v2: properly scoped self for all closures in this method

    var pb = $("playBtn");
    var sb = $("speedBtn");

    pb.addEventListener("click", function(e) { e.stopPropagation(); self.toggle(); });

    sb.addEventListener("click", function() {
      self.speedIdx = (self.speedIdx + 1) % self.speeds.length;
      var rate = self.speeds[self.speedIdx];
      sb.textContent = rate + "x";
      EventBus.emit("audio:setRate", { rate: rate });
      EX.ActRunner.setTimeScale(rate);
    });

    $("subToggle").addEventListener("click", function() {
      var on = EX.Subtitles.enabled;
      EX.Subtitles.setEnabled(!on);
      this.classList.toggle("off", on);
    });

    $("narToggle").addEventListener("click", function() {
      var off = this.classList.contains("off");
      EventBus.emit("audio:setEnabled", { enabled: off });
      this.classList.toggle("off", !off);
      this.textContent = off ? "\u{1F50A}" : "\u{1F507}";
    });

    // Light/dark theme toggle
    var themeBtn = $("themeToggle");
    if (themeBtn) {
      var sunIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
      var moonIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
      themeBtn.addEventListener("click", function() {
        document.body.classList.toggle("light-mode");
        var isLight = document.body.classList.contains("light-mode");
        themeBtn.innerHTML = isLight ? moonIcon : sunIcon;
      });
    }

    // Print notebook
    var printBtn = $("printBtn");
    if (printBtn) {
      printBtn.addEventListener("click", function() {
        window.print();
      });
    }

    // Scrubber: maps to default path global time
    var scrubber = $("scrubber");

    // Single recovery function used by all user interactions
    function doRecover() {
      console.log("[controls] triggering recovery from user interaction");
      EX.Orchestrator.recoverState(graph, state);
      self.playing = false;
      self._scrubberLocked = false;
      self._isDragging = false;
      pb.innerHTML = "\u25B6";
    }

    // Check if stuck and recover. Returns true if recovery was needed.
    function ensureReady() {
      if (self.firstDone && EX.Orchestrator.isStuck(state)) {
        doRecover();
        return true;
      }
      return false;
    }

    // Watchdog: every 1s, check if phase is "playing" but nothing is moving.
    // This catches stuck states that happen between user interactions.
    setInterval(function() {
      if (!self.firstDone) return;
      if (EX.Orchestrator.isStuck(state)) {
        console.log("[watchdog] stuck state detected, auto-recovering");
        doRecover();
      }
    }, 1000);

    function doSeek(pct) {
      ensureReady();
      if (self._scrubberLocked) return;
      // If at a gate, unlock scrubber — user wants to seek away from the gate
      if (state.phase === "gate") self._scrubberLocked = false;

      if (!self.firstDone) {
        self.firstDone = true;
        self.playing = true;
        pb.innerHTML = "\u23F8";
        if (window._collapseHero) window._collapseHero();
      }

      var totalDur = graph.totalDefaultDuration;
      EX.Orchestrator.seekToGlobalTime(pct * totalDur, graph, state);
      self.playing = true;
      pb.innerHTML = "\u23F8";
    }

    scrubber.addEventListener("mousedown", function() { self._isDragging = true; });
    scrubber.addEventListener("touchstart", function() { self._isDragging = true; }, { passive: true });
    document.addEventListener("mouseup", function() { self._isDragging = false; });
    document.addEventListener("touchend", function() { self._isDragging = false; });

    scrubber.addEventListener("input", function() {
      if (!self._isDragging) return;
      doSeek(parseInt(this.value) / 1000);
    });

    scrubber.addEventListener("click", function(e) {
      self._isDragging = false;
      var rect = scrubber.getBoundingClientRect();
      var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      scrubber.value = Math.round(pct * 1000);
      doSeek(pct);
    });

    // Keyboard navigation
    document.addEventListener("keydown", function(e) {
      if (e.target.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!self.firstDone) { self.firstDone = true; self.start(); return; }
        self.toggle();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        if (!self.firstDone) { self.firstDone = true; self.start(); }
        var curTime = state.getScrubberTime();
        EX.Orchestrator.seekToGlobalTime(curTime + 5, graph, state);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        if (!self.firstDone) { self.firstDone = true; self.start(); }
        var curTime = state.getScrubberTime();
        EX.Orchestrator.seekToGlobalTime(curTime - 5, graph, state);
      }
    });

    // First click to start
    document.addEventListener("click", function handler(e) {
      if (self.firstDone) return;
      if (e.target.closest("#controls")) return;
      if (e.target.closest(".quiz-opt")) return;
      self.firstDone = true;
      self.start();
      document.removeEventListener("click", handler);
    });

    // Build milestone dots
    this._buildMilestoneDots();

    // Listen for state changes
    EventBus.on("state:change", function(data) {
      if (data.to === "gate") self.onGateEnter();
      else if (data.from === "gate") self.onGateExit();
      else if (data.to === "ended") self.onLessonEnd();
    });

    // Hard reset clears our lock flags too
    EventBus.on("recover:reset", function() {
      self._scrubberLocked = false;
      self._isDragging = false;
    });

    // Listen for tick updates
    EventBus.on("playback:tick", function() {
      self.updateProgress();
    });

    // Show total duration immediately so "0:00 / 5:24" is visible before play
    var totalDur = graph.totalDefaultDuration;
    if (totalDur > 0) {
      $("timeD").textContent = "0:00 / " + formatTime(totalDur);
    }
  },

  start: function() {
    this.playing = true;
    $("playBtn").innerHTML = "\u23F8";
    if (window._collapseHero) window._collapseHero();
    EX.Orchestrator.start(this._graph, this._state);
  },

  toggle: function() {
    if (!this.firstDone) { this.firstDone = true; this.start(); return; }
    var state = this._state;
    var graph = this._graph;

    // Recover from any stuck state before inspecting phase
    if (EX.Orchestrator.isStuck(state)) {
      console.log("[controls] toggle detected stuck, recovering");
      EX.Orchestrator.recoverState(graph, state);
      this.playing = false;
      this._scrubberLocked = false;
      $("playBtn").innerHTML = "\u25B6";
      return; // leave paused — next click will resume
    }

    // If waiting for gate audio to finish, don't toggle — let it complete
    if (EX.Orchestrator._pendingGateTimer) return;

    // Use actual state phase as the source of truth
    var isActive = (state.phase === "playing");
    if (isActive) {
      this.playing = false;
      $("playBtn").innerHTML = "\u25B6";
      EX.ActRunner.pause();
      EventBus.emit("audio:pause", {});
      state.transition("paused");
    } else if (state.phase === "gate") {
      // Dismiss the gate and advance to the next act
      console.log("[controls] play pressed during gate — dismissing gate, advancing");
      state.phase = "playing"; // force out of gate
      this.playing = true;
      this._scrubberLocked = false;
      $("playBtn").innerHTML = "\u23F8";
      EX.Orchestrator._gatePausedAudio = null;
      EX.Orchestrator._advanceToNext(graph, state);
    } else {
      // If state is "ended" or "idle", reset to beginning
      if (state.phase === "ended" || state.phase === "idle") {
        this.start();
        return;
      }
      this.playing = true;
      $("playBtn").innerHTML = "\u23F8";
      state.transition("playing");
      EX.ActRunner.play();
      EventBus.emit("audio:resume", {});
    }
  },

  onGateEnter: function() {
    this.playing = false;
    // Don't lock scrubber — user should be able to seek away from a gate
    this._scrubberLocked = false;
    $("playBtn").innerHTML = "\u25B6";
  },

  onGateExit: function() {
    this.playing = true;
    this._scrubberLocked = false;
    $("playBtn").innerHTML = "\u23F8";
  },

  onLessonEnd: function() {
    this.playing = false;
    $("playBtn").innerHTML = "\u25B6";
  },

  updateProgress: function() {
    var graph = this._graph;
    var state = this._state;
    var totalDur = graph.totalDefaultDuration;
    var cumTime = state.getScrubberTime();

    // Don't fight the user's drag — only update scrubber position when idle
    if (!this._isDragging) {
      var pct = totalDur > 0 ? Math.round(cumTime / totalDur * 1000) : 0;
      $("scrubber").value = pct;
    }
    $("timeD").textContent = formatTime(cumTime) + " / " + formatTime(totalDur);

    var fillPct = totalDur > 0 ? (cumTime / totalDur * 100) : 0;
    var fill = $("progress-fill");
    if (fill) fill.style.height = fillPct + "%";
  },

  /* v2 fix: milestone dots use proper closure binding */
  _buildMilestoneDots: function() {
    var dotsContainer = $("milestone-dots");
    if (!dotsContainer) return;
    dotsContainer.innerHTML = "";

    var graph = this._graph;
    var state = this._state;
    var self = this; // v2: properly bound

    var positions = graph.getMilestonePositions();
    positions.forEach(function(ms) {
      var dot = document.createElement("div");
      dot.className = "milestone-dot" + (ms.type === "gate" ? " gate" : "");
      dot.style.left = (ms.position * 100) + "%";
      dot.title = ms.label || ("Act " + (ms.defaultIndex + 1));
      dot.addEventListener("click", function(e) {
        e.stopPropagation();
        e.preventDefault();
        // Recover from stuck state before jumping
        if (self.firstDone && EX.Orchestrator.isStuck(state)) {
          console.log("[controls] milestone click detected stuck, recovering");
          EX.Orchestrator.recoverState(graph, state);
          self.playing = false;
          self._scrubberLocked = false;
          $("playBtn").innerHTML = "\u25B6";
        }
        self._scrubberLocked = true;
        setTimeout(function() { self._scrubberLocked = false; }, 300);
        if (!self.firstDone) {
          self.firstDone = true;
          if (window._collapseHero) window._collapseHero();
        }
        if (ms.type === "gate") {
          // Jump to the act just before the gate and seek to its end so the
          // gate fires immediately and playback pauses at the question.
          var gateActDur = graph.defaultDurations[ms.defaultIndex] || 9999;
          EX.Orchestrator.jumpToDefaultIndex(ms.defaultIndex, gateActDur, graph, state);
          // onGateEnter will set playing=false and update the button
        } else {
          // Marker — jump to the act immediately after it
          EX.Orchestrator.jumpToDefaultIndex(ms.defaultIndex + 1, 0, graph, state);
          self.playing = true;
          $("playBtn").innerHTML = "\u23F8";
        }
      });
      dotsContainer.appendChild(dot);
    });
  },

  rebuildProgress: function() {
    this._buildMilestoneDots();
  }
};

function formatTime(seconds) {
  var m = Math.floor(seconds / 60);
  var s = Math.floor(seconds % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

EX.PlayerControls = PlayerControls;

})();
