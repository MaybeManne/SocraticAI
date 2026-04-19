# code2html

**code2html** is a visual-first lesson engine for building interactive, animated math explainers. You write a lesson as a JavaScript script — narration, cards, and visualization actions — then compile it to a single self-contained HTML file.

## How it works

A lesson is a timeline of **acts** (teaching segments) and **gates** (interactive checkpoints). Each act contains **beats** — narrated moments that can display a notebook card and trigger synchronized animations in a side-by-side SVG visualization. When a student answers a gate question incorrectly, the lesson branches to a remediation path, then rejoins the main flow.

The compiled output is a ~500 KB HTML file with no server or network dependency.

## Sections

| Section | What's in it |
|---------|--------------|
| [Getting Started](./getting-started/index.md) | Build and run your first lesson in five minutes |
| [Guides](./guides/index.md) | Deep dives into the build pipeline, content authoring, viz plugins, and the agentic pipeline |
| [Reference](./reference/index.md) | Complete API for every class, method, card type, and event |
| [Examples](./examples/index.md) | Annotated walkthroughs of the example and content scripts |

## Quick overview

```js
MX.lesson("Pythagorean Theorem", function(L) {

  L.problem("Prove that a² + b² = c².");

  L.act("Setting the stage", function(A) {
    A.say("Consider a right triangle with legs a and b and hypotenuse c.")
     .show("We want to show that $a^2 + b^2 = c^2$.")
     .do("drawTriangle");

    A.say("Let's draw squares on each side.")
     .do("drawSquares", {}, "+0.5");
  });

  L.ask({
    type: "quiz",
    question: "Which side is the hypotenuse?",
    options: ["Side a", "Side b", "Side c", "The right angle"],
    correct: 2,
    explain: { correct: "Correct — the hypotenuse is opposite the right angle." }
  });
});
```

Build it:

```bash
./build.sh --mx content/my-lesson.js dist/my-lesson.html
```

Open `dist/my-lesson.html` in any browser.
