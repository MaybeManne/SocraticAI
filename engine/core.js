/* ═══════════════════════════════════════════════════════════════════
   Engine Core v2 — LessonGraph, PlaybackState, EventBus, ActRunner

   Architecture: The scrubber/timeline always maps to the immutable
   "default path" (all-correct answers). Branch acts are overlays
   that insert into the student's actual path but don't shift the
   scrubber position. This makes seeking deterministic.
   ═══════════════════════════════════════════════════════════════════ */
(function() {
"use strict";

var $ = function(id) { return document.getElementById(id); };

/* ═══════════════════════════════════════════════════════════════════
   EventBus — simple pub/sub for decoupling modules
   ═══════════════════════════════════════════════════════════════════ */
var EventBus = {
  _handlers: {},

  on: function(event, fn) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(fn);
  },

  off: function(event, fn) {
    var arr = this._handlers[event];
    if (!arr) return;
    var idx = arr.indexOf(fn);
    if (idx >= 0) arr.splice(idx, 1);
  },

  emit: function(event, data) {
    var arr = this._handlers[event];
    if (!arr) return;
    for (var i = 0; i < arr.length; i++) {
      try { arr[i](data); } catch(e) { console.error("[EventBus]", event, e); }
    }
  }
};

/* ═══════════════════════════════════════════════════════════════════
   LessonGraph — immutable lesson structure built from window.LESSON
   ═══════════════════════════════════════════════════════════════════ */
function LessonGraph(lesson) {
  this.meta = lesson.meta;
  this.problem = lesson.problem;
  this.vizConfig = lesson.viz;

  // All acts (main + branch) keyed by id
  this.allActs = {};
  var self = this;
  lesson.acts.forEach(function(a) { self.allActs[a.id] = a; });
  for (var k in (lesson.branchActs || {})) {
    self.allActs[k] = lesson.branchActs[k];
  }

  // Default path: the main path (immutable, all-correct-answers path)
  this.defaultPath = (lesson.mainPath || []).slice();

  // Milestones indexed by afterAct
  this.milestoneAfter = {};
  (lesson.milestones || []).forEach(function(m) {
    self.milestoneAfter[m.afterAct] = m;
  });

  // Pre-compute default path durations
  this.defaultDurations = [];
  this.totalDefaultDuration = 0;
  for (var i = 0; i < this.defaultPath.length; i++) {
    var act = this.allActs[this.defaultPath[i]];
    var dur = (act && act.duration) ? act.duration : 5;
    this.defaultDurations.push(dur);
    this.totalDefaultDuration += dur;
  }

  // Audio/subtitle data references
  this.audio = lesson.audio || null;
  this.subtitles = lesson.subtitles || null;
  this.beatTimings = lesson.beatTimings || null;
}

/* Resolve a global time (on the default path) to {pathIndex, localTime} */
LessonGraph.prototype.resolveDefaultTime = function(globalTime) {
  globalTime = Math.max(0, Math.min(globalTime, this.totalDefaultDuration));
  var cumulative = 0;
  for (var i = 0; i < this.defaultPath.length; i++) {
    var dur = this.defaultDurations[i];
    if (globalTime < cumulative + dur) {
      return { pathIndex: i, localTime: globalTime - cumulative };
    }
    cumulative += dur;
  }
  var lastIdx = this.defaultPath.length - 1;
  return { pathIndex: lastIdx, localTime: this.defaultDurations[lastIdx] || 0 };
};

/* Get cumulative time on default path up to {pathIndex, localTime} */
LessonGraph.prototype.getDefaultCumulativeTime = function(pathIndex, localTime) {
  var total = 0;
  for (var i = 0; i < pathIndex && i < this.defaultPath.length; i++) {
    total += this.defaultDurations[i];
  }
  return total + (localTime || 0);
};

/* Get milestone positions as fractions of total default duration */
LessonGraph.prototype.getMilestonePositions = function() {
  var positions = [];
  var cumulative = 0;
  for (var i = 0; i < this.defaultPath.length; i++) {
    var dur = this.defaultDurations[i];
    var ms = this.milestoneAfter[this.defaultPath[i]];
    if (ms) {
      positions.push({
        defaultIndex: i,
        position: (cumulative + dur) / this.totalDefaultDuration,
        type: ms.type,
        label: ms.label || ""
      });
    }
    cumulative += dur;
  }
  return positions;
};


/* ═══════════════════════════════════════════════════════════════════
   PlaybackState — state machine for lesson playback

   States: idle → playing ↔ paused → gate → playing → ... → ended
   ═══════════════════════════════════════════════════════════════════ */
function PlaybackState(graph) {
  this.graph = graph;
  this.phase = "idle";           // idle | playing | paused | gate | ended
  this.pathHistory = [];          // actual act IDs visited in order
  this.cursorIndex = -1;          // index into pathHistory
  this.defaultIndex = -1;         // index into graph.defaultPath (for scrubber)
  this.localTime = 0;             // time within current act
  this.gateResults = {};          // milestoneId → true/false
  this.renderedUpTo = -1;         // highest pathHistory index fully rendered in notebook
  this._onBranchPath = false;     // true when playing branch acts
  this._branchReturnDefaultIdx = -1; // defaultPath index to return to after branch
}

/* Transition to a new phase with validation */
PlaybackState.prototype.transition = function(newPhase) {
  var valid = {
    "idle":    ["playing"],
    "playing": ["paused", "gate", "ended", "idle"],
    "paused":  ["playing", "idle"],
    "gate":    ["playing", "idle"],
    "ended":   ["idle", "playing"]
  };
  if (!valid[this.phase] || valid[this.phase].indexOf(newPhase) < 0) {
    console.warn("[PlaybackState] Invalid transition:", this.phase, "→", newPhase);
    return false;
  }
  var old = this.phase;
  this.phase = newPhase;
  EventBus.emit("state:change", { from: old, to: newPhase });
  return true;
};

/* Start from the beginning */
PlaybackState.prototype.start = function() {
  this.pathHistory = [];
  this.cursorIndex = -1;
  this.defaultIndex = -1;
  this.localTime = 0;
  this.gateResults = {};
  this.renderedUpTo = -1;
  this._onBranchPath = false;
  this._branchReturnDefaultIdx = -1;
  this.advanceToNextAct();
};

/* Advance to the next act in sequence */
PlaybackState.prototype.advanceToNextAct = function() {
  if (this._onBranchPath) {
    // We're on a branch — check if there are more branch acts
    var branchActId = this._nextBranchAct();
    if (branchActId) {
      this.pathHistory.push(branchActId);
      this.cursorIndex = this.pathHistory.length - 1;
      this.localTime = 0;
      return branchActId;
    }
    // Branch done — return to default path
    this._onBranchPath = false;
    this.defaultIndex = this._branchReturnDefaultIdx;
  } else {
    this.defaultIndex++;
  }

  if (this.defaultIndex >= this.graph.defaultPath.length) {
    this.transition("ended");
    EventBus.emit("lesson:end", {});
    return null;
  }

  var actId = this.graph.defaultPath[this.defaultIndex];
  this.pathHistory.push(actId);
  this.cursorIndex = this.pathHistory.length - 1;
  this.localTime = 0;
  return actId;
};

/* Enter a branch path after a wrong gate answer */
PlaybackState.prototype.enterBranch = function(branchActIds, returnDefaultIdx) {
  this._onBranchPath = true;
  this._branchReturnDefaultIdx = returnDefaultIdx;
  this._branchQueue = branchActIds.slice();
  // Start the first branch act
  var firstId = this._branchQueue.shift();
  this.pathHistory.push(firstId);
  this.cursorIndex = this.pathHistory.length - 1;
  this.localTime = 0;
  return firstId;
};

PlaybackState.prototype._nextBranchAct = function() {
  if (this._branchQueue && this._branchQueue.length > 0) {
    return this._branchQueue.shift();
  }
  return null;
};

/* Get global time on the default path for scrubber display */
PlaybackState.prototype.getScrubberTime = function() {
  if (this._onBranchPath) {
    // While on branch, show the position of the gate that triggered it
    return this.graph.getDefaultCumulativeTime(this._branchReturnDefaultIdx, 0);
  }
  return this.graph.getDefaultCumulativeTime(this.defaultIndex, this.localTime);
};

/* Get the current act descriptor */
PlaybackState.prototype.getCurrentAct = function() {
  if (this.cursorIndex < 0 || this.cursorIndex >= this.pathHistory.length) return null;
  return this.graph.allActs[this.pathHistory[this.cursorIndex]];
};

/* Get the current act ID */
PlaybackState.prototype.getCurrentActId = function() {
  if (this.cursorIndex < 0 || this.cursorIndex >= this.pathHistory.length) return null;
  return this.pathHistory[this.cursorIndex];
};


/* ═══════════════════════════════════════════════════════════════════
   ActRunner v2 — Compiles act beats into GSAP timeline
   Uses PlaybackState for all state management.
   ═══════════════════════════════════════════════════════════════════ */
var ActRunner = {
  masterTl: null,
  beatCues: [],
  activeBeatIdx: -1,
  _rafId: null,
  _renderedBeats: {},
  _currentActId: null,

  /* Load an act and build its GSAP timeline.
     options.instant: render everything at t=end (for snapshot replay)
     options.startTime: seek to this time after loading */
  loadAct: function(act, options) {
    options = options || {};
    this._stopTicker();
    if (this.masterTl) { this.masterTl.kill(); this.masterTl = null; }
    this._renderedBeats = {};
    this.activeBeatIdx = -1;
    this._currentActId = act.id;

    // Build beat timing cues
    this.beatCues = this._buildBeatCues(act);

    // Build GSAP master timeline
    var duration = this.getActDuration(act);
    this.masterTl = gsap.timeline({ paused: true });

    // Schedule beat card renders and viz actions
    for (var i = 0; i < act.beats.length; i++) {
      this._scheduleBeat(act.beats[i], this.beatCues[i], this.masterTl, options.instant);
    }

    // Ensure timeline covers full duration
    this.masterTl.to({}, { duration: 0.01 }, duration);

    // Set viz panel mode for the act
    if (act.vizPanel) EventBus.emit("viz:setMode", act.vizPanel);

    EventBus.emit("act:loaded", { act: act, duration: duration, instant: !!options.instant });
  },

  _buildBeatCues: function(act) {
    var graph = window._graph;
    if (graph && graph.beatTimings && graph.beatTimings[act.id]) {
      return graph.beatTimings[act.id];
    }
    var WPS = 2.5;
    var cues = [];
    var cursor = 0;
    for (var i = 0; i < act.beats.length; i++) {
      var beat = act.beats[i];
      var words = beat.say ? beat.say.split(/\s+/).length : 0;
      var dur = beat.duration || Math.max(1.5, words / WPS);
      cues.push({ beatId: beat.id, startTime: cursor, endTime: cursor + dur });
      cursor += dur;
    }
    return cues;
  },

  getActDuration: function(act) {
    if (act.duration) return act.duration;
    if (this.beatCues.length > 0) return this.beatCues[this.beatCues.length - 1].endTime;
    return 5;
  },

  _scheduleBeat: function(beat, cue, tl, instant) {
    var self = this;
    var t = cue.startTime;

    if (beat.card) {
      if (instant) {
        EventBus.emit("beat:render", { beat: beat, instant: true });
        self._renderedBeats[beat.id] = true;
      } else {
        tl.call(function() {
          if (!self._renderedBeats[beat.id]) {
            EventBus.emit("beat:render", { beat: beat, instant: false });
            self._renderedBeats[beat.id] = true;
          }
        }, [], t);
      }
    }

    // Schedule viz actions
    if (beat.vizActions && beat.vizActions.length > 0) {
      if (instant) {
        EventBus.emit("viz:runActions", { actions: beat.vizActions, time: 0, instant: true });
      } else {
        EventBus.emit("viz:runActions", { actions: beat.vizActions, timeline: tl, time: t, instant: false });
      }
    }

    // Viz panel mode override
    if (beat._explicitVizPanel && !instant) {
      tl.call(function() { EventBus.emit("viz:setMode", beat._explicitVizPanel); }, [], t);
    }

    // Inline migration at beat END — event-driven, not timeline-scheduled
    if (beat.inlineViz) {
      var inlineType = typeof beat.inlineViz === "string" ? beat.inlineViz : "auto";
      if (instant) {
        EventBus.emit("viz:migrateInline", { beatId: beat.id, type: inlineType });
      } else {
        var endTime = cue.endTime - 0.05;
        tl.call(function() {
          EventBus.emit("viz:migrateInline", { beatId: beat.id, type: inlineType });
        }, [], endTime);
      }
    }
  },

  play: function() {
    if (!this.masterTl) return;
    this.masterTl.play();
    this._startTicker();
  },

  pause: function() {
    if (this.masterTl) this.masterTl.pause();
    this._stopTicker();
  },

  seek: function(time) {
    if (!this.masterTl) return;
    var act = window._state.getCurrentAct();
    if (!act) return;
    time = Math.max(0, Math.min(time, this.getActDuration(act)));
    // Fire any beat renders / viz actions whose startTime <= time that were
    // NOT already rendered. Without this, seeking backwards (or jumping into
    // the middle of an act) leaves the viz empty / showing the intro state
    // until playback catches up — the "3-second intro flash" scrub bug.
    // GSAP .time() on a paused timeline does NOT invoke skipped .call() cbs,
    // so we must replay missed beats ourselves in instant mode.
    this._instantRenderUpTo(act, time);
    this.masterTl.time(time);
    this.masterTl.getChildren().forEach(function(c) {
      if (c.endTime && c.endTime() <= time) { try { c.progress(1, true); } catch(e){} }
    });
    this._updateActiveBeat(time);
    EventBus.emit("playback:tick", { time: time });
  },

  /* Render all beats of `act` whose cue.startTime <= time instantly (cards
     in instant mode, viz actions with instant:true) so the scene reflects
     the post-seek state immediately. Idempotent via _renderedBeats. */
  _instantRenderUpTo: function(act, time) {
    if (!act || !this.beatCues) return;
    for (var i = 0; i < act.beats.length; i++) {
      var beat = act.beats[i];
      var cue = this.beatCues[i];
      if (!cue || cue.startTime > time) break;
      if (this._renderedBeats[beat.id]) continue;
      if (beat.card) {
        EventBus.emit("beat:render", { beat: beat, instant: true });
      }
      if (beat.vizActions && beat.vizActions.length > 0) {
        EventBus.emit("viz:runActions", {
          actions: beat.vizActions, time: 0, instant: true
        });
      }
      if (beat.inlineViz && cue.endTime <= time) {
        var inlineType = typeof beat.inlineViz === "string" ? beat.inlineViz : "auto";
        EventBus.emit("viz:migrateInline", { beatId: beat.id, type: inlineType });
      }
      this._renderedBeats[beat.id] = true;
    }
  },

  getCurrentTime: function() {
    return this.masterTl ? this.masterTl.time() : 0;
  },

  setTimeScale: function(rate) {
    if (this.masterTl) this.masterTl.timeScale(rate);
  },

  cleanup: function() {
    this._stopTicker();
    if (this.masterTl) { this.masterTl.kill(); this.masterTl = null; }
    this.beatCues = [];
    this.activeBeatIdx = -1;
    this._renderedBeats = {};
    this._currentActId = null;
  },

  /* Snapshot an act: render all cards instantly, apply all viz at end state.
     Does NOT touch audio, does NOT create a playing timeline. */
  snapshotAct: function(act) {
    this.loadAct(act, { instant: true });
    // Kill the timeline immediately — we only wanted the side effects
    if (this.masterTl) { this.masterTl.kill(); this.masterTl = null; }
    this._renderedBeats = {};
    this._currentActId = null;
  },

  _startTicker: function() {
    this._stopTicker();
    var self = this;
    function tick() {
      var state = window._state;
      if (!state || state.phase !== "playing") {
        // Ticker is dying — clear _rafId so stuck detection can see it's dead
        self._rafId = null;
        return;
      }

      var t = self.masterTl ? self.masterTl.time() : 0;

      // Sync with audio if available
      var audioTime = null;
      EventBus.emit("audio:getTime", { callback: function(at) { audioTime = at; } });
      if (audioTime !== null && Math.abs(t - audioTime) > 0.1) {
        self.masterTl.time(audioTime);
        t = audioTime;
      }

      state.localTime = t;
      self._updateActiveBeat(t);
      EventBus.emit("playback:tick", { time: t });

      // Check act completion
      var act = state.getCurrentAct();
      var dur = act ? self.getActDuration(act) : 0;
      if (t >= dur - 0.05) {
        if (self.masterTl) self.masterTl.progress(1);
        self._stopTicker();
        EventBus.emit("act:complete", { actId: state.getCurrentActId() });
        return;
      }

      self._rafId = requestAnimationFrame(tick);
    }
    this._rafId = requestAnimationFrame(tick);
  },

  _stopTicker: function() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  },

  _updateActiveBeat: function(t) {
    var newIdx = -1;
    for (var i = this.beatCues.length - 1; i >= 0; i--) {
      if (t >= this.beatCues[i].startTime) { newIdx = i; break; }
    }
    if (newIdx !== this.activeBeatIdx && newIdx >= 0) {
      this.activeBeatIdx = newIdx;
      EventBus.emit("beat:enter", { beatId: this.beatCues[newIdx].beatId, index: newIdx });
    }
  }
};


/* ═══════════════════════════════════════════════════════════════════
   Orchestrator — wires everything together, handles act sequencing
   ═══════════════════════════════════════════════════════════════════ */
var Orchestrator = {
  _gatePausedAudio: null,   // { actId, time } — stored when audio pauses for a gate
  _pendingGateTimer: null,  // safety timeout while waiting for audio to finish
  _gateWaitToken: 0,        // cancellation token for _enterGateWhenAudioDone callbacks

  init: function(graph, state) {
    var self = this;

    // When an act completes, check for milestone and advance
    EventBus.on("act:complete", function(data) {
      var actId = data.actId;
      var ms = graph.milestoneAfter[actId];

      if (ms && ms.type === "gate" && !state._onBranchPath) {
        // Let the last beat's audio finish before showing the gate
        self._enterGateWhenAudioDone(ms, actId, graph, state);
      } else {
        self._advanceToNext(graph, state);
      }
    });

    // When a gate is resolved
    EventBus.on("gate:resolve", function(data) {
      var correct = data.correct;
      var ms = data.milestone;

      state.gateResults[ms.id] = correct;
      self._gatePausedAudio = null; // clear — we're moving on

      if (!correct && ms.wrongPath && ms.wrongPath.length > 0) {
        // Enter branch path — audio starts from 0 for the branch act
        var returnIdx = state.defaultIndex + 1;
        var firstBranchId = state.enterBranch(ms.wrongPath, returnIdx);
        console.log("[gate] branch act " + firstBranchId + " starting audio from 0");
        state.transition("playing");
        self._playActById(firstBranchId, graph);
      } else {
        // Correct answer — advance to next act, audio starts from 0
        state.transition("playing");
        self._advanceToNext(graph, state);
      }
    });
  },

  /* Wait for the current audio to finish naturally (up to 3s), then enter
     gate state.  This prevents cutting off mid-sentence. */
  _enterGateWhenAudioDone: function(ms, actId, graph, state) {
    var self = this;
    var am = EX.AudioManager;
    // Cancellation token — incremented by cancelPendingGate() to invalidate stale callbacks
    var token = ++this._gateWaitToken;

    function doEnter() {
      // Clean up timer
      if (self._pendingGateTimer) { clearTimeout(self._pendingGateTimer); self._pendingGateTimer = null; }
      // Check: was this gate wait cancelled? (e.g. by recoverState or jumpTo)
      if (token !== self._gateWaitToken) {
        console.log("[gate] stale gate callback ignored (token mismatch)");
        return;
      }
      // Check: is the state still valid for entering a gate?
      if (state.phase !== "playing") {
        console.log("[gate] cannot enter gate — phase is now:", state.phase);
        return;
      }

      var pausedTime = (am.current && !isNaN(am.current.currentTime)) ? am.current.currentTime : 0;
      EventBus.emit("audio:pause", {});
      self._gatePausedAudio = { actId: actId, time: pausedTime };
      console.log("[gate] audio paused at " + pausedTime.toFixed(2) + "s in act " + actId);

      state.transition("gate");
      EventBus.emit("gate:enter", { milestone: ms });
    }

    // If no audio playing, enter immediately
    if (!am.current || am.current.paused || am.current.ended) {
      doEnter();
      return;
    }

    // Audio still playing — wait for it to end naturally
    var audioEl = am.current;
    function onFinish() {
      audioEl.removeEventListener("ended", onFinish);
      audioEl.removeEventListener("pause", onFinish);
      doEnter();
    }

    audioEl.addEventListener("ended", onFinish);
    audioEl.addEventListener("pause", onFinish);

    // Safety: don't wait more than 10 seconds (was 3s — cut off trailing
    // syllables when beatTimings endTime < actual audio duration).
    self._pendingGateTimer = setTimeout(function() {
      audioEl.removeEventListener("ended", onFinish);
      audioEl.removeEventListener("pause", onFinish);
      doEnter();
    }, 10000);
  },

  /* Cancel any pending gate-entry wait and invalidate its callbacks */
  cancelPendingGate: function() {
    this._gateWaitToken++;  // invalidates any in-flight doEnter callback
    if (this._pendingGateTimer) {
      clearTimeout(this._pendingGateTimer);
      this._pendingGateTimer = null;
    }
  },

  start: function(graph, state) {
    // Full reset for replay: clear all stale content from previous playthrough
    this.cancelPendingGate();
    this._gatePausedAudio = null;
    ActRunner.cleanup();
    EventBus.emit("audio:stop", {});
    EventBus.emit("notebook:clear", {});
    EventBus.emit("viz:reset", {});

    state.start();
    var actId = state.getCurrentActId();
    if (actId) {
      state.transition("playing");
      this._playActById(actId, graph);
    }
  },

  _advanceToNext: function(graph, state) {
    var actId = state.advanceToNextAct();
    if (actId) {
      if (state.phase !== "playing") state.transition("playing");
      this._playActById(actId, graph);
    }
    // If null, lesson ended (handled by PlaybackState.advanceToNextAct)
  },

  _playActById: function(actId, graph) {
    var act = graph.allActs[actId];
    if (!act) { console.warn("[Orchestrator] Act not found:", actId); return; }

    // Cancel any pending gate-entry wait (if we're being called during the wait)
    this.cancelPendingGate();

    var isBranch = act._isBranch;
    if (isBranch) {
      console.log("[gate] branch act " + actId + " starting audio from 0");
    } else if (this._gatePausedAudio) {
      console.log("[gate] returning from branch, resuming act " + actId + " at 0s");
      this._gatePausedAudio = null;
    }

    EventBus.emit("act:start", { act: act, actId: actId });

    // Load audio for this act — always from 0 (each act has its own audio track)
    EventBus.emit("audio:loadAndPlay", { actId: actId, startTime: 0 });
    EventBus.emit("subtitles:load", { actId: actId, beats: act.beats });

    ActRunner.loadAct(act);
    ActRunner.play();
  },

  /* Jump to a position on the default path.
     Clears everything and replays from scratch up to target. */
  jumpToDefaultIndex: function(targetIdx, localTime, graph, state) {
    // If at a gate, dismiss it — user chose to seek away
    if (state.phase === "gate") {
      console.log("[gate] dismissed by seek — forcing out of gate state");
      state.phase = "playing"; // bypass validation
    }

    // Cancel any pending gate-entry wait
    this.cancelPendingGate();
    this._gatePausedAudio = null;

    // Stop current playback
    ActRunner.cleanup();
    EventBus.emit("audio:stop", {});
    EventBus.emit("notebook:clear", {});
    EventBus.emit("viz:reset", {});

    // Reset state
    state.pathHistory = [];
    state.cursorIndex = -1;
    state.defaultIndex = -1;
    state.localTime = 0;
    state.renderedUpTo = -1;
    state._onBranchPath = false;

    // Snapshot all acts before target
    for (var i = 0; i < targetIdx; i++) {
      var actId = graph.defaultPath[i];
      var act = graph.allActs[actId];
      if (act) {
        ActRunner.snapshotAct(act);
        state.pathHistory.push(actId);
        state.renderedUpTo = state.pathHistory.length - 1;
      }
      // Render passed gates
      var ms = graph.milestoneAfter[actId];
      if (ms && ms.type === "gate") {
        EventBus.emit("gate:renderPassed", { milestone: ms });
      }
    }

    // Set default index and play target act
    state.defaultIndex = targetIdx;
    var targetActId = graph.defaultPath[targetIdx];
    var targetAct = targetActId ? graph.allActs[targetActId] : null;
    if (!targetAct) {
      // targetIdx is past the end of the path — treat as lesson end
      state.transition("ended");
      EventBus.emit("lesson:end", {});
      return;
    }
    state.pathHistory.push(targetActId);
    state.cursorIndex = state.pathHistory.length - 1;
    state.localTime = localTime || 0;

    if (state.phase !== "playing") state.transition("playing");

    EventBus.emit("act:start", { act: targetAct, actId: targetActId });
    EventBus.emit("audio:loadAndPlay", { actId: targetActId, startTime: localTime });
    EventBus.emit("subtitles:load", { actId: targetActId, beats: targetAct.beats });

    ActRunner.loadAct(targetAct);
    ActRunner.seek(localTime || 0);
    ActRunner.play();
  },

  /* Seek to a global time on the default path */
  seekToGlobalTime: function(globalTime, graph, state) {
    // If at a gate, dismiss it — user chose to seek away
    if (state.phase === "gate") {
      console.log("[gate] dismissed by scrubber seek");
      state.phase = "playing";
    }

    globalTime = Math.max(0, Math.min(globalTime, graph.totalDefaultDuration));
    var target = graph.resolveDefaultTime(globalTime);

    if (target.pathIndex !== state.defaultIndex || state._onBranchPath) {
      // Different act — need to jump
      this.jumpToDefaultIndex(target.pathIndex, target.localTime, graph, state);
    } else {
      // Same act — just seek within. Pause audio first so the old position
      // doesn't keep playing while we seek, then resume from the new spot.
      EventBus.emit("audio:pause", {});
      ActRunner.seek(target.localTime);
      EventBus.emit("audio:seekTo", { time: target.localTime });
      if (state.phase === "playing") EventBus.emit("audio:resume", {});
      state.localTime = target.localTime;
    }
  },

  /* Returns true if the engine appears stuck and needs recovery.
     Checks every known stuck pattern. */
  isStuck: function(state) {
    var phase = state.phase;
    // Waiting for audio to finish before showing gate — not stuck, just transitioning
    if (this._pendingGateTimer) return false;
    // Valid interactive states
    if (phase === "paused" || phase === "ended") return false;
    // Gate is shown — not stuck (user needs to answer)
    if (phase === "gate") return false;
    // "idle" with firstDone means something went wrong
    if (phase === "idle") return true;
    // "playing" but nothing is actually playing
    if (phase === "playing") {
      if (!ActRunner.masterTl) return true;
      if (!ActRunner._rafId) return true;
    }
    return false;
  },

  /* Hard reset: force the engine back to a known-good paused state at the
     current act + time position.  Called when user interaction detects that
     the player is stuck (e.g. after rapid scrolling). */
  recoverState: function(graph, state) {
    console.log("[recover] === HARD RESET ===");
    console.log("[recover] phase:", state.phase, "masterTl:", !!ActRunner.masterTl,
                "ticker:", !!ActRunner._rafId, "pendingGate:", !!this._pendingGateTimer,
                "actId:", state.getCurrentActId(), "localTime:", state.localTime);

    // 0. Cancel ALL pending timers — gate wait, debounce, anything
    this.cancelPendingGate();
    console.log("[recover] killed pending gate timer + invalidated callbacks");

    // 1. Kill everything in flight
    ActRunner.cleanup();
    EventBus.emit("audio:stop", {});
    console.log("[recover] killed ActRunner + audio");

    // 2. Reset all lock flags via event so ScrollSync hears it
    EventBus.emit("recover:reset", {});

    // 3. Determine where we are on the default path
    var actId = state.getCurrentActId();
    var act = actId ? graph.allActs[actId] : null;
    var localTime = state.localTime || 0;

    if (!act) {
      // No valid act — fall back to the act at defaultIndex, or the first act
      var idx = Math.max(0, Math.min(state.defaultIndex, graph.defaultPath.length - 1));
      actId = graph.defaultPath[idx];
      act = graph.allActs[actId];
      localTime = 0;
      state.defaultIndex = idx;
      if (!state.pathHistory.length || state.pathHistory[state.pathHistory.length - 1] !== actId) {
        state.pathHistory.push(actId);
      }
      state.cursorIndex = state.pathHistory.length - 1;
    }

    // 4. Check if we should be at a gate (act completed + gate milestone after it)
    var ms = graph.milestoneAfter[actId];
    var actDur = (act.duration) || 5;
    var atGate = ms && ms.type === "gate" && localTime >= actDur - 0.1
                 && !state.gateResults[ms.id];

    if (atGate) {
      // Re-enter the gate — audio stays stopped (already killed above)
      state.phase = "gate";
      state._onBranchPath = false;
      state.localTime = actDur;
      // Preserve gate audio state if it was stored before recovery
      if (!this._gatePausedAudio) {
        this._gatePausedAudio = { actId: actId, time: actDur };
      }
      EventBus.emit("gate:enter", { milestone: ms });
      console.log("[gate] recovered at gate — audio stays stopped, paused state:", JSON.stringify(this._gatePausedAudio));
      return;
    }

    // 5. Force phase to "paused" (bypass transition validation since we may be
    //    in an invalid state that rejects all transitions)
    state.phase = "paused";
    state._onBranchPath = false;
    state.localTime = localTime;

    // 6. Reload the current act and seek to the saved position
    EventBus.emit("act:start", { act: act, actId: actId });
    EventBus.emit("subtitles:load", { actId: actId, beats: act.beats });
    ActRunner.loadAct(act);
    if (localTime > 0) ActRunner.seek(localTime);

    // 7. Pre-load audio for this act so the next play/resume picks it up
    //    immediately from the correct position (don't auto-play — we're paused)
    EX.AudioManager.loadAct(actId).then(function(audio) {
      if (audio) {
        // Double-check we haven't entered a gate while the load was in flight
        if (state.phase === "gate") {
          console.log("[audio] recovered — skipping preload, gate is active");
          return;
        }
        EX.AudioManager.current = audio;
        audio.playbackRate = EX.AudioManager.rate;
        if (audio.readyState >= 1) {
          audio.currentTime = localTime;
        }
        console.log("[audio] recovered — preloaded", actId, "at", localTime.toFixed(2) + "s");
      }
    });
    // Leave paused — the next user click on play will resume normally
  }
};


/* ═══════════════════════════════════════════════════════════════════
   Exports
   ═══════════════════════════════════════════════════════════════════ */
window.EX = window.EX || {};
window.EX.EventBus = EventBus;
window.EX.LessonGraph = LessonGraph;
window.EX.PlaybackState = PlaybackState;
window.EX.ActRunner = ActRunner;
window.EX.Orchestrator = Orchestrator;
window.EX.$ = $;

})();
