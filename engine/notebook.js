/* ═══════════════════════════════════════════════════════════════════
   Notebook v2 — Card container, KaTeX helpers, FillIn validator

   Houses the shared KaTeX rendering utilities (K) and the FillIn
   validator since they're used by both cards and gates.
   ═══════════════════════════════════════════════════════════════════ */
(function() {
"use strict";

var EX = window.EX;
var EventBus = EX.EventBus;
var $ = EX.$;

/* ═══════════════════════════════════════════════════════════════════
   KaTeX Helper — shared rendering utilities
   ═══════════════════════════════════════════════════════════════════ */
var K = {
  inline: function(latex, el) {
    try { katex.render(latex, el, { throwOnError: false, displayMode: false }); }
    catch(e) { el.textContent = latex; }
  },
  display: function(latex, el) {
    try { katex.render(latex, el, { throwOnError: false, displayMode: true }); }
    catch(e) { el.textContent = latex; }
  },
  mixed: function(text, container) {
    // Fallback: content that is clearly LaTeX but missing $ delimiters
    // (e.g. "y(t) = v_{0y}t - \\frac{1}{2}gt^2") must never render as raw
    // backslash text — treat the whole string as display math.
    if (text.indexOf("$") === -1 &&
        /\\(frac|sqrt|sum|int|cdot|times|approx|geq|leq|neq|pi|theta|alpha|beta|Delta|infty|left|right)\b/.test(text)) {
      var dm = document.createElement("div");
      K.display(text, dm);
      container.appendChild(dm);
      return;
    }
    var parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$]+?\$)/g);
    parts.forEach(function(part) {
      if (part.indexOf("$$") === 0 && part.lastIndexOf("$$") === part.length - 2) {
        var d = document.createElement("div");
        K.display(part.slice(2, -2), d);
        container.appendChild(d);
      } else if (part.indexOf("$") === 0 && part.lastIndexOf("$") === part.length - 1 && part.length > 2) {
        var s = document.createElement("span");
        K.inline(part.slice(1, -1), s);
        container.appendChild(s);
      } else if (part) {
        var html = part.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
        var s = document.createElement("span");
        s.innerHTML = html;
        container.appendChild(s);
      }
    });
  },
  renderWithBlank: function(text, container, blankCfg) {
    var parts = text.split("[___]");
    for (var i = 0; i < parts.length; i++) {
      if (parts[i]) K.mixed(parts[i], container);
      if (i < parts.length - 1) {
        var inp = document.createElement("input");
        inp.type = "text";
        inp.className = "fill-blank";
        inp.style.width = (blankCfg.width || 70) + "px";
        inp.placeholder = blankCfg.placeholder || "?";
        container.appendChild(inp);
      }
    }
  }
};

/* ═══════════════════════════════════════════════════════════════════
   FillIn Validator
   ═══════════════════════════════════════════════════════════════════ */
var FillIn = {
  normalize: function(s) {
    s = s.trim().toLowerCase().replace(/\s+/g, "");
    s = s.replace(/\\pi/g, "\u03c0").replace(/pi/gi, "\u03c0");
    s = s.replace(/\\times/g, "\u00d7").replace(/\*/g, "\u00d7");
    s = s.replace(/\\cdot/g, "\u00b7");
    s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1/$2");
    s = s.replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "");
    return s;
  },
  validate: function(input, accepted) {
    var n = FillIn.normalize(input);
    for (var i = 0; i < accepted.length; i++) {
      if (FillIn.normalize(accepted[i]) === n) return true;
    }
    return false;
  }
};

/* ═══════════════════════════════════════════════════════════════════
   Notebook — manages the right-panel card list
   ═══════════════════════════════════════════════════════════════════ */
var Notebook = {
  container: null,
  cards: {},

  init: function() {
    this.container = $("notebook");
    this._bindEvents();
    this._watchEmptiness();
  },

  /* Empty notebook = dead right column. Let the diagram take the full frame
     until the first card arrives (and again after notebook:clear). */
  _watchEmptiness: function() {
    var container = this.container;
    var stage = document.getElementById("stage");
    if (!stage || !container || typeof MutationObserver === "undefined") return;
    function sync() {
      stage.classList.toggle("nb-empty", container.children.length === 0);
    }
    new MutationObserver(sync).observe(container, { childList: true });
    sync();
  },

  _bindEvents: function() {
    var self = this;
    EventBus.on("notebook:appendBeat", function(data) {
      self.appendBeat(data.beatId, data.element);
    });
    EventBus.on("notebook:appendMilestone", function(data) {
      self.appendMilestone(data.milestoneId, data.element);
    });
    EventBus.on("notebook:clear", function() { self.clear(); });
    EventBus.on("beat:enter", function(data) {
      self.activate(data.beatId);
      if (window._state && window._state.phase === "playing") {
        EventBus.emit("scroll:toBeat", { beatId: data.beatId });
      }
    });
  },

  appendBeat: function(beatId, element) {
    if (this.cards[beatId]) return;
    element.dataset.beatId = beatId;
    this.cards[beatId] = element;
    this.container.appendChild(element);
    requestAnimationFrame(function() {
      element.classList.add("entered");
      element.classList.add("active");
    });
  },

  appendMilestone: function(milestoneId, element) {
    if (this.cards[milestoneId]) return;
    element.classList.add("milestone-card");
    element.dataset.milestoneId = milestoneId;
    this.cards[milestoneId] = element;
    this.container.appendChild(element);
    requestAnimationFrame(function() {
      element.classList.add("entered");
      element.classList.add("active");
    });
  },

  activate: function(id) {
    for (var k in this.cards) {
      var c = this.cards[k];
      c.classList.remove("active");
      if (c.classList.contains("entered")) c.classList.add("past");
    }
    if (this.cards[id]) {
      this.cards[id].classList.add("active");
      this.cards[id].classList.remove("past");
      this.cards[id].classList.add("entered");
    }
  },

  scrollTo: function(id) {
    var card = this.cards[id];
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  },

  clear: function() {
    this.container.innerHTML = "";
    this.cards = {};
  }
};

// Export
EX.K = K;
EX.FillIn = FillIn;
EX.Notebook = Notebook;

})();
