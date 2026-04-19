# Gate Types Reference

Gates pause playback and present an interactive question. The lesson only continues after the student interacts. If the answer is wrong (past the allowed attempts), the `wrongPath` branch plays, then rejoins the main lesson.

---

## `quiz`

Multiple-choice question with up to 8 options.

```js
L.ask({
  type: "quiz",
  question: "Which side of a right triangle is the hypotenuse?",
  options: [
    "The shortest side",
    "Either leg",
    "The side opposite the right angle",
    "The side adjacent to the largest angle"
  ],
  correct: 2,
  explain: {
    correct: "Correct — the hypotenuse is always opposite the right angle.",
    "0": "The hypotenuse is actually the longest side, not the shortest.",
    "1": "Neither leg is the hypotenuse.",
    "3": "Close — the hypotenuse is opposite the right angle, not just adjacent to the largest angle."
  },
  wrongPath: function(B) {
    B.act("Revisiting Triangle Sides", function(A) {
      A.say("Let's look at the triangle again.")
       .show("In a right triangle, the **hypotenuse** is the side opposite the 90° angle.");
    });
  }
});
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | `string` | ✓ | Question text (supports LaTeX) |
| `options` | `string[]` | ✓ | Answer choices — 2 to 8 options |
| `correct` | `number` | ✓ | Zero-based index of correct option |
| `explain` | `object` | | Keyed by `"correct"` or option index as string |
| `wrongPath` | `function(B)` | | Branch lesson for wrong answer |

**Behavior:** One wrong answer triggers `wrongPath` immediately (no retries). Correct answer shows the explanation for 2 s, then continues. Wrong answer shows the explanation for 3 s, then plays `wrongPath`.

---

## `fill-in`

Type-in-the-blank question. The blank appears inline within a sentence.

```js
L.ask({
  type: "fill-in",
  prompt: "The circumference of a circle is $C = $ [___] $\\times d$.",
  blank: {
    answer: ["pi", "π", "3.14159", "\\pi"],
    width: "60px",
    placeholder: "?"
  },
  hint: "It's a famous Greek letter.",
  successMessage: "Correct — $C = \\pi d$.",
  wrongPath: function(B) { ... }
});

// Shorthand:
L.askFillIn({
  prompt: "...",
  blank: { answer: [...], width: "60px" }
});
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | `string` | ✓ | Sentence containing `[___]` as the blank marker |
| `blank.answer` | `string[]` | ✓ | Accepted answers (normalized before comparison) |
| `blank.width` | `string` | | CSS width of the input (e.g. `"80px"`) |
| `blank.placeholder` | `string` | | Placeholder text |
| `hint` | `string` | | Shown after first wrong attempt |
| `successMessage` | `string` | | Shown on correct answer |
| `wrongPath` | `function(B)` | | Branch lesson after 3 wrong attempts |

**Answer normalization:** The validator strips LaTeX markup, lowercases, removes spaces, normalizes π/×/÷ symbols, and resolves `a/b` fractions. So `"Pi"`, `"π"`, `"\\pi"`, and `"3.14159"` can all match the same answer.

**Behavior:** Up to 3 attempts. On third wrong attempt, the answer is revealed as correct and `wrongPath` is triggered.

---

## `proof-builder`

Drag-and-drop proof step ordering. Students drag tiles into slots in the correct order.

```js
L.ask({
  type: "proof-builder",
  instruction: "Arrange the steps to prove $\\sqrt{2}$ is irrational.",
  slots: 4,
  availablePieces: [
    { id: "p1", latex: "\\text{Assume } \\sqrt{2} = \\frac{p}{q}" },
    { id: "p2", latex: "2q^2 = p^2 \\Rightarrow p \\text{ is even}" },
    { id: "p3", latex: "p = 2k \\Rightarrow q \\text{ is also even}" },
    { id: "p4", latex: "\\text{Contradiction — } \\gcd(p,q) \\geq 2" }
  ],
  correctOrder: ["p1", "p2", "p3", "p4"],
  hint: "Start with the assumption and derive contradictions.",
  wrongPath: function(B) { ... }
});

// Shorthand:
L.askProof({ ... });
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `instruction` | `string` | ✓ | Instructions for the student (supports LaTeX) |
| `slots` | `number` | ✓ | Number of slots to fill |
| `availablePieces` | `{id, latex}[]` | ✓ | Draggable tiles (can include distractors) |
| `correctOrder` | `string[]` | ✓ | Piece IDs in correct order |
| `hint` | `string` | | Shown after first wrong check |
| `wrongPath` | `function(B)` | | Branch lesson after 3 failed checks |

**Behavior:** Student drags pieces into slots and clicks "Check". Up to 3 checks allowed. On third failed check, the correct order is revealed and `wrongPath` is triggered. Supports mouse drag-and-drop and touch via pointer events. Clicking a filled slot removes the piece back to the tray.

---

## `interactive`

Slider-driven exploration with live computation. Never triggers `wrongPath` — this is an exploration gate, not an assessment.

```js
L.ask({
  type: "interactive",
  title: "Explore the Discriminant",
  description: "Drag the slider to change $b$ and see how roots change.",
  slider: {
    min: -10,
    max: 10,
    step: 1,
    default: 3
  },
  compute: "function(b) { var disc = b*b - 4; return { disc: disc, roots: disc > 0 ? 2 : disc === 0 ? 1 : 0 }; }",
  displays: [
    { field: "disc",  label: "Discriminant", style: "large" },
    { field: "roots", label: "Real roots" }
  ],
  challenge: "Find a value of $b$ where $\\Delta = 0$."
});
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | ✓ | Heading above the slider |
| `description` | `string` | | Subheading or instruction |
| `slider.min` | `number` | ✓ | Minimum slider value |
| `slider.max` | `number` | ✓ | Maximum slider value |
| `slider.step` | `number` | ✓ | Slider step size |
| `slider.default` | `number` | ✓ | Initial value |
| `compute` | `string \| function` | ✓ | JS function that takes slider value, returns result object |
| `displays` | `{field, label, style?}[]` | ✓ | Fields to display from the result |
| `challenge` | `string` | | Optional goal prompt (supports LaTeX) |

**`compute` note:** Pass a JS function string (for the agentic pipeline) or an actual function (for hand-written content). It receives the slider value and must return an object whose keys match `displays[].field`.

**`displays[].style`:** `"large"` renders the value in a bigger `<span>`.

**Behavior:** Student moves the slider and clicks "Continue →" when ready. Resolves as correct — no wrong path.
