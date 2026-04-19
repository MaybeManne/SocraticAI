/* examples/01_cards.js — Card Type Showcase
   Demonstrates every card type available in the lesson engine.
   Build: ./build.sh --mx examples/01_cards.js dist/examples/01_cards.html */

MX.lesson("Card Types Showcase", function(L) {

  L.source("code2html_v2 Examples");
  L.meta({ grade: "reference", tags: ["cards", "showcase"] });
  L.problem("A reference lesson demonstrating every card type available in the engine.");

  // ── 1. Title card ──────────────────────────────────────────────────────────
  L.act("Title Card", function(A) {
    A.vizPanel("hidden");

    A.say("The title card creates a full-width section header with an optional subheading.")
     .title("Card Types Showcase", "Every card type in one lesson");

    A.say("Use title cards to open major sections. The heading is large and bold; the subheading is lighter.")
     .show("The **title** card is perfect for chapter openers and act introductions.");
  });

  // ── 2. Text card (.show / .card("text")) ───────────────────────────────────
  L.act("Text Card", function(A) {
    A.vizPanel("hidden");

    A.say("The simplest card is the text card. Passing a string to .show() creates one automatically.")
     .show("This is a **text** card. It supports *Markdown*: bold, italic, lists, and code.");

    A.say("You can also use backticks for inline code like `f(x) = x²` or fenced code blocks.")
     .show("Inline code: `let x = 42`\n\nUse text cards for short definitions, reminders, and callouts.");
  });

  // ── 3. LaTeX card ──────────────────────────────────────────────────────────
  L.act("LaTeX Card", function(A) {
    A.vizPanel("hidden");

    A.say("The LaTeX card renders a full math expression using KaTeX.")
     .show("$$\\int_a^b f(x)\\,dx = F(b) - F(a)$$");

    A.say("Pass LaTeX directly to .show() — the engine detects the $$ delimiters and renders with KaTeX.")
     .show("The quadratic formula: $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$");

    A.say("For more control, use .card with type latex explicitly.")
     .card("latex", {
       content: "e^{i\\pi} + 1 = 0",
       note: "Euler's identity — often called the most beautiful equation in mathematics."
     });
  });

  // ── 4. Derivation card ─────────────────────────────────────────────────────
  L.act("Derivation Card", function(A) {
    A.vizPanel("hidden");

    A.say("The derivation card shows a step-by-step algebraic proof or simplification.")
     .card("derivation", {
       title: "Completing the Square",
       steps: [
         { expr: "ax^2 + bx + c = 0",                    note: "Start with general quadratic" },
         { expr: "ax^2 + bx = -c",                        note: "Move constant to right side" },
         { expr: "x^2 + \\frac{b}{a}x = -\\frac{c}{a}",  note: "Divide through by $a$" },
         { expr: "x^2 + \\frac{b}{a}x + \\frac{b^2}{4a^2} = \\frac{b^2 - 4ac}{4a^2}", note: "Add $(b/2a)^2$ to both sides" },
         { expr: "\\left(x + \\frac{b}{2a}\\right)^2 = \\frac{b^2 - 4ac}{4a^2}", note: "Left side is a perfect square" },
         { expr: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", note: "Take square root of both sides" }
       ]
     });

    A.say("Each step can include an optional note that explains the algebraic manipulation.")
     .show("Derivation cards are ideal for proofs where each line follows from the previous.");
  });

  // ── 5. Split card ──────────────────────────────────────────────────────────
  L.act("Split Card", function(A) {
    A.vizPanel("hidden");

    A.say("The split card displays two panels side by side — great for comparisons.")
     .card("split", {
       left:  { type: "latex",  content: "\\sin^2\\theta + \\cos^2\\theta = 1" },
       right: { type: "text",   content: "**Pythagorean Identity**: holds for all real $\\theta$." }
     });

    A.say("Both panels can hold any card content: text, LaTeX, or even a nested derivation.")
     .card("split", {
       title: "Two Forms of the Same Identity",
       left:  { type: "latex", content: "a^2 + b^2 = c^2" },
       right: { type: "latex", content: "\\sin^2\\theta + \\cos^2\\theta = 1" }
     });
  });

  // ── 6. Recap card ─────────────────────────────────────────────────────────
  L.act("Recap Card", function(A) {
    A.vizPanel("hidden");

    A.say("The recap card summarises key takeaways at the end of a section.")
     .card("recap", {
       title: "Key Takeaways",
       items: [
         "The discriminant $b^2 - 4ac$ determines the number of real roots.",
         "If discriminant $> 0$: two distinct real roots.",
         "If discriminant $= 0$: one repeated root.",
         "If discriminant $< 0$: no real roots (complex conjugate pair)."
       ]
     });

    A.say("Each item in the list is rendered as a bullet point with full LaTeX support.")
     .show("Recap cards help learners consolidate what they have just seen before moving on.");
  });

  // ── 7. Bar-chart card ─────────────────────────────────────────────────────
  L.act("Bar-Chart Card", function(A) {
    A.vizPanel("hidden");

    A.say("The bar-chart card renders a simple labelled bar chart.")
     .card("bar-chart", {
       title: "Number of Real Roots by Discriminant",
       labels: ["$\\Delta < 0$", "$\\Delta = 0$", "$\\Delta > 0$"],
       values: [0, 1, 2],
       unit: "roots",
       colors: ["#f87171", "#fbbf24", "#34d399"]
     });

    A.say("Use bar charts to visualise discrete numerical data — frequencies, counts, probabilities.")
     .show("The `unit` field appends a label to each bar's value tooltip.");
  });

  // ── 8. Plot-2d card ───────────────────────────────────────────────────────
  L.act("Plot-2D Card (Static)", function(A) {
    A.vizPanel("hidden");

    A.say("The plot-2d card renders a static SVG function plot via the lightweight built-in plotter.")
     .card("plot-2d", {
       title: "Quadratic: $f(x) = x^2 - 2x - 3$",
       xRange: [-2, 4],
       yRange: [-5, 5],
       functions: [
         { fn: "x*x - 2*x - 3", color: "#818cf8", name: "f(x)" },
         { fn: "0",              color: "#475569", name: "y=0",   style: "dashed" }
       ],
       points: [
         { x: -1, y: 0, label: "(-1,0)", color: "#34d399" },
         { x:  3, y: 0, label: "(3,0)",  color: "#34d399" },
         { x:  1, y: -4, label: "vertex (1,-4)", color: "#f59e0b" }
       ],
       note: "Roots at $x = -1$ and $x = 3$; vertex at $(1, -4)$."
     });

    A.say("For interactive graphs with pan, zoom, and draggable points, use the graph card instead.")
     .show("The plot-2d card is static and self-contained — no external library required.");
  });

  // ── 9. Graph card (JSXGraph — Stage 1) ────────────────────────────────────
  L.act("Graph Card (Interactive, JSXGraph)", function(A) {
    A.vizPanel("hidden");

    A.say("The graph card loads JSXGraph for a fully interactive function plotter with drag support.")
     .card("graph", {
       title: "Drag $P$ to explore the parabola",
       xRange: [-4, 4],
       yRange: [-2, 8],
       width: 380,
       height: 240,
       functions: [
         { fn: "x*x", color: "#818cf8", name: "f(x) = x²" },
         { fn: "2*x + 1", color: "#f59e0b", name: "g(x) = 2x+1" }
       ],
       points: [
         { x: 1, y: 1, label: "P", draggable: true, color: "#34d399" }
       ],
       interactive: true,
       note: "Pan and zoom are enabled. Drag $P$ along $f(x) = x^2$."
     });

    A.say("JSXGraph is loaded lazily on the first graph card — there is no overhead for lessons that don't use it.")
     .card("graph", {
       title: "Unit Circle",
       xRange: [-1.5, 1.5],
       yRange: [-1.5, 1.5],
       width: 280,
       height: 280,
       geometryObjects: [
         { type: "circle", center: [0, 0], radius: 1, color: "#818cf8", strokeWidth: 2 }
       ],
       points: [
         { x: 1,    y: 0,    label: "(1,0)",  draggable: false, color: "#94a3b8" },
         { x: -1,   y: 0,    label: "(-1,0)", draggable: false, color: "#94a3b8" },
         { x: 0,    y: 1,    label: "(0,1)",  draggable: false, color: "#94a3b8" },
         { x: 0.71, y: 0.71, label: "P=(cos θ, sin θ)", draggable: true, color: "#f59e0b" }
       ],
       interactive: true
     });
  });

  // ── 10. Code-runner card (p5.js — Stage 1) ────────────────────────────────
  L.act("Code-Runner Card (p5.js Sandbox)", function(A) {
    A.vizPanel("hidden");

    A.say("The code-runner card embeds a live p5.js editor. Click Run to execute the sketch.")
     .card("code-runner", {
       title: "Follow the Mouse",
       canvasHeight: 200,
       initialCode: [
         "function setup() {",
         "  createCanvas(370, 190);",
         "  background(15, 14, 23);",
         "}",
         "function draw() {",
         "  background(15, 14, 23, 30);",
         "  fill(129, 140, 248);",
         "  noStroke();",
         "  ellipse(mouseX, mouseY, 24, 24);",
         "  fill(251, 191, 36, 180);",
         "  ellipse(mouseX, mouseY - 12, 8, 8);",
         "}"
       ].join("\n"),
       autoRun: true,
       note: "Move the mouse over the canvas. Edit the code and press Run."
     });

    A.say("Code runs in a sandboxed iframe — it cannot access the lesson DOM. p5.js global mode works out of the box.")
     .card("code-runner", {
       title: "Lissajous Curve",
       canvasHeight: 220,
       initialCode: [
         "let t = 0;",
         "function setup() {",
         "  createCanvas(370, 210);",
         "  background(15, 14, 23);",
         "  stroke(129, 140, 248);",
         "  strokeWeight(1.5);",
         "  noFill();",
         "}",
         "function draw() {",
         "  background(15, 14, 23, 8);",
         "  let x = 185 + 160 * sin(3 * t + PI/4);",
         "  let y = 105 + 90  * sin(2 * t);",
         "  point(x, y);",
         "  t += 0.02;",
         "  if (t > TWO_PI * 3) { t = 0; background(15,14,23); }",
         "}"
       ].join("\n"),
       autoRun: true,
       runLabel: "Restart",
       note: "A Lissajous curve: $x = A\\sin(3t + \\pi/4),\\; y = B\\sin(2t)$"
     });
  });

  // ── 11. Figure card ───────────────────────────────────────────────────────
  L.act("Figure Card", function(A) {
    // Note: vizPanel defaults to "svg" — figure card works alongside SVG viz panel
    A.say("The figure card can display an SVG or image inline in the notebook.")
     .card("figure", {
       src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='150' viewBox='0 0 300 150'%3E%3Crect width='300' height='150' fill='%230f0e17'/%3E%3Ccircle cx='150' cy='75' r='60' fill='none' stroke='%23818cf8' stroke-width='2'/%3E%3Cline x1='150' y1='75' x2='210' y2='75' stroke='%23f59e0b' stroke-width='2'/%3E%3Ccircle cx='150' cy='75' r='4' fill='%23f59e0b'/%3E%3Ctext x='175' y='70' fill='%23e0e7ff' font-size='14' font-family='serif'%3Er%3C/text%3E%3C/svg%3E",
       alt: "Circle with radius r",
       caption: "A circle with centre $O$ and radius $r$."
     });

    A.say("The figure card accepts any URL or data URI. Use it for diagrams, photos, or external images.")
     .show("Figure cards are useful when the SVG viz panel is used for animation but you also need a static reference image in the notebook.");
  });

  // ── Inline viz ────────────────────────────────────────────────────────────
  L.act("Inline Viz (SVG Pulled Into Notebook)", function(A) {
    A.say("Any beat can pull the viz panel inline into the notebook by calling .inline().")
     .inline("svg");

    A.say("The .inline() method collapses the side panel and embeds a snapshot of the viz directly in the beat card. It is great for mobile or when the diagram is the focus.")
     .show("Use `.inline('svg')` or `.inline('figure')` depending on your viz type.");
  });

});
