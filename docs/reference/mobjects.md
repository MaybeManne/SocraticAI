# Mobjects Reference

Mobjects are the building blocks of the visualization. Every shape is a `Mobject` — an object with GSAP-compatible transform properties that maps to one or more SVG elements.

All factory functions return a `Mobject` and accept an `opts` object.

---

## Base `Mobject` properties

Every mobject exposes these GSAP-animatable properties:

| Property | Type | Description |
|----------|------|-------------|
| `x` | `number` | X position (SVG coordinates) |
| `y` | `number` | Y position (SVG coordinates) |
| `scale` | `number` | Uniform scale |
| `scaleX` | `number` | Horizontal scale |
| `scaleY` | `number` | Vertical scale |
| `rotation` | `number` | Rotation in degrees |
| `opacity` | `number` | 0 (transparent) to 1 (opaque) |
| `fill` | `string` | Fill color |
| `stroke` | `string` | Stroke color |
| `strokeWidth` | `number` | Stroke width in SVG units |

All properties have getters and setters, so GSAP can tween them directly:

```js
gsap.to(circle, { x: 300, scale: 2, duration: 1 });
```

## Base `Mobject` methods

All methods return `this` for chaining.

| Method | Description |
|--------|-------------|
| `moveTo(x, y)` | Set position |
| `shift(dx, dy)` | Delta move |
| `scaleTo(s, sy?)` | Set scale (uniform or non-uniform) |
| `rotateTo(deg)` | Set rotation in degrees |
| `setOpacity(o)` | Set opacity |
| `setFill(color)` | Set fill color |
| `setStroke(color, width?)` | Set stroke color and optional width |
| `setColor(color)` | Alias for `setFill` |
| `getBBox()` | Returns `{x, y, width, height}` bounding box |
| `getCenter()` | Returns `{x, y}` center |
| `getWidth()` | Bounding box width |
| `getHeight()` | Bounding box height |
| `copy()` | Clone this mobject |
| `remove()` | Detach from scene |

---

## Shapes

### `MX.circle(opts)`

```js
var c = MX.circle({
  radius: 80,          // or r
  fill: MX.C.TEAL,
  stroke: MX.C.WHITE,
  strokeWidth: 2,
  fillOpacity: 0.3,
  x: 250, y: 250
});
```

### `MX.dot(opts)`

A filled circle without stroke, sized for point markers.

```js
var d = MX.dot({ radius: 6, fill: MX.C.AMBER, x: 150, y: 300 });
```

### `MX.rect(opts)`

```js
var r = MX.rect({
  width: 120,
  height: 80,
  cornerRadius: 8,     // or rx
  fill: MX.C.INDIGO,
  stroke: MX.C.WHITE,
  strokeWidth: 1,
  x: 100, y: 100
});
```

### `MX.square(opts)`

Shorthand for `MX.rect` with equal width and height.

```js
var s = MX.square({ size: 100, fill: MX.C.CORAL });
```

### `MX.triangle(opts)`

Equilateral triangle.

```js
var t = MX.triangle({ size: 100, fill: MX.C.GREEN });
```

### `MX.line(opts)`

```js
var l = MX.line({
  from: [50, 400],
  to: [450, 100],
  stroke: MX.C.BLUE,
  strokeWidth: 3,
  dash: "8 4"          // optional stroke-dasharray
});
```

`LineMobject` exposes `getTotalLength()` for the dashoffset draw animation.

### `MX.arrow(opts)`

A line with an arrowhead at the end.

```js
var a = MX.arrow({
  from: [100, 250],
  to: [400, 250],
  stroke: MX.C.AMBER,
  strokeWidth: 2,
  tipSize: 12
});
```

### `MX.arc(opts)`

```js
var a = MX.arc({
  radius: 60,
  startAngle: 0,       // degrees
  endAngle: 90,
  fill: "none",
  stroke: MX.C.CORAL,
  strokeWidth: 2,
  x: 250, y: 250
});
```

### `MX.polygon(opts)`

Arbitrary polygon from a list of points.

```js
var p = MX.polygon({
  points: [[100, 400], [250, 100], [400, 400]],
  fill: MX.C.PURPLE,
  stroke: MX.C.WHITE,
  strokeWidth: 2
});
```

### `MX.ngon(opts)`

Regular polygon with `n` sides.

```js
var hex = MX.ngon({ sides: 6, radius: 80, fill: MX.C.INDIGO });
// also: n: 6
```

### `MX.star(opts)`

Five-pointed (or N-pointed) star.

```js
var star = MX.star({
  points: 5,           // or n
  outerRadius: 80,
  innerRadius: 40,
  fill: MX.C.AMBER,
  x: 250, y: 250
});
```

### `MX.path(opts)`

Arbitrary SVG path.

```js
var p = MX.path({
  d: "M 50 400 Q 250 50 450 400",
  fill: "none",
  stroke: MX.C.TEAL,
  strokeWidth: 2
});
```

### `MX.brace(opts)`

Curly brace between two points, with optional label.

```js
var b = MX.brace({
  from: [100, 300],
  to: [400, 300],
  bump: 20,            // how far the brace curves outward
  label: "a",
  labelColor: MX.C.WHITE,
  labelSize: 18,
  stroke: MX.C.WHITE,
  strokeWidth: 1.5
});
```

---

## Text

### `MX.text(text, opts)`

Plain SVG text.

```js
var t = MX.text("Hello!", {
  fontSize: 24,
  color: MX.C.WHITE,
  fill: MX.C.WHITE,
  anchor: "middle",    // SVG text-anchor
  baseline: "middle",  // SVG dominant-baseline
  fontWeight: "bold",
  x: 250, y: 250
});
```

### `MX.tex(latex, opts)`

LaTeX rendered via KaTeX into a `<foreignObject>`.

```js
var eq = MX.tex("\\frac{a^2 + b^2}{c^2}", {
  fontSize: 28,
  color: MX.C.WHITE,
  display: false,      // false = inline mode
  x: 150, y: 200
});
```

**Extra methods on `TexMobject`:**

| Method | Description |
|--------|-------------|
| `get latex` / `set latex(v)` | Get/set the LaTeX string (re-renders) |
| `parts(selector)` | Returns `HTMLElement[]` matching a CSS selector within the rendered KaTeX — useful for per-character animations |

### `MX.code(code, opts)`

Syntax-highlighted code block.

```js
var c = MX.code("def fib(n):\n  if n < 2: return n\n  return fib(n-1) + fib(n-2)", {
  fontSize: 14,
  fontFamily: "monospace",
  fill: MX.C.WHITE,
  bgFill: "rgba(0,0,0,0.3)",
  width: 300,
  lineHeight: 20,
  x: 50, y: 80
});
```

**Extra methods:**

| Method | Description |
|--------|-------------|
| `highlightLine(idx, color)` | Highlight a specific line |
| `resetLine(idx)` | Remove highlight from a line |

---

## Coordinate systems

### `MX.numberLine(opts)`

```js
var nl = MX.numberLine({
  range: [0, 10],   // [min, max]
  length: 400,
  step: 1,
  ticks: true,
  labels: true,
  tickHeight: 8,
  color: MX.C.WHITE,
  labelSize: 14,
  x: 50, y: 250
});

nl.valToX(5);              // → pixel x for value 5
nl.addPoint(5, { fill: MX.C.AMBER });  // add a dot at value 5
```

### `MX.axes(opts)`

2D Cartesian axes with optional grid.

```js
var ax = MX.axes({
  xRange: [-5, 5],
  yRange: [-3, 3],
  width: 400,
  height: 300,
  xStep: 1,
  yStep: 1,
  grid: true,
  color: "rgba(255,255,255,0.15)",
  axisColor: MX.C.WHITE,
  xLabel: "x",
  yLabel: "y",
  x: 50, y: 100
});

ax.c2p(2, 1.5);    // data coords → pixel coords: {x, y}
ax.p2c(300, 200);  // pixel coords → data coords: {x, y}
```

### `MX.plot(fn, axes, opts)`

Function graph plotted on an `AxesMobject`.

```js
var curve = MX.plot(function(x) { return x * x; }, ax, {
  color: MX.C.TEAL,
  strokeWidth: 2,
  xRange: [-3, 3],
  samples: 200
});

curve.update();              // Re-sample the function
curve.pathLength;            // Total path length (for dashoffset animations)
```

### `MX.parametric(xFn, yFn, axes, opts)`

Parametric curve on an `AxesMobject`.

```js
var helix = MX.parametric(
  function(t) { return Math.cos(t); },
  function(t) { return Math.sin(t); },
  ax,
  { tRange: [0, 2 * Math.PI], samples: 300, stroke: MX.C.CORAL }
);
```

---

## Group

### `MX.group(...mobs)`

```js
var g = MX.group(circle, label, arrow);
// or: MX.group([circle, label, arrow])
```

**Methods** (in addition to base `Mobject`):

| Method | Description |
|--------|-------------|
| `add(mob)` | Add a mobject |
| `remove(mob)` | Remove a mobject |
| `get children` | Array of child mobjects |
| `get length` | Number of children |
| `at(i)` | Child at index `i` |
| `forEach(fn)` | Iterate over children |
| `map(fn)` | Map over children |
| `arrangeInRow(gap?)` | Layout children left to right |
| `arrangeInColumn(gap?)` | Layout children top to bottom |
| `arrangeInGrid(cols, gapX, gapY)` | Layout children in a grid |

---

## Color palette

```js
MX.C.BLUE        // "#58C4DD"
MX.C.DARK_BLUE   // "#236B8E"
MX.C.TEAL        // "#5CD0B3"
MX.C.GREEN       // "#83C167"
MX.C.YELLOW      // "#FFFF00"
MX.C.GOLD        // "#F0AC5F"
MX.C.RED         // "#FC6255"
MX.C.MAROON      // "#C55F73"
MX.C.PURPLE      // "#9A72AC"
MX.C.PINK        // "#D147BD"
MX.C.WHITE       // "#FFFFFF"
MX.C.LIGHT_GRAY  // "#BBBBBB"
MX.C.GRAY        // "#888888"
MX.C.DARK_GRAY   // "#444444"
MX.C.INDIGO      // "#818cf8"
MX.C.VIOLET      // "#6366f1"
MX.C.LAVENDER    // "#c4b5fd"
MX.C.EMERALD     // "#34d399"
MX.C.AMBER       // "#f59e0b"
MX.C.CORAL       // "#f87171"
MX.C.BG          // "#0f0e17"  (background color)
```

---

## SVG filters

### `MX.glow(mob, opts)`

Adds a glow filter to a mobject.

```js
MX.glow(circle, { color: MX.C.TEAL, radius: 8 });
```

### `MX.shadow(mob, opts)`

Adds a drop shadow filter.

```js
MX.shadow(card, { dx: 4, dy: 4, blur: 6 });
```

---

## Scene

`MX.scene()` creates a `Scene` — the root container that manages mobjects and runs animations.

> **Note:** You rarely call `MX.scene()` directly when using `MX.vizPlugin()`. The `MX.vizPlugin()` wrapper creates and manages the scene for you.

```js
var scene = MX.scene(svgElement, { background: "#0f0e17" });

scene.add(circle, label);
scene.remove(arrow);
scene.clear();

// Play animations (returns Promise)
scene.play(MX.fadeIn(circle), MX.growFromCenter(label));
scene.playSequence(MX.fadeIn(circle), MX.fadeIn(label));

// Camera
scene.camera.panTo({ x: 300, y: 200, duration: 1 });
scene.camera.zoomTo({ x: 250, y: 250, scale: 2, duration: 0.8 });
scene.camera.reset({ duration: 0.6 });
scene.camera.focusOn(circle, { scale: 1.5, duration: 0.8 });

// Utility
scene.getViewCenter();   // {x, y} of SVG center
scene.killAll();         // Kill all active tweens
```
