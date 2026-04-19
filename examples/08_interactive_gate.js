/* examples/08_interactive_gate.js — Interactive slider gate + live viz sync
   Demonstrates: interactive gate with compute, vizSync, inline chart
   Build: ./build.sh --mx examples/08_interactive_gate.js dist/examples/08_interactive_gate.html */

MX.lesson("The Birthday Problem", function(L) {

  L.source("Probability — code2html_v2 Examples");
  L.problem("What is the probability that at least two people in a room share a birthday?");

  L.act("Setting up the complement", function(A) {
    A.vizPanel("hidden");

    A.say("Computing the probability that at least two people share a birthday is hard. So we compute the complement: the probability that everyone has a different birthday.")
     .show("$P(\\text{at least one match}) = 1 - P(\\text{all different})$");

    A.say("With $n$ people, the probability all birthdays are different is:")
     .card("derivation", {
       title: "No shared birthdays",
       steps: [
         { expr: "P(\\text{all different}) = \\frac{365}{365} \\cdot \\frac{364}{365} \\cdot \\frac{363}{365} \\cdots \\frac{365-n+1}{365}" },
         { expr: "= \\frac{365!}{(365-n)! \\cdot 365^n}" }
       ]
     });
  });

  L.act("The surprising threshold", function(A) {
    A.vizPanel("hidden");

    A.say("This probability drops faster than intuition suggests. With just 23 people, there's a 50% chance of a shared birthday.")
     .card("plot-2d", {
       title: "P(match) vs. group size",
       xRange: [1, 60], yRange: [0, 1],
       xLabel: "n (people)", yLabel: "probability",
       functions: [
         { fn: "1 - Math.exp(Array.from({length: Math.floor(x)}, (_, i) => Math.log((365-i)/365)).reduce((a,b) => a+b, 0))", color: MX.C.TEAL }
       ],
       points: [
         { x: 23, y: 0.507, label: "n=23", highlight: true },
         { x: 50, y: 0.970, label: "n=50" }
       ],
       threshold: { value: 0.5, label: "50%" },
       note: "At $n=23$: $P \\approx 50.7\\%$. At $n=50$: $P \\approx 97\\%$."
     });

    A.say("This feels wrong — 23 out of 365 is only 6% of the year. Why does 50% happen so early?")
     .show("With $n$ people there are $\\binom{n}{2} = n(n-1)/2$ pairs to check. For $n=23$ that's **253 pairs**.");
  });

  // ── Interactive gate: explore the birthday problem ──────────────────────────
  L.ask({
    type: "interactive",
    title: "Explore the Birthday Problem",
    description: "Drag the slider to change group size $n$ and watch the probability update.",
    slider: { min: 2, max: 80, step: 1, default: 23 },
    compute: function(n) {
      var logP = 0;
      for (var i = 0; i < n; i++) logP += Math.log((365 - i) / 365);
      var pMatch = 1 - Math.exp(logP);
      var pairs  = (n * (n - 1)) / 2;
      return {
        n:       n,
        pMatch:  (pMatch * 100).toFixed(1) + "%",
        pairs:   pairs,
        verdict: pMatch >= 0.5 ? "LIKELY (≥ 50%)" : "UNLIKELY (< 50%)"
      };
    },
    displays: [
      { field: "n",       label: "Group size" },
      { field: "pMatch",  label: "P(match)",  style: "large" },
      { field: "pairs",   label: "Pairs" },
      { field: "verdict", label: "Status" }
    ],
    challenge: "Find the smallest $n$ where $P(\\text{match}) \\geq 99\\%$."
  });

  L.act("Why intuition fails", function(A) {
    A.vizPanel("hidden");

    A.say("Our intuition anchors on one person — 'what are the chances MY birthday matches someone else's?' That probability is indeed low. But we're asking whether ANY pair matches.")
     .card("recap", {
       title: "The key insight",
       items: [
         { type: "text",  value: "With $n = 23$ there are $\\binom{23}{2} = 253$ distinct pairs." },
         { type: "latex", value: "\\binom{n}{2} = \\frac{n(n-1)}{2}", display: true },
         { type: "text",  value: "Each pair has a 1/365 ≈ 0.27% chance of matching. With 253 pairs, the cumulative probability crosses 50%." },
         { type: "example", value: "At $n = 57$: over 1500 pairs → P(match) > 99%." }
       ]
     });
  });

});
