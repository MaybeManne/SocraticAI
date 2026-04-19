MX.lesson("Projectile Motion: The Archer's Arrow", function(L) {

L.source("Classical physics - projectile motion with initial velocity and launch angle");
L.meta({ answer: "141 meters", estimated_duration_minutes: 6.5 });

L.problem("An archer shoots an arrow at 30° above horizontal with initial speed 40 m/s. Find how far the arrow travels before hitting the ground.", { highlight: "Arrow projectile motion: v₀ = 40 m/s, θ = 30°" });

L.viz({
  plugin: "projectile_motion",
  config: { viewBox: "0 0 800 400", scale: { x: 5, y: 15 }, origin: { x: 50, y: 350 } }
});


L.act("Setting the Scene", function(A) {
  A.vizPanel("svg");

  A.say("An archer draws back her bow, aiming thirty degrees above the horizon. The arrow sits poised at the perfect angle — not too steep, not too shallow.")
   .title("Projectile Motion", "An archer's challenge")
   .do("drawArcher", { position: "origin" })
   .do("showInitialVelocityVector", { magnitude: 40, angle: 30, color: "#f59e0b" }, "+1.0");

  A.say("She releases with an initial speed of forty meters per second. The arrow launches into its curved path. But here's the question that matters: where will this arrow land?")
   .show("**The Challenge:** Find the horizontal distance traveled by an arrow launched at 30° with initial speed 40 m/s.")
   .inline("svg");

  A.say("This is a classic projectile motion problem — one that reveals the beautiful physics of two-dimensional motion. The arrow follows gravity's pull while maintaining its forward momentum.");

});


L.act("The Independence Revelation", function(A) {
  A.vizPanel("svg");

  A.say("Here's the key insight that makes projectile motion solvable: we can treat horizontal and vertical motions as completely separate problems. Watch as we break this single velocity vector into its horizontal and vertical components.")
   .show("**Independence Principle**: Horizontal and vertical motions are independent — gravity affects only the vertical component.")
   .do("splitVelocityVector", { mainVector: true }, "+1.5");

  A.say("The horizontal component uses cosine. With our 30-degree angle, that's 40 times cosine of 30 degrees, which equals 40 times root 3 over 2.")
   .card("derivation", {
       title: "Horizontal Component",
       steps: [
         { latex: "v_x = v_0 \\cos(30°)" },
         { latex: "v_x = 40 \\times \\frac{\\sqrt{3}}{2}" },
         { latex: "v_x = 34.6 \\text{ m/s}", highlight: true }
       ]
     })
   .do("calculateComponents", { vx: 34.6, vy: 20 }, "+0.5");

  A.say("The vertical component uses sine. At 30 degrees, sine equals one-half, so we get 40 times one-half, which is exactly 20 meters per second upward.")
   .card("derivation", {
       title: "Vertical Component",
       steps: [
         { latex: "v_y = v_0 \\sin(30°)" },
         { latex: "v_y = 40 \\times \\frac{1}{2}" },
         { latex: "v_y = 20 \\text{ m/s}", highlight: true }
       ]
     });

  A.say("Now here's what makes this beautiful: gravity only affects vertical motion. It pulls the arrow downward but can't slow its horizontal movement. Let's see both motions side by side.")
   .show("**Key Insight**: Gravity acts only vertically — the horizontal velocity stays constant at 34.6 m/s throughout the entire flight.")
   .do("createSplitScreen", { layout: "horizontal" })
   .do("showMotionGraphs", { xType: "constant", yType: "parabolic" }, "+1.0");

});


L.ask({
  question: "What happens to the horizontal component of velocity as the arrow flies through the air?",
  options: [
    "It stays constant at 34.6 m/s throughout the flight",
    "It gradually decreases due to gravity",
    "It increases as the arrow accelerates forward",
    "It changes direction when the arrow reaches its peak"
  ],
  correct: 0,
  explain: {
    correct: "Exactly — gravity only acts vertically, so the horizontal velocity remains constant at 34.6 m/s throughout the entire flight.",
    "1": "That's a common gravity misconception. Gravity only pulls downward (vertically) and cannot affect horizontal motion.",
    "2": "That's confusing horizontal motion with acceleration. There's no horizontal force acting on the arrow after it leaves the bow.",
    "3": "That's mixing up the components. The horizontal component stays the same — only the vertical component changes direction at the peak."
  },
  wrongPath: function(B) {
    B.act("Understanding Gravity's Effect", function(A) {
      A.vizPanel("svg");

      A.say("Let's clear up a crucial point about gravity. Gravity is a force that always points straight down toward Earth's center — never sideways, never at an angle.")
       .card("figure", {
           svg: "<svg viewBox='0 0 400 300' xmlns='http://www.w3.org/2000/svg'><defs><linearGradient id='earthGrad' x1='0%' y1='0%' x2='0%' y2='100%'><stop offset='0%' style='stop-color:#4338ca;stop-opacity:1' /><stop offset='100%' style='stop-color:#1e1b4b;stop-opacity:1' /></linearGradient></defs><rect width='400' height='300' fill='#0f0e17'/><circle cx='200' cy='400' r='150' fill='url(#earthGrad)' stroke='#6366f1' stroke-width='2'/><text x='200' y='30' text-anchor='middle' fill='white' font-size='16' font-weight='bold'>Earth's Center</text><g stroke='#f59e0b' stroke-width='3' marker-end='url(#arrowhead)'><defs><marker id='arrowhead' markerWidth='10' markerHeight='7' refX='9' refY='3.5' orient='auto'><polygon points='0 0, 10 3.5, 0 7' fill='#f59e0b'/></marker></defs><line x1='100' y1='180' x2='100' y2='220'/><line x1='200' y1='140' x2='200' y2='180'/><line x1='300' y1='180' x2='300' y2='220'/><line x1='150' y1='200' x2='150' y2='240'/><line x1='250' y1='200' x2='250' y2='240'/></g><text x='200' y='280' text-anchor='middle' fill='#f59e0b' font-size='14'>Gravity always points toward Earth's center</text></svg>",
           caption: "Gravity acts uniformly downward everywhere on Earth's surface"
         })
       .do("drawArcher", { position: "origin" });

      A.say("This means gravity can only change the vertical component of velocity — it has absolutely no effect on horizontal motion. Watch how the velocity vector changes during flight.")
       .show("Key insight: Gravity only affects vertical motion. The horizontal velocity component remains constant throughout the entire flight.")
       .do("updateVelocityVector", { vx: "constant", vy: "decreasing" });

      A.say("Think of it this way: if you drop a ball while walking forward, it falls straight down relative to the ground, but keeps moving horizontally with you. The arrow behaves exactly the same — gravity pulls it down while it coasts horizontally at constant speed.")
       .show("Analogy: A ball dropped from a moving train falls straight down relative to the ground, but continues moving horizontally at the train's speed. Gravity doesn't slow down the horizontal motion.");

    });
  }
});


L.act("Motion in Real-Time", function(A) {
  A.vizPanel("svg");

  A.say("Let's watch our arrow fly in real time. The split screen merges into a single view as the arrow begins its journey through the air.")
   .do("mergeSplitScreens")
   .do("startArrowMotion", { realTimeSpeed: 0.8 }, "+1.0")
   .do("showPositionDot", { color: "#f59e0b", trailLength: 30 }, "+1.2");

  A.say("Notice how the horizontal velocity stays perfectly constant at 34.6 m/s throughout the entire flight. Watch this horizontal component — it never changes, never wavers.")
   .show("Horizontal velocity: $v_x = 34.6$ m/s (constant)")
   .do("updateVelocityVector", { vx: 34.6, vy: "current", emphasizeHorizontal: true }, "+0.5");

  A.say("Meanwhile, gravity steadily reduces the vertical velocity from its initial 20 m/s. Watch how it slows down, stops, then accelerates downward.")
   .show("Vertical velocity: $v_y = 20 - 9.8t$ m/s (decreasing)");

  A.say("The velocity vector tells the whole story — watch it rotate and shrink vertically while staying constant horizontally. This combination creates the curved path we see.")
   .do("updateVelocityVector", { vx: 34.6, vy: "current", showRotation: true }, "+0.8");

});


L.act("The Peak and Symmetry", function(A) {
  A.vizPanel("svg");

  A.say("Watch what happens at the highest point of the trajectory. Something magical occurs — the vertical velocity hits exactly zero.")
   .show("At the peak, $v_y = 0$ while $v_x$ remains constant")
   .do("highlightPeak", { pulse: true }, "+0.5");

  A.say("At this instant, the arrow moves purely horizontally at thirty-four point six meters per second. Look — no vertical motion at all, just smooth horizontal gliding.")
   .show({
       type: "latex",
       content: "v_{peak} = v_x = 40\\cos(30°) = 34.6\\text{ m/s}",
       highlight: true
     })
   .do("updateVelocityVector", { vx: 34.6, vy: 0, emphasizePureHorizontal: true }, "+0.3");

  A.say("Here's the beautiful symmetry of projectile motion: the time it takes to reach the peak equals the time to fall back down. What goes up must come down, and it takes exactly the same duration.")
   .show("Time symmetry: $t_{up} = t_{down}$, so total flight time is $2t_{peak}$")
   .do("drawSymmetryLines", { style: "dashed" })
   .do("markTimeIntervals", { up: "t₁", down: "t₁" }, "+1.0");

});


L.ask({
  question: "At the peak of the trajectory, the arrow's velocity is:",
  options: [
    "Zero (the arrow momentarily stops)",
    "34.6 m/s horizontally only",
    "40 m/s at 30° above horizontal",
    "34.6 m/s vertically only"
  ],
  correct: 1,
  explain: {
    correct: "Exactly — at the peak, vertical velocity is zero while horizontal velocity remains constant at 34.6 m/s.",
    "0": "That's the 'projectile stops' misconception. Only the vertical component becomes zero — horizontal motion continues unchanged.",
    "2": "That's the initial velocity. At the peak, the vertical component has decreased to zero due to gravity's effect.",
    "3": "That's confusing the components. At the peak, vertical velocity is zero and horizontal velocity is 34.6 m/s."
  },
  wrongPath: function(B) {
    B.act("Velocity vs Acceleration at Peak", function(A) {
      A.vizPanel("svg");

      A.say("Here's the key insight that trips up many students. At the peak of the trajectory, the arrow's vertical velocity is zero — it's neither moving up nor down at that instant. But gravity's acceleration is still pulling down at 9.8 meters per second squared.")
       .card("split", {
           left: {
             type: "text",
             content: "**At the Peak:**\n\n• Vertical velocity = 0 m/s\n• Arrow momentarily stops rising"
           },
           right: {
             type: "text",
             content: "**Gravity Never Stops:**\n\n• Acceleration = -9.8 m/s²\n• Always pulling downward"
           }
         })
       .do("highlightPeak", { pulse: true });

      A.say("Think of velocity as what's happening right now — the arrow's speed and direction at this exact moment. Acceleration tells us how that velocity is changing. They're completely different quantities that can have different values at the same time.")
       .show("**Velocity** = speed + direction *right now*\n\n**Acceleration** = how velocity is *changing*");

      A.say("Even though the arrow pauses for an instant at the peak, gravity never takes a break. It's constantly accelerating the arrow downward, which is exactly what turns that zero vertical velocity into downward motion for the descent.")
       .show("Gravity acts continuously — it's what makes the arrow start falling after reaching the peak.")
       .do("updateVelocityVector", { vx: 34.6, vy: 0 });

    });
  }
});


L.act("The Parabolic Path Emerges", function(A) {
  A.vizPanel("svg");

  A.say("When we combine constant horizontal motion with uniformly accelerated vertical motion, something beautiful happens. Watch as these two independent motions weave together to create the trajectory.")
   .show("The parabolic path emerges from combining two simple motions: constant velocity horizontally, constant acceleration vertically.")
   .do("animateGraphCombination", { sequence: "merge" }, "+1.0");

  A.say("There it is — the elegant parabolic curve. This graceful arc is the signature of all projectile motion, from arrows to basketballs to water from a fountain.")
   .do("drawFullTrajectory", { style: "smooth" }, "+0.5");

  A.say("Every projectile follows this same mathematical shape. The parabola isn't just beautiful — it's universal. From cannonballs to comets, nature writes this equation across the sky.")
   .show({
       type: "latex",
       content: "y = x \\tan \\theta - \\frac{g x^2}{2 v_0^2 \\cos^2 \\theta}",
       highlight: true
     })
   .inline("svg");

});


L.act("Calculating the Range", function(A) {
  A.vizPanel("svg");

  A.say("Now for the final calculation. To find where this arrow lands, we need the total time of flight — how long it stays airborne.")
   .show("Finding the range requires calculating the total flight time first");

  A.say("The arrow returns to ground level when its height y equals zero. That's our key insight for solving this problem.")
   .show({ type: "latex", content: "y = 0 \\text{ when arrow hits ground}", highlight: true })
   .do("showKinematicEquation", { equation: "vertical" }, "+0.5");

  A.say("Using the kinematic equation for vertical motion: y equals initial vertical velocity times t, minus one-half g t squared. Set this equal to zero.")
   .card("derivation", {
       title: "Time of Flight Equation",
       steps: [
         { latex: "y = v_{0y}t - \\frac{1}{2}gt^2" },
         { latex: "0 = 20t - \\frac{1}{2}(9.8)t^2", highlight: true },
         { latex: "0 = 20t - 4.9t^2" }
       ]
     })
   .do("solveEquation", { steps: "setup" }, "+0.5");

  A.say("Factor out t: t times quantity twenty minus four point nine t equals zero. So either t equals zero — that's launch — or twenty minus four point nine t equals zero. Solving: t equals four point zero eight seconds.")
   .card("derivation", {
       title: "Solving for Time",
       steps: [
         { latex: "t(20 - 4.9t) = 0" },
         { latex: "t = 0 \\text{ or } 20 - 4.9t = 0" },
         { latex: "t = \\frac{20}{4.9} = 4.08 \\text{ seconds}", highlight: true }
       ]
     })
   .do("highlightTimeOfFlight", { t: 4.08 }, "+1.5");

  A.say("Range equals horizontal velocity times time. We have thirty-four point six meters per second horizontally, times four point zero eight seconds. That gives us one hundred forty-one meters.")
   .card("derivation", {
       title: "Final Range Calculation",
       steps: [
         { latex: "\\text{Range} = v_x \\times t" },
         { latex: "= 34.6 \\times 4.08" },
         { latex: "= 141 \\text{ meters}", highlight: true }
       ]
     })
   .do("calculateRange", { formula: "distance" }, "+0.5")
   .do("drawRangeMeasurement", { style: "groundLine" }, "+1.5");

});


L.askFillIn({
  prompt: "If the initial vertical velocity is 20 m/s and gravity is 9.8 m/s², the time to reach peak height is [___] seconds.",
  blank: { answer: ["2.04", "2.041", "2.0", "2"], width: 80, placeholder: "?" },
  hint: "At the peak, the vertical velocity becomes zero. Use $v_y = v_{0y} - gt$.",
  successMessage: "Correct! The arrow reaches peak height at t = 2.04 seconds, which is exactly half the total flight time.",
  wrongPath: function(B) {
    B.act("Finding Time to Peak", function(A) {
      A.vizPanel("svg");

      A.say("At the peak of the trajectory, something special happens. The vertical component of velocity becomes exactly zero — the arrow stops climbing and is about to fall.")
       .show({ type: "latex", content: "v_y = v_{0y} - gt = 0", highlight: true })
       .do("highlightPeak", { pulse: true }, "0");

      A.say("Now we can solve for the time to reach peak height. Rearranging our equation gives us t equals v naught y over g. With our initial vertical velocity of 20 meters per second and gravity at 9.8, that's 2.04 seconds.")
       .card("derivation", {
           title: "Time to Peak",
           steps: [
             { latex: "v_y = v_{0y} - gt = 0" },
             { latex: "gt = v_{0y}" },
             {
               latex: "t = \\frac{v_{0y}}{g} = \\frac{20}{9.8} = 2.04\\text{ s}",
               highlight: true
             }
           ]
         })
       .do("markTimeIntervals", { up: 2.04, down: 2.04 }, "+1.0");

      A.say("Notice something beautiful here — this peak time is exactly half the total flight time. The trajectory is perfectly symmetric. What goes up must come down, and it takes the same time for each half of the journey.")
       .show("Peak time = ½ × Total flight time\nSymmetry: up time = down time")
       .do("drawSymmetryLines", { style: "dotted" }, "+0.5");

    });
  }
});


L.act("The Bigger Picture", function(A) {
  A.vizPanel("svg");

  A.say("Our answer: 141 meters! But here's something beautiful — our 30-degree shot was just one note in a larger symphony of possibilities.")
   .card("recap", {
       title: "The Solution",
       content: [
         { type: "text", value: "Initial conditions:" },
         { type: "text", value: "• Speed: 40 m/s" },
         { type: "text", value: "• Angle: 30°" },
         { type: "text", value: "• Components: 34.6 m/s horizontal, 20 m/s vertical" },
         { type: "text", value: "" },
         { type: "text", value: "Time of flight: 4.08 seconds" },
         { type: "text", value: "Range: 141 meters" }
       ]
     })
   .do("emphasizeOurAnswer", { highlight: true });

  A.say("If we tried different launch angles with the same initial speed of 40 meters per second, watch what emerges. Each angle traces its own arc through space.")
   .do("showMultipleTrajectories", { angles: [15, 30, 45, 60, 75] }, "+1.0");

  A.say("Maximum range occurs at 45 degrees — creating this fountain-like pattern. Notice how trajectories at 30 and 60 degrees reach the same distance, just through different paths.")
   .show("Complementary angles (30° and 60°) produce identical ranges")
   .do("highlightOptimalAngle", { angle: 45, maxRange: true }, "+0.5")
   .do("highlightComplementaryAngles", { angles: [30, 60] }, "+1.0");

  A.say("Projectile motion reveals elegant mathematical principles hidden in everyday physics. From throwing a ball to launching satellites, the same beautiful parabolas govern motion through space.")
   .show("Every projectile follows nature's perfect parabola")
   .inline("svg");

});

});