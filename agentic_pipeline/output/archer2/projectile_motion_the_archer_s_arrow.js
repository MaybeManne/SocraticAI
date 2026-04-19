MX.lesson("Projectile Motion - The Archer's Arrow", function(L) {

L.source("Classical mechanics - projectile motion with component analysis");
L.meta({
  answer: "The arrow travels approximately 141.4 meters before hitting the ground.",
  estimated_duration_minutes: 4.5
});

L.problem("An archer shoots an arrow at 30° above horizontal with initial speed 40 m/s. Find how far the arrow travels before hitting the ground.", {
  highlight: "Find the horizontal range of a projectile launched at 30° with v₀ = 40 m/s"
});

L.viz({
  plugin: "archery_projectile",
  config: {
    viewBox: "0 0 800 400",
    coordinateSystem: { origin: [50, 350], xScale: 4, yScale: 8, maxX: 180, maxY: 50 },
    gravity: 9.8,
    backgroundStyle: "outdoor_range"
  }
});


L.act("The Archer's Challenge", function(A) {
  A.vizPanel("svg");

  A.say("An archer draws back her bow, aiming 30 degrees above horizontal. The arrow will leave with an initial speed of 40 meters per second. The question is: how far will it travel before hitting the ground?")
   .do("createArcher", { position: "origin", bowAngle: 30 })
   .do("drawInitialVelocity", { magnitude: 40, angle: 30, color: "#f59e0b" }, "+1.0");

  A.say("At first glance, this seems incredibly complex. The arrow will curve gracefully through space — watch as it launches and traces its path while gravity pulls it downward and its forward motion continues.")
   .do("launchArrow", { v0x: 34.64, v0y: 20, gravity: 9.8 }, "+0.5")
   .do("drawTrajectoryPath", { color: "#818cf8", opacity: 0.7, realTime: true }, "+0.5")
   .do("animateFlight", {}, "+0.8")
   .do("showAngleSlider", {}, "+1.2")
   .do("updateVelocityComponents", { time: 1.0, showVectors: true }, "+2.0");

});


L.act("The Independence Revelation", function(A) {
  A.vizPanel("svg");

  A.say("But here's the beautiful secret that transforms projectile motion from intimidating to elegant: this complex curved path is actually two simple, independent motions happening simultaneously. In just a moment, watch as we decompose that diagonal velocity vector.")
   .show("The key insight: Horizontal and vertical motions are completely independent")
   .do("splitVelocityVector", { horizontal: 34.6, vertical: 20, animationDuration: 2.0 }, "+0.5");

  A.say("Notice how the velocity splits using trigonometry. The horizontal component points purely to the right, while the vertical component points straight up.")
   .show({
       type: "latex",
       content: "v_{0x} = v_0 \\cos(\\theta) \\quad v_{0y} = v_0 \\sin(\\theta)",
       highlight: true
     })
   .do("showEquation", { equation: "trigComponents", position: "topRight", style: "highlighted" })
   .do("highlightComponent", { component: "horizontal", intensity: 0.8 }, "+0.8")
   .do("highlightComponent", { component: "vertical", intensity: 0.8 }, "+1.2");

  A.say("Let's calculate the actual numbers. Horizontal component: forty times cosine of thirty degrees equals forty times square root three over two, which gives us about thirty-four point six meters per second. Vertical component: forty times sine of thirty degrees equals twenty meters per second exactly.")
   .card("derivation", {
       title: "Component Calculation",
       steps: [
         { latex: "v_{0x} = 40 \\cos(30°) = 40 \\times \\frac{\\sqrt{3}}{2}" },
         { latex: "v_{0x} = 20\\sqrt{3} \\approx 34.6 \\text{ m/s}", highlight: true },
         { latex: "v_{0y} = 40 \\sin(30°) = 40 \\times \\frac{1}{2}" },
         { latex: "v_{0y} = 20 \\text{ m/s}", highlight: true }
       ]
     })
   .do("animateCalculation", { steps: ["horizontal", "vertical"], timing: "sequential" }, "+0.5")
   .do("updateVelocityComponents", { time: 0, showVectors: true }, "+3.0");

});


L.askFillIn({
  prompt: "Verify: what is the horizontal component with initial speed 40 m/s at 30°? &ensp; [___] m/s",
  blank: { answer: ["34.6", "34.64", "34.641"], width: 60, placeholder: "? m/s" },
  hint: "Use $v_{0x} = v_0 \\cos(\\theta)$ with the cosine of 30°.",
  successMessage: "Excellent! $v_{0x} = 40 \\cos(30°) = 40 \\times \\frac{\\sqrt{3}}{2} = 34.6$ m/s.",
  wrongPath: function(B) {
    B.act("Trigonometry Review", function(A) {
      A.vizPanel("figure");

      A.say("Let's step back and clarify the trigonometry. When you see an angle in a right triangle, remember: cosine gives us the adjacent side — that's horizontal. Sine gives us the opposite side — that's vertical.")
       .card("figure", {
           svg: "<svg viewBox=\"0 0 400 300\" xmlns=\"http://www.w3.org/2000/svg\" style=\"background: transparent;\"><defs><marker id=\"arrowhead\" markerWidth=\"10\" markerHeight=\"7\" refX=\"10\" refY=\"3.5\" orient=\"auto\"><polygon points=\"0 0, 10 3.5, 0 7\" fill=\"#818cf8\" /></marker></defs><g transform=\"translate(50, 200)\"><line x1=\"0\" y1=\"0\" x2=\"200\" y2=\"0\" stroke=\"#ffffff\" stroke-width=\"2\" /><line x1=\"0\" y1=\"0\" x2=\"0\" y2=\"-100\" stroke=\"#ffffff\" stroke-width=\"2\" /><line x1=\"0\" y1=\"0\" x2=\"200\" y2=\"-100\" stroke=\"#818cf8\" stroke-width=\"3\" marker-end=\"url(#arrowhead)\" /><text x=\"100\" y=\"15\" text-anchor=\"middle\" fill=\"#f59e0b\" font-family=\"Arial, sans-serif\" font-size=\"14\" font-weight=\"bold\">adjacent (horizontal)</text><text x=\"-35\" y=\"-50\" text-anchor=\"middle\" fill=\"#f59e0b\" font-family=\"Arial, sans-serif\" font-size=\"14\" font-weight=\"bold\" transform=\"rotate(-90, -35, -50)\">opposite (vertical)</text><text x=\"105\" y=\"-45\" text-anchor=\"middle\" fill=\"#818cf8\" font-family=\"Arial, sans-serif\" font-size=\"14\" font-weight=\"bold\">hypotenuse</text><path d=\"M 20 0 A 20 20 0 0 0 20 -10\" stroke=\"#ffffff\" stroke-width=\"2\" fill=\"none\" /><text x=\"30\" y=\"-5\" fill=\"#ffffff\" font-family=\"Arial, sans-serif\" font-size=\"12\">θ</text><text x=\"220\" y=\"15\" fill=\"#f59e0b\" font-family=\"Arial, sans-serif\" font-size=\"16\" font-weight=\"bold\">cos θ</text><text x=\"-60\" y=\"-50\" fill=\"#f59e0b\" font-family=\"Arial, sans-serif\" font-size=\"16\" font-weight=\"bold\">sin θ</text></g></svg>",
           caption: "In a right triangle: cos θ gives horizontal, sin θ gives vertical"
         })
       .do("showEquation", {
           equation: "cos θ = adjacent/hypotenuse",
           position: "bottom-left",
           style: "highlight"
         }, "+1.0")
       .do("highlightComponent", { component: "horizontal", intensity: 0.8 }, "+1.5");

      A.say("For our projectile motion, the velocity vector is the hypotenuse. So horizontal component equals velocity times cosine of angle. Vertical component equals velocity times sine of angle.")
       .card("recap", {
           title: "Velocity Components",
           content: [
             { type: "text", value: "Initial speed: 40 m/s at 30°" },
             {
               type: "equation",
               value: "v_x = v_0 \\cos θ = 40 \\cos 30° = 40 × 0.866 = 34.6 \\text{ m/s}"
             },
             {
               type: "equation",
               value: "v_y = v_0 \\sin θ = 40 \\sin 30° = 40 × 0.5 = 20.0 \\text{ m/s}"
             }
           ]
         })
       .do("animateCalculation", { steps: ["horizontal", "vertical"], timing: "sequential" }, "+0.5");

    });
  }
});


L.act("Horizontal Motion Story", function(A) {
  A.vizPanel("svg");

  A.say("Let's zoom in on the horizontal motion. Notice something crucial — once the arrow leaves the bow, no forces push or pull it sideways.")
   .show("Key insight: Air resistance ignored, gravity acts only downward. No horizontal forces during flight.")
   .do("isolateMotion", { motionType: "horizontal", dimOpacity: 0.3 })
   .do("highlightComponent", { component: "horizontal", intensity: 1.2 }, "+0.8");

  A.say("This means the horizontal velocity stays rock-steady at 34.6 meters per second. Not speeding up, not slowing down — constant throughout the entire flight.")
   .show({
       type: "latex",
       content: "v_x = 34.6 \\text{ m/s} = \\text{constant}",
       highlight: true
     })
   .do("updateVelocityComponents", { time: 2.0, showVectors: true })
   .do("createMotionGraph", { type: "velocity", axis: "horizontal", realTime: false }, "+1.0");

  A.say("For horizontal position, it's simple multiplication. Distance equals velocity times time: x equals 34.6t. Watch how the arrow maintains this steady horizontal pace.")
   .show({
       type: "latex",
       content: "x(t) = v_x \\cdot t = 34.6t \\text{ meters}",
       highlight: true
     })
   .do("showEquation", { equation: "x = 34.6t", position: "top-right", style: "highlight" })
   .do("highlightComponent", { component: "horizontal", intensity: 1.2 }, "+0.5")
   .do("pulseObject", { objectId: "arrow", intensity: 1.1, duration: 0.6 }, "+1.2");

});


L.act("Vertical Motion Story", function(A) {
  A.vizPanel("svg");

  A.say("Now for vertical motion — here gravity constantly pulls downward at 9.8 meters per second squared. Let's isolate the vertical component to see how it behaves.")
   .show("Vertical motion is governed by constant downward acceleration due to gravity: $g = 9.8 \\text{ m/s}^2$")
   .do("isolateMotion", { motionType: "vertical", dimOpacity: 0.3 })
   .do("highlightComponent", { component: "vertical", intensity: 1.2 }, "+0.5");

  A.say("The vertical velocity starts at 20 meters per second upward, decreases due to gravity, becomes zero at the peak, then increases downward. Let me show you how the velocity vector changes direction over the course of the flight.")
   .do("updateVelocityComponents", { time: 0, showVectors: true }, "+0.5")
   .do("createMotionGraph", { type: "velocity", axis: "vertical", realTime: true }, "+1.5");

  A.say("Vertical position follows the kinematic equation: y equals v naught y times t minus one half g t squared. That's 20t minus 4.9t squared.")
   .show({
       type: "latex",
       content: "y = v_{0y} \\cdot t - \\frac{1}{2}gt^2 = 20t - 4.9t^2",
       highlight: true
     })
   .do("showEquation", { equation: "y = 20t - 4.9t²", position: "top-right", style: "physics" })
   .do("markTimeInstant", { time: 2.04, event: "peak", color: "#f59e0b" }, "+1.5");

  A.say("Notice the beautiful symmetry — the upward journey mirrors the downward journey. The arrow takes the same time to rise as it does to fall.")
   .show("Projectile motion is symmetric: time to reach maximum height equals time to fall back down.")
   .do("pulseObject", { objectId: "trajectory_peak", intensity: 1.5, duration: 1.0 })
   .do("markTimeInstant", { time: 4.08, event: "landing", color: "#818cf8" }, "+1.0");

});


L.act("Finding Flight Time", function(A) {
  A.vizPanel("svg");

  A.say("To find how far the arrow travels, we need one crucial piece: how long does it stay in the air? The answer lies in when it returns to the ground.")
   .show("Flight time = when the arrow returns to ground level (y = 0)")
   .do("showGroundCondition", { emphasis: true })
   .do("highlightComponent", { component: "vertical", intensity: 0.8 }, "+1.0");

  A.say("Here's the key insight: set y equals zero in our vertical equation. The arrow hits the ground when twenty t minus four point nine t squared equals zero.")
   .show({ type: "latex", content: "0 = 20t - 4.9t^2", highlight: true })
   .do("showEquation", { equation: "y = 20t - 4.9t²", position: "center", style: "large" })
   .do("pulseObject", { objectId: "ground_line", intensity: 0.6, duration: 1.5 }, "+1.2");

  A.say("Let's factor out t to solve this quadratic. We get t times the quantity twenty minus four point nine t equals zero.");

  A.say("This gives us two solutions: t equals zero when the arrow launches, or t equals twenty divided by four point nine, which is about four point zero eight seconds.")
   .card("derivation", {
       title: "Solving for Flight Time",
       steps: [
         { latex: "0 = 20t - 4.9t^2" },
         { latex: "0 = t(20 - 4.9t)" },
         { latex: "t = 0 \\text{ or } t = \\frac{20}{4.9}" },
         { latex: "t = 4.08 \\text{ seconds}", highlight: true }
       ]
     })
   .do("animateCalculation", { steps: 4, timing: "staggered" })
   .do("markTimeInstant", { time: 4.08, event: "landing", color: "#f59e0b" }, "+2.5");

});


L.ask({
  question: "An arrow is shot straight up with initial vertical velocity 25 m/s. How long until it returns to the starting height?",
  options: ["5.1 seconds", "2.5 seconds", "12.3 seconds", "10.2 seconds"],
  correct: 0,
  explain: {
    correct: "Exactly! Using 0 = 25t - 4.9t², we get t(25 - 4.9t) = 0, so t = 25/4.9 ≈ 5.1 seconds for the return trip.",
    "1": "That's the time to reach maximum height. The total flight time is twice this because the motion is symmetric.",
    "2": "That's confusing velocity with time. Remember to use the kinematic equation y = v₀t - ½gt² and set y = 0.",
    "3": "That's using the wrong formula. For vertical motion, use y = v₀t - ½gt² where v₀ = 25 m/s and g = 9.8 m/s²."
  },
  wrongPath: function(B) {
    B.act("Vertical Motion Symmetry", function(A) {
      A.vizPanel("svg");

      A.say("Here's something beautiful about projectile motion — the vertical motion has perfect symmetry. Watch as we create a graph of the arrow's height over time.")
       .show("Vertical motion under gravity follows a parabolic path with symmetric timing around the peak height.")
       .do("createMotionGraph", { type: "position", axis: "vertical", realTime: true })
       .do("markTimeInstant", { time: "peak", event: "maximum height", color: "#f59e0b" }, "+1.5");

      A.say("Notice the symmetry — the time to reach maximum height equals the time to fall back down. This gives us a powerful formula: total flight time is always two times the time to peak.")
       .show({
           type: "latex",
           content: "t_{\\text{flight}} = 2 \\times t_{\\text{peak}} = 2 \\times \\frac{v_{0y}}{g}",
           highlight: true
         })
       .do("showEquation", { equation: "t_peak = v_0y/g", position: "upper", style: "emphasis" })
       .do("animateCalculation", {
           steps: [
             "t_flight = 2 × t_peak",
             "t_flight = 2 × (v_0y/g)",
             "t_flight = 2v_0y/g"
           ],
           timing: "sequential"
         }, "+1.0");

    });
  }
});


L.act("Calculating the Range", function(A) {
  A.vizPanel("svg");

  A.say("Now we combine what we know. The horizontal component stays steady throughout the flight — that's our key insight.")
   .show("Range formula: horizontal velocity × flight time")
   .do("highlightComponent", { component: "horizontal", intensity: "high" }, "0")
   .do("showEquation", { equation: "Range = v_x \\times t_{flight}", position: "top-right", style: "bold" }, "+1.0");

  A.say("Plug in our numbers: thirty-four point six meters per second times four point zero eight seconds equals one hundred forty-one point four meters.")
   .card("derivation", {
       title: "Range Calculation",
       steps: [
         { latex: "Range = v_x \\times t_{flight}" },
         { latex: "Range = 34.6 \\text{ m/s} \\times 4.08 \\text{ s}" },
         { latex: "Range = 141.4 \\text{ meters}", highlight: true }
       ]
     })
   .do("animateCalculation", { steps: ["Range = 34.6 × 4.08", "Range = 141.4 m"], timing: "sequential" }, "0")
   .do("measureDistance", { from: "archer", to: "landing", label: "141.4 m" }, "+2.0");

  A.say("Now let's watch our arrow complete its journey and land exactly where our calculation predicted — physics in perfect harmony.")
   .do("replayTrajectory", { speed: "dramatic", showComponents: true }, "+0.5")
   .do("celebrateResult", { position: "landing", value: "141.4 m", effect: "golden_burst" }, "+3.5");

});


L.act("The Complete Picture", function(A) {
  A.vizPanel("svg");

  A.say("And there's the complete story — two simple motions creating one elegant arc. Watch as the horizontal motion stays perfectly steady while gravity pulls the vertical component through its rise and fall.")
   .card("recap", {
       title: "Projectile Motion Synthesis",
       content: [
         { type: "text", value: "Initial velocity: 40 m/s at 30°" },
         { type: "text", value: "Horizontal component: 34.6 m/s (constant)" },
         { type: "text", value: "Vertical component: 20 m/s → 0 → -20 m/s" },
         { type: "text", value: "Flight time: 4.08 seconds" },
         { type: "text", value: "Range: 141.4 meters" }
       ]
     })
   .do("replayTrajectory", { speed: 0.8, showComponents: true }, "+0.8")
   .do("updateVelocityComponents", { time: "dynamic", showVectors: true }, "+1.3");

  A.say("This distance makes perfect sense — about one and a half football fields for a skilled archer's shot. The mathematics transforms an ancient skill into precise prediction.")
   .show("Range = 141.4 meters ≈ 1.5 football fields")
   .do("addRealWorldScale", { scaleType: "football", opacity: 0.7 })
   .do("pulseObject", { objectId: "arrow_landing", intensity: 1.2, duration: 2 }, "+1.0");

  A.say("The general formula emerges naturally from our work. Range equals initial speed squared, times sine of twice the angle, divided by gravity. Beautiful physics hiding in elegant mathematics.")
   .show({
       type: "latex",
       content: "\\text{Range} = \\frac{v_0^2 \\sin(2\\theta)}{g}",
       highlight: true
     })
   .do("showEquation", { equation: "range_formula", position: "center", style: "highlight" })
   .do("showAngleSlider", {}, "+0.5")
   .do("celebrateResult", { position: "arrow_landing", value: "141.4 m", effect: "sparkle" }, "+1.5")
   .inline("svg");

});


L.ask({
  question: "Looking at the range formula $R = \\frac{v_0^2 \\sin(2\\theta)}{g}$, what would happen to the range if we doubled the initial speed from 40 m/s to 80 m/s (keeping the same 30° angle)?",
  options: [
    "The range would double (about 283 meters)",
    "The range would quadruple (about 566 meters)",
    "The range would increase by √2 (about 200 meters)",
    "The range would triple (about 424 meters)"
  ],
  correct: 1,
  explain: {
    correct: "Exactly! Since range depends on $v_0^2$, doubling the speed quadruples the range: $(2v_0)^2 = 4v_0^2$. The archer's shot would travel four times as far.",
    "0": "That's linear thinking, but range depends on speed squared. Doubling the speed gives $(2v_0)^2 = 4v_0^2$, so the range quadruples.",
    "2": "That's mixing up with the factor for kinetic energy scaling. Range scales with $v_0^2$, so doubling speed gives 4× the range.",
    "3": "That would be true if range scaled as $v_0^3$, but it scales as $v_0^2$. Doubling speed quadruples the range."
  },
  wrongPath: function(B) {
    B.act("Range Formula Analysis", function(A) {
      A.vizPanel("svg");

      A.say("The range formula reveals something powerful about projectile motion. Range equals v-naught squared times sine of two theta, all divided by g.")
       .show({ type: "latex", content: "R = \\frac{v_0^2 \\sin(2\\theta)}{g}", highlight: true })
       .do("showEquation", { equation: "range_formula", position: "center", style: "highlighted" })
       .do("highlightComponent", { component: "v0_squared", intensity: "high" }, "+1.0");

      A.say("Notice that range depends on v-naught squared — the initial speed squared. This creates a powerful scaling relationship that surprises many students.")
       .show("Key insight: Range ∝ v₀² (quadratic dependence)")
       .do("animateCalculation", { steps: ["v₀", "v₀²", "R ∝ v₀²"], timing: "sequential" }, "+0.5")
       .do("pulseObject", { objectId: "v0_squared_term", intensity: "medium", duration: 1.5 }, "+2.0");

    });
  }
});

});