/* ═══════════════════════════════════════════════════════════════════
   VizPanel3D — Three.js 3D visualization mode (Stage 1 expansion)

   Creates a <canvas id="viz-3d"> inside #viz-wrap and manages the
   Three.js lifecycle. Activated when VizPanel.setMode("3d") is called.

   Plugin interface: lesson authors provide window.EXPLAINER_VIZ_3D with:
     init(canvasEl, vizConfig, THREE, renderer)  — build scene
     timelineAction(tl, method, params, t)        — GSAP-driven tweens
     dispose()                                    — cleanup (optional)
     _renderFn                                    — set by init(); called each frame

   Load order: after engine/viz-panel.js, before engine/init.js
   ═══════════════════════════════════════════════════════════════════ */
(function() {
"use strict";

var EX       = window.EX;
var EventBus = EX.EventBus;
var $        = EX.$;

var VizPanel3D = {
  _canvas:   null,
  _renderer: null,
  _rafId:    null,
  _active:   false,
  _ready:    false,   // Three.js loaded and scene initialised

  /* Called from init.js after VizPanel.init() — safe to access #viz-wrap */
  init: function() {
    if (!window.EXPLAINER_VIZ_3D) return;  // skip if no 3D plugin

    var self = this;

    // Create canvas, absolutely positioned over the SVG
    var canvas = document.createElement("canvas");
    canvas.id = "viz-3d";
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;" +
      "display:none;z-index:3;border-radius:0";
    $("viz-wrap").appendChild(canvas);
    this._canvas = canvas;

    // Show/hide on mode changes (viz-panel.js hides the SVG, we show the canvas)
    EventBus.on("viz:setMode", function(mode) {
      if (mode === "3d") {
        canvas.style.display = "block";
        self._active = true;
        if (!self._ready) self._loadAndInit();
      } else {
        canvas.style.display = "none";
        self._active = false;
      }
    });

    // Dispose on reset
    EventBus.on("viz:reset", function() {
      canvas.style.display = "none";
      self._active = false;
      self._disposeScene();
    });

    // Route viz:runActions to EXPLAINER_VIZ_3D when active
    EventBus.on("viz:runActions", function(data) {
      if (!self._active || !self._ready) return;
      var V3D = window.EXPLAINER_VIZ_3D;
      if (!V3D || !V3D.timelineAction) return;

      var actions = data.actions;
      if (data.instant) {
        var tl = gsap.timeline();
        actions.forEach(function(a) {
          var offset = a.offset || a.delay || 0;
          if (typeof offset === "string" && offset.charAt(0) === "+") {
            offset = parseFloat(offset.substring(1));
          }
          V3D.timelineAction(tl, a.method, a.params || {}, offset);
        });
        tl.progress(1);
      } else {
        var tl2 = data.timeline;
        var base = data.time || 0;
        actions.forEach(function(a) {
          var offset = a.offset || a.delay || 0;
          if (typeof offset === "string" && offset.charAt(0) === "+") {
            offset = parseFloat(offset.substring(1));
          }
          V3D.timelineAction(tl2, a.method, a.params || {}, base + offset);
        });
      }
    });
  },

  /* Dynamically import Three.js (ES module) then initialise the plugin */
  _loadAndInit: function() {
    var self = this;
    var V3D  = window.EXPLAINER_VIZ_3D;
    if (!V3D) return;

    import("https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.min.js")
      .then(function(THREE) {
        var canvas = self._canvas;
        var w = canvas.clientWidth  || 400;
        var h = canvas.clientHeight || 400;

        var renderer = new THREE.WebGLRenderer({
          canvas: canvas,
          antialias: true,
          alpha: false
        });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x0f0e17, 1);
        self._renderer = renderer;

        // Resize renderer when viz panel resizes
        var ro = null;
        if (window.ResizeObserver) {
          ro = new ResizeObserver(function() {
            var nw = canvas.clientWidth  || 400;
            var nh = canvas.clientHeight || 400;
            renderer.setSize(nw, nh);
          });
          ro.observe($("viz-wrap"));
        }

        // Hand THREE + renderer to the plugin
        var vizConfig = window._graph ? window._graph.vizConfig : {};
        V3D.init(canvas, vizConfig, THREE, renderer);

        self._ready = true;
        self._startLoop(renderer, V3D);
      })
      .catch(function(e) {
        console.error("[VizPanel3D] Failed to load Three.js:", e);
      });
  },

  _startLoop: function(renderer, V3D) {
    var self = this;
    function loop() {
      self._rafId = requestAnimationFrame(loop);
      if (V3D._renderFn && self._active) {
        V3D._renderFn(renderer);
      }
    }
    loop();
  },

  _disposeScene: function() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    var V3D = window.EXPLAINER_VIZ_3D;
    if (V3D && V3D.dispose) V3D.dispose();
    if (this._renderer) {
      this._renderer.dispose();
      this._renderer = null;
    }
    this._ready = false;
  }
};

EX.VizPanel3D = VizPanel3D;

})();
