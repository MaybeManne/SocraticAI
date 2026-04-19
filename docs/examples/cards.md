# Example: Card Types Showcase

**File:** `examples/01_cards.js`  
**Build:** `./build.sh --mx examples/01_cards.js dist/examples/01_cards.html`

This lesson has no visualization — every act sets `A.vizPanel("hidden")` so the notebook takes the full screen width. The goal is to show each card type in isolation.

---

## Pattern: text card via `.show()`

```js
A.say("The simplest card is the text card.")
 .show("This is a **text** card. It supports *Markdown*: bold, italic, lists, and code.");
```

Passing a plain string to `.show()` auto-creates a `text` card. The engine parses `**bold**`, inline `$LaTeX$`, and display `$$LaTeX$$` from a single string using `K.mixed()`.

---

## Pattern: LaTeX card via `$$` detection

```js
A.say("The LaTeX card renders a full math expression.")
 .show("$$\\int_a^b f(x)\\,dx = F(b) - F(a)$$");
```

When `.show()` receives a string starting with `$$`, it auto-creates a `latex` card rendered in display mode via KaTeX.

---

## Pattern: explicit `.card("latex")` with note

```js
.card("latex", {
  content: "e^{i\\pi} + 1 = 0",
  note: "Euler's identity — often called the most beautiful equation in mathematics."
})
```

Use explicit `.card()` when you need the `note` field — a small annotation below the equation.

---

## Pattern: derivation with highlights and notes

```js
.card("derivation", {
  title: "Completing the Square",
  steps: [
    { expr: "ax^2 + bx + c = 0",                    note: "Start with general quadratic" },
    { expr: "ax^2 + bx = -c",                        note: "Move constant to right side" },
    { expr: "x^2 + \\frac{b}{a}x = -\\frac{c}{a}",  note: "Divide through by $a$" },
    { expr: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", note: "Take square root of both sides" }
  ]
})
```

Each step can have `highlight: true` to add an indigo background, or `wrong: true` to add a red tint for common mistakes.

---

## Pattern: split card for comparisons

```js
.card("split", {
  left:  { type: "latex",  content: "\\sin^2\\theta + \\cos^2\\theta = 1" },
  right: { type: "text",   content: "**Pythagorean Identity**: holds for all real $\\theta$." }
})
```

Left and right panels each have their own type. Mix LaTeX on one side with an explanation on the other.

---

## Pattern: recap with item types

```js
.card("recap", {
  title: "Key Formulas",
  items: [
    { type: "text",    value: "Start with the Pythagorean theorem." },
    { type: "latex",   value: "a^2 + b^2 = c^2", display: true },
    { type: "example", value: "3-4-5: $9 + 16 = 25$ ✓" },
    { type: "step",    num: 1, value: "Identify the legs." }
  ]
})
```

Recap cards open automatically when rendered. Click the header to collapse. The four item types (`text`, `latex`, `example`, `step`) give you formatting flexibility without leaving the DSL.

---

## Pattern: bar-chart with shorthand labels/values

```js
.card("bar-chart", {
  title: "Fibonacci Growth",
  labels: ["n=1", "n=2", "n=3", "n=4", "n=5"],
  values: [1, 1, 2, 3, 5],
  pattern: "Each value is the **sum** of the two before it."
})
```

The shorthand `labels` + `values` arrays are equivalent to a `bars` array. Bars animate in with staggered CSS transitions (300 ms apart).

---

## Pattern: plot-2d with functions and points

```js
.card("plot-2d", {
  title: "The Parabola",
  xRange: [-3, 3],
  yRange: [-1, 9],
  functions: [
    { fn: "x * x",     color: "#818cf8" },
    { fn: "2 * x - 1", color: "#f59e0b", style: "dashed" }
  ],
  points: [
    { x: 1, y: 1, label: "(1,1)", highlight: true }
  ],
  threshold: { value: 4, label: "y=4" }
})
```

Functions are JS expression strings — the engine wraps them in `new Function("x", "return (" + fn + ");")`. Path length is measured and drawn with the stroke-dashoffset animation. Dashed style applies `stroke-dasharray: 4 3`.
