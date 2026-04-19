/* ═══════════════════════════════════════════════════════════════════
   ScrollSync v2 — Bidirectional scroll ↔ timeline synchronization
   ═══════════════════════════════════════════════════════════════════ */
(function() {
"use strict";

var EX = window.EX;
var EventBus = EX.EventBus;
var $ = EX.$;

var ScrollSync = {
  observer: null,
  scrollLocked: false,
  timelineLocked: false,
  _lockTimeout: null,
  _intersectTimeout: null,

  init: function() {
    var nb = $("notebook");
    if (!nb) return;
    this.observer = new IntersectionObserver(
      this._onIntersect.bind(this),
      {
        root: nb,
        threshold: [0.5],
        rootMargin: "-20% 0px -20% 0px"
      }
    );

    var self = this;
    nb.addEventListener("wheel", function() {
      var state = window._state;
      if (!state || state.phase !== "playing") return;
      self.timelineLocked = true;
      clearTimeout(self._lockTimeout);
      self._lockTimeout = setTimeout(function() { self.timelineLocked = false; }, 800);
    }, { passive: true });

    // Listen for events
    EventBus.on("scroll:observe", function(data) {
      if (self.observer && data.element) self.observer.observe(data.element);
    });

    EventBus.on("scroll:toBeat", function(data) {
      self.scrollToBeat(data.beatId);
    });

    // Cancel any pending debounced seek when acts change or gates enter,
    // so a stale seek can't fire into a new context and corrupt state.
    EventBus.on("act:start", function() { self.cancelPendingSeek(); });
    EventBus.on("gate:enter", function() { self.cancelPendingSeek(); });
    EventBus.on("state:change", function() { self.cancelPendingSeek(); });

    // Hard reset: clear ALL locks and pending timeouts
    EventBus.on("recover:reset", function() {
      self.cancelPendingSeek();
      clearTimeout(self._lockTimeout);
      self._lockTimeout = null;
      self.scrollLocked = false;
      self.timelineLocked = false;
    });
  },

  cancelPendingSeek: function() {
    clearTimeout(this._intersectTimeout);
    this._intersectTimeout = null;
  },

  _onIntersect: function(entries) {
    if (this.scrollLocked) return;
    var state = window._state;
    if (!state || (state.phase !== "playing" && state.phase !== "paused")) return;

    var best = null, bestRatio = 0;
    entries.forEach(function(entry) {
      if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
        best = entry.target;
        bestRatio = entry.intersectionRatio;
      }
    });
    if (best && this.timelineLocked) {
      var beatId = best.dataset.beatId || best.dataset.milestoneId;
      if (!beatId) return;
      var self = this;
      // Capture the act that was playing when the scroll happened
      var actIdAtSchedule = EX.ActRunner._currentActId;
      clearTimeout(this._intersectTimeout);
      this._intersectTimeout = setTimeout(function() {
        self._intersectTimeout = null;
        // Re-check state: don't seek if act changed, state left playing, or timeline died
        var st = window._state;
        if (!st || (st.phase !== "playing" && st.phase !== "paused")) return;
        if (EX.ActRunner._currentActId !== actIdAtSchedule) return;
        if (!EX.ActRunner.masterTl) return;

        var cues = EX.ActRunner.beatCues;
        for (var i = 0; i < cues.length; i++) {
          if (cues[i].beatId === beatId) {
            self.scrollLocked = true;
            EX.ActRunner.seek(cues[i].startTime);
            self.scrollLocked = false;
            break;
          }
        }
      }, 50);
    }
  },

  scrollToBeat: function(beatId) {
    if (this.timelineLocked) return;
    this.scrollLocked = true;
    EX.Notebook.scrollTo(beatId);
    var self = this;
    setTimeout(function() { self.scrollLocked = false; }, 500);
  }
};

EX.ScrollSync = ScrollSync;

})();
