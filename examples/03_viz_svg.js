/* examples/03_viz_svg.js — Custom SVG Visualization Plugin
   Demonstrates all SVG animation patterns: draw-on (stroke-dashoffset), fade-in,
   attr tweening, highlight/dim, pulse, and GSAP timeline chaining.
   Topic: Right triangle and Pythagorean theorem.
   Build: ./build.sh --mx examples/03_viz_svg.js dist/examples/03_viz_svg.html */

// ── Viz Plugin ────────────────────────────────────────────────────────────────
window.EXPLAINER_VIZ = (function() {
  "use strict";

  var _svg = null;
  var _els = {};

  // ─── init ─────────────────────────────────────────────────────────────────
  function init(svgEl, config) {
    _svg = svgEl;

    // Set viewBox
    _svg.setAttribute("viewBox", "0 0 500 400");

    // Build the full SVG scene (all elements start hidden / transparent)
    _svg.innerHTML = [
      // Background grid (subtle)
      '<defs>',
      '  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">',
      '    <path d="M40 0L0 0 0 40" fill="none" stroke="rgba(99,102,241,0.08)" stroke-width="1"/>',
      '  </pattern>',
      '  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">',
      '    <polygon points="0 0, 8 3, 0 6" fill="#818cf8" opacity="0.7"/>',
      '  </marker>',
      '</defs>',
      '<rect width="500" height="400" fill="url(#grid)"/>',

      // ── Triangle group ──────────────────────────────────────────────────
      // Vertices: A=(80,320), B=(400,320), C=(400,80)
      // Hypotenuse ac: A→C
      // Leg a (vertical): B→C
      // Leg b (horizontal): A→B

      // Right angle mark at B
      '<polyline id="right-angle" points="400,300 420,300 420,320" fill="none"',
      '  stroke="#94a3b8" stroke-width="2" opacity="0"/>',

      // Legs
      '<line id="leg-b" x1="80" y1="320" x2="400" y2="320"',
      '  stroke="#34d399" stroke-width="3" stroke-linecap="round"',
      '  stroke-dasharray="320" stroke-dashoffset="320" opacity="1"/>',
      '<line id="leg-a" x1="400" y1="320" x2="400" y2="80"',
      '  stroke="#f59e0b" stroke-width="3" stroke-linecap="round"',
      '  stroke-dasharray="240" stroke-dashoffset="240" opacity="1"/>',

      // Hypotenuse
      '<line id="hyp" x1="80" y1="320" x2="400" y2="80"',
      '  stroke="#818cf8" stroke-width="3.5" stroke-linecap="round"',
      '  stroke-dasharray="400" stroke-dashoffset="400" opacity="1"/>',

      // Side labels
      '<text id="label-b" x="240" y="350" text-anchor="middle"',
      '  fill="#34d399" font-size="20" font-family="serif" font-style="italic" opacity="0">b</text>',
      '<text id="label-a" x="430" y="210" text-anchor="middle"',
      '  fill="#f59e0b" font-size="20" font-family="serif" font-style="italic" opacity="0">a</text>',
      '<text id="label-c" x="215" y="175" text-anchor="middle"',
      '  fill="#818cf8" font-size="20" font-family="serif" font-style="italic" opacity="0">c</text>',

      // Vertex labels
      '<circle id="pt-A" cx="80"  cy="320" r="5" fill="#e0e7ff" opacity="0"/>',
      '<circle id="pt-B" cx="400" cy="320" r="5" fill="#e0e7ff" opacity="0"/>',
      '<circle id="pt-C" cx="400" cy="80"  r="5" fill="#e0e7ff" opacity="0"/>',
      '<text id="vtx-A" x="58"  y="340" fill="#e0e7ff" font-size="16" font-family="serif" font-style="italic" opacity="0">A</text>',
      '<text id="vtx-B" x="412" y="340" fill="#e0e7ff" font-size="16" font-family="serif" font-style="italic" opacity="0">B</text>',
      '<text id="vtx-C" x="412" y="78"  fill="#e0e7ff" font-size="16" font-family="serif" font-style="italic" opacity="0">C</text>',

      // ── Squares group ─────────────────────────────────────────────────────
      // Square on leg-b (below the triangle): b=320, so square is 320x320 — too big
      // Use a scaled diagram instead: small squares on each side for illustration
      // Square on b: below A→B, 320 wide, 320 tall → clip to 320×80 strip for aesthetics
      // Instead: show coloured area fills with labels
      '<rect id="sq-b" x="80" y="320" width="320" height="60"',
      '  fill="rgba(52,211,153,0.12)" stroke="#34d399" stroke-width="1.5"',
      '  stroke-dasharray="760" stroke-dashoffset="760" opacity="0"/>',
      '<text id="sq-b-label" x="240" y="360" text-anchor="middle"',
      '  fill="#34d399" font-size="15" opacity="0">$b^2$</text>',

      '<rect id="sq-a" x="400" y="80" width="60" height="240"',
      '  fill="rgba(245,158,11,0.12)" stroke="#f59e0b" stroke-width="1.5"',
      '  stroke-dasharray="600" stroke-dashoffset="600" opacity="0"/>',
      '<text id="sq-a-label" x="430" y="205" text-anchor="middle"',
      '  fill="#f59e0b" font-size="15" opacity="0">$a^2$</text>',

      // Pythagoras formula
      '<text id="formula" x="250" y="50" text-anchor="middle"',
      '  fill="#e0e7ff" font-size="22" font-family="serif" opacity="0">',
      '  a² + b² = c²',
      '</text>',
    ].join("\n");

    // Cache element references
    var ids = [
      "right-angle", "leg-b", "leg-a", "hyp",
      "label-b", "label-a", "label-c",
      "pt-A", "pt-B", "pt-C", "vtx-A", "vtx-B", "vtx-C",
      "sq-b", "sq-a", "sq-b-label", "sq-a-label",
      "formula"
    ];
    ids.forEach(function(id) {
      _els[id] = _svg.getElementById(id);
    });
  }

  // ─── getElements ──────────────────────────────────────────────────────────
  function getElements() { return _els; }

  // ─── executeAction — for one-shot immediate actions ───────────────────────
  function executeAction(method, params) {
    switch (method) {
      case "reset":
        // Reset all elements to initial hidden state
        var drawLines = ["leg-b", "leg-a", "hyp", "sq-b", "sq-a"];
        drawLines.forEach(function(id) {
          var el = _els[id];
          if (!el) return;
          var da = el.getAttribute("stroke-dasharray");
          if (da) el.setAttribute("stroke-dashoffset", da);
        });
        var fadeEls = [
          "right-angle", "label-b", "label-a", "label-c",
          "pt-A", "pt-B", "pt-C", "vtx-A", "vtx-B", "vtx-C",
          "sq-b-label", "sq-a-label", "formula"
        ];
        fadeEls.forEach(function(id) {
          if (_els[id]) _els[id].setAttribute("opacity", "0");
        });
        break;
    }
  }

  // ─── timelineAction — GSAP-driven animations ──────────────────────────────
  function timelineAction(tl, method, params, t) {
    var p = params || {};
    var dur = p.duration != null ? p.duration : 0.8;

    switch (method) {

      // Draw on a line using stroke-dashoffset trick
      case "drawLeg_b":
        tl.to(_els["leg-b"], { strokeDashoffset: 0, duration: dur, ease: "power2.out" }, t);
        break;

      case "drawLeg_a":
        tl.to(_els["leg-a"], { strokeDashoffset: 0, duration: dur, ease: "power2.out" }, t);
        break;

      case "drawHyp":
        tl.to(_els["hyp"], { strokeDashoffset: 0, duration: dur, ease: "power2.out" }, t);
        break;

      // Fade in vertex dots and labels
      case "showVertices":
        var vtxEls = ["pt-A", "pt-B", "pt-C", "vtx-A", "vtx-B", "vtx-C"];
        vtxEls.forEach(function(id) {
          tl.to(_els[id], { opacity: 1, duration: 0.4, ease: "power1.in" }, t);
        });
        break;

      // Show right-angle mark
      case "showRightAngle":
        tl.to(_els["right-angle"], { opacity: 1, duration: 0.4, ease: "power1.in" }, t);
        break;

      // Fade in side labels
      case "showSideLabels":
        var labelEls = ["label-b", "label-a", "label-c"];
        labelEls.forEach(function(id) {
          tl.to(_els[id], { opacity: 1, duration: 0.5, ease: "power1.in" }, t);
        });
        break;

      // Draw squares (stroke-dashoffset for the rectangle border)
      case "drawSquare_b":
        tl.to(_els["sq-b"], { strokeDashoffset: 0, opacity: 1, duration: dur, ease: "power2.out" }, t);
        tl.to(_els["sq-b-label"], { opacity: 1, duration: 0.4, ease: "power1.in" }, t);
        break;

      case "drawSquare_a":
        tl.to(_els["sq-a"], { strokeDashoffset: 0, opacity: 1, duration: dur, ease: "power2.out" }, t);
        tl.to(_els["sq-a-label"], { opacity: 1, duration: 0.4, ease: "power1.in" }, t);
        break;

      // Show the Pythagoras formula text
      case "showFormula":
        tl.to(_els["formula"], { opacity: 1, duration: 0.7, ease: "power2.in" }, t);
        break;

      // Highlight one element (brighten it) — params: { id, color }
      case "highlight":
        var hlId = p.id;
        if (_els[hlId]) {
          tl.to(_els[hlId], { opacity: 1, duration: 0.3, ease: "power1.in" }, t);
          if (p.color) {
            tl.to(_els[hlId], { attr: { fill: p.color, stroke: p.color }, duration: 0.3 }, t);
          }
        }
        break;

      // Dim other elements to focus attention — params: { keep: ["id1","id2"] }
      case "dimOthers":
        var keep = p.keep || [];
        Object.keys(_els).forEach(function(id) {
          if (keep.indexOf(id) === -1) {
            tl.to(_els[id], { opacity: 0.2, duration: 0.4 }, t);
          }
        });
        break;

      // Restore all opacities
      case "undim":
        Object.keys(_els).forEach(function(id) {
          tl.to(_els[id], { opacity: 1, duration: 0.4 }, t);
        });
        break;

      // Pulse an element for emphasis — params: { id }
      case "pulse":
        var pulseEl = _els[p.id];
        if (pulseEl) {
          tl.to(pulseEl, { scale: 1.15, transformOrigin: "50% 50%", duration: 0.2, ease: "power1.out" }, t);
          tl.to(pulseEl, { scale: 1.0, duration: 0.3, ease: "power2.in" }, ">");
        }
        break;

      // Attr tween — arbitrary SVG attribute change — params: { id, attr: {...} }
      case "attrTween":
        if (_els[p.id]) {
          tl.to(_els[p.id], { attr: p.attr, duration: dur, ease: "power2.inOut" }, t);
        }
        break;
    }
  }

  return {
    init: init,
    getElements: getElements,
    executeAction: executeAction,
    timelineAction: timelineAction
  };
})();


// ── Lesson ────────────────────────────────────────────────────────────────────
MX.lesson("SVG Viz: The Pythagorean Theorem", function(L) {

  L.source("code2html_v2 Examples");
  L.problem("Prove that in a right triangle with legs $a$, $b$ and hypotenuse $c$, we have $a^2 + b^2 = c^2$.");

  L.viz({ plugin: window.EXPLAINER_VIZ, config: { viewBox: "0 0 500 400" } });

  // ── Act 1: Draw the triangle ─────────────────────────────────────────────
  L.act("Building the Triangle", function(A) {

    A.say("We start with a right triangle. The two shorter sides are called **legs**.")
     .do("drawLeg_b", {}, 0)
     .do("showVertices", {}, 0.3);

    A.say("The horizontal leg has length $b$.")
     .do("showSideLabels", {}, 0)
     .do("highlight", { id: "label-b", color: "#34d399" }, 0);

    A.say("Now we draw the vertical leg of length $a$.")
     .do("drawLeg_a", {}, 0)
     .do("showRightAngle", {}, 0.6);

    A.say("The right angle mark at $B$ confirms this is a right triangle.")
     .do("highlight", { id: "label-a", color: "#f59e0b" }, 0);

    A.say("Finally, the **hypotenuse** $c$ connects $A$ to $C$ — it is always the longest side.")
     .do("drawHyp", {}, 0)
     .do("highlight", { id: "label-c", color: "#818cf8" }, 0.6);
  });

  // ── Act 2: The squares ───────────────────────────────────────────────────
  L.act("Squares on the Sides", function(A) {

    A.say("The Pythagorean theorem is about **areas**. Build a square on each side of the triangle.")
     .do("drawSquare_b", {}, 0);

    A.say("The green square below leg $b$ has area $b^2$.")
     .do("dimOthers", { keep: ["leg-b", "label-b", "sq-b", "sq-b-label"] }, 0);

    A.say("Now build the square on leg $a$.")
     .do("undim", {}, 0)
     .do("drawSquare_a", {}, 0.2);

    A.say("The orange square to the right has area $a^2$.")
     .do("dimOthers", { keep: ["leg-a", "label-a", "sq-a", "sq-a-label"] }, 0);

    A.say("Together, $a^2 + b^2$ equals the area of the square on the hypotenuse $c^2$.")
     .do("undim", {}, 0)
     .do("showFormula", {}, 0.4)
     .do("pulse", { id: "formula" }, 0.8);
  });

  // ── Act 3: Animate the proof identity ───────────────────────────────────
  L.act("Pythagorean Identity", function(A) {

    A.say("For a 3-4-5 triangle: $a = 3$, $b = 4$, $c = 5$.")
     .do("dimOthers", { keep: ["hyp", "label-c", "formula"] }, 0);

    A.say("Check: $3^2 + 4^2 = 9 + 16 = 25 = 5^2$. The theorem holds!")
     .do("undim", {}, 0)
     .do("attrTween", { id: "formula", attr: { fill: "#34d399" }, duration: 0.6 }, 0.2)
     .do("pulse", { id: "hyp" }, 0.4);

    A.say("The theorem holds for **any** right triangle — not just nice integer ones.")
     .do("attrTween", { id: "formula", attr: { fill: "#e0e7ff" }, duration: 0.4 }, 0);
  });

  // ── Gate ────────────────────────────────────────────────────────────────
  L.ask({
    question: "In a right triangle with legs $a = 5$ and $b = 12$, what is the hypotenuse $c$?",
    options: ["$c = 13$", "$c = 17$", "$c = 15$", "$c = 11$"],
    correct: 0,
    explain: {
      "0": "Correct! $5^2 + 12^2 = 25 + 144 = 169 = 13^2$.",
      "1": "Not quite. Compute $5^2 + 12^2 = 25 + 144 = 169$. What is $\\sqrt{169}$?",
      "2": "Not quite. $5^2 + 12^2 = 169 \\neq 225 = 15^2$.",
      "3": "Not quite. The hypotenuse must be longer than either leg."
    }
  });

  // ── Wrap up ──────────────────────────────────────────────────────────────
  L.act("Summary", function(A) {
    A.say("The SVG viz plugin demonstrated draw-on animation (stroke-dashoffset), fade-in, attribute tweening, highlight/dim, and pulse effects.")
     .card("recap", {
       title: "SVG Animation Patterns Used",
       items: [
         "**Draw-on**: `strokeDashoffset` from full length → 0 traces the line",
         "**Fade-in**: `opacity: 0 → 1` for labels and marks",
         "**Dim/focus**: set `opacity: 0.2` on non-focal elements",
         "**Attr tween**: `attr: { fill, stroke }` for colour changes",
         "**Pulse**: scale up then back to 1 for emphasis"
       ]
     });
  });

});
