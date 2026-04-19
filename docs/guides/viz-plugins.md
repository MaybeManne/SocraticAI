# Viz Plugins

A visualization plugin drives the SVG panel on the left side of the screen. It implements three methods that the engine calls at specific points during playback.

## The plugin interface

Every plugin must expose `window.EXPLAINER_VIZ` with this shape:

```js
window.EXPLAINER_VIZ = {
  // Called once per act, before any timeline actions run.
  // Build your SVG here. Set initial states (opacity: 0).
  init: function(svgElement, config) { },

  // Called for each .do(method, params, offset) in the lesson.
  // Schedule GSAP tweens on `tl` at time `t`.
  timelineAction: function(tl, method, params, t) { },

  // [Optional] Called when an interactive gate slider moves.
  drawInteractive: function(n) { }
};
```

## The recommended pattern: MX.vizPlugin()

`MX.vizPlugin()` wraps your setup function and handles the `EXPLAINER_VIZ` boilerplate. You return a map of method names to functions; it wires them into `timelineAction` automatically.

```js
window.EXPLAINER_VIZ = MX.vizPlugin(function(scene, config) {

  // Build your scene here
  var circle = MX.circle({ radius: 80, fill: MX.C.TEAL, x: 250, y: 250 });
  var label  = MX.tex("r", { x: 250, y: 250, fontSize: 24, color: MX.C.WHITE });
  scene.add(circle, label);

  // Return a map of method → function
  return {
    drawCircle: function(tl, params, t) {
      MX.drawBorder(circle, { duration: 1 }).apply(tl, t);
      MX.fadeIn(label, { duration: 0.5 }).apply(tl, t + 0.8);
    },
    highlightRadius: function(tl, params, t) {
      MX.indicate(circle, { color: MX.C.AMBER, duration: 0.8 }).apply(tl, t);
    },
    scaleDown: function(tl, params, t) {
      MX.scaleAnim(circle, { scale: 0.5, duration: 0.6 }).apply(tl, t);
    }
  };
});
```

In your content script, call these methods with `.do()`:

```js
A.say("Draw the circle.")
 .do("drawCircle");

A.say("The radius is highlighted.")
 .do("highlightRadius");
```

## Writing a raw EXPLAINER_VIZ plugin

Use this when you need direct SVG control without the MX scene graph:

```js
window.EXPLAINER_VIZ = (function() {
  var svg, hyp, legA, legB;

  return {
    init: function(svgEl, config) {
      svg = svgEl;
      svg.innerHTML = [
        '<line id="leg-a" x1="50" y1="350" x2="350" y2="350" stroke="#58C4DD" stroke-width="3" opacity="0"/>',
        '<line id="leg-b" x1="350" y1="350" x2="350" y2="50"  stroke="#83C167" stroke-width="3" opacity="0"/>',
        '<line id="hyp"   x1="50" y1="350" x2="350" y2="50"   stroke="#F0AC5F" stroke-width="3" opacity="0"/>'
      ].join("");
      legA = svg.querySelector("#leg-a");
      legB = svg.querySelector("#leg-b");
      hyp  = svg.querySelector("#hyp");
    },

    timelineAction: function(tl, method, params, t) {
      if (method === "drawLegA") {
        var len = legA.getTotalLength();
        gsap.set(legA, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
        tl.to(legA, { strokeDashoffset: 0, duration: params.duration || 1 }, t);
      } else if (method === "drawLegB") {
        var len = legB.getTotalLength();
        gsap.set(legB, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
        tl.to(legB, { strokeDashoffset: 0, duration: params.duration || 1 }, t);
      } else if (method === "drawHyp") {
        var len = hyp.getTotalLength();
        gsap.set(hyp, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
        tl.to(hyp, { strokeDashoffset: 0, duration: params.duration || 1 }, t);
      }
    }
  };
})();
```

## Key constraints

**Build all elements in `init`, not in `timelineAction`.**
`init` is called once when an act starts. `timelineAction` is called many times — during normal playback, during seek operations, and when the engine snapshots the act for branch replay. Creating DOM elements inside `timelineAction` causes duplicates.

```js
// WRONG: creates a new element every time "showDot" is called
timelineAction: function(tl, method, params, t) {
  if (method === "showDot") {
    var dot = document.createElementNS("http://www.w3.org/2000/svg", "circle"); // ← BAD
    svg.appendChild(dot);
    tl.to(dot, { opacity: 1 }, t);
  }
}

// RIGHT: element pre-created in init, just animated in timelineAction
timelineAction: function(tl, method, params, t) {
  if (method === "showDot") {
    tl.to(dot, { opacity: 1 }, t); // ← dot was created in init()
  }
}
```

**Set initial states to `opacity: 0`.**
All elements should be invisible when `init` runs. Let `timelineAction` reveal them. This ensures seek and replay produce correct states.

**Use `params` for per-call variation.**
Pass data from the content script through `params`:

```js
// Content:
A.do("highlight", { element: "hypotenuse", color: "#f59e0b" });

// Plugin:
timelineAction: function(tl, method, params, t) {
  if (method === "highlight") {
    var el = elements[params.element];
    tl.to(el, { stroke: params.color, duration: 0.4 }, t);
  }
}
```

## GSAP animation recipes

**Draw a line** (stroke-dashoffset trick):
```js
var len = line.getTotalLength();
gsap.set(line, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
tl.to(line, { strokeDashoffset: 0, duration: 1, ease: "power2.inOut" }, t);
```

**Fade in with drift**:
```js
gsap.set(el, { opacity: 0, y: 12 });
tl.to(el, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, t);
```

**Scale pop-in**:
```js
gsap.set(el, { scale: 0, opacity: 0, transformOrigin: "center" });
tl.to(el, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" }, t);
```

**Highlight then restore**:
```js
tl.to(el, { fill: "#f59e0b", duration: 0.3 }, t)
  .to(el, { fill: original, duration: 0.3 }, t + 0.6);
```

**Dim everything except one element**:
```js
others.forEach(function(el) {
  tl.to(el, { opacity: 0.15, duration: 0.4 }, t);
});
tl.to(focus, { opacity: 1, duration: 0.4 }, t);
```

## The viewBox

The SVG canvas has a configurable viewBox set from your lesson's `L.viz()` call:

```js
L.viz({ config: { ... }, viewBox: "0 0 800 400" });
```

Default is `"0 0 500 500"`. Design your SVG coordinates within this space. The engine scales to fit the panel automatically.

## Accessing config values

Config values from `L.viz({ config: {...} })` are passed into `init`:

```js
// Content:
L.viz({ config: { cx: 250, cy: 250, radius: 100 } });

// Plugin:
init: function(svgEl, config) {
  circle = MX.circle({ x: config.cx, y: config.cy, radius: config.radius });
}
```

## Layout: zones and slots (MIT-grade polish)

The agentic pipeline's layout validator enforces these rules, and production plugins like the archer projectile lesson use them. Violating them produces the "jumbled diagram" anti-pattern: overlapping equations, stacked calculation steps, sliders on top of scene elements.

### 1. Declare a zone map up front

```js
// viewBox 800×400 — non-overlapping rectangles.
var Z = {
  BADGE:  { x:  10, y:  10, w: 240, h:  70 },  // initial conditions
  EQN:    { x: 260, y:  10, w: 240, h:  70 },  // current formula
  SLIDER: { x: 510, y:  10, w: 280, h: 130 },  // interactive control
  CALC:   { x: 510, y: 150, w: 280, h: 230 }   // derivation / chart
};
// Scene (axes, trajectories, moving objects) occupies the remaining area.
```

For every pair of zones `(A, B)`, either `A.x + A.w <= B.x` or `A.y + A.h <= B.y` (or the mirror). Overlap is forbidden.

### 2. Slot-based redraw

Each persistent overlay lives in a named slot. Before writing into a slot, remove its previous occupant:

```js
var slots = {};
function clearSlot(id) {
  if (slots[id] && slots[id].parentNode) slots[id].parentNode.removeChild(slots[id]);
  slots[id] = null;
}

case "showEquation":
  clearSlot("eqn");                       // remove previous equation
  var g = svgEl("g", { opacity: 0 }, svg);
  slots["eqn"] = g;
  panelBg(g, Z.EQN);                      // rounded semi-transparent backing
  // ...text inside Z.EQN with 12px padding...
  tl.to(g, { opacity: 1, duration: 0.5 }, t);
  break;
```

Without `clearSlot`, repeated calls pile text on top of prior text — the single most common overlap bug.

### 3. Backing panels for readability

Every text overlay sits on a rounded semi-transparent panel so it stays legible against the animated scene:

```js
function panelBg(parent, zone) {
  svgEl("rect", {
    x: zone.x, y: zone.y, width: zone.w, height: zone.h, rx: 8,
    fill: "rgba(15,14,23,0.82)", stroke: "#334155", "stroke-width": 1
  }, parent);
}
```

Text inside uses at least **12 px of padding** from panel edges. Line height is 24–28 px for 14-px monospace, 22 px for 16-px system-ui headings. Zone titles use uppercase 10-px gray labels (`"EQUATION"`, `"DERIVATION"`).

### Validation

When run through the pipeline, `_check_viz_layout()` in `orchestrator.py` scans generated plugin code and rejects (via the retry loop) any code that:

- creates `<text>` in a loop with `y: ...i*...` but no `clearSlot` anywhere
- has literal x/y coordinates outside the viewBox (`x < -50` or `x > 850` for width 800)
- creates 5+ text elements without any `Z.<ZONE>` references — freehand layout

You can run the same audit manually:

```python
from orchestrator import _check_viz_layout
warnings = _check_viz_layout(open("viz_plugin.js").read())
```

## Interactive gates

If your lesson has an `interactive` gate, implement `drawInteractive(n)`:

```js
drawInteractive: function(n) {
  // n is the current slider value
  // Update the visualization to reflect n
  circle.scaleTo(n / 10);
}
```

The gate slider calls this on every `input` event.
