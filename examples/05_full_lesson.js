/* examples/05_full_lesson.js — Complete Feature Showcase
   A real lesson on the Law of Cosines that uses:
     - SVG viz plugin with GSAP animations
     - All card types (title, text, latex, derivation, split, recap, bar-chart, graph)
     - All gate types (quiz, fill-in, proof-builder) with wrong-path branches
     - Markers, inline viz, vizPanel overrides, metadata, duration overrides
     - Source and meta declarations
   Build: ./build.sh --mx examples/05_full_lesson.js dist/examples/05_full_lesson.html */

// ── SVG Viz Plugin ────────────────────────────────────────────────────────────
window.EXPLAINER_VIZ = (function() {
  "use strict";
  var _svg = null, _els = {};

  function init(svgEl, config) {
    _svg = svgEl;
    _svg.setAttribute("viewBox", "0 0 500 420");

    // Vertices of a general triangle (A=bottom-left, B=bottom-right, C=top)
    // A=(60,350), B=(420,350), C=(260,100)
    _svg.innerHTML = [
      '<defs>',
      '  <marker id="arr" markerWidth="6" markerHeight="5" refX="6" refY="2.5" orient="auto">',
      '    <polygon points="0 0, 6 2.5, 0 5" fill="#818cf8"/>',
      '  </marker>',
      '</defs>',

      // Background
      '<rect width="500" height="420" fill="#0a0916"/>',

      // ── Triangle sides ────────────────────────────────────────────────────
      // Side a (B→C, opposite A): green
      '<line id="side-a" x1="420" y1="350" x2="260" y2="100"',
      '  stroke="#34d399" stroke-width="3" stroke-linecap="round"',
      '  stroke-dasharray="290" stroke-dashoffset="290"/>',
      // Side b (A→C, opposite B): orange
      '<line id="side-b" x1="60" y1="350" x2="260" y2="100"',
      '  stroke="#f59e0b" stroke-width="3" stroke-linecap="round"',
      '  stroke-dasharray="320" stroke-dashoffset="320"/>',
      // Side c (A→B, opposite C): purple
      '<line id="side-c" x1="60" y1="350" x2="420" y2="350"',
      '  stroke="#818cf8" stroke-width="3" stroke-linecap="round"',
      '  stroke-dasharray="360" stroke-dashoffset="360"/>',

      // ── Angle arc at A ────────────────────────────────────────────────────
      // Arc from ~30° to ~55° centred at A=(60,350), r=45
      '<path id="angle-A" d="M 105,350 A 45,45 0 0,0 85.5,309.5"',
      '  fill="none" stroke="#818cf8" stroke-width="2" opacity="0"/>',
      '<text id="angle-A-label" x="115" y="325" fill="#818cf8" font-size="18"',
      '  font-family="serif" font-style="italic" opacity="0">A</text>',

      // ── Vertices ─────────────────────────────────────────────────────────
      '<circle id="pt-A" cx="60"  cy="350" r="5" fill="#e0e7ff" opacity="0"/>',
      '<circle id="pt-B" cx="420" cy="350" r="5" fill="#e0e7ff" opacity="0"/>',
      '<circle id="pt-C" cx="260" cy="100" r="5" fill="#e0e7ff" opacity="0"/>',
      '<text id="vtx-A" x="38"  y="370" fill="#e0e7ff" font-size="16" font-family="serif" font-style="italic" opacity="0">A</text>',
      '<text id="vtx-B" x="428" y="370" fill="#e0e7ff" font-size="16" font-family="serif" font-style="italic" opacity="0">B</text>',
      '<text id="vtx-C" x="265" y="90"  fill="#e0e7ff" font-size="16" font-family="serif" font-style="italic" opacity="0">C</text>',

      // ── Side labels ───────────────────────────────────────────────────────
      '<text id="lbl-a" x="355" y="245" fill="#34d399" font-size="18" font-family="serif" font-style="italic" opacity="0">a</text>',
      '<text id="lbl-b" x="135" y="215" fill="#f59e0b" font-size="18" font-family="serif" font-style="italic" opacity="0">b</text>',
      '<text id="lbl-c" x="232" y="380" fill="#818cf8" font-size="18" font-family="serif" font-style="italic" opacity="0">c</text>',

      // ── Altitude from C to AB ─────────────────────────────────────────────
      '<line id="altitude" x1="260" y1="100" x2="260" y2="350"',
      '  stroke="rgba(224,231,255,0.3)" stroke-width="1.5" stroke-dasharray="6,4" opacity="0"/>',
      '<text id="alt-label" x="268" y="230" fill="rgba(224,231,255,0.5)" font-size="13" opacity="0">h</text>',

      // ── Formula banner ────────────────────────────────────────────────────
      '<rect id="formula-bg" x="50" y="20" width="400" height="48" rx="8"',
      '  fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.3)" stroke-width="1" opacity="0"/>',
      '<text id="formula-text" x="250" y="52" text-anchor="middle" fill="#e0e7ff"',
      '  font-size="20" font-family="serif" opacity="0">',
      '  c² = a² + b² − 2ab cos A',
      '</text>',
    ].join("\n");

    var ids = [
      "side-a","side-b","side-c",
      "angle-A","angle-A-label",
      "pt-A","pt-B","pt-C","vtx-A","vtx-B","vtx-C",
      "lbl-a","lbl-b","lbl-c",
      "altitude","alt-label",
      "formula-bg","formula-text"
    ];
    ids.forEach(function(id) { _els[id] = _svg.getElementById(id); });
  }

  function getElements() { return _els; }

  function executeAction(method, params) {
    if (method === "reset") {
      ["side-a","side-b","side-c"].forEach(function(id) {
        var el = _els[id];
        if (el) el.setAttribute("stroke-dashoffset", el.getAttribute("stroke-dasharray"));
      });
      ["angle-A","angle-A-label",
       "pt-A","pt-B","pt-C","vtx-A","vtx-B","vtx-C",
       "lbl-a","lbl-b","lbl-c",
       "altitude","alt-label",
       "formula-bg","formula-text"
      ].forEach(function(id) { if (_els[id]) _els[id].setAttribute("opacity","0"); });
    }
  }

  function timelineAction(tl, method, params, t) {
    var p = params || {};
    var dur = p.duration != null ? p.duration : 0.8;

    switch (method) {
      case "drawSide_c":
        tl.to(_els["side-c"], { strokeDashoffset: 0, duration: dur, ease:"power2.out" }, t);
        break;
      case "drawSide_a":
        tl.to(_els["side-a"], { strokeDashoffset: 0, duration: dur, ease:"power2.out" }, t);
        break;
      case "drawSide_b":
        tl.to(_els["side-b"], { strokeDashoffset: 0, duration: dur, ease:"power2.out" }, t);
        break;
      case "showVertices":
        ["pt-A","pt-B","pt-C","vtx-A","vtx-B","vtx-C"].forEach(function(id) {
          tl.to(_els[id], { opacity:1, duration:0.4 }, t);
        });
        break;
      case "showSideLabels":
        ["lbl-a","lbl-b","lbl-c"].forEach(function(id) {
          tl.to(_els[id], { opacity:1, duration:0.5 }, t);
        });
        break;
      case "showAngle_A":
        tl.to(_els["angle-A"],       { opacity:1, duration:0.5 }, t);
        tl.to(_els["angle-A-label"], { opacity:1, duration:0.5 }, t);
        break;
      case "showAltitude":
        tl.to(_els["altitude"],   { opacity:1, duration:0.6 }, t);
        tl.to(_els["alt-label"],  { opacity:1, duration:0.4 }, t);
        break;
      case "showFormula":
        tl.to(_els["formula-bg"],   { opacity:1, duration:0.5, ease:"power1.in" }, t);
        tl.to(_els["formula-text"], { opacity:1, duration:0.7, ease:"power2.in" }, t + 0.1);
        break;
      case "dimOthers":
        var keep = p.keep || [];
        Object.keys(_els).forEach(function(id) {
          if (keep.indexOf(id) === -1) tl.to(_els[id], { opacity:0.15, duration:0.4 }, t);
        });
        break;
      case "undim":
        Object.keys(_els).forEach(function(id) {
          tl.to(_els[id], { opacity:1, duration:0.4 }, t);
        });
        break;
      case "pulse":
        if (_els[p.id]) {
          tl.to(_els[p.id], { scale:1.12, transformOrigin:"50% 50%", duration:0.2, ease:"power1.out" }, t);
          tl.to(_els[p.id], { scale:1.0,  duration:0.3, ease:"power2.in" }, ">");
        }
        break;
    }
  }

  return { init:init, getElements:getElements, executeAction:executeAction, timelineAction:timelineAction };
})();


// ── Lesson ────────────────────────────────────────────────────────────────────
MX.lesson("The Law of Cosines", function(L) {

  L.source("AMC/AIME Geometry Toolkit — Example Lesson");
  L.meta({ grade: "10-12", tags: ["trigonometry", "law-of-cosines", "geometry"] });

  L.problem("In triangle $ABC$, sides $a$, $b$, $c$ are opposite to angles $A$, $B$, $C$ respectively. Derive and apply the **Law of Cosines**: $c^2 = a^2 + b^2 - 2ab\\cos A$.");

  L.viz({ plugin: window.EXPLAINER_VIZ, config: { viewBox: "0 0 500 420" } });

  // ══════════════════════════════════════════════════════════════════════════
  // PART 1: SETUP
  // ══════════════════════════════════════════════════════════════════════════

  L.act("Introducing the Triangle", function(A) {

    // Title card for section opening
    A.say("Welcome to the Law of Cosines.")
     .title("Law of Cosines", "Generalising Pythagoras to any triangle")
     .vizPanel("hidden");

    // Draw the triangle sides
    A.say("Consider triangle $ABC$ with sides $a$, $b$, $c$ opposite to vertices $A$, $B$, $C$.")
     .do("drawSide_c", {}, 0)
     .do("drawSide_a", { duration: 0.7 }, 0.5)
     .do("drawSide_b", { duration: 0.7 }, 0.8)
     .do("showVertices", {}, 1.2);

    A.say("Label the sides: $a$ is opposite $A$, $b$ is opposite $B$, and $c$ is opposite $C$.")
     .do("showSideLabels", {}, 0)
     .do("showAngle_A", {}, 0.4);

    A.say("The angle at $A$ — written $\\angle A$ — is the angle between sides $b$ and $c$. This is the key angle in the Law of Cosines.")
     .do("dimOthers", { keep: ["side-b","side-c","angle-A","angle-A-label","lbl-b","lbl-c","vtx-A","pt-A"] }, 0);

    A.say("For a right triangle, $\\cos A = 0$ when $A = 90°$, and the law reduces to Pythagoras.")
     .do("undim", {}, 0)
     .show("**Pythagoras** is a special case: $c^2 = a^2 + b^2 - 2ab \\cdot 0 = a^2 + b^2$.");
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PART 2: DERIVATION
  // ══════════════════════════════════════════════════════════════════════════

  L.marker("Derivation");

  L.act("Deriving the Law of Cosines", function(A) {

    A.say("We derive the law by dropping an altitude from $C$ to side $c$.")
     .do("showAltitude", {}, 0);

    A.say("The altitude $h$ splits the base $c$ into two segments. Using Pythagoras on each sub-triangle gives us two equations.")
     .card("derivation", {
       title: "Derivation via Altitude",
       steps: [
         { expr: "h^2 + d^2 = b^2",                              note: "Left sub-triangle (Pythagoras)" },
         { expr: "h^2 + (c-d)^2 = a^2",                         note: "Right sub-triangle (Pythagoras)" },
         { expr: "h^2 + c^2 - 2cd + d^2 = a^2",                 note: "Expand $(c-d)^2$" },
         { expr: "b^2 - 2cd + c^2 = a^2",                       note: "Substitute $h^2 + d^2 = b^2$" },
         { expr: "d = b\\cos A",                                  note: "From left triangle: $\\cos A = d/b$" },
         { expr: "b^2 - 2c(b\\cos A) + c^2 = a^2",              note: "Substitute $d = b\\cos A$" },
         { expr: "c^2 = a^2 + b^2 - 2bc\\cos A",                 note: "Rearrange — this is the Law of Cosines" }
       ]
     });

    A.say("The key insight is the cross term $-2ab\\cos A$. It accounts for how much the angle $A$ 'opens up' the triangle.")
     .do("showFormula", {}, 0)
     .do("pulse", { id: "formula-text" }, 0.6);

    // Show the formula with a split card comparing it to Pythagoras
    A.say("Compare the general law to the Pythagorean theorem:")
     .card("split", {
       title: "General vs. Right Triangle",
       left:  { type: "latex", content: "c^2 = a^2 + b^2 - 2ab\\cos A" },
       right: { type: "latex", content: "c^2 = a^2 + b^2 \\quad (A = 90°)" }
     });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GATE 1: Proof-builder — arrange the derivation steps
  // ══════════════════════════════════════════════════════════════════════════

  L.askProof({
    label: "Arrange the derivation",
    instruction: "Put the key steps in order to derive the Law of Cosines.",
    availablePieces: [
      "Drop altitude $h$ from $C$ to side $c$, splitting base into $d$ and $c-d$.",
      "Apply Pythagoras: $h^2 + d^2 = b^2$ and $h^2 + (c-d)^2 = a^2$.",
      "Expand and subtract: $b^2 - 2cd + c^2 = a^2$.",
      "Note that $\\cos A = d/b$, so $d = b\\cos A$.",
      "Substitute to get $c^2 = a^2 + b^2 - 2ab\\cos A$. $\\square$"
    ],
    correctOrder: [0, 1, 2, 3, 4]
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PART 3: APPLICATION
  // ══════════════════════════════════════════════════════════════════════════

  L.marker("Application");

  L.act("Applying the Law: Finding a Side", function(A) {

    A.say("Given $a = 7$, $b = 5$, and $\\angle C = 60°$, find side $c$.")
     .card("derivation", {
       title: "Finding $c$ when two sides and included angle are known",
       steps: [
         { expr: "c^2 = a^2 + b^2 - 2ab\\cos C",            note: "Law of Cosines with angle $C$" },
         { expr: "c^2 = 49 + 25 - 2(7)(5)\\cos 60°",        note: "Substitute $a=7$, $b=5$, $C=60°$" },
         { expr: "c^2 = 74 - 70 \\cdot \\tfrac{1}{2}",      note: "$\\cos 60° = 1/2$" },
         { expr: "c^2 = 74 - 35 = 39",                      note: "Arithmetic" },
         { expr: "c = \\sqrt{39} \\approx 6.24",             note: "Take positive root" }
       ]
     });

    A.say("When the included angle is $60°$, $\\cos 60° = 1/2$ makes the arithmetic clean.")
     .show("**Pattern**: $c^2 = a^2 + b^2 - ab$ whenever the included angle is $60°$.");
  });

  // ── Gate 2: Quiz ────────────────────────────────────────────────────────
  L.ask({
    question: "In triangle $ABC$, $a = 8$, $b = 6$, $\\angle C = 90°$. Find $c$.",
    options: ["$c = 10$", "$c = 14$", "$c = \\sqrt{28}$", "$c = 7$"],
    correct: 0,
    explain: {
      "0": "Correct! $c^2 = 64 + 36 - 2(8)(6)\\cos 90° = 100 - 0 = 100$, so $c = 10$.",
      "1": "Not quite. The law gives $c^2 = a^2 + b^2 - 2ab\\cos C$. When $C=90°$, $\\cos C = 0$.",
      "2": "$\\sqrt{28}$ would come from $6^2 - 8 = 28$, which is not the correct formula.",
      "3": "Check your arithmetic: $8^2 + 6^2 = 64 + 36 = 100$, so $c = 10$, not $7$."
    },
    wrongPath: function(B) {
      B.act("Review: $\\cos 90° = 0$", function(A) {
        A.vizPanel("hidden");

        A.say("When the included angle is $90°$, $\\cos 90° = 0$, so the middle term vanishes.")
         .card("split", {
           title: "Why the Right-Angle Case is Special",
           left:  { type: "latex", content: "c^2 = a^2 + b^2 - 2ab\\underbrace{\\cos 90°}_{=\\,0}" },
           right: { type: "latex", content: "c^2 = a^2 + b^2" }
         });

        A.say("This is exactly the Pythagorean theorem — confirming that Pythagoras is just a special case of the Law of Cosines.");
      });
    }
  });

  // ── Act: Finding an angle ─────────────────────────────────────────────
  L.act("Applying the Law: Finding an Angle", function(A) {

    A.say("The law can also be rearranged to find an angle when all three sides are known.")
     .card("derivation", {
       title: "Finding $\\angle A$ from three sides",
       steps: [
         { expr: "a^2 = b^2 + c^2 - 2bc\\cos A",             note: "Law of Cosines" },
         { expr: "2bc\\cos A = b^2 + c^2 - a^2",              note: "Isolate $\\cos A$ term" },
         { expr: "\\cos A = \\frac{b^2 + c^2 - a^2}{2bc}",   note: "Divide both sides by $2bc$" },
         { expr: "A = \\arccos\\!\\left(\\frac{b^2+c^2-a^2}{2bc}\\right)", note: "Apply inverse cosine" }
       ]
     });

    A.say("For the 3-4-5 triangle: $a=5$, $b=3$, $c=4$. Verify that angle $A$ is $90°$.")
     .show("$\\cos A = \\dfrac{9 + 16 - 25}{2 \\cdot 3 \\cdot 4} = \\dfrac{0}{24} = 0$, so $A = 90°$. ✓");
  });

  // ── Fill-in gate ────────────────────────────────────────────────────────
  L.askFillIn({
    label: "Apply the rearranged formula",
    prompt: "In a triangle with $a=5$, $b=4$, $c=6$, compute $\\cos A = $ [___] (give an exact fraction).",
    blank: {
      answer: ["27/48", "9/16", "0.5625"],
      width: 100,
      placeholder: "fraction"
    },
    hint: "Use $\\cos A = (b^2 + c^2 - a^2)/(2bc) = (16 + 36 - 25)/(2 \\cdot 4 \\cdot 6)$.",
    successMessage: "$\\cos A = 27/48 = 9/16 = 0.5625$",
    wrongPath: function(B) {
      B.act("Walk-through: Computing $\\cos A$", function(A) {
        A.vizPanel("hidden");

        A.say("Plug in $a=5$, $b=4$, $c=6$ step by step.")
         .card("derivation", {
           title: "$\\cos A$ for $a=5, b=4, c=6$",
           steps: [
             { expr: "\\cos A = \\frac{b^2 + c^2 - a^2}{2bc}",    note: "Formula" },
             { expr: "= \\frac{16 + 36 - 25}{2 \\cdot 4 \\cdot 6}", note: "Substitute" },
             { expr: "= \\frac{27}{48}",                           note: "Numerator: $16+36-25=27$; denominator: $48$" },
             { expr: "= \\frac{9}{16}",                            note: "Simplify" }
           ]
         });
      });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PART 4: VISUALISATION & EXPLORATION
  // ══════════════════════════════════════════════════════════════════════════

  L.marker("Exploration");

  L.act("Interactive Exploration", function(A) {
    A.vizPanel("hidden");

    A.say("Explore how changing angle $A$ affects side $c$ when $a = b = 5$.")
     .card("graph", {
       title: "$c$ as a function of $\\angle A$ (with $a=b=5$)",
       xRange: [0, 3.15],
       yRange: [0, 10.5],
       width: 380,
       height: 220,
       functions: [
         {
           fn: "Math.sqrt(25 + 25 - 50 * Math.cos(x))",
           color: "#818cf8",
           name: "c(A) = √(50 - 50·cos A)"
         },
         {
           fn: "5",
           color: "rgba(245,158,11,0.4)",
           name: "c = 5 (isosceles)"
         }
       ],
       points: [
         { x: 1.047, y: 5, label: "A=60°: c=5", draggable: false, color: "#34d399" },
         { x: 1.571, y: 7.07, label: "A=90°: c≈7.07", draggable: false, color: "#f59e0b" },
         { x: 3.14159, y: 10, label: "A=180°: c=10", draggable: false, color: "#f87171" }
       ],
       interactive: true,
       note: "At $A=60°$, the triangle is equilateral. At $A=90°$, $c = 5\\sqrt{2}$."
     });

    A.say("When $a = b$, the triangle is isosceles. At $\\angle A = 60°$ it becomes equilateral with $c = a = b = 5$.")
     .card("recap", {
       title: "Key Values",
       items: [
         "$A = 60°$: equilateral — $c = a = b = 5$",
         "$A = 90°$: right triangle — $c = 5\\sqrt{2} \\approx 7.07$",
         "$A \\to 0°$: degenerate — $c \\to 0$",
         "$A \\to 180°$: degenerate — $c \\to a + b = 10$"
       ]
     });
  });

  // ── p5 code-runner: students can experiment with the formula ─────────────
  L.act("Code Explorer", function(A) {
    A.vizPanel("hidden");

    A.say("Try the law of cosines yourself in code. Modify $a$, $b$, and angle $A$ to see how side $c$ changes.")
     .card("code-runner", {
       title: "Law of Cosines Calculator",
       canvasHeight: 200,
       initialCode: [
         "// Law of Cosines: c² = a² + b² - 2ab·cos(A)",
         "let a = 7, b = 5;",
         "let angleA_deg = 60; // degrees",
         "",
         "function setup() {",
         "  createCanvas(370, 190);",
         "  noLoop();",
         "  draw();",
         "}",
         "",
         "function draw() {",
         "  background(15, 14, 23);",
         "  let A = radians(angleA_deg);",
         "  let c2 = a*a + b*b - 2*a*b*cos(A);",
         "  let c = sqrt(c2);",
         "",
         "  fill(224, 231, 255);",
         "  textSize(15);",
         "  textAlign(LEFT);",
         "  text('a = ' + a,  20, 30);",
         "  text('b = ' + b,  20, 55);",
         "  text('A = ' + angleA_deg + '°',  20, 80);",
         "  fill(129, 140, 248);",
         "  textSize(20);",
         "  text('c = ' + nf(c, 1, 3),  20, 130);",
         "",
         "  // Draw triangle",
         "  let cx = 230, cy = 100, scale = 18;",
         "  stroke(52, 211, 153); strokeWeight(2); noFill();",
         "  line(cx, cy + b*scale/2, cx + c*scale, cy + b*scale/2);",
         "  stroke(245,158,11);",
         "  line(cx, cy - b*scale/2, cx, cy + b*scale/2);",
         "  stroke(129,140,248);",
         "  line(cx, cy - b*scale/2, cx + c*scale, cy + b*scale/2);",
         "}"
       ].join("\n"),
       autoRun: true,
       runLabel: "Recalculate",
       note: "Change $a$, $b$, `angleA_deg` and press Recalculate."
     });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PART 5: RECAP
  // ══════════════════════════════════════════════════════════════════════════

  L.marker("Recap");

  L.act("Summary and Applications", function(A) {
    A.vizPanel("hidden");

    A.say("The Law of Cosines is one of the most versatile tools in triangle geometry.")
     .card("recap", {
       title: "Key Takeaways",
       items: [
         "$c^2 = a^2 + b^2 - 2ab\\cos C$ — the core formula",
         "Works for **any** triangle (not just right triangles)",
         "Pythagoras is the special case $C = 90°$",
         "Can find a **side** given two sides + included angle (SAS)",
         "Can find an **angle** given all three sides (SSS)",
         "Use $\\cos A = (b^2 + c^2 - a^2) / (2bc)$ to recover an angle"
       ]
     });

    A.say("Three forms of the law — one for each angle:")
     .card("derivation", {
       title: "Three Forms",
       steps: [
         { expr: "a^2 = b^2 + c^2 - 2bc\\cos A", note: "Finding $a$ or $\\angle A$" },
         { expr: "b^2 = a^2 + c^2 - 2ac\\cos B", note: "Finding $b$ or $\\angle B$" },
         { expr: "c^2 = a^2 + b^2 - 2ab\\cos C", note: "Finding $c$ or $\\angle C$" }
       ]
     });

    A.say("Used in navigation (finding distance), surveying, and competition math (AMC/AIME triangle problems).")
     .card("bar-chart", {
       title: "When to Use Each Law",
       labels: ["SAS → side", "SSS → angle", "ASA/AAS", "SSA (ambiguous)"],
       values: [3, 3, 2, 1],
       colors: ["#818cf8","#34d399","#f59e0b","#f87171"],
       unit: "tools"
     });

    // Inline the SVG viz for the final summary beat
    A.say("Here is the complete triangle diagram for reference.")
     .inline("svg");
  });

});
