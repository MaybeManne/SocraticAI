# Your First Lesson

You'll build a minimal lesson that explains the quadratic formula. It has two acts, one interactive quiz gate, and a simple number-line visualization.

## 1. Create the file

Create `content/quadratic.js`:

```js
MX.lesson("The Quadratic Formula", function(L) {

  L.source("Getting Started Tutorial");
  L.problem("Solve $ax^2 + bx + c = 0$ for $x$.");

  // ── Act 1: The problem ──────────────────────────────────────────────
  L.act("Setting Up", function(A) {

    A.say("Every quadratic equation has the form ax-squared plus bx plus c equals zero.")
     .show("$$ax^2 + bx + c = 0$$");

    A.say("We want to isolate x. The trick is a technique called completing the square.")
     .card("derivation", {
       title: "Steps",
       steps: [
         { expr: "ax^2 + bx + c = 0",          note: "Start here" },
         { expr: "x^2 + \\frac{b}{a}x = -\\frac{c}{a}", note: "Divide by $a$" }
       ]
     });
  });

  // ── Act 2: The formula ──────────────────────────────────────────────
  L.act("The Formula", function(A) {

    A.say("After completing the square and taking the square root, we arrive at the quadratic formula.")
     .show("$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$");

    A.say("The expression under the square root is called the discriminant.")
     .card("split", {
       left:  { type: "latex", content: "\\Delta = b^2 - 4ac" },
       right: { type: "text",  content: "**Positive** → 2 real roots\n**Zero** → 1 real root\n**Negative** → no real roots" }
     });
  });

  // ── Gate: quiz ──────────────────────────────────────────────────────
  L.ask({
    type: "quiz",
    question: "If $\\Delta < 0$, how many real solutions does the equation have?",
    options: ["Two real solutions", "One real solution", "No real solutions", "Infinitely many"],
    correct: 2,
    explain: {
      correct: "Right — a negative discriminant means the square root is imaginary.",
      "0": "Not quite — two real solutions require $\\Delta > 0$.",
      "1": "One solution requires $\\Delta = 0$.",
      "3": "A quadratic has at most two solutions."
    },
    wrongPath: function(B) {
      B.act("The Discriminant Revisited", function(A) {
        A.say("Let's look at the discriminant more carefully.")
         .show("The discriminant $\\Delta = b^2 - 4ac$ lives inside the square root.");

        A.say("You can't take the square root of a negative number in the reals — so $\\Delta < 0$ means zero real solutions.")
         .card("recap", {
           title: "Discriminant Summary",
           items: [
             "$\\Delta > 0$: two distinct real roots",
             "$\\Delta = 0$: exactly one real root (a double root)",
             "$\\Delta < 0$: no real roots"
           ]
         });
      });
    }
  });

});
```

## 2. Build it

```bash
./build.sh --mx content/quadratic.js dist/quadratic.html
```

Output:

```
Built: dist/quadratic.html (475 KB) [MX + content + engine]
```

## 3. Open it

Open `dist/quadratic.html` in a browser. You'll see:

1. The problem statement fills the screen in **hero mode**
2. Click anywhere to collapse it and start playback
3. The notebook fills with cards as each beat plays
4. After Act 2, a quiz gate appears — try getting it wrong to trigger the branch

## What's happening

| DSL call | What it does |
|----------|-------------|
| `L.problem(...)` | Sets the pinned problem bar at the top |
| `L.act("Title", fn)` | Creates a teaching segment |
| `A.say("...")` | Narration text — drives timing and subtitles |
| `.show("...")` | Attaches a card to this beat (auto-detects type) |
| `.card("derivation", {...})` | Attaches a typed card explicitly |
| `L.ask({...})` | Creates an interactive gate (quiz, fill-in, etc.) |
| `wrongPath: function(B)` | Branch lesson if student answers incorrectly |

## Next steps

- **Add a visualization** — see [Writing Viz Plugins](../guides/viz-plugins.md)
- **Learn all card types** — see [Card Types Reference](../reference/card-types.md)
- **Add audio** — see [TTS Audio](../guides/tts-audio.md)
- **See the full API** — see [DSL Reference](../reference/dsl.md)
