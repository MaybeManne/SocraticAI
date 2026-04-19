/* ═══════════════════════════════════════════════════════════════════
   Card System v2 — Card type factories for beat rendering

   Listens for "beat:render" events and creates the appropriate
   notebook card based on the beat's card type.
   ═══════════════════════════════════════════════════════════════════ */
(function() {
"use strict";

var EX = window.EX;
var EventBus = EX.EventBus;
var K = EX.K;
var $ = EX.$;

function beatCard(beatId, type) {
  var el = document.createElement("div");
  el.className = "beat-card beat-card--" + type;
  el.dataset.beatId = beatId;
  return el;
}

var CardSystem = {
  factories: {},

  init: function() {
    var self = this;
    EventBus.on("beat:render", function(data) {
      self.renderBeat(data.beat);
    });
  },

  renderBeat: function(beat) {
    if (!beat.card) return null;
    var factory = this.factories[beat.card.type];
    if (!factory) {
      console.warn("[CardSystem] No factory for type: " + beat.card.type);
      return null;
    }
    var el = factory(beat.id, beat.card);
    if (el) {
      EventBus.emit("notebook:appendBeat", { beatId: beat.id, element: el });
      EventBus.emit("scroll:observe", { element: el });
    }
    return el;
  }
};

// ── Card: text ──
CardSystem.factories.text = function(id, data) {
  var el = beatCard(id, "text");
  var div = document.createElement("div"); div.className = "slide-text";
  K.mixed(data.content, div);
  el.appendChild(div);
  return el;
};

// ── Card: latex ──
CardSystem.factories.latex = function(id, data) {
  var el = beatCard(id, "derivation");
  var row = document.createElement("div");
  row.className = "deriv-step visible" + (data.highlight ? " highlight" : "");
  K.display(data.content || data.latex, row);
  el.appendChild(row);
  return el;
};

// ── Card: derivation ──
CardSystem.factories.derivation = function(id, data) {
  var el = beatCard(id, "derivation");
  if (data.title) {
    var t = document.createElement("div"); t.className = "derivation-title"; t.textContent = data.title;
    el.appendChild(t);
  }
  var steps = data.steps || [];
  steps.forEach(function(step) {
    var s = typeof step === "string" ? { latex: step } : step;
    var row = document.createElement("div");
    row.className = "deriv-step visible" + (s.highlight ? " highlight" : "") + (s.wrong ? " wrong" : "");
    // Accept both `latex` (canonical) and `expr` (DSL shorthand)
    K.display(s.latex || s.expr || "", row);
    if (s.note) {
      var noteEl = document.createElement("span");
      noteEl.style.cssText = "font-size:.75rem;color:var(--text-muted);margin-left:10px;font-style:italic";
      K.mixed(s.note, noteEl);
      row.appendChild(noteEl);
    }
    el.appendChild(row);
  });
  return el;
};

// ── Card: title ──
CardSystem.factories.title = function(id, data) {
  var overlay = $("title-overlay");
  // Cancel any pending hide from a prior render of this overlay
  clearTimeout(overlay._hideTimeout);
  gsap.killTweensOf(overlay);
  var oldItems = overlay.querySelectorAll("h1,h2,p");
  for (var j = 0; j < oldItems.length; j++) gsap.killTweensOf(oldItems[j]);

  var content = overlay.querySelector(".title-content");
  content.innerHTML = "";
  var h1 = document.createElement("h1"); h1.textContent = data.heading; content.appendChild(h1);
  var h2 = document.createElement("h2"); h2.textContent = data.subheading || ""; content.appendChild(h2);
  if (data.paragraphs) data.paragraphs.forEach(function(p) {
    var el = document.createElement("p");
    if (typeof p === "string") { el.textContent = p; }
    else { el.textContent = p.text; if (p.style === "highlight") { el.style.color = "#818cf8"; el.style.fontWeight = "500"; } }
    content.appendChild(el);
  });
  overlay.classList.add("active");
  gsap.to(overlay, { opacity: 1, duration: 0.5 });
  var items = overlay.querySelectorAll("h1,h2,p");
  for (var i = 0; i < items.length; i++) {
    gsap.fromTo(items[i], { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.3 + i * 0.8 });
  }
  overlay._hideTimeout = setTimeout(function() {
    gsap.to(overlay, { opacity: 0, duration: 0.6, onComplete: function() { overlay.classList.remove("active"); } });
  }, 4000);
  return null;
};

// ── Card: figure ──
CardSystem.factories.figure = function(id, data) {
  if (data.svg || data.caption) {
    EX.VizPanel.showFigure(data);
  }
  if (data.caption) {
    var el = beatCard(id, "text");
    var div = document.createElement("div"); div.className = "slide-text";
    K.mixed(data.caption, div);
    el.appendChild(div);
    return el;
  }
  return null;
};

// ── Card: recap ──
CardSystem.factories.recap = function(id, data) {
  var el = beatCard(id, "recap");
  el.classList.add("slide-card--recap");
  var header = document.createElement("div"); header.className = "recap-header";
  var h4 = document.createElement("h4"); h4.textContent = data.title || "Quick Review";
  header.appendChild(h4);
  var chev = document.createElement("span"); chev.className = "recap-chevron"; chev.innerHTML = "&#9660;";
  header.appendChild(chev);
  el.appendChild(header);
  var body = document.createElement("div"); body.className = "recap-body";
  // Accept `items: [string, ...]` (DSL shorthand) or `content: [{type,value}, ...]` (canonical)
  var rawItems = data.items || data.content || [];
  var content = rawItems.map(function(item) {
    if (typeof item === "string") return { type: "text", value: item };
    return item;
  });
  content.forEach(function(item) {
    if (typeof item === "string") item = { type: "text", value: item };
    if (item.type === "text") {
      var p = document.createElement("p"); K.mixed(item.value, p); body.appendChild(p);
    } else if (item.type === "latex") {
      var d = document.createElement("div");
      if (item.display) K.display(item.value, d); else K.inline(item.value, d);
      body.appendChild(d);
    } else if (item.type === "example") {
      var ex = document.createElement("div");
      ex.style.cssText = "background:rgba(99,102,241,0.06);border-left:3px solid #6366f1;padding:8px 12px;border-radius:6px;margin:6px 0";
      K.mixed(item.value, ex);
      body.appendChild(ex);
    } else if (item.type === "step") {
      var step = document.createElement("div");
      step.style.cssText = "display:flex;gap:8px;align-items:baseline;margin:4px 0";
      var num = document.createElement("span");
      num.style.cssText = "color:#818cf8;font-weight:600;font-size:.9rem;flex-shrink:0";
      num.textContent = (item.num || "") + ".";
      step.appendChild(num);
      var txt = document.createElement("span");
      K.mixed(item.value, txt);
      step.appendChild(txt);
      body.appendChild(step);
    }
  });
  el.appendChild(body);
  header.addEventListener("click", function() {
    body.classList.toggle("open");
    chev.classList.toggle("open");
  });
  setTimeout(function() { body.classList.add("open"); chev.classList.add("open"); }, 300);
  if (data.figure) EX.VizPanel.showFigure(data.figure);
  return el;
};

// ── Card: bar-chart ──
CardSystem.factories["bar-chart"] = function(id, data) {
  // Normalise shorthand format: `labels`+`values` → `bars` array
  var bars = data.bars;
  if (!bars && data.labels && data.values) {
    bars = data.labels.map(function(lbl, i) {
      return { label: lbl, value: data.values[i] || 0 };
    });
  }
  bars = bars || [];

  var el = beatCard(id, "bar-chart");
  el.classList.add("slide-card--bar-chart");
  var t = document.createElement("div"); t.className = "chart-title"; t.textContent = data.title;
  el.appendChild(t);
  var maxH = 60;
  var row = document.createElement("div"); row.className = "bar-row";
  var maxVal = data.maxValue || (bars.length ? Math.max.apply(null, bars.map(function(b) { return b.value; })) : 1);
  if (!maxVal) maxVal = 1; // guard against all-zero data
  bars.forEach(function(b, i) {
    var col = document.createElement("div"); col.className = "bar-col";
    var val = document.createElement("div"); val.className = "bar-val"; val.textContent = b.display !== undefined ? b.display : b.value;
    var fill = document.createElement("div"); fill.className = "bar-fill";
    fill.style.background = data.colors ? data.colors[i % data.colors.length] : "#818cf8";
    fill.style.height = "0";
    fill.dataset.target = Math.round(b.value / maxVal * maxH);
    var lab = document.createElement("div"); lab.className = "bar-label";
    K.mixed(String(b.label || ""), lab);
    col.appendChild(val); col.appendChild(fill); col.appendChild(lab);
    row.appendChild(col);
  });
  el.appendChild(row);
  if (data.pattern) {
    var pat = document.createElement("div"); pat.className = "chart-pattern";
    K.mixed(data.pattern, pat);
    el.appendChild(pat);
  }
  // Pass normalised bars so VizPanel doesn't crash on the old labels/values format
  EX.VizPanel.showChart(Object.assign({}, data, { bars: bars, maxValue: maxVal }));
  setTimeout(function() {
    var fills = el.querySelectorAll(".bar-fill");
    fills.forEach(function(f, i) {
      setTimeout(function() { f.style.height = f.dataset.target + "px"; }, 300 + i * 300);
    });
  }, 100);
  return el;
};

// ── Card: split ──
CardSystem.factories.split = function(id, data) {
  var el = beatCard(id, "split");
  if (data.title) {
    var t = document.createElement("div"); t.className = "derivation-title"; t.textContent = data.title;
    el.appendChild(t);
  }

  // Two-column layout: accept `left`/`right` panel objects
  if (data.left || data.right) {
    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:12px;align-items:stretch";
    [data.left, data.right].forEach(function(panel) {
      if (!panel) return;
      var col = document.createElement("div");
      col.style.cssText = "flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--card-bg)";
      if (panel.type === "latex" || panel.type === "derivation") {
        K.display(panel.content || panel.latex || "", col);
      } else if (panel.type === "text") {
        K.mixed(panel.content || panel.text || "", col);
      } else if (panel.content) {
        K.mixed(panel.content, col);
      }
      row.appendChild(col);
    });
    el.appendChild(row);
    return el;
  }

  // Legacy flat format: `content`, `latex`, `text` properties on data itself
  var c = data.content || data;
  if (c.latex) {
    var d = document.createElement("div"); d.className = "deriv-step highlight visible";
    K.display(c.latex, d); el.appendChild(d);
  }
  if (c.text) {
    var p = document.createElement("div"); p.className = "slide-text"; p.style.marginTop = "8px";
    K.mixed(c.text, p); el.appendChild(p);
  }
  return el;
};

// ── Card: plot-2d ──
CardSystem.factories["plot-2d"] = function(id, data) {
  var el = beatCard(id, "plot-2d");
  if (data.title) {
    var t = document.createElement("div"); t.className = "plot-title"; t.textContent = data.title;
    el.appendChild(t);
  }
  var W = 360, H = 210;
  var pad = { t: 16, r: 20, b: 32, l: 40 };
  var pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  var ns = "http://www.w3.org/2000/svg";

  // Resolve axis bounds — accept xRange/yRange (DSL) or xMin/xMax/yMin/yMax (canonical)
  var xMin = data.xMin !== undefined ? data.xMin : (data.xRange ? data.xRange[0] : 0);
  var xMax = data.xMax !== undefined ? data.xMax : (data.xRange ? data.xRange[1] : 10);
  var yMin = data.yMin !== undefined ? data.yMin : (data.yRange ? data.yRange[0] : 0);
  var yMax = data.yMax !== undefined ? data.yMax : (data.yRange ? data.yRange[1] : 10);
  // If only points are provided, infer bounds from them
  var pts = data.points || [];
  if (!data.xRange && !data.xMin && pts.length) {
    xMin = Math.min.apply(null, pts.map(function(p){ return p.x; }));
    xMax = Math.max.apply(null, pts.map(function(p){ return p.x; }));
    var xPad = (xMax - xMin) * 0.1 || 1;
    xMin -= xPad; xMax += xPad;
  }
  if (!data.yRange && !data.yMin && pts.length) {
    yMin = Math.min.apply(null, pts.map(function(p){ return p.y; }));
    yMax = Math.max.apply(null, pts.map(function(p){ return p.y; }));
    var yPad = (yMax - yMin) * 0.15 || 1;
    yMin -= yPad; yMax += yPad;
  }
  // Guard: ensure valid, non-degenerate range
  if (xMax <= xMin) xMax = xMin + 1;
  if (yMax <= yMin) yMax = yMin + 1;

  var xSpan = xMax - xMin, ySpan = yMax - yMin;

  function sx(v) { return pad.l + (v - xMin) / xSpan * pw; }
  function sy(v) { return pad.t + ph - (v - yMin) / ySpan * ph; }

  var svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.setAttribute("class", "plot-svg");

  // Grid lines + axis labels for y
  var yStep = data.yStep || Math.max(1, Math.ceil(ySpan / 5));
  var yStepMag = Math.pow(10, Math.floor(Math.log10(yStep)));
  yStep = Math.ceil(yStep / yStepMag) * yStepMag;
  if (yStep <= 0) yStep = 1; // safety: prevent infinite loop
  var yStart = Math.ceil(yMin / yStep) * yStep;
  for (var yv = yStart; yv <= yMax + 1e-9; yv += yStep) {
    var gl = document.createElementNS(ns, "line");
    gl.setAttribute("x1", pad.l); gl.setAttribute("x2", W - pad.r);
    gl.setAttribute("y1", sy(yv).toFixed(1)); gl.setAttribute("y2", sy(yv).toFixed(1));
    gl.setAttribute("class", "plot-grid-line");
    svg.appendChild(gl);
    var yl = document.createElementNS(ns, "text");
    yl.setAttribute("x", pad.l - 5); yl.setAttribute("y", (sy(yv) + 3).toFixed(1));
    yl.setAttribute("text-anchor", "end"); yl.setAttribute("class", "plot-axis-text");
    yl.textContent = Math.round(yv * 100) / 100;
    svg.appendChild(yl);
  }

  // x-axis ticks — use xTicks if provided, otherwise generate
  var xTicks = data.xTicks;
  if (!xTicks) {
    var xStep = Math.max(1, Math.ceil(xSpan / 6));
    var xStepMag = Math.pow(10, Math.floor(Math.log10(xStep)));
    xStep = Math.ceil(xStep / xStepMag) * xStepMag;
    if (xStep <= 0) xStep = 1;
    xTicks = [];
    var xStart = Math.ceil(xMin / xStep) * xStep;
    for (var xv = xStart; xv <= xMax + 1e-9; xv += xStep) xTicks.push(Math.round(xv * 100) / 100);
  }
  xTicks.forEach(function(xv) {
    var xl = document.createElementNS(ns, "text");
    xl.setAttribute("x", sx(xv).toFixed(1)); xl.setAttribute("y", H - pad.b + 14);
    xl.setAttribute("text-anchor", "middle"); xl.setAttribute("class", "plot-axis-text");
    xl.textContent = xv;
    svg.appendChild(xl);
  });

  if (data.xLabel) {
    var xLab = document.createElementNS(ns, "text");
    xLab.setAttribute("x", pad.l + pw / 2); xLab.setAttribute("y", H - 2);
    xLab.setAttribute("text-anchor", "middle"); xLab.setAttribute("class", "plot-label-text");
    xLab.textContent = data.xLabel; svg.appendChild(xLab);
  }
  if (data.yLabel) {
    var yLab = document.createElementNS(ns, "text");
    yLab.setAttribute("x", 10); yLab.setAttribute("y", pad.t + ph / 2);
    yLab.setAttribute("text-anchor", "middle"); yLab.setAttribute("class", "plot-label-text");
    yLab.setAttribute("transform", "rotate(-90,10," + (pad.t + ph / 2) + ")");
    yLab.textContent = data.yLabel; svg.appendChild(yLab);
  }

  // Draw zero axes if visible
  if (yMin <= 0 && 0 <= yMax) {
    var xAxis = document.createElementNS(ns, "line");
    xAxis.setAttribute("x1", pad.l); xAxis.setAttribute("x2", W - pad.r);
    xAxis.setAttribute("y1", sy(0).toFixed(1)); xAxis.setAttribute("y2", sy(0).toFixed(1));
    xAxis.setAttribute("stroke", "rgba(255,255,255,0.2)"); xAxis.setAttribute("stroke-width", "1");
    svg.appendChild(xAxis);
  }
  if (xMin <= 0 && 0 <= xMax) {
    var yAxis = document.createElementNS(ns, "line");
    yAxis.setAttribute("x1", sx(0).toFixed(1)); yAxis.setAttribute("x2", sx(0).toFixed(1));
    yAxis.setAttribute("y1", pad.t); yAxis.setAttribute("y2", H - pad.b);
    yAxis.setAttribute("stroke", "rgba(255,255,255,0.2)"); yAxis.setAttribute("stroke-width", "1");
    svg.appendChild(yAxis);
  }

  // Threshold line
  if (data.threshold) {
    var tl2 = document.createElementNS(ns, "line");
    tl2.setAttribute("x1", pad.l); tl2.setAttribute("x2", W - pad.r);
    tl2.setAttribute("y1", sy(data.threshold.value).toFixed(1)); tl2.setAttribute("y2", sy(data.threshold.value).toFixed(1));
    tl2.setAttribute("class", "plot-threshold-line"); svg.appendChild(tl2);
    var tlb = document.createElementNS(ns, "text");
    tlb.setAttribute("x", W - pad.r + 4); tlb.setAttribute("y", (sy(data.threshold.value) + 3).toFixed(1));
    tlb.setAttribute("class", "plot-threshold-text"); tlb.textContent = data.threshold.label;
    svg.appendChild(tlb);
  }

  // Function curves — accept `functions: [{fn, color, name, style}]`
  var allPaths = [];
  (data.functions || []).forEach(function(fnDef) {
    try {
      var fn = new Function("x", "return (" + fnDef.fn + ");");
      var steps = 200;
      var dx = xSpan / steps;
      var d = "";
      for (var i = 0; i <= steps; i++) {
        var x = xMin + i * dx;
        var y = fn(x);
        if (!isFinite(y)) { d += " "; continue; } // break path on asymptotes
        var px = sx(x).toFixed(1), py = sy(Math.max(yMin - ySpan, Math.min(yMax + ySpan, y))).toFixed(1);
        d += (d === "" || d.slice(-1) === " " ? "M" : "L") + px + "," + py;
      }
      if (d && d !== " ") {
        var curve = document.createElementNS(ns, "path");
        curve.setAttribute("d", d);
        curve.setAttribute("fill", "none");
        curve.setAttribute("stroke", fnDef.color || "#818cf8");
        curve.setAttribute("stroke-width", "2");
        if (fnDef.style === "dashed") curve.setAttribute("stroke-dasharray", "4 3");
        svg.appendChild(curve);
        allPaths.push(curve);
      }
    } catch(e) { /* skip bad function */ }
  });

  // Legacy single-curve from points array
  var dotsG = document.createElementNS(ns, "g");
  var path = null;
  if (pts.length) {
    var pathD = "";
    pts.forEach(function(p, i) {
      pathD += (i === 0 ? "M" : "L") + sx(p.x).toFixed(1) + "," + sy(p.y).toFixed(1);
    });
    path = document.createElementNS(ns, "path");
    path.setAttribute("d", pathD);
    path.setAttribute("class", "plot-curve");
    svg.appendChild(path);
    allPaths.push(path);
    pts.forEach(function(p) {
      var dot = document.createElementNS(ns, "circle");
      dot.setAttribute("cx", sx(p.x).toFixed(1)); dot.setAttribute("cy", sy(p.y).toFixed(1));
      dot.setAttribute("r", p.highlight ? 5 : 3);
      dot.setAttribute("fill", p.color || (p.highlight ? "#f59e0b" : "#818cf8"));
      dot.setAttribute("class", "plot-dot" + (p.highlight ? " highlight" : ""));
      dotsG.appendChild(dot);
      if (p.label) {
        var lb = document.createElementNS(ns, "text");
        lb.setAttribute("x", sx(p.x).toFixed(1));
        lb.setAttribute("y", (sy(p.y) - 8).toFixed(1));
        lb.setAttribute("text-anchor", "middle");
        lb.setAttribute("class", "plot-dot-text" + (p.highlight ? " highlight" : ""));
        lb.textContent = p.label;
        dotsG.appendChild(lb);
      }
    });
  }
  svg.appendChild(dotsG);
  el.appendChild(svg);

  if (data.note) {
    var note = document.createElement("div"); note.className = "plot-note";
    K.mixed(data.note, note);
    el.appendChild(note);
  }
  setTimeout(function() {
    allPaths.forEach(function(p) {
      try {
        var len = p.getTotalLength ? p.getTotalLength() : 500;
        if (len > 0) {
          p.style.strokeDasharray = len;
          p.style.strokeDashoffset = len;
          p.getBoundingClientRect();
          p.style.transition = "stroke-dashoffset 1.5s ease";
          p.style.strokeDashoffset = "0";
        }
      } catch(e) {}
    });
    var items = dotsG.children;
    for (var i = 0; i < items.length; i++) {
      (function(item, idx) {
        setTimeout(function() { item.style.transition = "opacity .3s"; item.style.opacity = "1"; }, 400 + idx * 100);
      })(items[i], i);
    }
  }, 200);
  return el;
};

EX.CardSystem = CardSystem;

})();
