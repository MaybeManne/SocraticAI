MX.lesson("Projectile Range: Why 45° is the Champion Angle", function(L) {

L.source("Projectile Range Problem — v₀ = 20 m/s, θ = 45°, g = 9.8 m/s²");
L.meta({ answer: "R ≈ 40.8 m", estimated_duration_minutes: 7 });

L.problem("A ball is launched at $\\theta = 45°$ with initial speed $v_0 = 20$ m/s from flat ground. Assuming no air resistance and $g = 9.8$ m/s², find the horizontal range $R$ when the ball lands.", { highlight: "Find the range of a projectile launched at 45°, v₀ = 20 m/s" });

L.viz({
  plugin: "projectile_motion_v1",
  config: {
    xMin: 0,
    xMax: 50,
    yMin: -2,
    yMax: 15,
    backgroundColor: "#d6eaf8",
    groundY: 0,
    groundColor: "#5d4037",
    groundStrokeWidth: 4,
    ballRadius: 0.35,
    ballColor: "#e65100",
    trajectoryColor: "#f9a825",
    trajectoryStrokeWidth: 3,
    horizontalColor: "#1565c0",
    verticalColor: "#c62828",
    algebraHighlightColor: "#ff6f00",
    equationFontScale: 0.8,
    finalAnswerFontScale: 1.3
  }
});


L.act("The Problem: A Ball in Flight", function(A) {
  A.vizPanel("svg");

  A.say("Here's the setup. A ball sits at the origin — ground stretching out ahead, everything still. In a moment, it gets launched into the air.")
   .title("A Ball in Flight", "Given $v_0 = 20$ m/s at $\\theta = 45°$ — where does it land?")
   .do("drawGround", {}, "0")
   .do("placeBall", { x: 0, y: 0 }, "+0.6");

  A.say("We're given exactly two things: an initial speed of $20$ m/s, and a launch angle of $45°$. That single arrow pointing diagonally up is everything we know — and somehow, we need to figure out where the ball comes back down.")
   .show("**Given:** $v_0 = 20$ m/s, $\\theta = 45°$, $g = 9.8$ m/s²\n\n**Find:** Horizontal range $R$")
   .do("drawLaunchArrow", { angle: 45, v0: 20, scale: 1 }, "0");

  A.say("Watch what happens when we let it fly. The ball carves out a perfect golden arc — rising, slowing, peaking, then curving back down to earth. That shape is a parabola, and it's beautiful. But beauty doesn't tell us the number.")
   .do("animateTrajectory", { v0: 20, angle: 45, duration: 3 }, "0");

  A.say("The ball lands somewhere along that ground line, and the distance from launch to landing is what we call the range $R$. See that question mark? That's our target — a precise horizontal distance hiding inside a curving path.")
   .show("The **range** $R$ is the horizontal distance from launch to landing.\n\n$$R = \\ ?$$")
   .do("showRangeBracket", { show: false }, "0")
   .do("pulseQuestionMark", {}, "+1.2")
   .inline("svg");

});


L.act("Splitting the Motion: Two Simple Problems in Disguise", function(A) {
  A.vizPanel("svg");

  A.say("Here's the key insight physicists use to crack projectile motion: horizontal and vertical don't talk to each other. Gravity only pulls down — it never touches the horizontal speed. That means we can separate them completely.")
   .show("**Independence of motion:** Horizontal and vertical components evolve independently. Gravity acts only on the vertical axis.")
   .do("highlightLaunchArrow", {}, "0");

  A.say("Watch the single launch arrow split into two. The blue arrow goes right — that's the horizontal component. The red arrow goes straight up — that's the vertical. Together, they form a perfect rectangle, and the original arrow is exactly their diagonal sum.")
   .do("splitArrowIntoComponents", { angle: 45, v0: 20, scale: 1 }, "0");

  A.say("At $45°$, cosine and sine are both $\\frac{\\sqrt{2}}{2}$, so each component is $v_0 \\cdot \\frac{\\sqrt{2}}{2} = 10\\sqrt{2} \\approx 14.14$ m/s. A perfectly equal split — and as you'll see later, that symmetry is exactly why $45°$ gives maximum range.")
   .card("derivation", {
       title: "Component Decomposition at 45°",
       steps: [
         {
           latex: "v_{0x} = v_0 \\cos 45° = 20 \\cdot \\frac{\\sqrt{2}}{2} = 10\\sqrt{2} \\approx 14.14 \\text{ m/s}"
         },
         {
           latex: "v_{0y} = v_0 \\sin 45° = 20 \\cdot \\frac{\\sqrt{2}}{2} = 10\\sqrt{2} \\approx 14.14 \\text{ m/s}",
           highlight: true
         },
         { latex: "v_{0x} = v_{0y} \\quad \\text{(unique to } 45°\\text{)}" }
       ]
     })
   .do("labelComponents", { vx_label: "10√2 m/s", vy_label: "10√2 m/s" }, "0")
   .do("showComponentEquations", { step: "decompose" }, "+1.2");

  A.say("Now let's pull them fully apart. A dividing line splits the screen. On the left, the full 2D parabola stays — dimmed but intact. On the right, two separate tracks appear, one for each component.")
   .do("splitScreen", {}, "0");

  A.say("Look at the top-right strip — the horizontal track. The dot glides right at perfectly constant speed. Notice those equally spaced tick marks: equal distances in equal times. No force, no acceleration. Just steady, unwavering motion.")
   .do("animateHorizontalStrip", {}, "0");

  A.say("Now the vertical strip. The dot rises, decelerates, hangs for a moment at the peak, then falls back down — exactly like a ball tossed straight up. This is just gravity doing its simple, one-dimensional work.")
   .do("animateVerticalStrip", {}, "0");

  A.say("Two simple problems, happening simultaneously. The intimidating parabola on the left is nothing more than these two motions running in parallel — a disguise hiding two very familiar ideas.")
   .card("recap", {
       title: "The Disguise Revealed",
       content: [
         { type: "text", value: "Projectile motion = two independent 1D problems:" },
         {
           type: "latex",
           value: "\\text{Horizontal: } x(t) = v_{0x}\\, t = 10\\sqrt{2}\\; t"
         },
         {
           type: "latex",
           value: "\\text{Vertical: } y(t) = v_{0y}\\, t - \\tfrac{1}{2}g t^2 = 10\\sqrt{2}\\; t - 4.9\\, t^2"
         },
         {
           type: "text",
           value: "Next: find how long the ball stays in the air using the vertical equation alone."
         }
       ],
       figure: "<svg viewBox='0 0 320 120' xmlns='http://www.w3.org/2000/svg' font-family='sans-serif'><rect width='320' height='120' fill='transparent'/><rect x='10' y='10' width='135' height='100' rx='8' fill='#1e1b4b' stroke='#6366f1' stroke-width='1.5'/><text x='77' y='30' text-anchor='middle' fill='#818cf8' font-size='11' font-weight='bold'>HORIZONTAL</text><line x1='25' y1='75' x2='130' y2='75' stroke='#334155' stroke-width='1'/><circle cx='35' cy='75' r='5' fill='#60a5fa'/><circle cx='60' cy='75' r='5' fill='#60a5fa' opacity='0.7'/><circle cx='85' cy='75' r='5' fill='#60a5fa' opacity='0.5'/><circle cx='110' cy='75' r='5' fill='#60a5fa' opacity='0.3'/><text x='77' y='100' text-anchor='middle' fill='#94a3b8' font-size='9'>constant speed</text><rect x='175' y='10' width='135' height='100' rx='8' fill='#1e1b4b' stroke='#f59e0b' stroke-width='1.5'/><text x='242' y='30' text-anchor='middle' fill='#fbbf24' font-size='11' font-weight='bold'>VERTICAL</text><line x1='242' y1='85' x2='242' y2='35' stroke='#334155' stroke-width='1'/><circle cx='242' cy='85' r='5' fill='#f87171'/><circle cx='242' cy='65' r='5' fill='#f87171' opacity='0.7'/><circle cx='242' cy='50' r='5' fill='#f87171' opacity='0.5'/><circle cx='242' cy='42' r='5' fill='#f87171' opacity='0.3'/><text x='242' y='105' text-anchor='middle' fill='#94a3b8' font-size='9'>gravity decelerates</text></svg>"
     })
   .do("labelStrips", {
       horizontal_text: "Constant velocity — no force acts",
       vertical_text: "Uniform acceleration — gravity only"
     }, "0")
   .inline("svg");

});


L.ask({
  question: "At a launch angle of 45°, which statement about the horizontal and vertical speed components is true?",
  options: [
    "Both components are equal: $v_{0x} = v_{0y} = 10\\sqrt{2}$ m/s",
    "The horizontal component is larger: $v_{0x} = 20$ m/s, $v_{0y} = 0$ m/s",
    "The vertical component is larger: $v_{0y} = 20$ m/s, $v_{0x} = 0$ m/s",
    "They add to $v_0$: $v_{0x} + v_{0y} = 20$ m/s"
  ],
  correct: 0,
  explain: {
    correct: "Exactly — because $\\cos 45° = \\sin 45° = \\frac{\\sqrt{2}}{2}$, both components equal $20 \\cdot \\frac{\\sqrt{2}}{2} = 10\\sqrt{2} \\approx 14.14$ m/s. This perfect symmetry is what makes 45° special.",
    "1": "That's the flat-launch misconception (θ = 0°). At 0°, all the speed is horizontal and the ball goes nowhere vertically. At 45°, both components share the speed equally via cos 45° and sin 45°.",
    "2": "That's the straight-up launch misconception (θ = 90°). At 90°, all the speed is vertical and the ball goes straight up. At 45°, cos and sin are equal, so neither component dominates.",
    "3": "That's a component-addition error. Components combine as vectors, not scalars — the correct relationship is $v_0 = \\sqrt{v_{0x}^2 + v_{0y}^2}$, not $v_{0x} + v_{0y} = v_0$."
  },
  wrongPath: function(B) {
    B.act("The Unit Circle at 45°: A Perfect Symmetry", function(A) {
      A.vizPanel("figure");

      A.say("Here's what's really going on at 45°. Picture the unit circle — a circle of radius one centered at the origin. The point on that circle at 45° sits exactly halfway between the x-axis and the y-axis. Its x-coordinate and y-coordinate are identical.")
       .card("figure", {
           svg: "<svg viewBox='0 0 320 320' xmlns='http://www.w3.org/2000/svg' style='background:transparent'><circle cx='160' cy='160' r='110' fill='none' stroke='#6366f1' stroke-width='2'/><line x1='40' y1='160' x2='280' y2='160' stroke='#ffffff' stroke-width='1' stroke-opacity='0.4'/><line x1='160' y1='40' x2='160' y2='280' stroke='#ffffff' stroke-width='1' stroke-opacity='0.4'/><line x1='160' y1='160' x2='237.8' y2='82.2' stroke='#f59e0b' stroke-width='2.5'/><line x1='237.8' y1='82.2' x2='237.8' y2='160' stroke='#818cf8' stroke-width='2' stroke-dasharray='5,4'/><line x1='160' y1='160' x2='237.8' y2='160' stroke='#34d399' stroke-width='2' stroke-dasharray='5,4'/><line x1='237.8' y1='160' x2='237.8' y2='82.2' stroke='none'/><rect x='230' y='153' width='7' height='7' fill='none' stroke='#ffffff' stroke-width='1.2' stroke-opacity='0.7'/><circle cx='237.8' cy='82.2' r='5' fill='#f59e0b'/><text x='249' y='78' fill='#f59e0b' font-size='13' font-family='serif' font-style='italic'>P</text><text x='195' y='175' fill='#34d399' font-size='13' font-family='serif'>cos 45°</text><text x='243' y='128' fill='#818cf8' font-size='13' font-family='serif'>sin 45°</text><path d='M 175 160 A 15 15 0 0 0 170.6 149.4' fill='none' stroke='#f59e0b' stroke-width='1.5'/><text x='176' y='152' fill='#f59e0b' font-size='11' font-family='sans-serif'>45°</text><text x='90' y='260' fill='#ffffff' font-size='12' font-family='sans-serif' fill-opacity='0.7'>cos 45° = sin 45° = √2/2</text></svg>",
           caption: "At 45°, the point $P$ on the unit circle has equal $x$ and $y$ coordinates — so $\\cos 45° = \\sin 45°$."
         });

      A.say("Why are they equal? The triangle formed is a 45-45-90 triangle — and since two of its angles are the same, the two legs must be the same length. Both legs equal $\\frac{\\sqrt{2}}{2}$. So $\\cos 45°$ and $\\sin 45°$ are not just close — they are exactly the same number.")
       .card("derivation", {
           title: "45-45-90 Triangle",
           steps: [
             { latex: "\\text{Triangle legs: } a = b \\quad (\\text{isosceles})" },
             { latex: "a^2 + b^2 = 1^2 \\implies 2a^2 = 1 \\implies a = \\tfrac{\\sqrt{2}}{2}" },
             {
               latex: "\\cos 45° = \\tfrac{\\sqrt{2}}{2}, \\quad \\sin 45° = \\tfrac{\\sqrt{2}}{2}",
               highlight: true
             }
           ]
         });

      A.say("That makes the answer to our quiz question completely clear. The horizontal component is $v_0 \\cos 45° = v_0 \\cdot \\frac{\\sqrt{2}}{2}$, and the vertical component is $v_0 \\sin 45° = v_0 \\cdot \\frac{\\sqrt{2}}{2}$. They are always equal — no matter what $v_0$ is. 45° is the one angle where the ball splits its speed perfectly.")
       .show({
           type: "latex",
           content: "v_{0x} = v_0 \\cos 45° = v_0 \\sin 45° = v_{0y} = \\frac{\\sqrt{2}}{2}\\,v_0",
           highlight: true
         })
       .inline("figure");

    });
  }
});


L.marker("Derivation");


L.act("How Long Is the Ball in the Air?", function(A) {
  A.vizPanel("svg");

  A.say("When does the ball land? That's a vertical question — horizontal motion has absolutely no say in the matter. So let's dim the horizontal strip and zoom in on what gravity is doing.")
   .do("focusVerticalStrip", {}, "0");

  A.say("The vertical position at any moment is $y(t) = v_{0y}\\,t - \\tfrac{1}{2}g\\,t^2$. Constant upward kick from the launch, fighting a steadily growing downward pull from gravity.")
   .show("y(t) = v_{0y}\\,t - \\tfrac{1}{2}g\\,t^2")
   .do("showEquation", { step: "y_of_t" }, "0");

  A.say("Landing means $y = 0$. Set the whole expression to zero — and now factor out a $t$. Two solutions appear immediately: $t = 0$ and $t = \\tfrac{2v_{0y}}{g}$.")
   .card("derivation", {
       title: "Finding When the Ball Lands",
       steps: [
         { latex: "0 = v_{0y}\\,t - \\tfrac{1}{2}g\\,t^2" },
         { latex: "0 = t\\!\\left(v_{0y} - \\tfrac{1}{2}g\\,t\\right)" },
         { latex: "t = 0 \\quad \\text{or} \\quad t = \\dfrac{2v_{0y}}{g}", highlight: true }
       ]
     })
   .do("showEquation", { step: "set_zero" }, "0")
   .do("showEquation", { step: "factor" }, "+1.2")
   .do("showEquation", { step: "t_flight" }, "+2.4");

  A.say("$t = 0$ is just the launch instant — trivial, not what we want. The meaningful solution is $t = \\tfrac{2v_{0y}}{g}$: exactly the time gravity needs to pull the ball all the way back to earth.")
   .do("highlightSolution", { t_expression: "2v_{0y}/g", label: "time of flight" }, "+0.5");

  A.say("Plugging in $v_{0y} = 10\\sqrt{2}$ m/s and $g = 9.8$ m/s² gives $t = \\tfrac{2 \\times 10\\sqrt{2}}{9.8} \\approx 2.887$ seconds. Watch the clock tick — the dot rises for the first half, then falls back down symmetrically.")
   .show({
       type: "latex",
       content: "t = \\frac{2 \\times 10\\sqrt{2}}{9.8} \\approx 2.887\\text{ s}",
       highlight: true
     })
   .do("showEquation", { step: "t_flight" }, "0")
   .do("showClockOnVerticalStrip", { duration: 2.887 }, "+0.8");

  A.say("Now bring back the horizontal strip. For those same $2.887$ seconds, the ball was also gliding rightward at $10\\sqrt{2}$ m/s — steady, uninterrupted. The range is simply how far that constant drift carried it.")
   .do("restoreHorizontalStrip", {}, "0")
   .inline("svg");

});


L.askFillIn({
  prompt: "The time of flight formula $t = \\dfrac{2v_{0y}}{g}$ depends only on the [___] component of velocity.",
  blank: { answer: ["vertical", "Vertical", "VERTICAL"], width: 100, placeholder: "one word" },
  hint: "Ask yourself: which strip did we \"dim\" when solving for landing time? Horizontal motion had \"absolutely no say in the matter.\"",
  successMessage: "Exactly! The landing condition $y = 0$ is a purely vertical equation — $v_{0y}$ and $g$ are the only players. Horizontal speed is irrelevant to *when* the ball lands.",
  wrongPath: function(B) {
    B.act("Two Balls, Same Clock: Proving Axis Independence", function(A) {
      A.vizPanel("svg");

      A.say("Here's a thought experiment that cuts right to the heart of the confusion. Imagine two balls launched at the exact same moment — both with an upward speed of $10\\sqrt{2}$ m/s — but one travels horizontally at 10 m/s while the other charges ahead at 30 m/s.")
       .do("drawGround", {}, "0")
       .do("placeBall", { x: 0, y: 0 }, "+0.4")
       .do("drawLaunchArrow", { angle: 55, v0: 10, scale: 1 }, "+0.8")
       .do("drawLaunchArrow", { angle: 25, v0: 30, scale: 1 }, "+1.4");

      A.say("Both arrows are split into components. The horizontal components are very different — but look at the red vertical arrows. They are identical. Both balls climb and fall under the exact same gravitational story.")
       .do("splitArrowIntoComponents", { angle: 55, v0: 10, scale: 1 }, "0")
       .do("splitArrowIntoComponents", { angle: 25, v0: 30, scale: 1 }, "+0.6")
       .do("labelComponents", { vx_label: "v_x = 10 m/s", vy_label: "v_y = 10√2 m/s" }, "+1.4");

      A.say("Watch both trajectories unfold. The slow ball arcs steeply and lands close. The fast ball stretches far out across the ground. But keep your eye on the vertical rhythm — they rise together, they fall together.")
       .do("animateTrajectory", { v0: 14.14, angle: 55, duration: 3 }, "0")
       .do("animateTrajectory", { v0: 31.62, angle: 25, duration: 3 }, "0");

      A.say("They touch down at the same instant. Different distances, same clock. This is the core of the independence principle — horizontal speed is irrelevant to when gravity wins.")
       .show("**Axis Independence:** Time of flight $T$ depends only on $v_{0y}$, not $v_{0x}$.\n\n$$T = \\frac{2\\,v_{0y}}{g}$$\n\nHorizontal speed changes *where* the ball lands, never *when*.")
       .do("showRangeBracket", { value: "10√2 × T", show: true }, "0")
       .do("showRangeBracket", { value: "30√2 × T", show: true }, "+0.8")
       .do("focusVerticalStrip", {}, "+1.6")
       .inline("svg");

    });
  }
});


L.act("Computing the Range: The √2 Magic Trick", function(A) {
  A.vizPanel("svg");

  A.say("The two strips have done their jobs. Now fold them back — watch the split screen collapse into the full 2D flight path you started with.")
   .do("collapseStrips", {}, "0");

  A.say("The horizontal component has exactly one job: travel at $10\\sqrt{2}$ m/s for the entire duration of the flight — $t = \\frac{20\\sqrt{2}}{9.8}$ seconds. Range is just distance equals speed times time.")
   .show({ type: "latex", content: "R = v_{0x} \\times t", highlight: false })
   .do("showEquation", { step: "R_formula" }, "+0.8");

  A.say("Substitute both expressions. Horizontal velocity gives us $10\\sqrt{2}$, and the time of flight gives us $\\frac{20\\sqrt{2}}{9.8}$. Look at those two $\\sqrt{2}$ terms sitting right next to each other.")
   .card("derivation", {
       title: "Substituting into R = v₀ₓ × t",
       steps: [
         { latex: "R = v_{0x} \\times t" },
         { latex: "R = 10\\sqrt{2} \\times \\frac{20\\sqrt{2}}{9.8}", highlight: true }
       ]
     })
   .do("showEquation", { step: "R_substitution" }, "0")
   .do("highlightSqrt2Terms", {}, "+1.2");

  A.say("$\\sqrt{2} \\times \\sqrt{2} = 2$. Watch them cancel — those two orange radicals strike through and leave behind a clean factor of two.")
   .do("cancelSqrt2Terms", {}, "0");

  A.say("What's left is pure arithmetic: $10 \\times 20 \\times 2 = 400$, divided by $9.8$. No square roots, no approximations — the mess cleaned itself up.")
   .card("derivation", {
       title: "Cleaning Up",
       steps: [
         { latex: "R = \\frac{10 \\times 20 \\times \\sqrt{2} \\times \\sqrt{2}}{9.8}" },
         { latex: "R = \\frac{10 \\times 20 \\times 2}{9.8}" },
         { latex: "R = \\frac{400}{9.8} \\approx 40.8 \\text{ m}", highlight: true }
       ]
     })
   .do("showEquation", { step: "R_simplified" }, "0")
   .do("showEquation", { step: "R_final" }, "+1.5");

  A.say("The range bracket snaps into place — $40.8$ meters. That's your answer. But it quietly raises a question: was $45°$ really the best possible angle to choose?")
   .do("snapRangeBracket", { value: 40.8 }, "0")
   .do("showFinalAnswer", { value: "R ≈ 40.8 m" }, "+1.2")
   .inline("svg");

});


L.ask({
  question: "If the initial speed were doubled to $v_0 = 40$ m/s (still at $45°$), what happens to the range?",
  options: [
    "The range doubles to $\\approx 81.6$ m",
    "The range quadruples to $\\approx 163.3$ m",
    "The range increases by a factor of $\\sqrt{2}$ to $\\approx 57.7$ m",
    "The range stays the same — only angle determines range"
  ],
  correct: 1,
  explain: {
    correct: "Exactly — because $R = \\frac{v_0^2 \\sin(2\\theta)}{g}$, range scales with $v_0^2$. Doubling $v_0$ multiplies $R$ by $2^2 = 4$, giving $\\approx 163.3$ m.",
    "0": "That's linear-scaling confusion. If $R$ depended on $v_0$ directly, doubling speed would double range. But the range formula has $v_0^2$ — squaring the speed squares the range.",
    "2": "That's the square-root misconception. $\\sqrt{2}$ appeared in the algebra as a coincidence of $45°$, but it doesn't govern how range scales with speed. The exponent on $v_0$ in $R = v_0^2 \\sin(2\\theta)/g$ is 2, not $\\frac{1}{2}$.",
    "3": "That's the angle-only fallacy. Angle fixes the shape of the trajectory, but $v_0$ controls how far it reaches. The full formula $R = v_0^2 \\sin(2\\theta)/g$ shows range depends on both."
  },
  wrongPath: function(B) {
    B.act("Range Scales with v₀ Squared", function(A) {
      A.vizPanel("null");

      A.say("Here's why the answer is quadruple, not double. Look at the general range formula: $R = \\dfrac{v_0^2 \\sin(2\\theta)}{g}$. The initial speed isn't just $v_0$ — it appears as $v_0^2$. That exponent changes everything.")
       .show({ type: "latex", content: "R = \\frac{v_0^2 \\sin(2\\theta)}{g}", highlight: true });

      A.say("When you double $v_0$, you're replacing it with $2v_0$. Squaring that gives $(2v_0)^2 = 4v_0^2$ — a factor of four, not two. The range doesn't scale with speed, it scales with speed squared.")
       .card("derivation", {
           title: "Doubling v₀",
           steps: [
             { latex: "R \\propto v_0^2" },
             { latex: "(2v_0)^2 = 4v_0^2", highlight: true },
             { latex: "\\Rightarrow R_{\\text{new}} = 4 \\times R_{\\text{old}}" }
           ]
         });

      A.say("Let's put real numbers on it. At $v_0 = 20$ m/s, the range is $\\frac{400 \\times 1}{9.8} \\approx 40.8$ m. At $v_0 = 40$ m/s, it's $\\frac{1600 \\times 1}{9.8} \\approx 163.3$ m. That second number is exactly four times the first.")
       .card("bar-chart", {
           title: "Range vs. Launch Speed (θ = 45°)",
           bars: [
             { label: "v₀ = 20 m/s", value: 40.8, display: "40.8 m" },
             { label: "v₀ = 40 m/s", value: 163.3, display: "163.3 m" }
           ],
           maxValue: 180
         });

      A.say("This is the signature of a quadratic relationship. Every time you double the speed, the range grows by a factor of four. Triple the speed? Nine times the range. The bar on the right isn't just taller — it's four bars stacked into one.")
       .show("**Quadratic scaling:** $R \\propto v_0^2$\n\n$\\times 2$ speed → $\\times 4$ range\n\n$\\times 3$ speed → $\\times 9$ range")
       .inline();

    });
  }
});


L.marker("Payoff");


L.act("Why 45° Is the Champion Angle", function(A) {
  A.vizPanel("svg");

  A.say("That $R \\approx 40.8$ m is a real answer — but is it the *best* answer? There's a beautiful general formula hiding in the same two-step approach we just used. For any launch angle $\\theta$, the range simplifies to $R = \\dfrac{v_0^2 \\sin(2\\theta)}{g}$.")
   .show({ type: "latex", content: "R = \\frac{v_0^2 \\sin(2\\theta)}{g}", highlight: true })
   .do("showEquation", { step: "general_range" }, "0")
   .do("showEquation", { step: "R_final" }, "+1.2");

  A.say("The key is that $\\sin(2\\theta)$ sitting in the numerator. Sine is at most 1 — and it hits exactly 1 when $2\\theta = 90°$, meaning $\\theta = 45°$. Every other angle gives a smaller sine, and therefore a shorter range.")
   .show("$\\sin(2\\theta)$ is maximized when $2\\theta = 90°$, i.e. $\\theta = 45°$, where $\\sin(90°) = 1$.")
   .do("dimCurrentTrajectory", { opacity: 0.25 }, "0");

  A.say("Let's make all the angles compete. Here come five trajectories at once — $15°$, $30°$, $45°$, $60°$, and $75°$ — all launched at the same $20$ m/s. Watch how high and how far each one goes.")
   .do("drawTrajectoryFan", { angles: [15, 30, 45, 60, 75], v0: 20, highlight_angle: 45 }, "0");

  A.say("Now look at where they land. The gold arc — $45°$ — reaches the farthest right. And notice something elegant: $30°$ and $60°$ share the same landing spot, and so do $15°$ and $75°$. Symmetric pairs, perfectly balanced around $45°$.")
   .show("Complementary angles share the same range: $R(\\theta) = R(90°{-}\\theta)$, because $\\sin(2\\theta) = \\sin(180°{-}2\\theta)$.")
   .do("labelFanLanding", {}, "0");

  A.say("Here's the rigorous picture. A graph of $f(\\theta) = \\sin(2\\theta)$ slides up beneath the trajectories. It rises from zero, crests at $\\theta = 45°$, and falls back to zero at $90°$. The peak is unmistakable — and that's exactly where our ball was aimed.")
   .do("slideInSin2ThetaGraph", {}, "0")
   .do("markPeakOnGraph", { theta: 45 }, "+1.5");

  A.say("The golden dot on the graph connects back up to the tallest arc in the fan — our $45°$ trajectory. This isn't a coincidence or a lucky number. It's the geometry of sine forcing the answer.")
   .do("highlightCurrentAngle", { theta: 45 }, "0");

  A.say("Plug in: $R = \\dfrac{(20)^2 \\cdot \\sin(90°)}{9.8} = \\dfrac{400}{9.8} \\approx 40.8$ meters. That's not just *an* answer — it's the *maximum* possible range at this speed. No other angle gets you farther. $45°$ is the champion.")
   .card("recap", {
       title: "Why 45° Wins",
       content: [
         { type: "text", value: "General range formula (any angle):" },
         { type: "latex", value: "R = \\frac{v_0^2 \\sin(2\\theta)}{g}" },
         { type: "text", value: "Maximum when $\\sin(2\\theta) = 1$, i.e. $\\theta = 45°$." },
         {
           type: "latex",
           value: "R_{\\max} = \\frac{v_0^2}{g} = \\frac{(20)^2}{9.8} \\approx 40.8 \\text{ m}"
         },
         {
           type: "text",
           value: "Bonus: complementary angles give equal ranges, e.g. $R(30°) = R(60°)$."
         }
       ],
       figure: "<svg viewBox='0 0 340 160' xmlns='http://www.w3.org/2000/svg' style='background:transparent'><defs><marker id='arr' markerWidth='6' markerHeight='6' refX='5' refY='3' orient='auto'><path d='M0,0 L6,3 L0,6 Z' fill='#94a3b8'/></marker></defs><line x1='20' y1='130' x2='320' y2='130' stroke='#94a3b8' stroke-width='1.5' marker-end='url(#arr)'/><line x1='20' y1='130' x2='20' y2='20' stroke='#94a3b8' stroke-width='1.5' marker-end='url(#arr)'/><text x='170' y='148' fill='#94a3b8' font-size='11' text-anchor='middle' font-family='serif'>θ</text><text x='10' y='80' fill='#94a3b8' font-size='11' text-anchor='middle' font-family='serif'>R</text><path d='M20,130 Q80,18 170,50 Q260,82 320,130' fill='none' stroke='#818cf8' stroke-width='1.5' stroke-dasharray='4,3' opacity='0.5'/><path d='M20,130 Q120,8 220,130' fill='none' stroke='#f59e0b' stroke-width='3'/><path d='M20,130 Q160,55 320,130' fill='none' stroke='#818cf8' stroke-width='1.5' stroke-dasharray='4,3' opacity='0.5'/><circle cx='220' cy='130' r='5' fill='#f59e0b'/><text x='220' y='122' fill='#f59e0b' font-size='10' text-anchor='middle' font-family='sans-serif' font-weight='bold'>45°</text><text x='275' y='122' fill='#818cf8' font-size='9' text-anchor='middle' font-family='sans-serif'>30°=60°</text><text x='316' y='122' fill='#818cf8' font-size='9' text-anchor='middle' font-family='sans-serif'>15°=75°</text><text x='180' y='38' fill='#f59e0b' font-size='12' font-family='serif' font-weight='bold'>R ≈ 40.8 m</text></svg>"
     })
   .do("highlightCurrentAngle", { theta: 45 }, "0")
   .do("showFinalAnswer", { value: "R ≈ 40.8 m" }, "+1.0")
   .inline("svg");

});

});