# Writing Content Scripts

A content script exports a lesson by calling `MX.lesson()`. Everything inside that call is the DSL.

## The three-level structure

```
Lesson
├── Problem statement
├── Acts (teaching segments)
│   └── Beats (narrated moments with cards + viz actions)
├── Markers (passive chapter dividers)
└── Gates (interactive checkpoints)
    └── Wrong path (branch lesson triggered on wrong answer)
```

## Minimal lesson

```js
MX.lesson("Euler's Identity", function(L) {

  L.problem("Show that $e^{i\\pi} + 1 = 0$.");

  L.act("The Formula", function(A) {
    A.say("This equation connects five fundamental constants.")
     .show("$$e^{i\\pi} + 1 = 0$$");
  });

});
```

## Acts and beats

Each `L.act()` gets a title and a callback that receives `A` (an `ActBuilder`). Inside, you create beats with `A.say()`.

```js
L.act("Introducing π", function(A) {

  // Set the default viz panel mode for all beats in this act
  A.vizPanel("svg");

  // Beat 1: narration + card
  A.say("Pi is the ratio of a circle's circumference to its diameter.")
   .show("$$\\pi = \\frac{C}{d} \\approx 3.14159\\ldots$$");

  // Beat 2: narration + card + synchronized viz action
  A.say("As we draw the circle, watch the ratio stay constant.")
   .show("No matter how large the circle, $C/d$ is always $\\pi$.")
   .do("drawCircle")
   .do("showRatio", {}, "+0.8");   // fires 0.8s after beat starts

  // Beat 3: inline the viz snapshot into the notebook
  A.say("Here's what we've drawn so far.")
   .inline();

});
```

## Cards

`.show(content)` is the quick way to add a card. The engine auto-detects the type:

| `content` value | Card type created |
|----------------|------------------|
| Plain string | `text` (supports `**bold**`, `$inline$`, `$$display$$`) |
| String starting with `$$` | `latex` |
| Object with `type` key | That type explicitly |

For full control, use `.card(type, data)`:

```js
A.say("Here's the derivation.")
 .card("derivation", {
   title: "Completing the Square",
   steps: [
     { expr: "x^2 + bx = -c" },
     { expr: "x^2 + bx + \\frac{b^2}{4} = \\frac{b^2}{4} - c", note: "Add $(b/2)^2$" },
     { expr: "\\left(x + \\frac{b}{2}\\right)^2 = \\frac{b^2 - 4c}{4}" }
   ]
 });
```

See [Card Types Reference](../reference/card-types.md) for every card type.

## Viz actions

Use `.do(method, params, offset)` to schedule a visualization action during a beat.

```js
A.say("First we draw the triangle, then label its sides.")
 .do("drawTriangle")                  // fires at beat start (offset 0)
 .do("showLabels", { color: "amber" }, "+0.5");  // fires 0.5s later
```

The `method` name must match a method your `EXPLAINER_VIZ` plugin implements in `timelineAction`. See [Viz Plugins](./viz-plugins.md).

**Offset rules:**

| Offset value | Meaning |
|-------------|---------|
| `0` (default) | At beat start — reveal, then explain |
| `"+0.5"` | 0.5 s after beat start — explain, then reveal |
| `"+1.0"` | 1.0 s after beat start — explain first, reveal second |
| `1.5` (number) | 1.5 s absolute from beat start |

## Inlining the viz

`.inline()` snapshots the current state of the SVG visualization and inserts it as a frozen image in the notebook. Use this to create a permanent record of what the viz looks like at a key moment.

```js
A.say("That's the complete figure.")
 .inline();                   // auto-detect type

A.say("Here's the chart we built.")
 .inline("chart");            // explicit type: "svg" | "figure" | "chart"
```

## Markers

Markers are passive chapter dividers — they appear as dots on the scrubber but don't interrupt playback.

```js
L.marker("Derivation Phase");
```

## Gates

Gates pause playback and display an interactive question. Use `L.ask()` for all gate types.

```js
L.ask({
  type: "quiz",
  question: "What is $\\pi$ approximately?",
  options: ["2.718", "3.14159", "1.618", "1.0"],
  correct: 1,
  explain: {
    correct: "Yes — $\\pi \\approx 3.14159$.",
    "0": "2.718 is Euler's number $e$, not $\\pi$."
  }
});
```

For fill-in blanks:

```js
L.ask({
  type: "fill-in",
  prompt: "The circumference of a circle is $C = $ [___] $\\times d$.",
  blank: {
    answer: ["pi", "π", "3.14159"],
    width: "60px",
    placeholder: "?"
  },
  hint: "It's a famous Greek letter.",
  successMessage: "Correct — $C = \\pi d$."
});

// Shorthand:
L.askFillIn({ prompt: "...", blank: {...} });
```

For proof builders:

```js
L.ask({
  type: "proof-builder",
  instruction: "Arrange the steps to complete the proof.",
  slots: 3,
  availablePieces: [
    { id: "p1", latex: "a^2 + b^2" },
    { id: "p2", latex: "= c^2" },
    { id: "p3", latex: "\\text{QED}" }
  ],
  correctOrder: ["p1", "p2", "p3"],
  hint: "Start with the left-hand side."
});

// Shorthand:
L.askProof({ ... });
```

## Wrong paths

Any gate type (except `interactive`) can have a `wrongPath`. It's a function that receives a `LessonBuilder` and defines a mini-lesson that plays when the student answers incorrectly.

```js
L.ask({
  type: "quiz",
  question: "...",
  correct: 0,
  wrongPath: function(B) {
    B.act("Let's Review", function(A) {
      A.say("Let's go back to basics.")
       .show("Here's what you need to know...");
    });
    // Add as many acts as needed
  }
});
```

After the wrong path plays, the lesson rejoins the main path at the next act.

## Timing and duration

Duration is estimated automatically at ~2.5 words per second. Override it if needed:

```js
A.say("Short sentence.")
 .duration(3);    // force 3 seconds regardless of word count
```

## Viz panel modes

Set the panel mode per act or per beat:

```js
// Act-level default
A.vizPanel("hidden");

// Beat-level override
A.say("Here's the chart.")
 .vizPanel("chart")
 .inline("chart");
```

| Mode | Effect |
|------|--------|
| `svg` | Main SVG visualization (default) |
| `figure` | Show a static figure in the panel |
| `chart` | Show an animated bar chart |
| `hidden` | Hide the panel, notebook takes full width |
| `wide` | Panel takes more horizontal space |
| `3d` | Three.js canvas (requires `engine/viz-3d.js`) |

## Metadata

```js
MX.lesson("My Lesson", function(L) {
  L.source("AMC 10A 2023 #15");          // Attribution shown in title bar
  L.meta({
    id: "my_lesson",                      // Used in audio file naming
    grade: "10",
    tags: ["geometry", "competition"]
  });
  L.problem("Find the area of...", { highlight: "area" });
  // ...
});
```
