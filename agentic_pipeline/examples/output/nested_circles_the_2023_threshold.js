MX.lesson("Nested Circles — The 2023π Threshold", function(L) {

L.source("AMC 10A 2023 #15 (Modified)");
L.meta({ answer: "64", estimated_duration_minutes: 8 });

L.problem("An even number of circles are nested, starting with a radius of $1$ and increasing by $1$ each time, all sharing a common point. The region between every other circle is shaded, starting with the region inside the circle of radius $2$ but outside the circle of radius $1.$ An example showing $8$ circles is displayed below. What is the **least number of circles** needed to make the total shaded area at least $2023\\pi$?", { highlight: "Find the least number of circles for shaded area ≥ 2023π." });

L.viz({
  plugin: "nested_circles_v2",
  config: {
    cx: 250,
    baseY: 450,
    scale: 32,
    circleCount: 8,
    darkColor: "#0f0e17",
    strokeColor: "#818cf8",
    finalCount: 40,
    finalScale: 5.5
  }
});


L.act("Drawing the Circles", function(A) {
  A.vizPanel("svg");

  A.say("Let's build up the picture. We start with a common point at the bottom and draw circles of increasing radius — all tangent at that single point.")
   .do("showGrid")
   .do("showGlow", {}, "+0.5")
   .do("showDot", {}, "+1.0");

  A.say("The smallest circle has radius one.")
   .do("drawCircle", { r: 1 });

  A.say("Then radius two. Notice the region between them — that's our first shaded ring.")
   .do("drawCircle", { r: 2 });

  A.say("Radius three — this ring stays unshaded.")
   .do("drawCircle", { r: 3 });

  A.say("Radius four — shaded again. The pattern alternates: shaded, unshaded, shaded, unshaded.")
   .do("drawCircle", { r: 4 });

  A.say("Five and six.")
   .do("drawCircle", { r: 5 })
   .do("drawCircle", { r: 6 }, "+1.0");

  A.say("Seven and eight complete our example with four shaded rings.")
   .do("drawCircle", { r: 7 })
   .do("drawCircle", { r: 8 }, "+1.0");

  A.say("With eight circles we get four shaded rings, labeled k equals one through four.")
   .show("With $2n$ circles, there are exactly $n$ shaded rings.\n\n**Shaded ring $k$:** between radii $(2k{-}1)$ and $2k$\n\n$8$ circles → $n = 4$ shaded rings.")
   .inline("svg");

});


L.ask({
    question: "Which rings are shaded in this pattern?",
    options: [
      "Odd → even radius (1→2, 3→4, 5→6, ...)",
      "Even → odd radius (2→3, 4→5, 6→7, ...)",
      "Every ring",
      "Only the outermost ring"
    ],
    correct: 0,
    explain: {
      correct: "Correct! Shading goes from each odd radius to the next even radius: 1→2, 3→4, 5→6, and so on.",
      "1": "Close, but shading starts between radius 1 (odd) and 2 (even), not between 2 and 3.",
      "2": "Not every ring — the pattern alternates between shaded and unshaded.",
      "3": "There are multiple shaded rings, not just one."
    }
  });

// WARNING: No act spec found for act_area_formula
// WARNING: No gate spec found for gate_circle_area
// WARNING: No act spec found for act_ring_anatomy
// WARNING: No gate spec found for gate_outer_area
// WARNING: No act spec found for act_general_formula
// WARNING: No gate spec found for gate_verify_ring_2

L.marker("visualization");

// WARNING: No act spec found for act_pattern
// WARNING: No gate spec found for gate_sequence_type
// WARNING: No act spec found for act_gauss_sum
// WARNING: No act spec found for act_solve_inequality
});