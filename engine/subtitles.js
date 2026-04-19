/* ═══════════════════════════════════════════════════════════════════
   Subtitle Manager v2 — Per-act subtitle rendering with word highlight
   ═══════════════════════════════════════════════════════════════════ */
(function() {
"use strict";

var EX = window.EX;
var EventBus = EX.EventBus;
var $ = EX.$;

var Subtitles = {
  track: null,
  cues: [],
  currentIdx: -1,
  enabled: true,
  _graph: null,

  init: function(graph) {
    this.track = $("subtitle-track");
    this._graph = graph;
    this._bindEvents();
  },

  _bindEvents: function() {
    var self = this;
    EventBus.on("subtitles:load", function(data) {
      self.loadAct(data.actId, data.beats);
    });
    EventBus.on("playback:tick", function(data) {
      self.update(data.time);
    });
    EventBus.on("audio:stop", function() { self.hide(); });
    // Hide subtitles when a gate takes over — otherwise the last cue from
    // the preceding act stays frozen on screen while the student answers.
    EventBus.on("gate:enter", function() { self.hide(); });
    EventBus.on("audio:pause", function() { self.hide(); });
  },

  loadAct: function(actId, beats) {
    // Try TTS pipeline subtitles first
    if (this._graph && this._graph.subtitles && this._graph.subtitles[actId]) {
      this.cues = this._graph.subtitles[actId];
      this.currentIdx = -1;
      this.hide();
      return;
    }

    // Auto-generate cues from beats
    this.cues = [];
    if (!beats) { this.currentIdx = -1; return; }

    // Build beat cues for timing
    var WPS = 2.5;
    var cursor = 0;
    for (var i = 0; i < beats.length; i++) {
      var beat = beats[i];
      if (!beat.say) continue;
      var words = beat.say.split(/\s+/).length;
      var dur = beat.duration || Math.max(1.5, words / WPS);
      var startTime = cursor;
      var endTime = cursor + dur;

      // Split into sentences for subtitle display
      var sentences = beat.say.match(/[^.!?]+[.!?]+/g) || [beat.say];
      var sentDur = dur / sentences.length;
      for (var s = 0; s < sentences.length; s++) {
        this.cues.push({
          start: startTime + s * sentDur,
          end: startTime + (s + 1) * sentDur,
          text: sentences[s].trim()
        });
      }
      cursor += dur;
    }
    this.currentIdx = -1;
    this.hide();
  },

  update: function(currentTime) {
    if (!this.enabled || !this.cues.length) return;
    var t = currentTime;
    var newIdx = -1;
    for (var i = 0; i < this.cues.length; i++) {
      if (t >= this.cues[i].start && t < this.cues[i].end) { newIdx = i; break; }
    }
    if (newIdx !== this.currentIdx) {
      this.currentIdx = newIdx;
      if (newIdx >= 0) {
        var cue = this.cues[newIdx];
        if (cue.words) {
          this._renderWords(cue, t);
        } else {
          this.track.textContent = cue.text;
        }
        this.track.classList.add("visible");
      } else {
        this.track.classList.remove("visible");
      }
    } else if (newIdx >= 0 && this.cues[newIdx].words) {
      this._renderWords(this.cues[newIdx], t);
    }
  },

  _renderWords: function(cue, t) {
    var off = t - cue.start, html = "";
    for (var w = 0; w < cue.words.length; w++) {
      var word = cue.words[w];
      var next = w + 1 < cue.words.length ? cue.words[w + 1].offset : Infinity;
      html += (off >= word.offset && off < next)
        ? '<span class="active-word">' + word.word + "</span> "
        : word.word + " ";
    }
    this.track.innerHTML = html.trim();
  },

  hide: function() {
    if (this.track) this.track.classList.remove("visible");
    this.currentIdx = -1;
  },

  setEnabled: function(on) {
    this.enabled = on;
    if (!on) this.hide();
  }
};

EX.Subtitles = Subtitles;

})();
