MX.lesson("Projectile Range: Why 45° is the Sweet Spot", function(L) {

L.source("Projectile Range Problem — v₀ = 20 m/s, θ = 45°, g = 9.8 m/s²");
L.meta({ answer: "R ≈ 40.8 m", estimated_duration_minutes: 8 });

L.problem("A ball is launched at $\\theta = 45°$ with initial speed $v_0 = 20$ m/s from flat ground. Assuming no air resistance and $g = 9.8$ m/s², find the horizontal range $R$ — the distance from launch to landing.", { highlight: "Find the range R of a projectile launched at 45° with v₀ = 20 m/s" });

L.viz({
  plugin: "projectile_motion_v1",
  config: {
    xRange: [0, 52],
    yRange: [0, 32],
    xLabel: "horizontal distance (m)",
    yLabel: "height (m)",
    gridOpacity: 0.12,
    colorMap: {
      horizontal: "#4CAF50",
      vertical: "#2196F3",
      gravity: "#F44336",
      trajectory: "#FFD700",
      answer: "#FFD700"
    }
  }
});


L.act("The Setup — A Simple Question", function(A) {
  A.vizPanel("svg");

  A.say("Imagine throwing a ball at exactly 45 degrees. It arcs through the air and lands somewhere on flat ground. The question is simple to ask — but surprisingly rich to answer: how far away does it land?")
   .title("How Far Does It Go?", "Projectile motion at $\\theta = 45°$, $v_0 = 20$ m/s")
   .do("initScene", {
       xRange: [0, 52],
       yRange: [0, 32],
       xLabel: "horizontal distance (m)",
       yLabel: "height (m)"
     }, "0")
   .do("placeBall", { x: 0, y: 0 }, "+0.6")
   .do("showQuestionMark", { x: 3, y: 4 }, "+1.2");

  A.say("We launch the ball with an initial speed of 20 meters per second — that golden arrow — at an angle of exactly 45 degrees above the ground.")
   .do("drawVelocityArrow", { speed: 20, angle: 45, color: "#FFD700", label: "v₀ = 20 m/s", durationMs: 900 }, "0")
   .do("drawAngleArc", { angle: 45, label: "45°" }, "+1.1");

  A.say("That arrow is pointing diagonally — not purely sideways, not purely upward, but both at once. It has a horizontal push and a vertical lift baked into a single velocity. That tension is exactly what makes projectile motion interesting.")
   .show("One velocity arrow. Two independent stories.\n\n$v_0 = 20$ m/s at $\\theta = 45°$ carries both a **horizontal component** and a **vertical component** — and gravity will act on only one of them.")
   .do("dimAllExcept", { exceptIds: ["velocityArrow", "angleArc", "ball"], opacity: 0.2 }, "+0.4");

  A.say("Gravity doesn't care about the horizontal. It only pulls down. So the ball's horizontal speed stays constant throughout the flight, while the vertical speed changes every instant. Separating those two stories is the key to finding the range.")
   .show("**The Core Insight:**\n\n- Horizontal: $a_x = 0$ — constant speed\n- Vertical: $a_y = -g$ — gravity acts the whole way\n\nTwo independent motions. One ball.")
   .do("dimAllExcept", { exceptIds: ["velocityArrow", "angleArc", "ball", "axes", "grid"], opacity: 0.5 }, "+0.8")
   .inline();

});


L.marker("Velocity Decomposition");


L.act("Splitting the Arrow — Horizontal & Vertical", function(A) {
  A.vizPanel("svg");

  A.say("That single gold arrow is hiding two independent stories. Watch what happens when we pull it apart.")
   .do("decomposeVelocity", {
       speed: 20,
       angle: 45,
       horizontalLabel: "v₀cos45° = 10√2 ≈ 14.1 m/s",
       verticalLabel: "v₀sin45° = 10√2 ≈ 14.1 m/s"
     }, "0");

  A.say("The green arrow is the horizontal piece — pure sideways speed. Nothing in this problem ever pushes the ball left or right, so this length never changes. Not once during the entire flight.")
   .show("v_x = v_0 \\cos 45° = 10\\sqrt{2} \\approx 14.1 \\ \\text{m/s} \\ (\\text{constant})")
   .do("pulseArrow", { component: "horizontal", color: "#4CAF50" }, "0");

  A.say("The blue arrow is the vertical piece — the upward speed. Gravity fights this one relentlessly. It will shrink to zero at the peak, then flip downward on the way back to earth.")
   .show("v_y = v_0 \\sin 45° = 10\\sqrt{2} \\approx 14.1 \\ \\text{m/s} \\ (\\text{decreasing})")
   .do("pulseArrow", { component: "vertical", color: "#2196F3" }, "0");

  A.say("Both components come from the same launch — cosine gives the horizontal, sine gives the vertical. At exactly 45°, cosine and sine are equal, so the two pieces are perfectly matched: both $10\\sqrt{2}$ meters per second.")
   .card("derivation", {
       title: "Decomposing $v_0 = 20$ m/s at $\\theta = 45°$",
       steps: [
         {
           latex: "v_x = v_0 \\cos\\theta = 20 \\cos 45° = 20 \\cdot \\frac{\\sqrt{2}}{2} = 10\\sqrt{2} \\ \\text{m/s}"
         },
         {
           latex: "v_y = v_0 \\sin\\theta = 20 \\sin 45° = 20 \\cdot \\frac{\\sqrt{2}}{2} = 10\\sqrt{2} \\ \\text{m/s}"
         },
         {
           latex: "v_x = v_y \\approx 14.1 \\ \\text{m/s} \\quad (\\text{unique to } 45°)",
           highlight: true
         }
       ]
     })
   .do("dimAllExcept", {
       exceptIds: ["horizontalArrow", "verticalArrow", "goldArrow", "triangle"],
       opacity: 0.15
     }, "0")
   .inline("svg");

});


L.askFillIn({
  prompt: "A ball is launched at $\\theta = 45°$ with $v_0 = 20$ m/s. What is the **horizontal component** of the initial velocity? $v_x = v_0 \\cos 45° =$ [___] m/s",
  blank: {
    answer: ["10√2", "10\\sqrt{2}", "14.1", "14.14", "14.142", "≈14.1", "≈ 14.1"],
    width: 90,
    placeholder: "m/s"
  },
  hint: "Use the formula $v_x = v_0 \\cos\\theta$. Think of the velocity arrow as the hypotenuse of a right triangle — the horizontal leg is $20 \\cdot \\cos 45° = 20 \\cdot \\frac{\\sqrt{2}}{2}$.",
  successMessage: "Correct! $v_x = 20\\cos 45° = 10\\sqrt{2} \\approx 14.1$ m/s. This horizontal speed stays **constant** for the entire flight — gravity never touches it.",
  wrongPath: function(B) {
    B.act("Vector Components — The Right Triangle Reminder", function(A) {
      A.vizPanel("svg");

      A.say("Let's slow down and look at what went wrong. That $20$ m/s isn't the horizontal speed — it's the total speed, the hypotenuse. The horizontal and vertical components are the two shorter legs of a right triangle.")
       .card("figure", {
           svg: "<svg viewBox='0 0 320 200' xmlns='http://www.w3.org/2000/svg' style='background:transparent'><defs><marker id='ah' markerWidth='8' markerHeight='8' refX='7' refY='3.5' orient='auto'><polygon points='0 0, 8 3.5, 0 7' fill='#f59e0b'/></marker><marker id='ah-g' markerWidth='8' markerHeight='8' refX='7' refY='3.5' orient='auto'><polygon points='0 0, 8 3.5, 0 7' fill='#4ade80'/></marker><marker id='ah-b' markerWidth='8' markerHeight='8' refX='7' refY='3.5' orient='auto'><polygon points='0 0, 8 3.5, 0 7' fill='#60a5fa'/></marker></defs><line x1='60' y1='160' x2='260' y2='160' stroke='#4ade80' stroke-width='3' marker-end='url(#ah-g)'/><line x1='260' y1='160' x2='260' y2='40' stroke='#60a5fa' stroke-width='3' marker-end='url(#ah-b)'/><line x1='60' y1='160' x2='260' y2='40' stroke='#f59e0b' stroke-width='3' marker-end='url(#ah)'/><rect x='248' y='148' width='12' height='12' fill='none' stroke='#888' stroke-width='1.5'/><text x='155' y='185' text-anchor='middle' fill='#4ade80' font-size='14' font-family='sans-serif'>v_x = 20·cos45°</text><text x='285' y='105' text-anchor='start' fill='#60a5fa' font-size='14' font-family='sans-serif'>v_y = 20·sin45°</text><text x='140' y='90' text-anchor='middle' fill='#f59e0b' font-size='15' font-family='sans-serif' font-weight='bold'>20 m/s</text><text x='75' y='152' fill='#aaa' font-size='13' font-family='sans-serif'>45°</text><path d='M 80 160 A 20 20 0 0 0 74 145' fill='none' stroke='#aaa' stroke-width='1.5'/></svg>",
           caption: "The $20$ m/s arrow (gold) is the hypotenuse. The green and blue arrows are the legs — always shorter."
         })
       .do("dimAllExcept", { exceptIds: ["triangle", "goldArrow"], opacity: 0.1 }, "0")
       .do("drawVelocityArrow", { speed: 20, angle: 45, color: "#f59e0b", label: "20 m/s", durationMs: 800 }, "+0.8")
       .do("drawAngleArc", { angle: 45, label: "45°" }, "+1.8");

      A.say("Here's the key rule: cosine gives you the adjacent leg over the hypotenuse. So the horizontal component is $20 \\cdot \\cos 45° = 20 \\cdot \\frac{\\sqrt{2}}{2} = 10\\sqrt{2}$ m/s.")
       .card("derivation", {
           title: "SOH-CAH-TOA Decomposition",
           steps: [
             { latex: "v_x = v_0 \\cos\\theta = 20 \\cdot \\cos 45°", highlight: false },
             {
               latex: "= 20 \\cdot \\frac{\\sqrt{2}}{2} = 10\\sqrt{2} \\approx 14.1 \\text{ m/s}",
               highlight: true
             }
           ]
         })
       .do("decomposeVelocity", {
           speed: 20,
           angle: 45,
           horizontalLabel: "20·cos45° = 10√2",
           verticalLabel: "20·sin45° = 10√2"
         }, "0")
       .do("pulseArrow", { component: "horizontal", color: "#4ade80" }, "+1.5");

      A.say("And sine gives the opposite leg — the vertical component: $20 \\cdot \\sin 45° = 10\\sqrt{2}$ m/s. At $45°$ specifically, the two legs are equal. But notice — both are smaller than the hypotenuse of $20$ m/s. That's always true for any right triangle.")
       .card("derivation", {
           title: "SOH-CAH-TOA Decomposition",
           steps: [
             { latex: "v_y = v_0 \\sin\\theta = 20 \\cdot \\sin 45°", highlight: false },
             {
               latex: "= 20 \\cdot \\frac{\\sqrt{2}}{2} = 10\\sqrt{2} \\approx 14.1 \\text{ m/s}",
               highlight: true
             },
             {
               latex: "v_x = v_y = 10\\sqrt{2} \\quad (\\text{special case: } \\theta = 45°)",
               highlight: false
             }
           ]
         })
       .do("pulseArrow", { component: "vertical", color: "#60a5fa" }, "0")
       .do("pulseArrow", { component: "horizontal", color: "#4ade80" }, "+1.2");

      A.say("So the answer is $10\\sqrt{2}$ m/s — not $20$, and not $10$. The $20$ m/s lives on the hypotenuse. The components sit on the legs, always scaled down by $\\cos\\theta$ or $\\sin\\theta$. Hold onto these two values — they drive everything that follows.")
       .show({
           type: "latex",
           content: "v_x = 10\\sqrt{2} \\text{ m/s}, \\quad v_y = 10\\sqrt{2} \\text{ m/s}",
           highlight: true
         })
       .do("pulseArrow", { component: "horizontal", color: "#4ade80" }, "+0.5")
       .do("pulseArrow", { component: "vertical", color: "#60a5fa" }, "+1.3")
       .inline("svg");

    });
  }
});


L.act("Following the Flight — Live Velocity Vectors", function(A) {
  A.vizPanel("svg");

  A.say("Now let's watch the ball actually fly. Notice the green horizontal arrow — it never changes length. Nothing pushes the ball sideways, so it cruises at $10\\sqrt{2}$ m/s the entire flight.")
   .do("resetSegment", { keepIds: ["axes", "ball", "horizontalArrow", "verticalArrow"] }, "0")
   .do("animateLaunch", { speed: 20, angle: 45, g: 9.8, durationMs: 3200 }, "+0.6");

  A.say("Meanwhile the blue vertical arrow is shrinking. Gravity pulls down at $9.8$ m/s² every second, steadily eating away at that upward speed.")
   .do("pulseArrow", { component: "vertical", color: "#818cf8" }, "+0.5");

  A.say("Right at the peak, the blue arrow disappears entirely — the vertical velocity hits exactly zero. The ball is still moving sideways, but for one instant it hangs motionless in the vertical direction.")
   .do("markApex", {}, "0");

  A.say("After the peak, gravity flips the blue arrow downward, and it grows longer as the ball accelerates toward the ground. The descent is a perfect mirror of the climb.")
   .show("**Vertical velocity** $v_y = v_0\\sin\\theta - gt$\n\n- Positive on the way **up**\n- Zero at the **apex**\n- Negative on the way **down**")
   .do("dimAllExcept", {
       exceptIds: [
         "trajectoryArc",
         "apexDot",
         "apexLine",
         "apexLabel",
         "horizontalArrow"
       ],
       opacity: 0.2
     }, "0");

  A.say("The green horizontal arrow has stayed perfectly constant the whole time — same length at launch, at the apex, and at landing. That constancy is what makes horizontal and vertical motion so clean to handle separately.")
   .do("pulseArrow", { component: "horizontal", color: "#4ade80" }, "+0.3")
   .inline();

});


L.marker("Time of Flight");


L.act("Symmetry & the Landing Clock", function(A) {
  A.vizPanel("svg");

  A.say("Look at this arc. The left half and right half are perfect mirror images — whatever the ball does climbing up, it undoes on the way back down. Same shape, same time, just reversed.")
   .do("reflectArcSymmetry", {}, "0");

  A.say("That symmetry gives us a clean question: when does the ball return to ground level? In other words, when does $y(t) = 0$?")
   .do("showEquation", { step: "yOfT", position: "top" }, "0")
   .do("showEquation", { step: "setZero", position: "top" }, "+1.2");

  A.say("Set $y(t) = 10\\sqrt{2}\\,t - 4.9t^2 = 0$ and factor out $t$. You get $t\\,(10\\sqrt{2} - 4.9t) = 0$ — two solutions appear immediately.")
   .card("derivation", {
       title: "Solving for Flight Time",
       steps: [
         { latex: "y(t) = 10\\sqrt{2}\\,t - 4.9t^2 = 0" },
         { latex: "t\\,(10\\sqrt{2} - 4.9t) = 0", highlight: true },
         { latex: "t = 0 \\quad \\text{or} \\quad t = \\frac{10\\sqrt{2}}{4.9}" }
       ]
     })
   .do("showEquation", { step: "factored", position: "top" }, "0");

  A.say("$t = 0$ is just the launch — not useful. The second solution is what we're after: $t = \\dfrac{10\\sqrt{2}}{4.9} \\approx 2.89$ seconds. That's our landing clock.")
   .show({
       type: "latex",
       content: "T_{\\text{flight}} = \\frac{10\\sqrt{2}}{4.9} \\approx 2.89 \\text{ s}",
       highlight: true
     })
   .do("highlightSolution", { solution: "nonzero" }, "0")
   .inline();

});


L.ask({
  question: "We found the flight time by solving $y(t) = 0$. Why is setting $y(t) = 0$ the correct landing condition?",
  options: [
    "Because the ball returns to ground level — the same height it started, $y = 0$.",
    "Because the vertical velocity is zero at landing, so $v_y = 0$.",
    "Because the horizontal velocity is zero at landing, so $v_x = 0$.",
    "Because the total speed is zero at landing, so $v = 0$."
  ],
  correct: 0,
  explain: {
    correct: "Exactly — the ball lands when it returns to $y = 0$, the same height as the launch. Setting $y(t) = 0$ captures that geometric condition, giving us both $t = 0$ (launch) and $t = T_{\\text{flight}}$ (landing).",
    "1": "That's the apex condition, not the landing condition. $v_y = 0$ is true only at the top of the arc — the midpoint of the flight — where the ball momentarily stops rising. At landing, the ball is still moving downward, so $v_y \\neq 0$.",
    "2": "That's a misconception about horizontal motion. With no air resistance, $v_x$ stays constant throughout the entire flight — it is never zero. The horizontal velocity at landing equals the horizontal velocity at launch.",
    "3": "That's a stopped-ball misconception. The ball hits the ground while still moving — it has both horizontal and vertical velocity at the moment of landing. Total speed is only zero if the ball somehow freezes mid-air, which doesn't happen here."
  },
  wrongPath: function(B) {
    B.act("Apex vs. Landing — Two Very Different Moments", function(A) {
      A.vizPanel("svg");

      A.say("That answer is one of the most common mix-ups in all of projectile motion — and it's worth pausing to really see why it's wrong. There are two dramatic moments in the ball's flight, and they are completely different things.")
       .do("dimAllExcept", { exceptIds: ["trajectoryArc"], opacity: 0.15 }, "0");

      A.say("The first moment is the apex — the very top of the arc. Up here, the vertical velocity has drained away to zero. $v_y = 0$. But look: the ball is still very much in the air. It hasn't landed. $y$ is at its maximum, not zero.")
       .show("**At the apex:** $v_y = 0$, but $y = y_{\\max}$. The ball is airborne and still moving horizontally.")
       .do("markApex", {}, "0");

      A.say("Now notice the green horizontal arrow is still glowing at the apex. The ball is coasting sideways the whole time — $v_x$ never changes. $v_y = 0$ only means the ball stopped going *up*. It does not mean the ball stopped.")
       .do("pulseArrow", { component: "horizontal", color: "#4caf50" }, "0");

      A.say("The second moment is landing. Here, $y = 0$ — the ball is back on the ground, at the same height it started. The velocity is definitely *not* zero. It points downward at an angle, just as fast as it was at launch.")
       .show({ type: "latex", content: "\\text{Landing condition: } y(t) = 0", highlight: true })
       .do("placeBall", { x: 40.8, y: 0 }, "0")
       .do("drawVelocityArrow", { speed: 20, angle: -45, color: "#2196F3", label: "v at landing", durationMs: 600 }, "+0.8");

      A.say("So the two conditions are: $v_y = 0$ finds the apex, and $y = 0$ finds the landing. Setting velocity to zero would give you the height of the peak — not the range. That's why we set $y(t) = 0$ when we want to know *when* and *where* the ball touches down.")
       .card("derivation", {
           title: "Two Conditions — One Confused With the Other",
           steps: [
             {
               latex: "v_y = 0 \\quad \\Rightarrow \\quad \\text{apex (max height)}",
               highlight: false,
               wrong: false
             },
             {
               latex: "y(t) = 0 \\quad \\Rightarrow \\quad \\text{landing (range)}",
               highlight: true,
               wrong: false
             }
           ]
         })
       .do("dimAllExcept", {
           exceptIds: ["trajectoryArc", "apexMarker", "landingBall", "landingArrow"],
           opacity: 0.2
         }, "0")
       .inline("svg");

    });
  }
});


L.act("Computing the Range — Time Meets Distance", function(A) {
  A.vizPanel("svg");

  A.say("We have the clock — $t = \\frac{10\\sqrt{2}}{4.9} \\approx 2.89$ seconds, glowing gold. Now the horizontal equation. No acceleration, no drag — just constant speed times time.")
   .do("resetSegment", { keepIds: ["trajectoryArc", "apexDot", "axes"] }, "0")
   .do("showEquation", { step: "horizontal", position: "center" }, "+0.8");

  A.say("The horizontal component of our launch speed is $v_0 \\cos 45° = 10\\sqrt{2}$ m/s. So $x(t) = 10\\sqrt{2} \\cdot t$ — clean and linear all the way to landing.")
   .show({
       type: "latex",
       content: "x(t) = v_0 \\cos\\theta \\cdot t = 10\\sqrt{2}\\cdot t",
       highlight: false
     })
   .do("dimAllExcept", { exceptIds: ["trajectoryArc", "axes", "equationBlock"], opacity: 0.2 }, "+0.5");

  A.say("Now substitute. The flight time $t = \\frac{10\\sqrt{2}}{4.9}$ slides straight in — and watch what happens to those square roots.")
   .do("substituteTime", { t: 2.887 }, "+0.6");

  A.say("The two $\\sqrt{2}$ factors multiply: $10\\sqrt{2} \\times 10\\sqrt{2} = 100 \\times 2 = 200$. The roots vanish completely, leaving just $\\frac{200}{4.9}$.")
   .card("derivation", {
       title: "Range Calculation",
       steps: [
         { latex: "R = 10\\sqrt{2} \\cdot \\dfrac{10\\sqrt{2}}{4.9}" },
         {
           latex: "= \\dfrac{10\\sqrt{2} \\times 10\\sqrt{2}}{4.9} = \\dfrac{200}{4.9}",
           highlight: false
         },
         { latex: "\\approx 40.8 \\text{ m}", highlight: true }
       ]
     });

  A.say("Forty-point-eight meters. Watch it land — the bracket stretches from launch to exactly where the arc touches down. That gold label is your answer.")
   .do("drawRangeBracket", { range: 40.8 }, "0")
   .inline("svg");

});


L.marker("The Elegant Formula");


L.act("The Beautiful Compression — sin(2θ) Emerges", function(A) {
  A.vizPanel("svg");

  A.say("There's something more beautiful hiding in our answer. Instead of plugging in numbers, let's keep everything symbolic. The range for any angle $\\theta$ and any speed $v_0$ is horizontal velocity times flight time — that's $v_0\\cos\\theta$ multiplied by $\\frac{2v_0\\sin\\theta}{g}$.")
   .do("resetSegment", { keepIds: ["trajectoryArc", "rangeBracket", "axes"] }, "0")
   .do("showEquation", { step: "generalExpanded", position: "center" }, "+1.2");

  A.say("Write it out and two things jump out at you: a $\\cos\\theta$ and a $\\sin\\theta$, sitting right next to each other, multiplied by $2$. Watch that cluster — it has a name.")
   .do("groupTrigTerms", {}, "+1.0");

  A.say("The double-angle identity: $2\\sin\\theta\\cos\\theta = \\sin(2\\theta)$. Two separate trig functions literally compress into one. Watch the algebra collapse.")
   .show({
       type: "latex",
       content: "2\\sin\\theta\\cos\\theta = \\sin(2\\theta)",
       highlight: true
     })
   .do("collapseToSin2Theta", {}, "+0.8");

  A.say("The result is clean and golden: $R = \\dfrac{v_0^2 \\sin(2\\theta)}{g}$. One fraction, one trig function. The entire parabolic flight compressed to three symbols.")
   .show({ type: "latex", content: "R = \\frac{v_0^2\\,\\sin(2\\theta)}{g}", highlight: true })
   .do("dimAllExcept", { exceptIds: ["generalFormula", "rangeBracket"], opacity: 0.2 }, "+0.6");

  A.say("Let's verify it. Plug in $v_0 = 20$, $\\theta = 45°$, $g = 9.8$: you get $\\frac{400 \\cdot \\sin 90°}{9.8} = \\frac{400}{9.8} \\approx 40.8$ m. The green checkmark lands exactly where our arc did.")
   .do("verifyWithNumbers", { v0: 20, theta: 45, g: 9.8 }, "0")
   .inline("svg");

});


L.askFillIn({
  prompt: "Using $R = \\dfrac{v_0^2\\,\\sin(2\\theta)}{g}$, find the range for a ball launched at $\\theta = 30°$ with $v_0 = 20$ m/s and $g = 9.8$ m/s². Round to one decimal place. $R =$ [___] m.",
  blank: { answer: ["35.3", "35.4"], width: 80, placeholder: "? m" },
  hint: "Substitute carefully: $\\sin(2 \\times 30°) = \\sin(60°) \\approx 0.866$, not $\\sin(30°) = 0.5$. Then compute $\\frac{400 \\times 0.866}{9.8}$.",
  successMessage: "Correct! $R = \\dfrac{20^2 \\cdot \\sin(60°)}{9.8} = \\dfrac{400 \\times 0.866}{9.8} \\approx 35.3$ m. Notice that's less than the 40.8 m at 45° — the formula already hints that 45° is special.",
  wrongPath: function(B) {
    B.act("The Double-Angle — Don't Forget the 2", function(A) {
      A.vizPanel("svg");

      A.say("Here's the trap that caught you. The formula isn't $\\sin(\\theta)$ — it's $\\sin(2\\theta)$. That factor of 2 inside the sine changes everything. Let's see exactly where it comes from.")
       .do("showEquation", { step: "generalExpanded", position: "center" }, "0");

      A.say("Look at the expanded form on screen: $R = v_0 \\cos\\theta \\cdot \\dfrac{2v_0 \\sin\\theta}{g}$. See those two trig functions — $\\cos\\theta$ and $\\sin\\theta$ — sitting side by side? That product has a name.")
       .show("R = v_0\\cos\\theta \\cdot \\frac{2v_0\\sin\\theta}{g}")
       .do("groupTrigTerms", {}, "+1.2");

      A.say("The glowing box highlights $2\\sin\\theta\\cos\\theta$. There's a classic trig identity: $2\\sin\\theta\\cos\\theta = \\sin(2\\theta)$. Watch those three terms compress into one.")
       .do("collapseToSin2Theta", {}, "+0.5");

      A.say("Beautiful. The full formula is $R = \\dfrac{v_0^2 \\sin(2\\theta)}{g}$. The 2 lives *inside* the sine — not multiplying the whole thing, not hiding outside. Right there, inside the argument.")
       .show({ type: "latex", content: "R = \\frac{v_0^2 \\sin(2\\theta)}{g}", highlight: true });

      A.say("Now apply it to $\\theta = 30°$. The argument becomes $2 \\times 30° = 60°$ — not 30°. So you need $\\sin(60°) = \\dfrac{\\sqrt{3}}{2}$, which is about $0.866$. Not $\\sin(30°) = 0.5$.")
       .card("derivation", {
           title: "Correcting the θ = 30° Calculation",
           steps: [
             { latex: "2\\theta = 2 \\times 30° = 60°" },
             { latex: "\\sin(30°) = 0.5 \\quad \\leftarrow \\text{WRONG argument}", wrong: true },
             {
               latex: "\\sin(60°) = \\dfrac{\\sqrt{3}}{2} \\approx 0.866 \\quad \\leftarrow \\text{correct}",
               highlight: true
             },
             {
               latex: "R = \\frac{(20)^2 \\times 0.866}{9.8} = \\frac{400 \\times 0.866}{9.8} \\approx 35.4 \\text{ m}",
               highlight: true
             }
           ]
         })
       .do("dimAllExcept", { exceptIds: ["formulaBlock"], opacity: 0.2 }, "0");

      A.say("So the right answer is about $35.4$ m — not $20.4$ m from using $\\sin(30°)$, and not $40.8$ m from accidentally reusing $45°$. The culprit in both errors was the same: forgetting to double the angle before taking the sine.")
       .card("recap", {
           title: "The Double-Angle Trap",
           content: [
             { type: "text", value: "The range formula hides a double-angle identity:" },
             { type: "latex", value: "R = \\frac{v_0^2 \\sin(2\\theta)}{g}" },
             { type: "text", value: "Common mistake: plugging in sin(θ) instead of sin(2θ)." },
             { type: "text", value: "For θ = 30°: use sin(60°) ≈ 0.866, giving R ≈ 35.4 m ✓" }
           ],
           figure: "<svg viewBox='0 0 320 140' xmlns='http://www.w3.org/2000/svg' style='background:transparent'><rect width='320' height='140' rx='10' fill='#0f0e17'/><text x='160' y='28' text-anchor='middle' font-size='13' fill='#94a3b8' font-family='sans-serif'>Argument inside sin matters!</text><text x='70' y='65' text-anchor='middle' font-size='14' fill='#ef4444' font-family='monospace' text-decoration='line-through'>sin(30°) = 0.500</text><text x='70' y='90' text-anchor='middle' font-size='11' fill='#ef4444' font-family='sans-serif'>✗ Wrong angle</text><line x1='160' y1='50' x2='160' y2='100' stroke='#475569' stroke-width='1' stroke-dasharray='4 3'/><text x='250' y='65' text-anchor='middle' font-size='14' fill='#6ee7b7' font-family='monospace'>sin(60°) = 0.866</text><text x='250' y='90' text-anchor='middle' font-size='11' fill='#6ee7b7' font-family='sans-serif'>✓ 2θ = 60°</text><text x='160' y='125' text-anchor='middle' font-size='13' fill='#f59e0b' font-family='sans-serif' font-weight='bold'>R ≈ 35.4 m</text></svg>"
         })
       .inline();

    });
  }
});


L.marker("The 45° Payoff");


L.act("The Universe Chose 45° — The Visual Climax", function(A) {
  A.vizPanel("svg");

  A.say("Here's the secret hiding inside the formula. Range is proportional to $\\sin(2\\theta)$ — and a sine function reaches its peak, the value $1$, exactly when its argument hits $90°$. So maximum range demands $2\\theta = 90°$, which means $\\theta = 45°$. Our problem didn't just pick a convenient angle — it picked the *optimal* one.")
   .do("resetSegment", { keepIds: ["axes", "rangeBracket"] }, "0")
   .do("showFanOfTrajectories", { angles: [15, 30, 45, 60, 75, 90], speed: 20, g: 9.8 }, "+1.2");

  A.say("Watch every arc — same launch speed, every angle. The $45°$ arc in gold clears the farthest distance. Notice the symmetric pairs: $30°$ and $60°$ land at exactly the same spot, and so do $15°$ and $75°$. The parabola is balanced around $45°$.")
   .do("dimAllExcept", { exceptIds: ["arc_45", "landingDot_45", "fanArcs"], opacity: 0.35 }, "+1.0");

  A.say("Now let's connect each arc to a number. A graph slides in on the right — the horizontal axis is launch angle, the vertical axis is range. Watch as each landing dot maps to a point on the $\\sin(2\\theta)$ curve, one by one.")
   .do("showRangeVsAngleGraph", {}, "+0.5");

  A.say("The peak of that curve sits exactly at $45°$, crowned by a gold star. The answer to 'how far?' was $40.8$ m. But the deeper answer — 'what angle goes farthest?' — is $45°$. Not by accident. Not by coincidence. The mathematics demanded it.")
   .card("recap", {
       title: "The 45° Payoff",
       content: [
         {
           type: "text",
           value: "The range formula $R = \\dfrac{v_0^2 \\sin(2\\theta)}{g}$ is maximized when $\\sin(2\\theta) = 1$."
         },
         {
           type: "text",
           value: "$\\sin(2\\theta) = 1 \\implies 2\\theta = 90° \\implies \\theta = 45°$"
         },
         { type: "text", value: "At $\\theta = 45°$, the maximum range is:" },
         {
           type: "text",
           value: "$R_{\\max} = \\dfrac{v_0^2}{g} = \\dfrac{(20)^2}{9.8} \\approx 40.8 \\text{ m}$"
         },
         {
           type: "text",
           value: "Symmetric pairs like $30°$ and $60°$ always share the same range — the sine curve is symmetric about its peak at $45°$."
         }
       ],
       figure: "<svg viewBox='0 0 340 180' xmlns='http://www.w3.org/2000/svg' style='background:transparent'><defs><marker id='arr' markerWidth='8' markerHeight='8' refX='6' refY='3' orient='auto'><path d='M0,0 L0,6 L8,3 z' fill='#818cf8'/></marker></defs><!-- Axes --><line x1='30' y1='150' x2='310' y2='150' stroke='#818cf8' stroke-width='1.5' marker-end='url(#arr)'/><line x1='30' y1='150' x2='30' y2='20' stroke='#818cf8' stroke-width='1.5' marker-end='url(#arr)'/><text x='315' y='154' fill='#818cf8' font-size='11' font-family='serif'>θ</text><text x='22' y='16' fill='#818cf8' font-size='11' font-family='serif'>R</text><!-- sin(2θ) curve approx with quadratic bezier --><path d='M30,150 Q100,10 170,22 Q240,10 310,150' stroke='#6366f1' stroke-width='2.5' fill='none'/><path d='M30,150 Q100,80 170,22 Q240,80 310,150' stroke='none' fill='#6366f140'/><path d='M30,150 Q100,10 170,22 Q240,10 310,150' stroke='none' fill='#6366f130'/><!-- Symmetric pair dots --><circle cx='83' cy='112' r='5' fill='#818cf8' opacity='0.7'/><circle cx='257' cy='112' r='5' fill='#818cf8' opacity='0.7'/><line x1='83' y1='112' x2='257' y2='112' stroke='#818cf8' stroke-width='1' stroke-dasharray='4,3' opacity='0.5'/><text x='60' y='108' fill='#818cf8' font-size='9' font-family='serif'>30°</text><text x='258' y='108' fill='#818cf8' font-size='9' font-family='serif'>60°</text><!-- Peak at 45° --><circle cx='170' cy='22' r='7' fill='#f59e0b' stroke='#fbbf24' stroke-width='2'/><polygon points='170,8 174,18 184,18 176,24 179,34 170,28 161,34 164,24 156,18 166,18' fill='#f59e0b' opacity='0.9' transform='scale(0.6) translate(113,-2)'/><line x1='170' y1='22' x2='170' y2='150' stroke='#f59e0b' stroke-width='1.5' stroke-dasharray='5,3'/><text x='162' y='162' fill='#f59e0b' font-size='10' font-weight='bold' font-family='serif'>45°</text><!-- Label --><text x='140' y='13' fill='#f59e0b' font-size='10' font-family='serif' font-weight='bold'>R_max</text></svg>"
     })
   .do("zoomOutFinalShot", {}, "+1.0")
   .inline("svg");

});

});