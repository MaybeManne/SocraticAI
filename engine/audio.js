/* ═══════════════════════════════════════════════════════════════════
   Audio Manager v2 — Async-safe audio loading and playback

   Fixes from v1:
   - loadAct() returns a Promise (resolves on canplaythrough)
   - play(actId, startTime) loads then seeks then plays — no race condition
   - seekTo() checks readyState before seeking
   ═══════════════════════════════════════════════════════════════════ */
(function() {
"use strict";

var EX = window.EX;
var EventBus = EX.EventBus;

var AudioManager = {
  current: null,
  enabled: true,
  rate: 1,
  cache: {},
  _graph: null,
  _loadToken: 0,

  init: function(graph) {
    this._graph = graph;
    this._bindEvents();
  },

  _bindEvents: function() {
    var self = this;
    EventBus.on("audio:loadAndPlay", function(data) {
      self.loadAndPlay(data.actId, data.startTime || 0);
    });
    EventBus.on("audio:stop", function() { self.stop(); });
    EventBus.on("audio:pause", function() { self.pause(); });
    EventBus.on("audio:resume", function() { self.resume(); });
    EventBus.on("audio:seekTo", function(data) { self.seekTo(data.time); });
    EventBus.on("audio:setRate", function(data) { self.setRate(data.rate); });
    EventBus.on("audio:setEnabled", function(data) { self.setEnabled(data.enabled); });
    EventBus.on("audio:getTime", function(data) {
      if (data.callback && self.current && !self.current.paused && self.current.duration) {
        data.callback(self.current.currentTime);
      }
    });

    // Hard reset: stop everything and invalidate in-flight loads
    EventBus.on("recover:reset", function() {
      console.log("[audio] recovered — killing current audio and invalidating pending loads");
      self.stop();
      self._loadToken++;  // any in-flight loadAct promise will see a stale token and bail
    });
  },

  /* Load audio for an act — returns a Promise */
  loadAct: function(actId) {
    var self = this;
    return new Promise(function(resolve) {
      if (!self._graph || !self._graph.audio) { resolve(null); return; }
      var audioDef = self._graph.audio[actId];
      if (!audioDef) { resolve(null); return; }

      // Check cache
      if (self.cache[actId]) { resolve(self.cache[actId]); return; }

      var src = audioDef.b64 ? "data:audio/mpeg;base64," + audioDef.b64 : audioDef.src;
      if (!src) { resolve(null); return; }

      var a = new window.Audio(src);
      a.preload = "auto";

      var _done = false;
      function onReady() {
        if (_done) return;
        _done = true;
        self.cache[actId] = a;
        resolve(a);
      }

      a.addEventListener("canplaythrough", onReady, { once: true });
      // Fallback timeout — don't block forever
      setTimeout(function() { if (!_done) { _done = true; self.cache[actId] = a; resolve(a); } }, 5000);
    });
  },

  /* Load, seek, then play — async-safe sequence */
  loadAndPlay: function(actId, startTime) {
    var self = this;
    this.stop();
    if (!this.enabled) return;

    var token = ++this._loadToken;
    this.loadAct(actId).then(function(audio) {
      if (!audio || self._loadToken !== token) return;
      self.current = audio;
      audio.currentTime = startTime || 0;
      audio.playbackRate = self.rate;
      audio.play().catch(function() {});
    });
  },

  stop: function() {
    if (this.current) {
      this.current.pause();
      this.current.currentTime = 0;
    }
    this.current = null;
  },

  pause: function() {
    if (this.current && !this.current.paused) this.current.pause();
  },

  resume: function() {
    if (!this.enabled || !this.current) return;
    this.current.playbackRate = this.rate;
    this.current.play().catch(function() {});
  },

  seekTo: function(time) {
    if (!this.current) return;
    // v2 fix: check readyState before seeking
    if (this.current.readyState >= 1) {
      this.current.currentTime = time;
    } else {
      // Queue the seek for when audio is ready
      var self = this;
      this.current.addEventListener("canplay", function handler() {
        self.current.removeEventListener("canplay", handler);
        self.current.currentTime = time;
      }, { once: true });
    }
  },

  getTime: function() {
    return this.current ? this.current.currentTime : 0;
  },

  getDuration: function(actId) {
    // v2 fix: return duration for a specific act, not the global current
    if (actId && this.cache[actId]) {
      var d = this.cache[actId].duration;
      return (d && !isNaN(d)) ? d : 0;
    }
    return (this.current && this.current.duration && !isNaN(this.current.duration)) ? this.current.duration : 0;
  },

  setRate: function(r) {
    this.rate = r;
    if (this.current) this.current.playbackRate = r;
  },

  setEnabled: function(on) {
    this.enabled = on;
    if (!on) this.stop();
  }
};

EX.AudioManager = AudioManager;

})();
