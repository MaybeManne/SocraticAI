# Example: Gate Types Showcase

**File:** `examples/02_gates.js`  
**Build:** `./build.sh --mx examples/02_gates.js dist/examples/02_gates.html`

This lesson demonstrates all four gate types with realistic questions. Each gate has a `wrongPath` branch (except `interactive`).

---

## Pattern: quiz with per-option explanations

```js
L.ask({
  type: "quiz",
  question: "What is $\\pi$ approximately equal to?",
  options: ["2.718", "3.14159", "1.618", "1.0"],
  correct: 1,
  explain: {
    correct: "Yes — $\\pi \\approx 3.14159$.",
    "0": "2.718 is Euler's number $e$, not $\\pi$.",
    "2": "1.618 is the golden ratio $\\phi$.",
    "3": "1.0 is not close to $\\pi$."
  },
  wrongPath: function(B) {
    B.act("Constants Review", function(A) {
      A.say("Let's review the major mathematical constants.")
       .card("recap", {
         title: "Key Constants",
         items: [
           { type: "latex", value: "\\pi \\approx 3.14159", display: true },
           { type: "latex", value: "e \\approx 2.71828",   display: true },
           { type: "latex", value: "\\phi = \\frac{1+\\sqrt{5}}{2} \\approx 1.618", display: true }
         ]
       });
    });
  }
});
```

The `explain` object keys are either `"correct"` or the option index as a string. Any key can be omitted — the gate shows an empty explanation for that option.

---

## Pattern: fill-in with normalized answers

```js
L.askFillIn({
  prompt: "The area of a circle with radius $r$ is $A = $ [___].",
  blank: {
    answer: ["pi r^2", "\\pi r^2", "π r²", "πr²", "pi*r*r"],
    width: "100px",
    placeholder: "formula"
  },
  hint: "Think: circumference is $2\\pi r$, area involves $r^2$.",
  successMessage: "$A = \\pi r^2$ — the classic circle area formula.",
  wrongPath: function(B) {
    B.act("Circle Area Derivation", function(A) {
      A.say("Let's derive the area formula from scratch.")
       .card("derivation", {
         title: "Area from Integration",
         steps: [
           { expr: "A = \\int_0^r 2\\pi t \\, dt" },
           { expr: "A = 2\\pi \\cdot \\frac{r^2}{2}" },
           { expr: "A = \\pi r^2" }
         ]
       });
    });
  }
});
```

The fill-in validator normalizes input before comparison: strips LaTeX delimiters, lowercases, removes spaces, converts `π` to `pi`, handles `a/b` fractions. So `"pi r^2"`, `"\\pi r^2"`, and `"πr²"` all match if any of them are in `answer`.

---

## Pattern: proof-builder with distractors

```js
L.askProof({
  instruction: "Arrange the steps to prove that $\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}$.",
  slots: 3,
  availablePieces: [
    { id: "p1", latex: "\\text{Base: } n=1 \\Rightarrow 1 = \\frac{1 \\cdot 2}{2} \\checkmark" },
    { id: "p2", latex: "\\text{Assume: } \\sum_{k=1}^{m} k = \\frac{m(m+1)}{2}" },
    { id: "p3", latex: "\\sum_{k=1}^{m+1} k = \\frac{(m+1)(m+2)}{2} \\checkmark" },
    { id: "d1", latex: "\\text{Assume the formula fails for } m+1" }  // distractor
  ],
  correctOrder: ["p1", "p2", "p3"],
  hint: "Mathematical induction: base case, then inductive step."
});
```

You can include more pieces than slots to add distractors. The student must place exactly `slots` pieces. Clicking a filled slot returns the piece to the tray.

---

## Pattern: interactive gate with a live compute function

```js
L.ask({
  type: "interactive",
  title: "Explore Circle Area",
  slider: { min: 1, max: 20, step: 1, default: 5 },
  compute: function(r) {
    var area = Math.PI * r * r;
    return {
      r:    r,
      area: area.toFixed(2)
    };
  },
  displays: [
    { field: "r",    label: "Radius" },
    { field: "area", label: "Area",   style: "large" }
  ],
  challenge: "Find a radius where $A > 100$."
});
```

`compute` receives the current slider value. The returned object's fields must match `displays[].field`. `style: "large"` renders that value in a large span — useful for the answer you want students to observe.

The "Continue →" button is always available. The gate resolves immediately as correct.
