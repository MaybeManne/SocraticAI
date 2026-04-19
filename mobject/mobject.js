/* ═══════════════════════════════════════════════════════════════════
   Explainer Mobject System — Declarative SVG Scene Graph
   Provides: MX.circle, MX.rect, MX.line, MX.arrow, MX.arc, MX.polygon,
             MX.dot, MX.brace, MX.text, MX.tex, MX.group, MX.numberLine,
             MX.axes, MX.plot, MX.image
   ═══════════════════════════════════════════════════════════════════ */
(function() {
"use strict";

var MX = window.MX = window.MX || {};
var NS = "http://www.w3.org/2000/svg";

/* ── Helpers ── */
function svgEl(tag, attrs) {
  var e = document.createElementNS(NS, tag);
  if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function _id() { return "mx_" + (++_id._n); }
_id._n = 0;

MX._svgEl = svgEl;
MX._id = _id;

/* ═══════════════════════════════════════════════════════════════════
   Color Palette — 3B1B-inspired + dark-theme accents
   ═══════════════════════════════════════════════════════════════════ */
MX.C = MX.colors = {
  BLUE:       "#58C4DD", DARK_BLUE:   "#236B8E",
  TEAL:       "#5CD0B3", GREEN:       "#83C167",
  YELLOW:     "#FFFF00", GOLD:        "#F0AC5F",
  RED:        "#FC6255", MAROON:      "#C55F73",
  PURPLE:     "#9A72AC", PINK:        "#D147BD",
  WHITE:      "#FFFFFF", LIGHT_GRAY:  "#BBBBBB",
  GRAY:       "#888888", DARK_GRAY:   "#444444",
  // Theme accents (match existing CSS)
  INDIGO:     "#818cf8", VIOLET:      "#6366f1",
  LAVENDER:   "#c4b5fd", EMERALD:     "#34d399",
  AMBER:      "#f59e0b", CORAL:       "#f87171",
  BG:         "#0f0e17"
};

/* ═══════════════════════════════════════════════════════════════════
   Base Mobject
   ═══════════════════════════════════════════════════════════════════ */
class Mobject {
  constructor() {
    this.id = _id();
    this.el = svgEl("g", { id: this.id });
    this._x = 0; this._y = 0;
    this._sx = 1; this._sy = 1;
    this._rot = 0;
    this._op = 1;
    this.scene = null;
    this.parent = null;
    this._children = [];
  }

  /* ── GSAP-compatible property accessors ── */
  get x()        { return this._x; }
  set x(v)       { this._x = v; this._sync(); }
  get y()        { return this._y; }
  set y(v)       { this._y = v; this._sync(); }
  get scaleX()   { return this._sx; }
  set scaleX(v)  { this._sx = v; this._sync(); }
  get scaleY()   { return this._sy; }
  set scaleY(v)  { this._sy = v; this._sync(); }
  get rotation() { return this._rot; }
  set rotation(v){ this._rot = v; this._sync(); }
  get opacity()  { return this._op; }
  set opacity(v) { this._op = v; if (this.el) this.el.setAttribute("opacity", v); }
  // Uniform scale shortcut
  get scale()    { return this._sx; }
  set scale(v)   { this._sx = this._sy = v; this._sync(); }

  /* ── Chainable setters ── */
  moveTo(x, y)       { this._x = x; this._y = y; this._sync(); return this; }
  shift(dx, dy)      { this._x += dx; this._y += (dy || 0); this._sync(); return this; }
  scaleTo(s, sy)     { this._sx = s; this._sy = sy !== undefined ? sy : s; this._sync(); return this; }
  rotateTo(deg)      { this._rot = deg; this._sync(); return this; }
  setOpacity(o)      { this.opacity = o; return this; }
  setFill(c)         { this._setAttr("fill", c); return this; }
  setStroke(c, w)    { this._setAttr("stroke", c); if (w !== undefined) this._setAttr("stroke-width", w); return this; }
  setColor(c)        { return this.setFill(c); }

  /* ── Internal: set attribute on primary shape element ── */
  _setAttr(k, v) {
    var shape = this._shape || this.el.querySelector("*");
    if (shape) shape.setAttribute(k, v);
  }
  _getAttr(k) {
    var shape = this._shape || this.el.querySelector("*");
    return shape ? shape.getAttribute(k) : null;
  }

  // Expose fill/stroke as GSAP-animatable properties
  get fill()    { return this._getAttr("fill"); }
  set fill(v)   { this._setAttr("fill", v); }
  get stroke()  { return this._getAttr("stroke"); }
  set stroke(v) { this._setAttr("stroke", v); }
  get strokeWidth()  { return parseFloat(this._getAttr("stroke-width")) || 0; }
  set strokeWidth(v) { this._setAttr("stroke-width", v); }

  /* ── Transform sync ── */
  _sync() {
    if (!this.el) return;
    var t = "";
    if (this._x || this._y) t += "translate(" + this._x + "," + this._y + ") ";
    if (this._rot)           t += "rotate(" + this._rot + ") ";
    if (this._sx !== 1 || this._sy !== 1) t += "scale(" + this._sx + "," + this._sy + ")";
    this.el.setAttribute("transform", t.trim());
  }

  /* ── Geometry ── */
  getBBox() {
    try { return this.el.getBBox(); }
    catch(e) { return { x: this._x, y: this._y, width: 0, height: 0 }; }
  }
  getCenter() {
    var b = this.getBBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }
  getWidth()  { return this.getBBox().width; }
  getHeight() { return this.getBBox().height; }

  /* ── Clone ── */
  copy() {
    var c = new this.constructor();
    c.el = this.el.cloneNode(true);
    c.el.id = _id();
    c._x = this._x; c._y = this._y;
    c._sx = this._sx; c._sy = this._sy;
    c._rot = this._rot; c._op = this._op;
    c._shape = c.el.querySelector("*");
    return c;
  }

  /* ── Lifecycle ── */
  remove() {
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    return this;
  }
}

MX.Mobject = Mobject;

/* ═══════════════════════════════════════════════════════════════════
   Shape Primitives
   ═══════════════════════════════════════════════════════════════════ */

/* ── Circle ── */
class CircleMobject extends Mobject {
  constructor(opts) {
    super();
    opts = opts || {};
    var r = opts.radius || opts.r || 50;
    this._shape = svgEl("circle", {
      cx: 0, cy: 0, r: r,
      fill: opts.fill || "none",
      stroke: opts.stroke || MX.C.INDIGO,
      "stroke-width": opts.strokeWidth || 2,
      "fill-opacity": opts.fillOpacity !== undefined ? opts.fillOpacity : 1
    });
    this.el.appendChild(this._shape);
    if (opts.x !== undefined || opts.y !== undefined) this.moveTo(opts.x || 0, opts.y || 0);
  }
  get radius() { return parseFloat(this._shape.getAttribute("r")); }
  set radius(v) { this._shape.setAttribute("r", v); }
}

/* ── Dot ── */
class DotMobject extends Mobject {
  constructor(opts) {
    super();
    opts = opts || {};
    this._shape = svgEl("circle", {
      cx: 0, cy: 0, r: opts.radius || 4,
      fill: opts.fill || opts.color || MX.C.WHITE,
      stroke: "none"
    });
    this.el.appendChild(this._shape);
    if (opts.x !== undefined || opts.y !== undefined) this.moveTo(opts.x || 0, opts.y || 0);
  }
}

/* ── Rectangle ── */
class RectMobject extends Mobject {
  constructor(opts) {
    super();
    opts = opts || {};
    var w = opts.width || 100, h = opts.height || 60;
    var rx = opts.cornerRadius || opts.rx || 0;
    this._shape = svgEl("rect", {
      x: -w / 2, y: -h / 2, width: w, height: h,
      rx: rx, ry: rx,
      fill: opts.fill || "none",
      stroke: opts.stroke || MX.C.INDIGO,
      "stroke-width": opts.strokeWidth || 2
    });
    this.el.appendChild(this._shape);
    if (opts.x !== undefined || opts.y !== undefined) this.moveTo(opts.x || 0, opts.y || 0);
  }
  get width()  { return parseFloat(this._shape.getAttribute("width")); }
  set width(v) { this._shape.setAttribute("width", v); this._shape.setAttribute("x", -v / 2); }
  get height() { return parseFloat(this._shape.getAttribute("height")); }
  set height(v){ this._shape.setAttribute("height", v); this._shape.setAttribute("y", -v / 2); }
}

/* ── Line ── */
class LineMobject extends Mobject {
  constructor(opts) {
    super();
    opts = opts || {};
    var from = opts.from || [0, 0], to = opts.to || [100, 0];
    this._shape = svgEl("line", {
      x1: from[0], y1: from[1], x2: to[0], y2: to[1],
      stroke: opts.stroke || opts.color || MX.C.WHITE,
      "stroke-width": opts.strokeWidth || 2,
      "stroke-linecap": "round"
    });
    if (opts.dash) this._shape.setAttribute("stroke-dasharray", opts.dash);
    this.el.appendChild(this._shape);
  }
  setPoints(from, to) {
    this._shape.setAttribute("x1", from[0]); this._shape.setAttribute("y1", from[1]);
    this._shape.setAttribute("x2", to[0]);   this._shape.setAttribute("y2", to[1]);
    return this;
  }
  get length() {
    var dx = parseFloat(this._shape.getAttribute("x2")) - parseFloat(this._shape.getAttribute("x1"));
    var dy = parseFloat(this._shape.getAttribute("y2")) - parseFloat(this._shape.getAttribute("y1"));
    return Math.sqrt(dx * dx + dy * dy);
  }
}

/* ── Arrow ── */
class ArrowMobject extends Mobject {
  constructor(opts) {
    super();
    opts = opts || {};
    var from = opts.from || [0, 0], to = opts.to || [100, 0];
    var color = opts.stroke || opts.color || MX.C.WHITE;
    var sw = opts.strokeWidth || 2;
    var tipSize = opts.tipSize || 10;

    // Arrowhead marker
    var markerId = _id();
    var defs = svgEl("defs");
    var marker = svgEl("marker", {
      id: markerId, markerWidth: tipSize, markerHeight: tipSize,
      refX: tipSize - 1, refY: tipSize / 2, orient: "auto", markerUnits: "userSpaceOnUse"
    });
    var path = svgEl("path", {
      d: "M0,0 L" + tipSize + "," + (tipSize / 2) + " L0," + tipSize + " Z",
      fill: color
    });
    marker.appendChild(path);
    defs.appendChild(marker);
    this.el.appendChild(defs);
    this._marker = path;

    this._shape = svgEl("line", {
      x1: from[0], y1: from[1], x2: to[0], y2: to[1],
      stroke: color, "stroke-width": sw, "stroke-linecap": "round",
      "marker-end": "url(#" + markerId + ")"
    });
    this.el.appendChild(this._shape);
  }
  setPoints(from, to) {
    this._shape.setAttribute("x1", from[0]); this._shape.setAttribute("y1", from[1]);
    this._shape.setAttribute("x2", to[0]);   this._shape.setAttribute("y2", to[1]);
    return this;
  }
}

/* ── Arc ── */
class ArcMobject extends Mobject {
  constructor(opts) {
    super();
    opts = opts || {};
    var r = opts.radius || 50;
    var start = (opts.startAngle || 0) * Math.PI / 180;
    var end = (opts.endAngle || 90) * Math.PI / 180;
    var x1 = r * Math.cos(start), y1 = r * Math.sin(start);
    var x2 = r * Math.cos(end),   y2 = r * Math.sin(end);
    var large = (end - start > Math.PI) ? 1 : 0;
    this._r = r; this._start = opts.startAngle || 0; this._end = opts.endAngle || 90;
    this._shape = svgEl("path", {
      d: "M" + x1 + "," + y1 + " A" + r + "," + r + " 0 " + large + " 1 " + x2 + "," + y2,
      fill: opts.fill || "none",
      stroke: opts.stroke || MX.C.INDIGO,
      "stroke-width": opts.strokeWidth || 2,
      "stroke-linecap": "round"
    });
    this.el.appendChild(this._shape);
    if (opts.x !== undefined || opts.y !== undefined) this.moveTo(opts.x || 0, opts.y || 0);
  }
}

/* ── Polygon ── */
class PolygonMobject extends Mobject {
  constructor(opts) {
    super();
    opts = opts || {};
    var points = opts.points || [[0, -40], [40, 40], [-40, 40]]; // default triangle
    var ptStr = points.map(function(p) { return p[0] + "," + p[1]; }).join(" ");
    this._shape = svgEl("polygon", {
      points: ptStr,
      fill: opts.fill || "none",
      stroke: opts.stroke || MX.C.INDIGO,
      "stroke-width": opts.strokeWidth || 2,
      "stroke-linejoin": "round"
    });
    this.el.appendChild(this._shape);
    if (opts.x !== undefined || opts.y !== undefined) this.moveTo(opts.x || 0, opts.y || 0);
  }
}

/* ── Regular Polygon ── */
class RegularPolygonMobject extends PolygonMobject {
  constructor(opts) {
    opts = opts || {};
    var n = opts.sides || opts.n || 6;
    var r = opts.radius || 50;
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = (2 * Math.PI * i / n) - Math.PI / 2;
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    opts.points = pts;
    super(opts);
  }
}

/* ── Star ── */
class StarMobject extends PolygonMobject {
  constructor(opts) {
    opts = opts || {};
    var n = opts.points || opts.n || 5;
    var outer = opts.outerRadius || 50;
    var inner = opts.innerRadius || outer * 0.4;
    var pts = [];
    for (var i = 0; i < n * 2; i++) {
      var a = (Math.PI * i / n) - Math.PI / 2;
      var r = i % 2 === 0 ? outer : inner;
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    opts.points = pts;
    super(opts);
  }
}

/* ── Path (arbitrary SVG path) ── */
class PathMobject extends Mobject {
  constructor(opts) {
    super();
    opts = opts || {};
    this._shape = svgEl("path", {
      d: opts.d || opts.path || "",
      fill: opts.fill || "none",
      stroke: opts.stroke || MX.C.INDIGO,
      "stroke-width": opts.strokeWidth || 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    });
    this.el.appendChild(this._shape);
    if (opts.x !== undefined || opts.y !== undefined) this.moveTo(opts.x || 0, opts.y || 0);
  }
  get pathLength() { try { return this._shape.getTotalLength(); } catch(e) { return 0; } }
}

/* ── Brace (curly bracket annotation) ── */
class BraceMobject extends Mobject {
  constructor(opts) {
    super();
    opts = opts || {};
    var from = opts.from || [0, 0], to = opts.to || [100, 0];
    var dx = to[0] - from[0], dy = to[1] - from[1];
    var len = Math.sqrt(dx * dx + dy * dy);
    var angle = Math.atan2(dy, dx) * 180 / Math.PI;
    var bump = opts.bump || 12;
    var mid = len / 2;
    // Curly brace shape pointing downward (away from the line from→to)
    var d = "M0,0 C" + (mid * 0.15) + "," + bump + " " + (mid * 0.4) + "," + bump + " " + mid + "," + (bump * 1.8) +
            " C" + (mid * 0.6 + mid) + "," + bump + " " + (mid * 0.85 + mid * 0.3) + "," + bump + " " + len + ",0";
    this._shape = svgEl("path", {
      d: d,
      fill: "none",
      stroke: opts.stroke || opts.color || MX.C.LAVENDER,
      "stroke-width": opts.strokeWidth || 1.5,
      "stroke-linecap": "round"
    });
    this.el.appendChild(this._shape);
    this.moveTo(from[0], from[1]);
    this._rot = angle; this._sync();

    // Optional label
    if (opts.label) {
      var labelEl = svgEl("text", {
        x: mid, y: bump * 2.4,
        "text-anchor": "middle", "dominant-baseline": "hanging",
        fill: opts.labelColor || MX.C.LAVENDER,
        "font-size": opts.labelSize || 12,
        "font-family": "system-ui, sans-serif"
      });
      labelEl.textContent = opts.label;
      this.el.appendChild(labelEl);
      this._label = labelEl;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Text Mobjects
   ═══════════════════════════════════════════════════════════════════ */

/* ── Plain Text ── */
class TextMobject extends Mobject {
  constructor(text, opts) {
    super();
    opts = opts || {};
    this._text = text;
    this._shape = svgEl("text", {
      x: 0, y: 0,
      "text-anchor": opts.anchor || "middle",
      "dominant-baseline": opts.baseline || "central",
      fill: opts.fill || opts.color || MX.C.WHITE,
      "font-size": opts.fontSize || 18,
      "font-weight": opts.fontWeight || "normal",
      "font-family": opts.fontFamily || "'SF Pro Display','Segoe UI',system-ui,sans-serif",
      "letter-spacing": opts.letterSpacing || "normal"
    });
    this._shape.textContent = text;
    this.el.appendChild(this._shape);
    if (opts.x !== undefined || opts.y !== undefined) this.moveTo(opts.x || 0, opts.y || 0);
  }
  get text() { return this._text; }
  set text(v) { this._text = v; this._shape.textContent = v; }
}

/* ── KaTeX Math ── */
class TexMobject extends Mobject {
  constructor(latex, opts) {
    super();
    opts = opts || {};
    this._latex = latex;
    this._display = opts.display !== false;
    // Use foreignObject to embed KaTeX-rendered HTML
    var fo = svgEl("foreignObject", {
      x: 0, y: 0, width: opts.width || 400, height: opts.height || 80,
      overflow: "visible"
    });
    var div = document.createElement("div");
    div.style.cssText = "color:" + (opts.color || MX.C.WHITE) +
      ";font-size:" + (opts.fontSize || "1.2em") +
      ";white-space:nowrap;display:inline-block;";
    div.className = "mx-tex";
    fo.appendChild(div);
    this._div = div;
    this._fo = fo;
    this.el.appendChild(fo);
    // Render after DOM insertion via a microtask
    this._render();
    if (opts.x !== undefined || opts.y !== undefined) this.moveTo(opts.x || 0, opts.y || 0);
  }

  _render() {
    var self = this;
    if (typeof katex !== "undefined") {
      try {
        katex.render(this._latex, this._div, {
          throwOnError: false,
          displayMode: this._display
        });
        // Auto-size foreignObject after render
        requestAnimationFrame(function() { self._autoSize(); });
      } catch(e) {
        this._div.textContent = this._latex;
      }
    } else {
      this._div.textContent = this._latex;
    }
  }

  _autoSize() {
    var rect = this._div.getBoundingClientRect();
    if (rect.width > 0) {
      this._fo.setAttribute("width", Math.ceil(rect.width) + 10);
      this._fo.setAttribute("height", Math.ceil(rect.height) + 10);
    }
  }

  get latex() { return this._latex; }
  set latex(v) { this._latex = v; this._render(); }

  /* Return sub-expression mobjects for individual animation */
  parts(selector) {
    var els = this._div.querySelectorAll(selector || ".katex-html > .base > *");
    return Array.from(els);
  }
}

/* ── Code Block ── */
class CodeMobject extends Mobject {
  constructor(code, opts) {
    super();
    opts = opts || {};
    var lines = code.split("\n");
    var lineHeight = opts.lineHeight || 18;
    var fontSize = opts.fontSize || 13;
    var fontFamily = opts.fontFamily || "'SF Mono','Fira Code',monospace";
    var colors = opts.colors || {};

    var bg = svgEl("rect", {
      x: -8, y: -8,
      width: opts.width || 350,
      height: lines.length * lineHeight + 16,
      rx: 8, fill: opts.bgFill || "rgba(255,255,255,0.04)",
      stroke: "rgba(255,255,255,0.08)", "stroke-width": 1
    });
    this.el.appendChild(bg);

    this._lines = [];
    for (var i = 0; i < lines.length; i++) {
      var t = svgEl("text", {
        x: 0, y: i * lineHeight,
        fill: opts.fill || MX.C.LIGHT_GRAY,
        "font-size": fontSize,
        "font-family": fontFamily,
        "dominant-baseline": "hanging"
      });
      t.textContent = lines[i];
      this.el.appendChild(t);
      this._lines.push(t);
    }
    if (opts.x !== undefined || opts.y !== undefined) this.moveTo(opts.x || 0, opts.y || 0);
  }

  highlightLine(idx, color) {
    if (this._lines[idx]) {
      this._lines[idx].setAttribute("fill", color || MX.C.INDIGO);
      this._lines[idx].setAttribute("font-weight", "600");
    }
    return this;
  }

  resetLine(idx) {
    if (this._lines[idx]) {
      this._lines[idx].setAttribute("fill", MX.C.LIGHT_GRAY);
      this._lines[idx].setAttribute("font-weight", "normal");
    }
    return this;
  }
}


/* ═══════════════════════════════════════════════════════════════════
   Group
   ═══════════════════════════════════════════════════════════════════ */
class Group extends Mobject {
  constructor(items) {
    super();
    this._children = [];
    if (items) {
      var arr = Array.isArray(items) ? items : Array.from(arguments);
      for (var i = 0; i < arr.length; i++) this.add(arr[i]);
    }
  }

  add(mob) {
    if (!(mob instanceof Mobject)) return this;
    this._children.push(mob);
    mob.parent = this;
    this.el.appendChild(mob.el);
    return this;
  }

  remove(mob) {
    var idx = this._children.indexOf(mob);
    if (idx >= 0) {
      this._children.splice(idx, 1);
      mob.parent = null;
      if (mob.el.parentNode === this.el) this.el.removeChild(mob.el);
    }
    return this;
  }

  get children() { return this._children.slice(); }
  get length()   { return this._children.length; }
  at(i)          { return this._children[i]; }

  /* Bulk operations */
  forEach(fn) { this._children.forEach(fn); return this; }
  map(fn)     { return this._children.map(fn); }

  /* Layout helpers */
  arrangeInRow(gap) {
    gap = gap || 20;
    var x = 0;
    this._children.forEach(function(c) {
      c.moveTo(x, 0);
      x += c.getWidth() + gap;
    });
    // Center the whole row
    this.shift(-x / 2, 0);
    return this;
  }

  arrangeInColumn(gap) {
    gap = gap || 20;
    var y = 0;
    this._children.forEach(function(c) {
      c.moveTo(0, y);
      y += c.getHeight() + gap;
    });
    this.shift(0, -y / 2);
    return this;
  }

  arrangeInGrid(cols, gapX, gapY) {
    cols = cols || 3; gapX = gapX || 20; gapY = gapY || 20;
    this._children.forEach(function(c, i) {
      var col = i % cols, row = Math.floor(i / cols);
      c.moveTo(col * gapX, row * gapY);
    });
    return this;
  }
}

MX.Group = Group;

/* ═══════════════════════════════════════════════════════════════════
   Coordinate Systems
   ═══════════════════════════════════════════════════════════════════ */

/* ── NumberLine ── */
class NumberLineMobject extends Mobject {
  constructor(opts) {
    super();
    opts = opts || {};
    this._range = opts.range || [0, 10];
    this._length = opts.length || 400;
    this._step = opts.step || 1;
    this._showTicks = opts.ticks !== false;
    this._showLabels = opts.labels !== false;
    this._tickHeight = opts.tickHeight || 8;
    this._color = opts.color || MX.C.WHITE;

    // Main line
    this._line = svgEl("line", {
      x1: 0, y1: 0, x2: this._length, y2: 0,
      stroke: this._color, "stroke-width": 2, "stroke-linecap": "round"
    });
    this.el.appendChild(this._line);

    // Ticks + labels
    this._tickEls = [];
    this._labelEls = [];
    if (this._showTicks) this._drawTicks(opts);

    if (opts.x !== undefined || opts.y !== undefined) this.moveTo(opts.x || 0, opts.y || 0);
  }

  _drawTicks(opts) {
    var min = this._range[0], max = this._range[1];
    var step = this._step;
    var scale = this._length / (max - min);
    for (var v = min; v <= max; v += step) {
      var px = (v - min) * scale;
      var tick = svgEl("line", {
        x1: px, y1: -this._tickHeight / 2, x2: px, y2: this._tickHeight / 2,
        stroke: this._color, "stroke-width": 1.5
      });
      this.el.appendChild(tick);
      this._tickEls.push(tick);

      if (this._showLabels) {
        var label = svgEl("text", {
          x: px, y: this._tickHeight / 2 + 14,
          "text-anchor": "middle", fill: "rgba(255,255,255,0.5)",
          "font-size": opts.labelSize || 11, "font-family": "system-ui"
        });
        label.textContent = v;
        this.el.appendChild(label);
        this._labelEls.push(label);
      }
    }
  }

  /* Convert value → pixel x */
  valToX(v) {
    var min = this._range[0], max = this._range[1];
    return (v - min) / (max - min) * this._length;
  }

  /* Add a dot marker at a value */
  addPoint(v, opts) {
    opts = opts || {};
    var px = this.valToX(v);
    var dot = new DotMobject({ x: px, y: 0, radius: opts.radius || 5, fill: opts.color || MX.C.INDIGO });
    this.el.appendChild(dot.el);
    this._children.push(dot);
    return dot;
  }
}

/* ── Axes (2D coordinate system) ── */
class AxesMobject extends Mobject {
  constructor(opts) {
    super();
    opts = opts || {};
    this._xRange = opts.xRange || [-5, 5];
    this._yRange = opts.yRange || [-5, 5];
    this._width  = opts.width  || 400;
    this._height = opts.height || 400;
    this._xStep  = opts.xStep  || 1;
    this._yStep  = opts.yStep  || 1;
    this._color  = opts.color  || "rgba(255,255,255,0.3)";
    this._axisColor = opts.axisColor || MX.C.WHITE;
    this._showGrid = opts.grid !== false;

    var xMin = this._xRange[0], xMax = this._xRange[1];
    var yMin = this._yRange[0], yMax = this._yRange[1];
    var w = this._width, h = this._height;
    var sx = w / (xMax - xMin), sy = h / (yMax - yMin);
    this._sx_coord = sx; this._sy_coord = sy;
    this._ox = -xMin * sx; this._oy = yMax * sy; // origin in pixel coords

    // Grid
    if (this._showGrid) {
      for (var xv = Math.ceil(xMin); xv <= xMax; xv += this._xStep) {
        if (xv === 0) continue;
        var px = (xv - xMin) * sx;
        this.el.appendChild(svgEl("line", {
          x1: px, y1: 0, x2: px, y2: h,
          stroke: "rgba(255,255,255,0.05)", "stroke-width": 1
        }));
      }
      for (var yv = Math.ceil(yMin); yv <= yMax; yv += this._yStep) {
        if (yv === 0) continue;
        var py = (yMax - yv) * sy;
        this.el.appendChild(svgEl("line", {
          x1: 0, y1: py, x2: w, y2: py,
          stroke: "rgba(255,255,255,0.05)", "stroke-width": 1
        }));
      }
    }

    // X axis
    var xAxisY = this._oy;
    this.el.appendChild(svgEl("line", {
      x1: 0, y1: xAxisY, x2: w, y2: xAxisY,
      stroke: this._axisColor, "stroke-width": 1.5
    }));
    // Y axis
    var yAxisX = this._ox;
    this.el.appendChild(svgEl("line", {
      x1: yAxisX, y1: 0, x2: yAxisX, y2: h,
      stroke: this._axisColor, "stroke-width": 1.5
    }));

    // Tick labels
    for (var xv = Math.ceil(xMin); xv <= xMax; xv += this._xStep) {
      if (xv === 0) continue;
      var px = (xv - xMin) * sx;
      var t = svgEl("text", {
        x: px, y: xAxisY + 16, "text-anchor": "middle",
        fill: "rgba(255,255,255,0.4)", "font-size": 10, "font-family": "system-ui"
      });
      t.textContent = xv;
      this.el.appendChild(t);
    }
    for (var yv = Math.ceil(yMin); yv <= yMax; yv += this._yStep) {
      if (yv === 0) continue;
      var py = (yMax - yv) * sy;
      var t = svgEl("text", {
        x: yAxisX - 10, y: py + 3, "text-anchor": "end",
        fill: "rgba(255,255,255,0.4)", "font-size": 10, "font-family": "system-ui"
      });
      t.textContent = yv;
      this.el.appendChild(t);
    }

    // Axis labels
    if (opts.xLabel) {
      var xl = svgEl("text", {
        x: w + 10, y: xAxisY + 4, "text-anchor": "start", "dominant-baseline": "central",
        fill: MX.C.WHITE, "font-size": 14, "font-family": "system-ui", "font-style": "italic"
      });
      xl.textContent = opts.xLabel;
      this.el.appendChild(xl);
    }
    if (opts.yLabel) {
      var yl = svgEl("text", {
        x: yAxisX - 4, y: -10, "text-anchor": "end",
        fill: MX.C.WHITE, "font-size": 14, "font-family": "system-ui", "font-style": "italic"
      });
      yl.textContent = opts.yLabel;
      this.el.appendChild(yl);
    }

    if (opts.x !== undefined || opts.y !== undefined) this.moveTo(opts.x || 0, opts.y || 0);
  }

  /* Convert data coords → pixel coords */
  c2p(xv, yv) {
    var xMin = this._xRange[0], yMax = this._yRange[1];
    return {
      x: (xv - xMin) * this._sx_coord,
      y: (yMax - yv) * this._sy_coord
    };
  }

  /* Convert pixel → data coords */
  p2c(px, py) {
    var xMin = this._xRange[0], yMax = this._yRange[1];
    return {
      x: px / this._sx_coord + xMin,
      y: yMax - py / this._sy_coord
    };
  }
}

/* ── FunctionGraph (plots a function on Axes) ── */
class FunctionGraphMobject extends Mobject {
  constructor(fn, axes, opts) {
    super();
    opts = opts || {};
    this._fn = fn;
    this._axes = axes;
    this._color = opts.color || opts.stroke || MX.C.INDIGO;
    this._sw = opts.strokeWidth || 2.5;
    this._xRange = opts.xRange || axes._xRange;
    this._samples = opts.samples || 200;

    this._shape = svgEl("path", {
      d: this._computePath(),
      fill: "none",
      stroke: this._color,
      "stroke-width": this._sw,
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    });
    this.el.appendChild(this._shape);
  }

  _computePath(endX) {
    var ax = this._axes;
    var xMin = this._xRange[0], xMax = endX !== undefined ? endX : this._xRange[1];
    var step = (xMax - xMin) / this._samples;
    var parts = [];
    for (var xv = xMin; xv <= xMax; xv += step) {
      var yv = this._fn(xv);
      if (!isFinite(yv)) continue;
      var p = ax.c2p(xv, yv);
      // Clip to axes bounds
      if (p.x < 0 || p.x > ax._width || p.y < 0 || p.y > ax._height) continue;
      parts.push((parts.length === 0 ? "M" : "L") + p.x.toFixed(2) + "," + p.y.toFixed(2));
    }
    return parts.join(" ");
  }

  /* Recompute for new function or parameter change */
  update(fn) {
    if (fn) this._fn = fn;
    this._shape.setAttribute("d", this._computePath());
    return this;
  }

  /* Get path length for draw animation */
  get pathLength() { try { return this._shape.getTotalLength(); } catch(e) { return 0; } }
}

/* ── ParametricCurve ── */
class ParametricCurveMobject extends Mobject {
  constructor(xFn, yFn, axes, opts) {
    super();
    opts = opts || {};
    this._xFn = xFn;
    this._yFn = yFn;
    this._axes = axes;
    this._tRange = opts.tRange || [0, 2 * Math.PI];
    this._samples = opts.samples || 200;

    var tMin = this._tRange[0], tMax = this._tRange[1];
    var step = (tMax - tMin) / this._samples;
    var parts = [];
    for (var t = tMin; t <= tMax; t += step) {
      var p = axes.c2p(xFn(t), yFn(t));
      parts.push((parts.length === 0 ? "M" : "L") + p.x.toFixed(2) + "," + p.y.toFixed(2));
    }

    this._shape = svgEl("path", {
      d: parts.join(" "),
      fill: opts.fill || "none",
      stroke: opts.stroke || opts.color || MX.C.INDIGO,
      "stroke-width": opts.strokeWidth || 2.5,
      "stroke-linecap": "round"
    });
    this.el.appendChild(this._shape);
  }

  get pathLength() { try { return this._shape.getTotalLength(); } catch(e) { return 0; } }
}


/* ═══════════════════════════════════════════════════════════════════
   SVG Filters — glow, shadow, blur
   ═══════════════════════════════════════════════════════════════════ */
MX._filters = {};
MX._ensureFilter = function(svgRoot, name, filterBody) {
  if (MX._filters[name]) return name;
  var defs = svgRoot.querySelector("defs") || svgEl("defs");
  if (!defs.parentNode) svgRoot.insertBefore(defs, svgRoot.firstChild);
  var filter = svgEl("filter", { id: name, x: "-50%", y: "-50%", width: "200%", height: "200%" });
  filter.innerHTML = filterBody;
  defs.appendChild(filter);
  MX._filters[name] = true;
  return name;
};

/* Apply a glow effect to a mobject */
MX.glow = function(mob, opts) {
  opts = opts || {};
  var color = opts.color || MX.C.INDIGO;
  var radius = opts.radius || 6;
  var name = "mx-glow-" + color.replace(/[^a-zA-Z0-9]/g, "") + "-" + radius;
  var svgRoot = mob.el.closest("svg");
  if (svgRoot) {
    MX._ensureFilter(svgRoot, name,
      '<feGaussianBlur in="SourceGraphic" stdDeviation="' + radius + '" result="blur"/>' +
      '<feFlood flood-color="' + color + '" flood-opacity="0.6" result="color"/>' +
      '<feComposite in="color" in2="blur" operator="in" result="glow"/>' +
      '<feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>'
    );
    mob.el.setAttribute("filter", "url(#" + name + ")");
  }
  return mob;
};

/* Apply drop shadow */
MX.shadow = function(mob, opts) {
  opts = opts || {};
  var dx = opts.dx || 2, dy = opts.dy || 4, blur = opts.blur || 6;
  var name = "mx-shadow-" + dx + "-" + dy + "-" + blur;
  var svgRoot = mob.el.closest("svg");
  if (svgRoot) {
    MX._ensureFilter(svgRoot, name,
      '<feDropShadow dx="' + dx + '" dy="' + dy + '" stdDeviation="' + blur + '" flood-color="rgba(0,0,0,0.5)"/>'
    );
    mob.el.setAttribute("filter", "url(#" + name + ")");
  }
  return mob;
};


/* ═══════════════════════════════════════════════════════════════════
   Factory Functions — short-hand API
   ═══════════════════════════════════════════════════════════════════ */
MX.circle   = function(o) { return new CircleMobject(o); };
MX.dot      = function(o) { return new DotMobject(o); };
MX.rect     = function(o) { return new RectMobject(o); };
MX.line     = function(o) { return new LineMobject(o); };
MX.arrow    = function(o) { return new ArrowMobject(o); };
MX.arc      = function(o) { return new ArcMobject(o); };
MX.polygon  = function(o) { return new PolygonMobject(o); };
MX.ngon     = function(o) { return new RegularPolygonMobject(o); };
MX.star     = function(o) { return new StarMobject(o); };
MX.path     = function(o) { return new PathMobject(o); };
MX.brace    = function(o) { return new BraceMobject(o); };
MX.text     = function(t, o) { return new TextMobject(t, o); };
MX.tex      = function(l, o) { return new TexMobject(l, o); };
MX.code     = function(c, o) { return new CodeMobject(c, o); };
MX.group    = function()  { return new Group(Array.from(arguments)); };
MX.numberLine = function(o) { return new NumberLineMobject(o); };
MX.axes     = function(o) { return new AxesMobject(o); };
MX.plot     = function(fn, axes, o) { return new FunctionGraphMobject(fn, axes, o); };
MX.parametric = function(xFn, yFn, axes, o) { return new ParametricCurveMobject(xFn, yFn, axes, o); };

/* Convenience shape constructors */
MX.triangle = function(o) { o = o || {}; return MX.ngon(Object.assign({ sides: 3 }, o)); };
MX.square   = function(o) { o = o || {}; return MX.rect(Object.assign({ width: o.size || 80, height: o.size || 80 }, o)); };

/* Export classes for instanceof checks */
MX.CircleMobject = CircleMobject;
MX.DotMobject = DotMobject;
MX.RectMobject = RectMobject;
MX.LineMobject = LineMobject;
MX.ArrowMobject = ArrowMobject;
MX.ArcMobject = ArcMobject;
MX.PolygonMobject = PolygonMobject;
MX.RegularPolygonMobject = RegularPolygonMobject;
MX.StarMobject = StarMobject;
MX.PathMobject = PathMobject;
MX.BraceMobject = BraceMobject;
MX.TextMobject = TextMobject;
MX.TexMobject = TexMobject;
MX.CodeMobject = CodeMobject;
MX.NumberLineMobject = NumberLineMobject;
MX.AxesMobject = AxesMobject;
MX.FunctionGraphMobject = FunctionGraphMobject;
MX.ParametricCurveMobject = ParametricCurveMobject;

})();
