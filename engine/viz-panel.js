/* ═══════════════════════════════════════════════════════════════════
   VizPanel v2 — SVG panel management, inline migration, configurable viewBox

   Fixes from v1:
   - viewBox is configurable via LESSON.viz.viewBox (not hardcoded 500x500)
   - Inline migration is event-driven (not timeline-scheduled)
   - _svgToImage fallback: uses inline SVG element when rasterization fails
   ═══════════════════════════════════════════════════════════════════ */
(function() {
"use strict";

var EX = window.EX;
var $ = EX.$;
var EventBus = EX.EventBus;

var VizPanel = {
  vizWrap: null,
  mainSvg: null,
  overlayDiv: null,
  _viewBox: "0 0 500 500",

  init: function(vizConfig) {
    this.vizWrap = $("viz-wrap");
    this.mainSvg = $("viz");
    this.overlayDiv = document.createElement("div");
    this.overlayDiv.id = "viz-overlay";
    this.overlayDiv.style.cssText = "position:absolute;inset:0;z-index:5;display:none;flex-direction:column;align-items:center;justify-content:center;padding:20px";
    this.vizWrap.appendChild(this.overlayDiv);

    // Configurable viewBox — educator freedom
    if (vizConfig && vizConfig.viewBox) {
      this._viewBox = vizConfig.viewBox;
    } else if (vizConfig && vizConfig.config && vizConfig.config.viewBox) {
      this._viewBox = vizConfig.config.viewBox;
    }
    this.mainSvg.setAttribute("viewBox", this._viewBox);
    this._applyViewBoxClip();

    this._bindEvents();
  },

  _applyViewBoxClip: function() {
    var ns = "http://www.w3.org/2000/svg";
    var vb = this._viewBox.split(/[\s,]+/).map(Number);
    var x = vb[0] || 0, y = vb[1] || 0, w = vb[2] || 500, h = vb[3] || 500;
    var defs = this.mainSvg.querySelector("defs") || document.createElementNS(ns, "defs");
    if (!this.mainSvg.querySelector("defs")) this.mainSvg.appendChild(defs);
    var existing = defs.querySelector("#viz-clip");
    if (existing) existing.parentNode.removeChild(existing);
    var clip = document.createElementNS(ns, "clipPath");
    clip.setAttribute("id", "viz-clip");
    var rect = document.createElementNS(ns, "rect");
    rect.setAttribute("x", x); rect.setAttribute("y", y);
    rect.setAttribute("width", w); rect.setAttribute("height", h);
    clip.appendChild(rect);
    defs.appendChild(clip);
    this.mainSvg.setAttribute("clip-path", "url(#viz-clip)");
  },

  getViewBox: function() {
    return this._viewBox;
  },

  getViewBoxDimensions: function() {
    var parts = this._viewBox.split(/[\s,]+/).map(Number);
    return { x: parts[0] || 0, y: parts[1] || 0, width: parts[2] || 500, height: parts[3] || 500 };
  },

  _bindEvents: function() {
    var self = this;
    EventBus.on("viz:setMode", function(mode) { self.setMode(mode); });
    EventBus.on("viz:migrateInline", function(data) { self.migrateToNotebook(data.beatId, data.type); });
    // NOTE: viz:reset is handled by init.js which calls reset() THEN reinit()
    // in the correct order. Do NOT register a separate handler here.
  },

  reset: function() {
    // Clear SVG contents
    var svg = this.mainSvg;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    // Restore viewBox and clipping
    svg.setAttribute("viewBox", this._viewBox);
    this._applyViewBoxClip();
    // Reset overlay
    this.overlayDiv.style.display = "none";
    this.overlayDiv.innerHTML = "";
    this.setMode("svg");
  },

  setMode: function(mode) {
    mode = mode || "svg";
    var nb = $("notebook");
    switch (mode) {
      case "svg":
        this.mainSvg.style.display = "";
        this.overlayDiv.style.display = "none";
        this.vizWrap.style.display = "";
        nb.style.flex = "0 0 50%";
        break;
      case "chart":
      case "figure":
        this.mainSvg.style.display = "none";
        this.overlayDiv.style.display = "flex";
        this.overlayDiv.innerHTML = "";
        this.vizWrap.style.display = "";
        nb.style.flex = "0 0 50%";
        break;
      case "hidden":
        this.vizWrap.style.display = "none";
        nb.style.flex = "1 1 100%";
        break;
      case "wide":
        this.mainSvg.style.display = "";
        this.overlayDiv.style.display = "none";
        this.vizWrap.style.display = "";
        nb.style.flex = "0 0 42%";
        break;
      case "3d":
        this.mainSvg.style.display = "none";
        this.overlayDiv.style.display = "none";
        this.vizWrap.style.display = "";
        nb.style.flex = "0 0 42%";
        break;
    }
  },

  showFigure: function(figureData) {
    this.setMode("figure");
    var container = this.overlayDiv;
    container.innerHTML = "";
    if (figureData.title) {
      var t = document.createElement("div");
      t.className = "viz-overlay-title";
      t.textContent = figureData.title;
      container.appendChild(t);
    }
    if (figureData.svg) {
      var wrap = document.createElement("div");
      wrap.innerHTML = figureData.svg;
      container.appendChild(wrap);
    }
    if (figureData.caption) {
      var cap = document.createElement("div");
      cap.className = "viz-overlay-caption";
      EX.K.mixed(figureData.caption, cap);
      container.appendChild(cap);
    }
  },

  showChart: function(chartData) {
    this.setMode("chart");
    var container = this.overlayDiv;
    container.innerHTML = "";
    var t = document.createElement("div");
    t.className = "viz-overlay-title";
    t.textContent = chartData.title || "";
    container.appendChild(t);
    var row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:flex-end;gap:8px;height:140px;width:85%;max-width:400px";
    var colors = chartData.colors || ["#818cf8","#6366f1","#a78bfa","#7c3aed","#c4b5fd","#4f46e5","#8b5cf6","#6d28d9"];
    chartData.bars.forEach(function(b, i) {
      var col = document.createElement("div");
      col.style.cssText = "flex:1;display:flex;flex-direction:column;align-items:center;gap:4px";
      var val = document.createElement("div");
      val.className = "viz-overlay-bar-val";
      val.textContent = b.display || b.value;
      var fill = document.createElement("div");
      fill.style.cssText = "width:100%;border-radius:4px 4px 0 0;background:" + colors[i % colors.length] + ";height:0%;transition:height .6s cubic-bezier(.34,1.56,.64,1)";
      fill.dataset.target = Math.round(b.value / chartData.maxValue * 100);
      var lab = document.createElement("div");
      lab.className = "viz-overlay-bar-label";
      lab.textContent = b.label;
      col.appendChild(val); col.appendChild(fill); col.appendChild(lab);
      row.appendChild(col);
    });
    container.appendChild(row);
    if (chartData.pattern) {
      var pat = document.createElement("div");
      pat.className = "viz-overlay-pattern";
      EX.K.mixed(chartData.pattern, pat);
      container.appendChild(pat);
    }
    setTimeout(function() {
      row.querySelectorAll("[data-target]").forEach(function(f, i) {
        setTimeout(function() { f.style.height = f.dataset.target + "%"; }, i * 250);
      });
    }, 200);
  },

  /* Migrate current viz panel content into the notebook as an inline card.
     Strategy: always append synchronously (clone) first, then optionally
     upgrade to a rasterized image if the async conversion succeeds.
     This guarantees the inline content is visible immediately. */
  migrateToNotebook: function(beatId, type) {
    type = type || "auto";

    var useOverlay = (type === "figure" || type === "chart") ||
                     (type === "auto" && this.overlayDiv.style.display !== "none" && this.overlayDiv.children.length > 0);
    var useSvg = (type === "svg") ||
                 (type === "auto" && !useOverlay && this.mainSvg.style.display !== "none");

    if (useSvg) {
      // Immediately append SVG clone (synchronous, always works)
      this._appendInlineSvgClone(beatId);
    } else if (useOverlay && this.overlayDiv.children.length > 0) {
      // Clone overlay HTML directly — reliable, no async race
      this._appendOverlayClone(beatId);
    }
  },

  /* Clone the overlay (figure/chart) HTML directly into the notebook.
     Synchronous — no foreignObject/Canvas pipeline, no race conditions. */
  _appendOverlayClone: function(beatId) {
    var el = document.createElement("div");
    el.className = "beat-card beat-card--viz-inline viz-inline";
    var inner = document.createElement("div");
    inner.className = "viz-inline-content";
    inner.className = "viz-overlay-inner";
    // Deep clone overlay children
    for (var i = 0; i < this.overlayDiv.children.length; i++) {
      inner.appendChild(this.overlayDiv.children[i].cloneNode(true));
    }
    el.appendChild(inner);
    el.style.opacity = "1";
    el.style.transform = "none";
    EventBus.emit("notebook:appendBeat", { beatId: beatId + "-viz", element: el });
  },

  /* Rasterize SVG into a PNG image and append to the notebook.
     Canvas rasterization bypasses all SVG DOM issues (namespace, ID
     conflicts, GSAP state, sizing). Falls back to SVG data-URL <img>. */
  _inlineCounter: 0,
  _appendInlineSvgClone: function(beatId) {
    this._inlineCounter++;
    var vb = this._viewBox.split(/[\s,]+/).map(Number);
    var vw = vb[2] || 500, vh = vb[3] || 500;
    var scale = 2; // retina

    // 1. Clone from the LIVE SVG and bake GSAP state
    var clone = this.mainSvg.cloneNode(true);
    clone.removeAttribute("id");
    clone.setAttribute("viewBox", this._viewBox);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(vw));
    clone.setAttribute("height", String(vh));

    var origEls = this.mainSvg.querySelectorAll("*");
    var cloneEls = clone.querySelectorAll("*");
    for (var i = 0; i < origEls.length && i < cloneEls.length; i++) {
      var cs = origEls[i].style;
      if (cs.opacity !== "") cloneEls[i].setAttribute("opacity", cs.opacity);
      if (cs.strokeDashoffset !== "") cloneEls[i].setAttribute("stroke-dashoffset", cs.strokeDashoffset);
      if (cs.strokeDasharray !== "") cloneEls[i].setAttribute("stroke-dasharray", cs.strokeDasharray);
      if (cs.transform !== "" && cs.transform !== "none") cloneEls[i].setAttribute("transform", cs.transform);
      if (cs.fill !== "") cloneEls[i].setAttribute("fill", cs.fill);
      if (cs.stroke !== "") cloneEls[i].setAttribute("stroke", cs.stroke);
    }

    // 2. Serialize (IDs don't matter — this goes into an <img>, not the DOM)
    var svgStr = new XMLSerializer().serializeToString(clone);

    // 3. Build container immediately so notebook position is reserved
    var el = document.createElement("div");
    el.className = "beat-card beat-card--viz-inline viz-inline";
    // Set explicit height from viewBox aspect ratio so layout is stable before image loads
    var inner = document.createElement("div");
    inner.className = "viz-inline-content";
    inner.className = "viz-overlay-inner";
    el.appendChild(inner);
    // Make visible immediately — no GSAP fade that fights with CSS !important
    el.style.opacity = "1";
    el.style.transform = "none";
    EventBus.emit("notebook:appendBeat", { beatId: beatId + "-viz", element: el });

    // 4. Rasterize via Canvas → PNG
    var blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function() {
      try {
        var canvas = document.createElement("canvas");
        canvas.width = vw * scale;
        canvas.height = vh * scale;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, vw * scale, vh * scale);
        URL.revokeObjectURL(url);
        var pngImg = document.createElement("img");
        pngImg.src = canvas.toDataURL("image/png");
        pngImg.style.cssText = "width:100%;height:auto;display:block;border-radius:6px";
        inner.appendChild(pngImg);
      } catch(e) {
        console.warn("[VizPanel] Canvas rasterize failed, using SVG data URL:", e);
        URL.revokeObjectURL(url);
        var fallback = document.createElement("img");
        fallback.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgStr)));
        fallback.style.cssText = "width:100%;height:auto;display:block;border-radius:6px";
        inner.appendChild(fallback);
      }
    };
    img.onerror = function() {
      console.warn("[VizPanel] SVG blob load failed, using data URL fallback");
      URL.revokeObjectURL(url);
      var fallback = document.createElement("img");
      fallback.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgStr)));
      fallback.style.cssText = "width:100%;height:auto;display:block;border-radius:6px";
      inner.appendChild(fallback);
    };
    img.src = url;
  }
};

EX.VizPanel = VizPanel;

})();
