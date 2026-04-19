# Card Types Reference

Cards appear in the notebook panel on the right as each beat plays. Attach a card with `.show(content)` (auto-detect) or `.card(type, data)` (explicit).

---

## `text`

Plain text with Markdown and inline LaTeX. The most common card type.

**Auto-detected** when you pass a plain string to `.show()`.

```js
A.say("Here's the key insight.")
 .show("The **discriminant** $\\Delta = b^2 - 4ac$ determines the number of roots.");
```

| Data field | Type | Description |
|-----------|------|-------------|
| `content` | `string` | Supports `**bold**`, `$inline LaTeX$`, `$$display LaTeX$$` |

**Explicit:**
```js
.card("text", { content: "The **discriminant** $\\Delta = b^2 - 4ac$." })
```

---

## `latex`

A single display-mode math equation.

**Auto-detected** when you pass a string starting with `$$` to `.show()`.

```js
A.say("The quadratic formula:").show("$$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$");
```

| Data field | Type | Description |
|-----------|------|-------------|
| `content` | `string` | LaTeX (without delimiters) |
| `latex` | `string` | Alias for `content` |
| `highlight` | `boolean` | Add a highlight background |
| `note` | `string` | Small annotation below the equation (supports LaTeX) |

**Explicit:**
```js
.card("latex", {
  content: "e^{i\\pi} + 1 = 0",
  note: "Euler's identity"
})
```

---

## `derivation`

Step-by-step algebraic derivation with optional notes per step.

```js
.card("derivation", {
  title: "Completing the Square",
  steps: [
    { expr: "ax^2 + bx + c = 0",   note: "Start here" },
    { expr: "x^2 + \\frac{b}{a}x = -\\frac{c}{a}", note: "Divide by $a$" },
    { expr: "\\left(x + \\frac{b}{2a}\\right)^2 = \\frac{b^2-4ac}{4a^2}" },
    { expr: "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}", highlight: true }
  ]
})
```

| Data field | Type | Description |
|-----------|------|-------------|
| `title` | `string` | Optional heading |
| `steps` | `Step[]` | Array of steps |
| `steps[].expr` | `string` | LaTeX for this step (also `latex`) |
| `steps[].note` | `string` | Side annotation — supports mixed LaTeX |
| `steps[].highlight` | `boolean` | Highlight this row |
| `steps[].wrong` | `boolean` | Mark this row as a common mistake |

---

## `title`

Full-screen overlay with heading, subheading, and optional paragraphs. Does not appear in the notebook scroll — it animates over the page, then fades out after 4 seconds.

```js
A.title("Chapter 2", "The Pythagorean Theorem");

// or via .card():
.card("title", {
  heading: "Chapter 2",
  subheading: "The Pythagorean Theorem",
  paragraphs: [
    "One of the most famous results in all of mathematics.",
    { text: "Proved in 570 BCE.", style: "highlight" }
  ]
})
```

| Data field | Type | Description |
|-----------|------|-------------|
| `heading` | `string` | Large heading text |
| `subheading` | `string` | Smaller subheading |
| `paragraphs` | `(string \| {text, style?})[]` | Optional body paragraphs |

---

## `figure`

Directs a static image or SVG into the viz panel. Optionally adds a caption card to the notebook.

```js
.card("figure", {
  caption: "A right triangle with legs $a$, $b$ and hypotenuse $c$."
})
```

| Data field | Type | Description |
|-----------|------|-------------|
| `caption` | `string` | Caption text (supports mixed LaTeX) — creates a text card in notebook |
| `svg` | `string` | SVG string to inject into the viz panel |

---

## `recap`

Collapsible summary list — expands on render, collapses on click.

```js
.card("recap", {
  title: "Key Takeaways",
  items: [
    "$\\Delta > 0$ → two real roots",
    "$\\Delta = 0$ → one real root",
    "$\\Delta < 0$ → no real roots"
  ]
})
```

**Shorthand items** — strings become `text` items. For more control, use item objects:

```js
items: [
  { type: "text",    value: "The determinant controls root count." },
  { type: "latex",   value: "\\Delta = b^2 - 4ac", display: true },
  { type: "example", value: "For $x^2 - x - 6$: $\\Delta = 1 + 24 = 25 > 0$." },
  { type: "step",    num: 1, value: "Compute $\\Delta$." }
]
```

| Data field | Type | Description |
|-----------|------|-------------|
| `title` | `string` | Recap heading (default `"Quick Review"`) |
| `items` | `(string \| Item)[]` | List entries |
| `figure` | `object` | Optional figure to show in the viz panel |

---

## `bar-chart`

Animated bar chart that grows in on render.

```js
.card("bar-chart", {
  title: "Circles by Year",
  bars: [
    { label: "2019", value: 12, display: "12" },
    { label: "2020", value: 31, display: "31" },
    { label: "2021", value: 64, display: "64" }
  ],
  maxValue: 80,
  colors: [MX.C.INDIGO, MX.C.TEAL, MX.C.AMBER],
  pattern: "Values roughly **triple** each year."
})
```

**Shorthand** — use `labels` + `values` arrays instead of `bars`:

```js
.card("bar-chart", {
  title: "Growth",
  labels: ["2019", "2020", "2021"],
  values: [12, 31, 64]
})
```

| Data field | Type | Description |
|-----------|------|-------------|
| `title` | `string` | Chart title |
| `bars` | `{label, value, display?}[]` | Bar definitions |
| `labels` | `string[]` | Shorthand — bar labels |
| `values` | `number[]` | Shorthand — bar values |
| `maxValue` | `number` | Scale denominator (default: max of values) |
| `colors` | `string[]` | Per-bar colors (cycles) |
| `pattern` | `string` | Pattern observation shown below (supports LaTeX) |

---

## `split`

Two-column layout for comparisons.

```js
.card("split", {
  title: "Two Representations",
  left:  { type: "latex", content: "\\sin^2\\theta + \\cos^2\\theta = 1" },
  right: { type: "text",  content: "**Pythagorean Identity** — holds for all $\\theta$." }
})
```

| Data field | Type | Description |
|-----------|------|-------------|
| `title` | `string` | Optional heading |
| `left` | `Panel` | Left panel: `{ type: "latex"\|"text", content }` |
| `right` | `Panel` | Right panel |

---

## `plot-2d`

Static 2D function plot with animated draw-in. Axes are auto-scaled from data.

```js
.card("plot-2d", {
  title: "The Parabola $y = x^2$",
  xRange: [-3, 3],
  yRange: [0, 9],
  xLabel: "x",
  yLabel: "y",
  functions: [
    { fn: "x * x",       color: MX.C.TEAL },
    { fn: "2 * x + 1",   color: MX.C.AMBER, style: "dashed" }
  ],
  points: [
    { x: 1, y: 1, label: "(1,1)", highlight: true },
    { x: -1, y: 1 }
  ],
  threshold: { value: 4, label: "y = 4" },
  note: "The vertex is at $(0, 0)$."
})
```

| Data field | Type | Description |
|-----------|------|-------------|
| `title` | `string` | Optional title |
| `xRange` | `[min, max]` | x-axis bounds (also `xMin`/`xMax`) |
| `yRange` | `[min, max]` | y-axis bounds (also `yMin`/`yMax`) |
| `xLabel` | `string` | x-axis label |
| `yLabel` | `string` | y-axis label |
| `xTicks` | `number[]` | Custom tick positions on x-axis |
| `yStep` | `number` | y-axis grid step (auto-computed if omitted) |
| `functions` | `{fn, color, style?}[]` | Functions to plot; `fn` is a JS string like `"x * x"` |
| `points` | `{x, y, label?, color?, highlight?}[]` | Scatter points |
| `threshold` | `{value, label}` | Horizontal reference line |
| `note` | `string` | Note below the chart (supports LaTeX) |

---

## Planned card types

These types are defined in `engine/graph-card.js` and `engine/viz-3d.js` (Stage 1 features, not yet stable):

| Type | Description |
|------|-------------|
| `graph` | Interactive 2D plotter using JSXGraph |
| `code-runner` | p5.js sandbox with live execution |
