# Viz Plugin Interface

A viz plugin is a JavaScript object assigned to `window.EXPLAINER_VIZ`. The engine calls its methods at specific points during playback.

---

## Full interface

```js
window.EXPLAINER_VIZ = {
  /**
   * Called once per act, before any timeline actions.
   * Build the SVG here. Set all initial states (opacity: 0).
   * @param {SVGSVGElement} svgElement - The main SVG element
   * @param {object} config - Values from L.viz({ config: {...} })
   */
  init: function(svgElement, config) { },

  /**
   * Called for each .do(method, params, offset) in the lesson.
   * Schedule GSAP tweens on tl at time t.
   * @param {GSAPTimeline} tl - The act's master timeline
   * @param {string} method   - The method name from .do("method")
   * @param {object} params   - The params object from .do("method", params)
   * @param {number} t        - Absolute time in seconds on the timeline
   */
  timelineAction: function(tl, method, params, t) { },

  /**
   * [Optional] Called when an interactive gate slider changes.
   * @param {number} n - Current slider value
   */
  drawInteractive: function(n) { }
};
```

---

## Using `MX.vizPlugin()` (recommended)

`MX.vizPlugin()` creates the `EXPLAINER_VIZ` object for you. You provide a setup function that receives a `Scene` and returns a method map.

```js
window.EXPLAINER_VIZ = MX.vizPlugin(function(scene, config) {

  // Build scene elements — all hidden initially
  var triangle = MX.polygon({
    points: [[250, 400], [250, 100], [500, 400]],
    fill: "none", stroke: MX.C.WHITE, strokeWidth: 2
  });
  scene.add(triangle);

  // Return method map — keys become the method names for .do()
  return {
    drawTriangle: function(tl, params, t) {
      MX.drawBorder(triangle, { duration: 1.2 }).apply(tl, t);
    },
    highlightLeg: function(tl, params, t) {
      var color = params.color || MX.C.AMBER;
      MX.colorPulse(triangle, { color: color, duration: 0.8 }).apply(tl, t);
    }
  };
});
```

**What `MX.vizPlugin()` adds over raw `EXPLAINER_VIZ`:**
- Creates and manages the `Scene` for you
- Routes `timelineAction` calls to the returned method map
- Passes the scene to `drawInteractive` if you return a method named `drawInteractive`
- Exposes `getScene()` and `getMethods()` for debugging

---

## The `init` / `timelineAction` contract

**Everything created in `init`, animated in `timelineAction`.**

`init` is called once when an act starts — including when the engine replays acts after gate branches or seeks. `timelineAction` is called many times on the same timeline. If you create DOM elements inside `timelineAction`, you'll get duplicates.

```js
// WRONG
timelineAction: function(tl, method, params, t) {
  if (method === "showDot") {
    var dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    svg.appendChild(dot);          // ← creates a new dot every call
    tl.to(dot, { opacity: 1 }, t);
  }
}

// RIGHT
var dot;
init: function(svgEl, config) {
  svg = svgEl;
  dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("opacity", "0");
  svg.appendChild(dot);            // ← created once
},
timelineAction: function(tl, method, params, t) {
  if (method === "showDot") {
    tl.to(dot, { opacity: 1 }, t); // ← just animated
  }
}
```

---

## The viewBox

The SVG's viewBox defaults to `"0 0 500 500"` and is configurable via:

```js
L.viz({ viewBox: "0 0 800 400", config: { ... } });
```

Design all your SVG coordinates within the viewBox space. The engine scales the SVG to fit the panel regardless of panel size.

---

## The `config` object

Values you put in `L.viz({ config: {...} })` arrive in `init` as the second argument. Use this to make your plugin data-driven:

```js
// Content:
L.viz({ config: { center: [250, 250], radius: 120, color: "#58C4DD" } });

// Plugin:
init: function(svgEl, config) {
  circle = MX.circle({
    x: config.center[0],
    y: config.center[1],
    radius: config.radius,
    stroke: config.color
  });
}
```

---

## Offset parsing

Offsets in `.do()` are parsed before `timelineAction` receives them:

| `.do()` call | `t` in `timelineAction` |
|--------------|------------------------|
| `.do("m")` | `beatStart + 0` |
| `.do("m", {}, "+0.5")` | `beatStart + 0.5` |
| `.do("m", {}, "+1.2")` | `beatStart + 1.2` |
| `.do("m", {}, 2.0)` | `beatStart + 2.0` |

The `t` parameter is already the absolute time on the master timeline — you don't need to add the offset yourself.

---

## Warnings

If your `timelineAction` method adds no GSAP tweens, the engine logs a warning:

```
[Viz] Method "showDot" added no tweens — is the method name correct?
```

This means the method name in `.do()` doesn't match anything you're actually animating in `timelineAction`. Check spelling.
