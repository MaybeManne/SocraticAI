/* ═══════════════════════════════════════════════════════════════════
   Explainer Animation & Scene System v2
   v2: viewBox read dynamically from SVG (not hardcoded 500x500)
   Provides:
     Animations — MX.fadeIn, MX.fadeOut, MX.growFromCenter, MX.shrinkOut,
       MX.drawBorder, MX.write, MX.indicate, MX.circumscribe, MX.flash,
       MX.wiggle, MX.colorPulse, MX.morphTo, MX.shift, MX.moveTo,
       MX.scaleTo, MX.rotateTo, MX.moveAlongPath, MX.orbit
     Composition — MX.sequence, MX.parallel, MX.stagger
     Scene + Camera — MX.scene
   ═══════════════════════════════════════════════════════════════════ */
(function() {
"use strict";

var MX = window.MX;
if (!MX) throw new Error("explainer-mobject.js must be loaded before explainer-anim.js");

var NS = "http://www.w3.org/2000/svg";

/* ═══════════════════════════════════════════════════════════════════
   Animation Core

   Each animation factory returns an AnimDef object:
   {
     apply: function(tl, at) — adds tweens to a GSAP timeline
     duration: number        — default duration
   }
   Scene.play() calls apply() on each animation to build the timeline.
   ═══════════════════════════════════════════════════════════════════ */

function animDef(applyFn, duration) {
  return { apply: applyFn, duration: duration || 1 };
}

/* ─── Entrance Animations ─── */

MX.fadeIn = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 0.6;
  var dir = opts.from || null; // "up", "down", "left", "right"
  return animDef(function(tl, at) {
    var from = { opacity: 0 };
    if (dir === "up")    from.y = mob.y + (opts.distance || 30);
    if (dir === "down")  from.y = mob.y - (opts.distance || 30);
    if (dir === "left")  from.x = mob.x + (opts.distance || 30);
    if (dir === "right") from.x = mob.x - (opts.distance || 30);
    mob.opacity = 0;
    tl.fromTo(mob, from, {
      opacity: 1, x: mob.x, y: mob.y, duration: dur, ease: opts.ease || "power2.out"
    }, at);
  }, dur);
};

MX.fadeOut = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 0.5;
  var dir = opts.to || null;
  return animDef(function(tl, at) {
    var to = { opacity: 0, duration: dur, ease: opts.ease || "power2.in" };
    if (dir === "up")    to.y = mob.y - (opts.distance || 30);
    if (dir === "down")  to.y = mob.y + (opts.distance || 30);
    if (dir === "left")  to.x = mob.x - (opts.distance || 30);
    if (dir === "right") to.x = mob.x + (opts.distance || 30);
    to.onComplete = function() { mob.remove(); };
    tl.to(mob, to, at);
  }, dur);
};

MX.growFromCenter = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 0.7;
  return animDef(function(tl, at) {
    mob.opacity = 0;
    mob.scale = 0;
    tl.to(mob, {
      opacity: 1, scale: 1, duration: dur,
      ease: opts.ease || "back.out(1.7)"
    }, at);
  }, dur);
};

MX.shrinkOut = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 0.5;
  return animDef(function(tl, at) {
    tl.to(mob, {
      opacity: 0, scale: 0, duration: dur,
      ease: opts.ease || "back.in(1.7)",
      onComplete: function() { mob.remove(); }
    }, at);
  }, dur);
};

MX.spiralIn = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 1;
  return animDef(function(tl, at) {
    var tx = mob.x, ty = mob.y;
    mob.opacity = 0; mob.scale = 0;
    mob.moveTo(tx + 80, ty - 80);
    mob.rotation = -180;
    tl.to(mob, {
      opacity: 1, scale: 1, x: tx, y: ty, rotation: 0,
      duration: dur, ease: opts.ease || "power3.out"
    }, at);
  }, dur);
};

/* ─── Draw Animations (stroke-based) ─── */

MX.drawBorder = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 1.2;
  return animDef(function(tl, at) {
    var shape = mob._shape || mob.el.querySelector("path,circle,rect,line,polygon,ellipse");
    if (!shape) return;
    var len;
    try { len = shape.getTotalLength(); }
    catch(e) {
      // For circles, compute from radius
      var r = parseFloat(shape.getAttribute("r"));
      if (r) len = 2 * Math.PI * r;
      else len = 400;
    }
    shape.setAttribute("stroke-dasharray", len);
    shape.setAttribute("stroke-dashoffset", len);
    mob.opacity = 1;
    // First draw stroke
    tl.to(shape, {
      attr: { "stroke-dashoffset": 0 },
      duration: dur * 0.7, ease: opts.ease || "power2.inOut"
    }, at);
    // Then fill
    var origFill = shape.getAttribute("fill");
    if (origFill && origFill !== "none") {
      shape.setAttribute("fill-opacity", "0");
      tl.to(shape, { attr: { "fill-opacity": 1 }, duration: dur * 0.3 }, at + dur * 0.7);
    }
  }, dur);
};

/* "Write" effect for text/tex — characters appear with a handwriting feel */
MX.write = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 1.5;
  return animDef(function(tl, at) {
    mob.opacity = 0;
    // For tex mobjects, try to animate sub-elements
    if (mob._div && mob._div.querySelector(".katex-html")) {
      var spans = mob._div.querySelectorAll(".katex-html .base > *");
      if (spans.length > 0) {
        mob.opacity = 1;
        var stag = dur / spans.length;
        for (var i = 0; i < spans.length; i++) {
          spans[i].style.opacity = "0";
          spans[i].style.transform = "translateY(5px)";
          spans[i].style.transition = "none";
        }
        for (var i = 0; i < spans.length; i++) {
          (function(span, delay) {
            tl.to(span, {
              opacity: 1, y: 0, duration: Math.max(0.15, stag),
              ease: "power2.out"
            }, at + delay);
          })(spans[i], i * stag);
        }
        return;
      }
    }
    // For path-based mobjects, use stroke drawing
    var shape = mob._shape || mob.el.querySelector("path,line");
    if (shape && shape.getTotalLength) {
      try {
        var len = shape.getTotalLength();
        shape.setAttribute("stroke-dasharray", len);
        shape.setAttribute("stroke-dashoffset", len);
        mob.opacity = 1;
        tl.to(shape, {
          attr: { "stroke-dashoffset": 0 },
          duration: dur, ease: opts.ease || "power1.inOut"
        }, at);
        return;
      } catch(e) {}
    }
    // Fallback: simple fade in
    tl.to(mob, { opacity: 1, duration: dur * 0.5 }, at);
  }, dur);
};

/* Reverse of draw — "un-create" */
MX.uncreate = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 0.8;
  return animDef(function(tl, at) {
    var shape = mob._shape || mob.el.querySelector("path,circle,rect,line,polygon");
    if (!shape) { tl.to(mob, { opacity: 0, duration: dur }, at); return; }
    var len;
    try { len = shape.getTotalLength(); }
    catch(e) { var r = parseFloat(shape.getAttribute("r")); len = r ? 2 * Math.PI * r : 400; }
    shape.setAttribute("stroke-dasharray", len);
    shape.setAttribute("stroke-dashoffset", "0");
    tl.to(shape, {
      attr: { "stroke-dashoffset": len, "fill-opacity": 0 },
      duration: dur, ease: "power2.in",
      onComplete: function() { mob.remove(); }
    }, at);
  }, dur);
};

/* ─── Emphasis Animations ─── */

MX.indicate = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 0.8;
  var color = opts.color || MX.C.AMBER;
  return animDef(function(tl, at) {
    tl.to(mob, { scale: 1.15, duration: dur * 0.4, ease: "power2.out" }, at);
    tl.to(mob, { scale: 1, duration: dur * 0.4, ease: "power2.in" }, at + dur * 0.4);
    // Color pulse on shape
    var shape = mob._shape;
    if (shape) {
      var orig = shape.getAttribute("stroke") || shape.getAttribute("fill");
      tl.to(shape, { attr: { stroke: color }, duration: dur * 0.3 }, at);
      tl.to(shape, { attr: { stroke: orig }, duration: dur * 0.3 }, at + dur * 0.5);
    }
  }, dur);
};

MX.circumscribe = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 1.2;
  var color = opts.color || MX.C.AMBER;
  var padding = opts.padding || 8;
  return animDef(function(tl, at) {
    var bb = mob.getBBox();
    var rect = MX._svgEl("rect", {
      x: bb.x - padding, y: bb.y - padding,
      width: bb.width + padding * 2, height: bb.height + padding * 2,
      rx: 4, fill: "none", stroke: color, "stroke-width": 2
    });
    var parent = mob.el.parentNode;
    if (parent) parent.appendChild(rect);
    var len = 2 * (bb.width + bb.height + padding * 4);
    rect.setAttribute("stroke-dasharray", len);
    rect.setAttribute("stroke-dashoffset", len);
    tl.to(rect, {
      attr: { "stroke-dashoffset": 0 },
      duration: dur * 0.6, ease: "power2.inOut"
    }, at);
    tl.to(rect, { opacity: 0, duration: dur * 0.3 }, at + dur * 0.7);
    tl.call(function() { if (rect.parentNode) rect.parentNode.removeChild(rect); }, [], at + dur);
  }, dur);
};

MX.flash = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 0.5;
  var color = opts.color || MX.C.AMBER;
  return animDef(function(tl, at) {
    var shape = mob._shape;
    if (!shape) return;
    var origFill = shape.getAttribute("fill");
    var origStroke = shape.getAttribute("stroke");
    tl.to(shape, { attr: { fill: color, stroke: color }, duration: dur * 0.15 }, at);
    tl.to(shape, { attr: { fill: origFill, stroke: origStroke }, duration: dur * 0.3 }, at + dur * 0.15);
    tl.to(mob, { opacity: 1.0, duration: 0.01 }, at + dur);
  }, dur);
};

MX.wiggle = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 0.6;
  var amount = opts.amount || 10;
  return animDef(function(tl, at) {
    var x0 = mob.x;
    tl.to(mob, { x: x0 - amount, duration: dur * 0.1, ease: "power1.inOut" }, at);
    tl.to(mob, { x: x0 + amount, duration: dur * 0.15, ease: "power1.inOut" }, at + dur * 0.1);
    tl.to(mob, { x: x0 - amount * 0.6, duration: dur * 0.15, ease: "power1.inOut" }, at + dur * 0.25);
    tl.to(mob, { x: x0 + amount * 0.4, duration: dur * 0.15, ease: "power1.inOut" }, at + dur * 0.4);
    tl.to(mob, { x: x0, duration: dur * 0.2, ease: "power2.out" }, at + dur * 0.55);
  }, dur);
};

MX.colorPulse = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 1;
  var color = opts.color || MX.C.AMBER;
  var count = opts.count || 2;
  return animDef(function(tl, at) {
    var shape = mob._shape;
    if (!shape) return;
    var orig = shape.getAttribute("fill") || shape.getAttribute("stroke");
    var attr = shape.getAttribute("fill") !== "none" ? "fill" : "stroke";
    var pulse = dur / (count * 2);
    for (var i = 0; i < count; i++) {
      var t = at + i * pulse * 2;
      var o = {}; o[attr] = color;
      tl.to(shape, { attr: o, duration: pulse * 0.8, ease: "power1.inOut" }, t);
      var o2 = {}; o2[attr] = orig;
      tl.to(shape, { attr: o2, duration: pulse * 0.8, ease: "power1.inOut" }, t + pulse);
    }
  }, dur);
};

/* ─── Transform Animations ─── */

MX.morphTo = function(mobA, mobB, opts) {
  opts = opts || {};
  var dur = opts.duration || 1;
  return animDef(function(tl, at) {
    // Cross-fade approach: fade out A while fading in B at same position
    var cx = mobA.x, cy = mobA.y;
    mobB.moveTo(cx, cy);
    mobB.opacity = 0;
    // If both have path shapes, try path morph
    var pathA = mobA._shape && mobA._shape.getAttribute("d");
    var pathB = mobB._shape && mobB._shape.getAttribute("d");
    if (pathA && pathB && typeof gsap !== "undefined" && gsap.plugins && gsap.plugins.morphSVG) {
      // Use GSAP MorphSVG plugin if available
      tl.to(mobA._shape, { morphSVG: pathB, duration: dur, ease: "power2.inOut" }, at);
    } else {
      // Fallback: cross-fade
      tl.to(mobA, { opacity: 0, scale: 0.9, duration: dur * 0.5, ease: "power2.in" }, at);
      tl.to(mobB, { opacity: 1, scale: 1, duration: dur * 0.5, ease: "power2.out" }, at + dur * 0.4);
    }
  }, dur);
};

MX.replacementTransform = function(mobA, mobB, opts) {
  opts = opts || {};
  var dur = opts.duration || 1;
  return animDef(function(tl, at) {
    mobB.moveTo(mobA.x, mobA.y);
    mobB.opacity = 0;
    mobB.scale = mobA.scale;
    tl.to(mobA, { opacity: 0, duration: dur * 0.4, ease: "power2.in" }, at);
    tl.to(mobB, { opacity: 1, duration: dur * 0.4, ease: "power2.out" }, at + dur * 0.35);
    // Move B to its final position
    if (mobB._targetX !== undefined) {
      tl.to(mobB, { x: mobB._targetX, y: mobB._targetY, duration: dur * 0.5 }, at + dur * 0.3);
    }
  }, dur);
};

/* ─── Movement Animations ─── */

MX.shiftAnim = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 0.8;
  return animDef(function(tl, at) {
    tl.to(mob, {
      x: mob.x + (opts.dx || 0),
      y: mob.y + (opts.dy || 0),
      duration: dur,
      ease: opts.ease || "power2.inOut"
    }, at);
  }, dur);
};

MX.moveToAnim = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 0.8;
  return animDef(function(tl, at) {
    tl.to(mob, {
      x: opts.x !== undefined ? opts.x : mob.x,
      y: opts.y !== undefined ? opts.y : mob.y,
      duration: dur,
      ease: opts.ease || "power2.inOut"
    }, at);
  }, dur);
};

MX.scaleAnim = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 0.6;
  var s = opts.scale || opts.s || 1;
  return animDef(function(tl, at) {
    tl.to(mob, { scale: s, duration: dur, ease: opts.ease || "power2.out" }, at);
  }, dur);
};

MX.rotateAnim = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 0.8;
  var deg = opts.degrees || opts.deg || 360;
  return animDef(function(tl, at) {
    tl.to(mob, { rotation: mob.rotation + deg, duration: dur, ease: opts.ease || "power2.inOut" }, at);
  }, dur);
};

MX.moveAlongPath = function(mob, pathMob, opts) {
  opts = opts || {};
  var dur = opts.duration || 2;
  return animDef(function(tl, at) {
    var shape = pathMob._shape || pathMob.el.querySelector("path");
    if (!shape) return;
    var len = shape.getTotalLength();
    var startPct = opts.start || 0;
    var endPct = opts.end || 1;
    tl.to({ t: startPct }, {
      t: endPct, duration: dur, ease: opts.ease || "none",
      onUpdate: function() {
        var pt = shape.getPointAtLength(this.targets()[0].t * len);
        mob.moveTo(pt.x, pt.y);
      }
    }, at);
  }, dur);
};

MX.orbit = function(mob, opts) {
  opts = opts || {};
  var dur = opts.duration || 2;
  var cx = opts.cx || 0, cy = opts.cy || 0;
  var r = opts.radius || 100;
  var startAngle = (opts.startAngle || 0) * Math.PI / 180;
  var endAngle = (opts.endAngle || 360) * Math.PI / 180;
  return animDef(function(tl, at) {
    tl.to({ a: startAngle }, {
      a: endAngle, duration: dur, ease: opts.ease || "none",
      onUpdate: function() {
        var a = this.targets()[0].a;
        mob.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
    }, at);
  }, dur);
};

/* ─── Generic property animation ─── */

MX.animate = function(mob, props, opts) {
  opts = opts || {};
  var dur = props.duration || opts.duration || 0.8;
  return animDef(function(tl, at) {
    var tweenProps = Object.assign({}, props, { duration: dur, ease: opts.ease || "power2.inOut" });
    tl.to(mob, tweenProps, at);
  }, dur);
};

/* ─── Wait / Pause ─── */

MX.wait = function(dur) {
  dur = dur || 1;
  return animDef(function(tl, at) {
    tl.to({}, { duration: dur }, at);
  }, dur);
};


/* ═══════════════════════════════════════════════════════════════════
   Composition — sequence, parallel, stagger
   ═══════════════════════════════════════════════════════════════════ */

MX.sequence = function() {
  var anims = Array.isArray(arguments[0]) ? arguments[0] : Array.from(arguments);
  var total = anims.reduce(function(s, a) { return s + (a.duration || 0); }, 0);
  return animDef(function(tl, at) {
    var cursor = at;
    for (var i = 0; i < anims.length; i++) {
      anims[i].apply(tl, cursor);
      cursor += anims[i].duration || 0;
    }
  }, total);
};

MX.parallel = function() {
  var anims = Array.isArray(arguments[0]) ? arguments[0] : Array.from(arguments);
  var maxDur = Math.max.apply(null, anims.map(function(a) { return a.duration || 0; }));
  return animDef(function(tl, at) {
    for (var i = 0; i < anims.length; i++) {
      anims[i].apply(tl, at);
    }
  }, maxDur);
};

MX.stagger = function(items, animFn, opts) {
  opts = opts || {};
  var lag = opts.lag || 0.15;
  var total = items.length * lag + (opts.duration || 0.6);
  return animDef(function(tl, at) {
    for (var i = 0; i < items.length; i++) {
      var anim = animFn(items[i], opts);
      anim.apply(tl, at + i * lag);
    }
  }, total);
};


/* ═══════════════════════════════════════════════════════════════════
   Scene — container that manages Mobjects, plays animations, Camera
   ═══════════════════════════════════════════════════════════════════ */

class Scene {
  constructor(svgElement, opts) {
    opts = opts || {};
    this.svg = typeof svgElement === "string" ? document.getElementById(svgElement) : svgElement;
    this._objects = [];
    this._timelines = [];

    // Camera state
    this._camX = 0;
    this._camY = 0;
    this._camScale = 1;
    this._camRotation = 0;

    // Scene layer (all objects render into this group, camera transforms it)
    this._sceneGroup = MX._svgEl("g", { id: "mx-scene" });
    this.svg.appendChild(this._sceneGroup);

    // Background — v2: reads viewBox dynamically
    if (opts.background) {
      var vb = this._getViewBox();
      this._bg = MX._svgEl("rect", {
        x: vb[0], y: vb[1], width: vb[2], height: vb[3],
        fill: opts.background
      });
      this.svg.insertBefore(this._bg, this._sceneGroup);
    }
  }

  /* v2: read viewBox from SVG element dynamically */
  _getViewBox() {
    return (this.svg.getAttribute("viewBox") || "0 0 500 500").split(/[\s,]+/).map(Number);
  }

  /* ── Object management ── */
  add() {
    var args = Array.isArray(arguments[0]) ? arguments[0] : Array.from(arguments);
    for (var i = 0; i < args.length; i++) {
      var mob = args[i];
      if (this._objects.indexOf(mob) < 0) {
        this._objects.push(mob);
        mob.scene = this;
        this._sceneGroup.appendChild(mob.el);
      }
    }
    return this;
  }

  remove() {
    var args = Array.isArray(arguments[0]) ? arguments[0] : Array.from(arguments);
    for (var i = 0; i < args.length; i++) {
      var mob = args[i];
      var idx = this._objects.indexOf(mob);
      if (idx >= 0) {
        this._objects.splice(idx, 1);
        mob.scene = null;
        if (mob.el.parentNode) mob.el.parentNode.removeChild(mob.el);
      }
    }
    return this;
  }

  _unregister(mob) {
    var idx = this._objects.indexOf(mob);
    if (idx >= 0) { this._objects.splice(idx, 1); mob.scene = null; }
  }

  clear() {
    while (this._objects.length) this.remove(this._objects[0]);
    return this;
  }

  /* ── Play animations ──
     scene.play(anim1, anim2)  — plays in parallel
     Returns a Promise that resolves when done.  */
  play() {
    var anims = Array.from(arguments);
    var tl = gsap.timeline();
    // If multiple anims passed, play in parallel (all start at 0)
    for (var i = 0; i < anims.length; i++) {
      if (anims[i] && anims[i].apply) {
        anims[i].apply(tl, 0);
      }
    }
    this._timelines.push(tl);
    return new Promise(function(resolve) {
      tl.eventCallback("onComplete", resolve);
    });
  }

  /* Play in sequence */
  playSequence() {
    return this.play(MX.sequence(Array.from(arguments)));
  }

  /* Shorthand: add + animate in one call */
  addWithAnim(mob, animFn, opts) {
    this.add(mob);
    return this.play(animFn(mob, opts));
  }

  /* ── Camera ── */

  get camera() {
    var self = this;
    return {
      /* Pan to absolute position */
      panTo: function(opts) {
        opts = opts || {};
        var dur = opts.duration || 0.8;
        return animDef(function(tl, at) {
          var tx = -(opts.x || 0);
          var ty = -(opts.y || 0);
          tl.to(self, {
            _camX: tx, _camY: ty,
            duration: dur, ease: opts.ease || "power2.inOut",
            onUpdate: function() { self._syncCamera(); }
          }, at);
        }, dur);
      },

      /* Zoom to a scale level, optionally centering on a point or mobject */
      zoomTo: function(opts) {
        opts = opts || {};
        var dur = opts.duration || 0.8;
        var s = opts.scale || 2;
        return animDef(function(tl, at) {
          var tx = self._camX, ty = self._camY;
          // Center on a mobject if provided
          if (opts.target) {
            var c = opts.target.getCenter();
            var vb = self._getViewBox();
            tx = -(c.x * s - vb[2] / 2);
            ty = -(c.y * s - vb[3] / 2);
          } else if (opts.x !== undefined) {
            var vb = self._getViewBox();
            tx = -(opts.x * s - vb[2] / 2);
            ty = -(opts.y * s - vb[3] / 2);
          }
          tl.to(self, {
            _camScale: s, _camX: tx, _camY: ty,
            duration: dur, ease: opts.ease || "power2.inOut",
            onUpdate: function() { self._syncCamera(); }
          }, at);
        }, dur);
      },

      /* Reset camera to default */
      reset: function(opts) {
        opts = opts || {};
        var dur = opts.duration || 0.8;
        return animDef(function(tl, at) {
          tl.to(self, {
            _camX: 0, _camY: 0, _camScale: 1, _camRotation: 0,
            duration: dur, ease: opts.ease || "power2.inOut",
            onUpdate: function() { self._syncCamera(); }
          }, at);
        }, dur);
      },

      /* Focus on a mobject (zoom + pan to center it) */
      focusOn: function(mob, opts) {
        opts = opts || {};
        opts.target = mob;
        opts.scale = opts.scale || 2;
        return this.zoomTo(opts);
      },

      /* Follow a mobject continuously */
      follow: function(mob, opts) {
        opts = opts || {};
        var dur = opts.duration || 0;
        return animDef(function(tl, at) {
          tl.to({}, {
            duration: dur || 2,
            onUpdate: function() {
              var c = mob.getCenter();
              var vb = self._getViewBox();
              self._camX = -(c.x * self._camScale - vb[2] / 2);
              self._camY = -(c.y * self._camScale - vb[3] / 2);
              self._syncCamera();
            }
          }, at);
        }, dur || 2);
      }
    };
  }

  _syncCamera() {
    var t = "translate(" + this._camX + "," + this._camY + ") " +
            "scale(" + this._camScale + ") " +
            "rotate(" + this._camRotation + ")";
    this._sceneGroup.setAttribute("transform", t);
  }

  /* ── Utility ── */

  /* Get center of viewport in scene coordinates */
  getViewCenter() {
    var vb = this._getViewBox();
    return { x: vb[2] / 2, y: vb[3] / 2 };
  }

  /* Kill all active timelines */
  killAll() {
    this._timelines.forEach(function(tl) { tl.kill(); });
    this._timelines = [];
  }
}

MX.Scene = Scene;
MX.scene = function(svgEl, opts) { return new Scene(svgEl, opts); };


/* ═══════════════════════════════════════════════════════════════════
   Viz Plugin Adapter — makes MX scenes work as EXPLAINER_VIZ plugins
   so lessons can use the new Mobject system within the existing engine.

   Usage in viz file:
     window.EXPLAINER_VIZ = MX.vizPlugin(function(scene, config) {
       // build viz using scene.add(), MX.circle(), etc.
       return {
         drawCircle: function(tl, params, t) { ... },
         ...
       };
     });
   ═══════════════════════════════════════════════════════════════════ */
MX.vizPlugin = function(setupFn) {
  var scene = null;
  var methods = null;

  return {
    name: "mx-viz-plugin",
    init: function(svgElement, config) {
      scene = new Scene(svgElement, { background: config.background || MX.C.BG });
      methods = setupFn(scene, config) || {};
    },
    timelineAction: function(tl, method, params, t) {
      if (methods && methods[method]) {
        var result = methods[method](tl, params, t);
        // If the method returns an AnimDef, apply it
        if (result && result.apply) result.apply(tl, t);
      }
    },
    drawInteractive: function(n) {
      if (methods && methods.drawInteractive) methods.drawInteractive(n);
    },
    getScene: function() { return scene; },
    getMethods: function() { return methods; }
  };
};


})();
