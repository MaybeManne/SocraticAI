MX.lesson("Finding the Least Number of Nested Circles for Shaded Area", function(L) {

L.source("Custom Problem");
L.meta({ answer: "64", estimated_duration_minutes: 15 });

L.problem("An even number of circles are nested, starting with a radius of $1$ and increasing by $1$ each time, all sharing a common point. The region between every other circle is shaded, starting with the region inside the circle of radius $2$ but outside the circle of radius $1$. An example showing $8$ circles is displayed below. What is the **least number of circles** needed to make the total shaded area at least $2023\\pi$?", { highlight: "Find the least number of circles for total shaded area ≥ 2023π." });

L.viz({
  plugin: "nested_circles",
  config: {
    cx: 250,
    baseY: 250,
    scale: 28,
    circleCount: 8,
    darkColor: "#0f0e17",
    strokeColor: "#818cf8",
    finalCount: 64,
    finalScale: 3.4
  }
});


L.act("Introduction to Circles", function(A) {
  A.vizPanel("svg");

  A.say("Let's start by drawing our first circle of radius 1. This circle serves as the foundation for our nested structure.")
   .do("drawCircle", { radius: 1 });

  A.say("Now, we'll incrementally add circles with increasing radii. Each new circle will be larger than the previous one, creating a beautiful pattern.")
   .do("drawCircle", { radius: 2 })
   .do("drawCircle", { radius: 3 }, "+1.0")
   .do("drawCircle", { radius: 4 }, "+2.0")
   .do("drawCircle", { radius: 5 }, "+3.0")
   .do("drawCircle", { radius: 6 }, "+4.0")
   .do("drawCircle", { radius: 7 }, "+5.0")
   .do("drawCircle", { radius: 8 }, "+6.0");

});


L.act("Highlighting Shaded Areas", function(A) {
  A.vizPanel("svg");

  A.say("Notice the shaded area between the first two circles.")
   .do("highlightShadedArea", { r1: 1, r2: 2 });

  A.say("Now, let's highlight the shaded area between the next pair of circles.")
   .do("highlightShadedArea", { r1: 3, r2: 4 });

});


L.act("Summation of Areas", function(A) {
  A.vizPanel("svg");

  A.say("We can express the shaded area mathematically. The shaded area between circles of radius $2k$ and $2k-1$ is given by $A_k = \\pi( (2k)^2 - (2k-1)^2 )$.")
   .show("A_k = \\pi( (2k)^2 - (2k-1)^2 )")
   .do("fadeInFormula");

  A.say("Let's break this down into manageable parts. The total shaded area is the sum of all individual shaded areas up to $k$. This can be expressed as $\\sum_{i=1}^{k} A_i$.")
   .do("fadeInFormula");

});


L.act("Finding Minimum k", function(A) {
  A.vizPanel("svg");

  A.say("To determine the least number of circles needed, we want to find the minimum $k$ such that the total shaded area reaches at least $2023\\pi$. This means we need to solve for the equation of the shaded area.")
   .do("drawGraph", { equation: "k(k + 1)" });

  A.say("Now, let's graph the equation and see where it intersects with our threshold line at $4046$. This will show us the minimum $k$ needed to achieve the shaded area requirement.")
   .do("highlightIntersection", { x: 4046 });

});


L.ask({
  question: "What is the shaded area between the circles of radius 2 and 1?",
  options: ["\\pi", "3\\pi", "2\\pi", "4\\pi"],
  correct: 2,
  explain: {
    correct: "Exactly — because the shaded area is the area of the larger circle minus the area of the smaller circle: $\\pi(2^2) - \\pi(1^2) = 4\\pi - \\pi = 3\\pi$.",
    "1": "That's the area of the smaller circle. Remember to include the larger circle's area as well.",
    "3": "That's the area of the larger circle. Make sure to subtract the area of the smaller circle.",
    "4": "That's not correct. You need to find the difference between the two areas."
  },
  wrongPath: function(B) {
    B.act("Correcting Shaded Area Understanding", function(A) {
      A.vizPanel("svg");

      A.say("Let's revisit how we calculate shaded areas. Specifically, we need to clarify the regions between our nested circles.")
       .do("highlightShadedArea", { r1: 1, r2: 2 });

    });
  }
});


L.askFillIn({
  prompt: "The least number of circles needed is [___].",
  blank: { answer: ["64"], width: 60, placeholder: "?" },
  hint: "Use the equation for the shaded area to find $k$.",
  successMessage: "Correct — the least number of circles needed is 64.",
  wrongPath: function(B) {
    B.act("Correcting Minimum k Understanding", function(A) {
      A.vizPanel("svg");

      A.say("Let's go through the steps to find k again. We need to ensure our calculations are precise.")
       .do("drawGraph", { equation: "k*(k + 1)" })
       .do("highlightIntersection", { x: 4046 }, "+1.0");

    });
  }
});

});