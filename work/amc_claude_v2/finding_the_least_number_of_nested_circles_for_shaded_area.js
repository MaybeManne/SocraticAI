MX.lesson("Finding the Least Number of Nested Circles for Shaded Area", function(L) {

L.source("AMC 10A 2023 \u00b715");
L.meta({ answer: "64" });

L.problem("An even number of circles are nested, all sharing a common point, with radii $1, 2, 3, \\ldots$ Every other ring is shaded, starting with the ring between radii $1$ and $2$. What is the **least number of circles** so the total shaded area is at least $2023\\pi$?", { highlight: "Least circles: total shaded \u2265 2023\u03c0" });

L.viz({ plugin: "nested_circles_lesson", config: {} });

L.act("Building the Picture", function(A) {
  A.vizPanel("svg");
  A.say("Every circle shares one bottom point. Starting with radius 1.")
   .do("drawCircle", { radius: 1 });
  A.say("Radius 2 expands \u2014 a ring appears between them, the first shaded region.")
   .do("drawCircle", { radius: 2 });
  A.say("Adding radii 3 through 8. Every other gap is shaded \u2014 four glowing rings.")
   .do("drawCircle", { radius: 3 })
   .do("drawCircle", { radius: 4 }, "+0.8")
   .do("drawCircle", { radius: 5 }, "+1.6")
   .do("drawCircle", { radius: 6 }, "+2.4")
   .do("drawCircle", { radius: 7 }, "+3.2")
   .do("drawCircle", { radius: 8 }, "+4.0");
});

L.act("The Shaded Rings", function(A) {
  A.vizPanel("svg");
  A.say("First shaded ring: between circles 1 and 2.")
   .do("highlightShadedArea", { r1: 1, r2: 2 });
  A.say("Second ring: between circles 3 and 4. Pattern alternates outward.")
   .do("highlightShadedArea", { r1: 3, r2: 4 });
});

L.act("Ring Area \u2014 Step 1", function(A) {
  A.vizPanel("svg");
  A.say("Ring $k$ is between radius $2k{-}1$ and $2k$. Area is outer disk minus inner disk.")
   .do("fadeInFormula")
   .show({ type: "latex", content: "A_k = \\pi(2k)^2 - \\pi(2k-1)^2" });
});

L.act("Ring Area \u2014 Step 2", function(A) {
  A.vizPanel("svg");
  A.say("Expand the squares: $4k^2\\pi$ from outer, $\\pi(4k^2 - 4k + 1)$ from inner.")
   .show({ type: "latex", content: "= \\pi\\bigl[4k^2 - (4k^2 - 4k + 1)\\bigr]" });
});

L.act("Ring Area \u2014 Step 3", function(A) {
  A.vizPanel("svg");
  A.say("The $4k^2$ terms cancel perfectly. Area is just $\\pi(4k-1)$ \u2014 linear in $k$.")
   .show({ type: "latex", content: "A_k = \\pi(4k - 1)", highlight: true });
});

L.act("Summing All Rings", function(A) {
  A.vizPanel("svg");
  A.say("With $n$ rings ($2n$ circles): sum all ring areas using the arithmetic series formula.")
   .show({ type: "latex", content: "S = \\pi\\sum_{k=1}^{n}(4k-1) = \\pi \\cdot n(2n+1)" });
});

L.act("Finding the Answer", function(A) {
  A.vizPanel("svg");
  A.say("Need $n(2n+1) \\geq 2023$. Graph crosses the orange threshold. Drag the slider to explore.")
   .do("drawGraph", { equation: "n(2n+1)" })
   .show({ type: "derivation", title: "Solve for n", steps: [
     { latex: "n(2n+1) \\geq 2023" },
     { latex: "n=31:\\; 31\\times63 = 1953 < 2023" },
     { latex: "n=32:\\; 32\\times65 = 2080 \\geq 2023", highlight: true }
   ]});
  A.say("$n=32$ \u2014 32 shaded rings, $2n = 64$ circles.")
   .do("highlightIntersection", { x: 2023 })
   .show({ type: "latex", content: "\\boxed{2n = 64 \\text{ circles}}", highlight: true });
});

L.ask({
  question: "What is the area of ring $k=1$?",
  options: ["$\\pi$", "$2\\pi$", "$3\\pi$", "$4\\pi$"],
  correct: 2,
  explain: {
    correct: "$A_1 = \\pi(4\\cdot1-1)=3\\pi$ \u2713",
    "0": "That\u2019s the inner disk $\\pi r^2$, not the ring gap.",
    "1": "Off by one: $4\\pi - \\pi = 3\\pi$.",
    "3": "$4\\pi$ is the full outer disk, not the ring."
  },
  wrongPath: function(B) {
    B.act("Ring Area Recap", function(A) {
      A.vizPanel("svg");
      A.say("Ring area = outer minus inner: $\\pi(4)-\\pi(1)=3\\pi$.")
       .do("highlightShadedArea", { r1: 1, r2: 2 })
       .show({ type: "latex", content: "A_1 = 4\\pi - \\pi = 3\\pi", highlight: true });
    });
  }
});

L.askFillIn({
  prompt: "Minimum circles needed: [___]",
  blank: { answer: ["64"], width: 60, placeholder: "?" },
  hint: "Find $n$ with $n(2n+1)\\geq2023$, answer is $2n$.",
  successMessage: "Correct! $n=32 \\Rightarrow 2n=64$ circles.",
  wrongPath: function(B) {
    B.act("Minimum Circles Recap", function(A) {
      A.vizPanel("svg");
      A.say("$n=32$: $32\\times65=2080\\geq2023$ \u2713. Circles $=2n=64$.")
       .do("highlightIntersection", { x: 2023 })
       .show({ type: "latex", content: "2n = 64 \\text{ circles}", highlight: true });
    });
  }
});

});
