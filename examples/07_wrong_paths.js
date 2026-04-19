/* examples/07_wrong_paths.js — Multi-level wrong path branching
   Demonstrates: nested wrong paths, proof-builder gate, multi-act remediation
   Build: ./build.sh --mx examples/07_wrong_paths.js dist/examples/07_wrong_paths.html */

MX.lesson("Completing the Square", function(L) {

  L.source("code2html_v2 Examples");
  L.problem("Solve $x^2 + 6x + 5 = 0$ by completing the square.");

  L.act("Setting up", function(A) {
    A.vizPanel("hidden");

    A.say("Move the constant to the right side first.")
     .card("derivation", {
       steps: [
         { expr: "x^2 + 6x + 5 = 0" },
         { expr: "x^2 + 6x = -5" }
       ]
     });

    A.say("We add $(b/2)^2 = (6/2)^2 = 9$ to both sides.")
     .show("$$x^2 + 6x + 9 = -5 + 9 = 4$$");
  });

  L.act("Factoring the perfect square", function(A) {
    A.vizPanel("hidden");

    A.say("The left side is now a perfect square trinomial.")
     .card("derivation", {
       steps: [
         { expr: "(x + 3)^2 = 4" },
         { expr: "x + 3 = \\pm 2" },
         { expr: "x = -1 \\text{ or } x = -5", highlight: true }
       ]
     });
  });

  // ── Gate: proof-builder ────────────────────────────────────────────────────
  L.askProof({
    instruction: "Arrange the steps to solve $x^2 + 6x + 5 = 0$ by completing the square.",
    slots: 5,
    availablePieces: [
      { id: "p1", latex: "x^2 + 6x = -5" },
      { id: "p2", latex: "x^2 + 6x + 9 = 4" },
      { id: "p3", latex: "(x+3)^2 = 4" },
      { id: "p4", latex: "x + 3 = \\pm 2" },
      { id: "p5", latex: "x = -1 \\text{ or } x = -5" },
      { id: "d1", latex: "x^2 + 5 = 6x" }  // distractor
    ],
    correctOrder: ["p1", "p2", "p3", "p4", "p5"],
    hint: "Start by moving the constant, then add $(b/2)^2$.",
    wrongPath: function(B) {
      B.act("Why $(b/2)^2$?", function(A) {
        A.vizPanel("hidden");

        A.say("To make a perfect square, we need $x^2 + bx + c$ where $c = (b/2)^2$.")
         .card("derivation", {
           title: "The $(b/2)^2$ rule",
           steps: [
             { expr: "(x + k)^2 = x^2 + 2kx + k^2" },
             { expr: "\\text{match: } 2k = b \\Rightarrow k = b/2" },
             { expr: "\\text{so add: } k^2 = (b/2)^2" }
           ]
         });

        A.say("For $b = 6$: add $(6/2)^2 = 9$. The left side becomes $(x+3)^2$.")
         .show("Always add the same value to both sides to keep the equation balanced.");
      });

      B.act("Factoring review", function(A) {
        A.vizPanel("hidden");

        A.say("A perfect square trinomial $x^2 + 2kx + k^2$ always factors as $(x+k)^2$.")
         .card("recap", {
           title: "Perfect square patterns",
           items: [
             { type: "latex", value: "x^2 + 6x + 9 = (x+3)^2", display: true },
             { type: "latex", value: "x^2 - 4x + 4 = (x-2)^2", display: true },
             { type: "text",  value: "The constant is always the square of half the linear coefficient." }
           ]
         });
      });
    }
  });

  L.act("Checking our answers", function(A) {
    A.vizPanel("hidden");

    A.say("Verify by substituting back: $(-1)^2 + 6(-1) + 5 = 1 - 6 + 5 = 0$. And $(-5)^2 + 6(-5) + 5 = 25 - 30 + 5 = 0$.")
     .card("recap", {
       title: "Both solutions check out",
       items: [
         { type: "step", num: 1, value: "$x = -1$: $(−1)^2 + 6(−1) + 5 = 0$ ✓" },
         { type: "step", num: 2, value: "$x = -5$: $(−5)^2 + 6(−5) + 5 = 0$ ✓" }
       ]
     });
  });

});
