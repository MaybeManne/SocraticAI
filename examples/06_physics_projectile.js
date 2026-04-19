/* examples/06_physics_projectile.js — Physics: Projectile Motion
   Demonstrates: physics problem, custom viz plugin, plot-2d card, fill-in gate
   Build: ./build.sh --mx examples/06_physics_projectile.js dist/examples/06_physics_projectile.html */

/* ── Viz plugin: projectile trajectory ─────────────────────────────────────── */
window.EXPLAINER_VIZ = MX.vizPlugin(function(scene, config) {

  var g   = config.g   || 9.8;   // gravity (m/s²)
  var v0  = config.v0  || 20;    // initial speed (m/s)
  var ang = config.ang || 45;    // launch angle (degrees)

  var W = 500, H = 500;
  var margin = { l: 50, r: 20, t: 20, b: 50 };
  var pw = W - margin.l - margin.r;
  var ph = H - margin.t - margin.b;

  var rad = ang * Math.PI / 180;
  var vx  = v0 * Math.cos(rad);
  var vy  = v0 * Math.sin(rad);
  var tFlight = 2 * vy / g;
  var range   = vx * tFlight;
  var apexT   = vy / g;
  var apexH   = vy * apexT - 0.5 * g * apexT * apexT;

  // coordinate helpers — data (m) → SVG pixels
  function sx(x) { return margin.l + (x / range) * pw; }
  function sy(y) { return (H - margin.b) - (y / (apexH * 1.2)) * ph; }

  // ── Background: axes ────────────────────────────────────────────────
  var ax = MX.axes({
    xRange: [0, range], yRange: [0, apexH * 1.2],
    width: pw, height: ph,
    xLabel: "x (m)", yLabel: "y (m)",
    color: "rgba(255,255,255,0.12)", axisColor: MX.C.WHITE,
    x: margin.l, y: margin.t
  });
  scene.add(ax);

  // ── Trajectory path ─────────────────────────────────────────────────
  var samples = 80;
  var pts = [];
  for (var i = 0; i <= samples; i++) {
    var t = (i / samples) * tFlight;
    pts.push({ x: vx * t, y: vy * t - 0.5 * g * t * t });
  }
  var pathD = pts.map(function(p, i) {
    return (i === 0 ? "M" : "L") + sx(p.x).toFixed(1) + "," + sy(p.y).toFixed(1);
  }).join(" ");

  var trajectory = MX.path({ d: pathD, fill: "none", stroke: MX.C.TEAL, strokeWidth: 2.5 });
  trajectory.setOpacity(0);
  scene.add(trajectory);

  // ── Projectile dot ───────────────────────────────────────────────────
  var ball = MX.dot({ radius: 7, fill: MX.C.AMBER, x: sx(0), y: sy(0) });
  ball.setOpacity(0);
  scene.add(ball);

  // ── Velocity vector ──────────────────────────────────────────────────
  var velArrow = MX.arrow({
    from: [sx(0), sy(0)],
    to:   [sx(0) + 40 * Math.cos(rad), sy(0) - 40 * Math.sin(rad)],
    stroke: MX.C.CORAL, strokeWidth: 2, tipSize: 8
  });
  velArrow.setOpacity(0);
  scene.add(velArrow);

  // ── Apex marker ──────────────────────────────────────────────────────
  var apexDot = MX.dot({ radius: 5, fill: MX.C.INDIGO, x: sx(range / 2), y: sy(apexH) });
  apexDot.setOpacity(0);
  scene.add(apexDot);

  var apexLabel = MX.text("H = " + apexH.toFixed(1) + " m", {
    x: sx(range / 2), y: sy(apexH) - 16, fontSize: 13, color: MX.C.LAVENDER, anchor: "middle"
  });
  apexLabel.setOpacity(0);
  scene.add(apexLabel);

  // ── Range label ──────────────────────────────────────────────────────
  var rangeLabel = MX.text("R = " + range.toFixed(1) + " m", {
    x: sx(range / 2), y: sy(0) + 28, fontSize: 13, color: MX.C.EMERALD, anchor: "middle"
  });
  rangeLabel.setOpacity(0);
  scene.add(rangeLabel);

  return {
    showAxes: function(tl, params, t) {
      MX.fadeIn(ax, { duration: 0.8 }).apply(tl, t);
    },

    launchBall: function(tl, params, t) {
      // Animate ball along trajectory
      tl.set(ball.el, { opacity: 1 }, t);
      var dur = params.duration || 2.5;
      var progress = { v: 0 };
      tl.to(progress, {
        v: 1, duration: dur, ease: "none",
        onUpdate: function() {
          var tt = progress.v * tFlight;
          var bx = sx(vx * tt);
          var by = sy(vy * tt - 0.5 * g * tt * tt);
          gsap.set(ball.el, { x: bx - sx(0), y: by - sy(0) });
        }
      }, t);
      // Draw trajectory simultaneously
      MX.drawBorder(trajectory, { duration: dur }).apply(tl, t);
    },

    showVelocityVector: function(tl, params, t) {
      MX.fadeIn(velArrow, { duration: 0.5 }).apply(tl, t);
    },

    showApex: function(tl, params, t) {
      MX.growFromCenter(apexDot, { duration: 0.4 }).apply(tl, t);
      MX.fadeIn(apexLabel, { from: "up", duration: 0.4 }).apply(tl, t + 0.2);
    },

    showRange: function(tl, params, t) {
      MX.fadeIn(rangeLabel, { from: "down", duration: 0.5 }).apply(tl, t);
    },

    highlightApex: function(tl, params, t) {
      MX.indicate(apexDot, { color: MX.C.AMBER, duration: 0.6 }).apply(tl, t);
    },

    dimTrajectory: function(tl, params, t) {
      tl.to(trajectory.el, { opacity: 0.2, duration: 0.4 }, t);
    }
  };
});


/* ── Lesson ─────────────────────────────────────────────────────────────────── */
MX.lesson("Projectile Motion", function(L) {

  L.source("Physics: Kinematics");
  L.meta({ id: "projectile_motion", grade: "11", tags: ["physics", "kinematics"] });
  L.problem(
    "A ball is launched at $v_0 = 20$ m/s at an angle of $45°$. " +
    "Find the range $R$ and maximum height $H$.",
    { highlight: "Find range and height" }
  );
  L.viz({
    viewBox: "0 0 500 500",
    config: { g: 9.8, v0: 20, ang: 45 }
  });


  // ── Act 1: Components ──────────────────────────────────────────────────────
  L.act("Breaking velocity into components", function(A) {
    A.vizPanel("svg");

    A.say("Any launch velocity has two independent components — horizontal and vertical.")
     .show("$$v_x = v_0 \\cos\\theta \\qquad v_y = v_0 \\sin\\theta$$")
     .do("showAxes");

    A.say("At 45° with $v_0 = 20$ m/s, both components are equal: about 14.1 m/s each.")
     .card("split", {
       left:  { type: "latex", content: "v_x = 20\\cos 45° \\approx 14.1\\text{ m/s}" },
       right: { type: "latex", content: "v_y = 20\\sin 45° \\approx 14.1\\text{ m/s}" }
     })
     .do("showVelocityVector", {}, "+0.3");

    A.say("Horizontal motion is uniform — no forces act horizontally. Vertical motion has constant downward acceleration $g$.")
     .show("Horizontal: $x = v_x t$ — straight line.\n\nVertical: $y = v_y t - \\frac{1}{2}g t^2$ — parabola.");
  });


  // ── Act 2: The trajectory ──────────────────────────────────────────────────
  L.act("The parabolic trajectory", function(A) {
    A.vizPanel("svg");

    A.say("Watch the ball trace its path. The horizontal motion is steady; the vertical rise and fall create the parabola.")
     .do("launchBall", { duration: 2.5 });

    A.say("At the apex the vertical velocity is zero. Only horizontal velocity remains — that's the peak height.")
     .do("showApex", {}, "+2.6")
     .do("highlightApex", {}, "+3.0");

    A.say("The ball hits the ground when $y = 0$ again — that distance is the range.")
     .do("showRange", {}, "+0.4")
     .inline();
  });


  // ── Act 3: Solving for H ───────────────────────────────────────────────────
  L.act("Deriving maximum height", function(A) {
    A.vizPanel("hidden");

    A.say("At the apex, vertical velocity is zero. Use $v_y^2 = v_{y0}^2 - 2gH$ with $v_y = 0$.")
     .card("derivation", {
       title: "Maximum Height",
       steps: [
         { expr: "0 = v_{y0}^2 - 2gH" },
         { expr: "H = \\frac{v_{y0}^2}{2g}" },
         { expr: "H = \\frac{(14.14)^2}{2 \\times 9.8} \\approx 10.2\\text{ m}", highlight: true }
       ]
     });

    A.say("Alternatively, use time to apex: $t_{\\text{apex}} = v_{y0}/g$, then $H = v_{y0} t - \\frac{1}{2}g t^2$.")
     .show("Both routes give $H \\approx 10.2$ m for 45° at 20 m/s.");
  });


  // ── Gate 1: Height check ───────────────────────────────────────────────────
  L.askFillIn({
    prompt: "At $v_0 = 20$ m/s and $\\theta = 45°$, the maximum height is $H = $ [___] m. (Round to nearest integer.)",
    blank: { answer: ["10", "10.2", "10.20"], width: 60, placeholder: "?" },
    hint: "Use $H = v_{y0}^2 / (2g)$ with $v_{y0} = v_0 \\sin 45°$.",
    successMessage: "Correct — $H = (14.14)^2 / (2 \\times 9.8) \\approx 10.2$ m.",
    wrongPath: function(B) {
      B.act("Using kinematics at the apex", function(A) {
        A.vizPanel("hidden");

        A.say("At the apex, the vertical velocity equals zero. That's the key constraint.")
         .show("$v_y = v_{y0} - g t = 0 \\Rightarrow t_{\\text{apex}} = v_{y0}/g$");

        A.say("Plug that time back into the displacement formula to get height.")
         .card("derivation", {
           title: "Height from displacement",
           steps: [
             { expr: "H = v_{y0} t_{\\text{apex}} - \\tfrac{1}{2}g t_{\\text{apex}}^2" },
             { expr: "H = v_{y0} \\cdot \\frac{v_{y0}}{g} - \\frac{1}{2}g \\left(\\frac{v_{y0}}{g}\\right)^2" },
             { expr: "H = \\frac{v_{y0}^2}{2g}", highlight: true }
           ]
         });
      });
    }
  });


  // ── Act 4: Solving for R ───────────────────────────────────────────────────
  L.act("Deriving range", function(A) {
    A.vizPanel("hidden");

    A.say("Total flight time is twice the time to apex, since the trajectory is symmetric.")
     .card("derivation", {
       title: "Range",
       steps: [
         { expr: "t_{\\text{flight}} = \\frac{2 v_{y0}}{g}" },
         { expr: "R = v_x \\cdot t_{\\text{flight}} = v_0\\cos\\theta \\cdot \\frac{2 v_0 \\sin\\theta}{g}" },
         { expr: "R = \\frac{v_0^2 \\sin 2\\theta}{g}", highlight: true },
         { expr: "R = \\frac{(20)^2 \\sin 90°}{9.8} \\approx 40.8\\text{ m}" }
       ]
     });

    A.say("The $\\sin 2\\theta$ factor peaks at $\\theta = 45°$ — confirming 45° gives maximum range.")
     .card("plot-2d", {
       title: "Range vs. launch angle",
       xRange: [0, 90], yRange: [0, 45],
       xLabel: "θ (degrees)", yLabel: "R (m)",
       functions: [{ fn: "(400 * Math.sin(2 * x * Math.PI / 180)) / 9.8", color: MX.C.TEAL }],
       points: [{ x: 45, y: 40.8, label: "45°", highlight: true }]
     });
  });


  // ── Gate 2: Range quiz ─────────────────────────────────────────────────────
  L.ask({
    type: "quiz",
    question: "Which launch angle gives the maximum range (assuming flat ground and no air resistance)?",
    options: ["30°", "45°", "60°", "90°"],
    correct: 1,
    explain: {
      correct: "Yes — $\\sin 2\\theta$ is maximized when $2\\theta = 90°$, so $\\theta = 45°$.",
      "0": "$\\sin(60°) < \\sin(90°)$ — 30° gives less range than 45°.",
      "2": "$\\sin(120°) = \\sin(60°) < 1$ — 60° and 30° give the same range, both less than 45°.",
      "3": "At 90° the ball goes straight up — zero horizontal range."
    }
  });


  // ── Act 5: Summary ─────────────────────────────────────────────────────────
  L.act("Summary", function(A) {
    A.vizPanel("svg");

    A.say("Two formulas capture the full motion. Height peaks when vertical speed is zero. Range uses the double-angle identity.")
     .card("recap", {
       title: "Projectile motion — key results",
       items: [
         { type: "latex", value: "H = \\dfrac{v_0^2 \\sin^2\\theta}{2g}", display: true },
         { type: "latex", value: "R = \\dfrac{v_0^2 \\sin 2\\theta}{g}", display: true },
         { type: "text",  value: "Maximum range at $\\theta = 45°$." },
         { type: "example", value: "$v_0 = 20$ m/s, $\\theta = 45°$: $H \\approx 10.2$ m, $R \\approx 40.8$ m." }
       ]
     })
     .do("showApex")
     .do("showRange", {}, "+0.4")
     .inline();
  });

});
