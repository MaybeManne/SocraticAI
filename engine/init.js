/* ═══════════════════════════════════════════════════════════════════
   Init v2 — Wires all modules together and boots the lesson

   Load order: core → notebook → viz-panel → audio → subtitles →
               cards → gates → controls → scroll-sync → init
   ═══════════════════════════════════════════════════════════════════ */
(function() {
"use strict";

var EX = window.EX;
var EventBus = EX.EventBus;
var $ = EX.$;
var K = EX.K;

var L = window.LESSON;
if (!L) { console.error("No LESSON data found"); return; }

// Apply language/direction from lesson metadata
if (L.meta && L.meta.lang) {
  document.documentElement.lang = L.meta.lang;
}
if (L.meta && L.meta.dir) {
  document.documentElement.dir = L.meta.dir;
}

// ── Build the LessonGraph ──
var graph = new EX.LessonGraph(L);
window._graph = graph;

// ── Build the PlaybackState ──
var state = new EX.PlaybackState(graph);
window._state = state;

// ── Viz Plugin management ──
var VizManager = {
  plugin: null,
  init: function() {
    var V = window.EXPLAINER_VIZ;
    if (V && graph.vizConfig) {
      var config = graph.vizConfig.config || graph.vizConfig;
      V.init($("viz"), config);
      this.plugin = V;
    }
  },
  reinit: function() {
    var V = window.EXPLAINER_VIZ;
    if (V && graph.vizConfig) {
      var config = graph.vizConfig.config || graph.vizConfig;
      V.init($("viz"), config);
      this.plugin = V;
    }
  }
};

// Wire viz action events
EventBus.on("viz:runActions", function(data) {
  if (!VizManager.plugin) return;
  var actions = data.actions;
  var plugin = VizManager.plugin;
  if (!plugin.timelineAction) {
    console.warn("[Viz] Plugin has no timelineAction method — .do() calls will be ignored");
    return;
  }
  function runAction(a, tl, baseTime) {
    var offset = a.offset || a.delay || 0;
    if (typeof offset === "string" && offset.charAt(0) === "+") offset = parseFloat(offset.substring(1));
    var before = tl.getChildren().length;
    plugin.timelineAction(tl, a.method, a.params || {}, baseTime + offset);
    if (tl.getChildren().length === before) {
      console.warn("[Viz] Method \"" + a.method + "\" added no tweens — is the method name correct?");
    }
  }
  if (data.instant) {
    var instantTl = gsap.timeline();
    actions.forEach(function(a) { runAction(a, instantTl, 0); });
    instantTl.progress(1);
  } else {
    var tl = data.timeline;
    var baseTime = data.time || 0;
    actions.forEach(function(a) { runAction(a, tl, baseTime); });
  }
});

EventBus.on("viz:reset", function() {
  // Kill ALL tweens targeting old SVG elements BEFORE removing them,
  // so GSAP doesn't hold stale references from previous play sessions.
  var oldEls = Array.prototype.slice.call($("viz").querySelectorAll("*"));
  oldEls.forEach(function(el) {
    gsap.killTweensOf(el);
  });

  // Clear SVG, THEN rebuild from scratch
  EX.VizPanel.reset();
  VizManager.reinit();

  // Flush any GSAP entry animations the plugin started during init so that
  // snapshotAct() captures the correct final state rather than opacity:0.
  var newEls = Array.prototype.slice.call($("viz").querySelectorAll("*"));
  newEls.forEach(function(el) {
    gsap.getTweensOf(el).forEach(function(t) { t.progress(1); });
  });
});

// ── Initialize all modules ──
document.title = (L.meta.source || "") + " \u2014 " + (L.meta.title || "Math Explainer");

EX.Notebook.init();
EX.VizPanel.init(graph.vizConfig);
EX.Subtitles.init(graph);
EX.AudioManager.init(graph);
VizManager.init();
if (window.EXPLAINER_VIZ_3D && EX.VizPanel3D) {
  EX.VizPanel3D.init();
}
EX.ScrollSync.init();
EX.CardSystem.init();
EX.GateSystem.init();
EX.Orchestrator.init(graph, state);
EX.PlayerControls.init(graph, state);

// ── Render problem bar ──
if (L.problem) {
  var bar = $("problem-bar");
  bar.innerHTML = "";
  bar.classList.add("hero");

  if (L.meta && L.meta.source) {
    var src = document.createElement("div");
    src.className = "problem-source";
    src.textContent = L.meta.source;
    bar.appendChild(src);
  }

  var textDiv = document.createElement("div");
  textDiv.className = "problem-text";
  K.mixed(L.problem.text, textDiv);
  bar.appendChild(textDiv);

  if (L.problem.highlight) {
    var hl = document.createElement("span");
    hl.className = "problem-highlight";
    hl.textContent = L.problem.highlight;
    bar.appendChild(hl);
  }

  gsap.fromTo(bar, { opacity: 0 }, { opacity: 1, duration: 0.6 });

  window._collapseHero = function() {
    if (!bar.classList.contains("hero")) return;
    bar.classList.remove("hero");
    bar.innerHTML = "";
    K.mixed(L.problem.text, bar);
    if (L.problem.highlight) {
      var hl2 = document.createElement("span");
      hl2.className = "problem-highlight";
      hl2.textContent = " " + L.problem.highlight;
      bar.appendChild(hl2);
    }
    gsap.fromTo(bar, { opacity: 0.5, y: -8 }, { opacity: 1, y: 0, duration: 0.4 });
  };
}

// ── Script export (for TTS pipeline) ──
window.exportScripts = function() {
  var scripts = [];
  function processAct(act, isBranch) {
    var fullScript = act.beats.map(function(b) { return b.say; }).filter(Boolean).join(" ");
    if (fullScript) {
      scripts.push({
        actId: act.id,
        title: act.title,
        text: fullScript,
        branch: isBranch || false,
        beatScripts: act.beats.map(function(b) { return { beatId: b.id, say: b.say || "" }; })
      });
    }
  }
  L.acts.forEach(function(a) { processAct(a, false); });
  for (var k in L.branchActs) { processAct(L.branchActs[k], true); }
  console.log("=== NARRATION SCRIPTS ===");
  console.log(JSON.stringify(scripts, null, 2));
  return scripts;
};

})();
