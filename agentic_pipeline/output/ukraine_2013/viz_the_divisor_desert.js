window.EXPLAINER_VIZ = (function () {
  'use strict';

  // ── Palette ──────────────────────────────────────────────────────────
  var DARK    = "#0f0e17";
  var PRIMARY = "#6366f1";
  var LIGHT   = "#818cf8";
  var ACCENT  = "#f59e0b";
  var CORAL   = "#f87171";
  var TEXT    = "#e0e7ff";
  var DIM     = "rgba(255,255,255,0.45)";

  // ── Layout constants (SVG is 1000 × 600) ─────────────────────────────
  var W = 1000, H = 600;
  var NL_Y    = 490;   // number line y-position
  var NL_CX   = 500;   // x of m² = 100
  var PX_UNIT = 9;     // pixels per unit on number line

  function xAt(v) { return NL_CX + (v - 100) * PX_UNIT; }

  // ── Step counters (stateful multi-call actions) ─────────────────────
  var morphStep = 0, arcStep = 0, gauntStep = 0, zoomStep = 0;

  // ── Element refs ─────────────────────────────────────────────────────
  var svg, config;

  // number line
  var nlGroup, nlCenterDot, nlCenterLabel;
  var nlBracket, nlBrackLabelL, nlBrackLabelR;
  var nlFactor73Dot, nlFactor73Lbl, nlFactor137Dot, nlFactor137Lbl;
  var nlOutsideLbl73, nlOutsideLbl137;
  var nlLeftDimmer, nlEmptyLbl;
  var arcPath, arcDotL, arcDotR, arcFracLbl;

  // equation workspace
  var eqGroup, eqSteps;   // eqSteps[i] = <g> element with full stage

  // dial (The Squeeze)
  var dialGroup, dialNeedle, dialRLabel;

  // gauntlet
  var gaunGroup, gaunCase1, gaunCase2, gaunCase3, gaunFinal;

  // ── SVG helper ───────────────────────────────────────────────────────
  function el(tag, attrs, parent) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(content, attrs, parent) {
    var e = el("text", attrs, parent);
    e.textContent = content;
    return e;
  }

  // ── init ─────────────────────────────────────────────────────────────
  function init(svgElement, vizConfig) {
    svg = svgElement; config = vizConfig;

    // ── defs: gradient + grid pattern + arrowhead ─────────────────────
    var defs = el("defs", {}, svg);

    var rg = el("radialGradient", {id:"ddGlow", cx:"50%", cy:"50%", r:"55%"}, defs);
    el("stop", {offset:"0%",   "stop-color":"#312e81", "stop-opacity":"0.3"}, rg);
    el("stop", {offset:"100%", "stop-color":"#312e81", "stop-opacity":"0"},   rg);

    var pat = el("pattern", {id:"ddGrid", width:"50", height:"50", patternUnits:"userSpaceOnUse"}, defs);
    el("path", {d:"M50 0L0 0 0 50", fill:"none", stroke:"rgba(255,255,255,0.02)", "stroke-width":"1"}, pat);

    var mk = el("marker", {id:"ddArrow", markerWidth:"8", markerHeight:"8",
                           refX:"6", refY:"3", orient:"auto"}, defs);
    el("path", {d:"M0,0 L0,6 L8,3 z", fill:ACCENT}, mk);

    // ── background layers ─────────────────────────────────────────────
    el("rect", {width:W, height:H, fill:DARK}, svg);
    el("rect", {width:W, height:H, fill:"url(#ddGrid)"}, svg);
    el("ellipse", {cx:W/2, cy:H/2, rx:520, ry:360, fill:"url(#ddGlow)"}, svg);

    // ═════════════════════════════════════════════════════════════════
    // NUMBER LINE  (always present; fades in/out per act)
    // ═════════════════════════════════════════════════════════════════
    nlGroup = el("g", {opacity:"0"}, svg);

    // axis
    el("line", {x1:60, y1:NL_Y, x2:950, y2:NL_Y,
                stroke:LIGHT, "stroke-width":"2.5"}, nlGroup);
    el("path", {d:"M950,"+(NL_Y)+" l-8,-5 l0,10 z", fill:LIGHT}, nlGroup);

    // tick marks  60..145 every 10, plus 73 and 137
    var ticks = [60,70,73,80,90,100,110,120,130,137,140];
    for (var i = 0; i < ticks.length; i++) {
      var v = ticks[i];
      var tx = xAt(v);
      var major = (v % 20 === 0);
      el("line", {x1:tx, y1:NL_Y-(major?10:5), x2:tx, y2:NL_Y+(major?10:5),
                  stroke: major ? TEXT : "rgba(255,255,255,0.35)",
                  "stroke-width": major ? "2" : "1"}, nlGroup);
      if (major) {
        txt(""+v, {x:tx, y:NL_Y+26, fill:DIM,
                   "font-size":"13", "text-anchor":"middle",
                   "font-family":"system-ui"}, nlGroup);
      }
    }

    // m² center marker
    nlCenterDot  = el("circle", {cx:NL_CX, cy:NL_Y, r:5, fill:ACCENT, opacity:"0"}, nlGroup);
    nlCenterLabel = txt("m\u00B2 = 100", {x:NL_CX, y:NL_Y-22, fill:ACCENT,
                                     "font-size":"15", "text-anchor":"middle",
                                     "font-family":"system-ui", opacity:"0"}, nlGroup);

    // bracket shading  [80, 120]
    var bL = xAt(80), bR = xAt(120);
    nlBracket = el("rect", {x:bL, y:NL_Y-16, width:bR-bL, height:32,
                             fill:"rgba(99,102,241,0.22)", stroke:PRIMARY,
                             "stroke-width":"2", rx:"3", opacity:"0"}, nlGroup);
    nlBrackLabelL = txt("80", {x:bL, y:NL_Y-25, fill:LIGHT,
                               "font-size":"14", "text-anchor":"middle",
                               "font-family":"system-ui", opacity:"0"}, nlGroup);
    nlBrackLabelR = txt("120", {x:bR, y:NL_Y-25, fill:LIGHT,
                                "font-size":"14", "text-anchor":"middle",
                                "font-family":"system-ui", opacity:"0"}, nlGroup);

    // left dimmer (for snap_and_dim)
    nlLeftDimmer = el("rect", {x:60, y:NL_Y-30, width:NL_CX-60, height:60,
                                fill:"rgba(15,14,23,0.8)", opacity:"0"}, nlGroup);

    // factor 73  (starts 60px above to drop in)
    var f73x = xAt(73);
    nlFactor73Dot = el("circle", {cx:f73x, cy:NL_Y-60, r:8, fill:CORAL, opacity:"0"}, nlGroup);
    nlFactor73Lbl = txt("73", {x:f73x, y:NL_Y-80, fill:CORAL,
                               "font-size":"18", "font-weight":"bold",
                               "text-anchor":"middle", "font-family":"system-ui",
                               opacity:"0"}, nlGroup);

    // factor 137
    var f137x = xAt(137);
    nlFactor137Dot = el("circle", {cx:f137x, cy:NL_Y-60, r:8, fill:CORAL, opacity:"0"}, nlGroup);
    nlFactor137Lbl = txt("137", {x:f137x, y:NL_Y-80, fill:CORAL,
                                 "font-size":"18", "font-weight":"bold",
                                 "text-anchor":"middle", "font-family":"system-ui",
                                 opacity:"0"}, nlGroup);

    // "outside bracket" callout labels
    nlOutsideLbl73  = txt("\u2190 outside", {x:f73x-18, y:NL_Y+20, fill:"rgba(248,113,113,0.7)",
                                         "font-size":"12", "text-anchor":"end",
                                         "font-family":"system-ui", opacity:"0"}, nlGroup);
    nlOutsideLbl137 = txt("outside \u2192", {x:f137x+18, y:NL_Y+20, fill:"rgba(248,113,113,0.7)",
                                         "font-size":"12", "text-anchor":"start",
                                         "font-family":"system-ui", opacity:"0"}, nlGroup);

    // co-divisor arc  (left dot → right dot)
    arcDotL = el("circle", {cx:xAt(80), cy:NL_Y, r:7, fill:ACCENT, opacity:"0"}, nlGroup);
    arcDotR = el("circle", {cx:xAt(121), cy:NL_Y, r:7, fill:ACCENT, opacity:"0"}, nlGroup);
    var arcStr = "M"+xAt(80)+","+NL_Y+" Q"+NL_CX+","+(NL_Y-110)+" "+xAt(121)+","+NL_Y;
    arcPath = el("path", {d:arcStr, fill:"none", stroke:ACCENT, "stroke-width":"2.5",
                          "stroke-dasharray":"300", "stroke-dashoffset":"300",
                          "marker-end":"url(#ddArrow)", opacity:"0"}, nlGroup);
    arcFracLbl = txt("+0.49...", {x:xAt(121)+8, y:NL_Y-36, fill:ACCENT,
                                   "font-size":"14", "font-style":"italic",
                                   "font-family":"system-ui", opacity:"0"}, nlGroup);

    // "0 divisors" final label
    nlEmptyLbl = txt("0 divisors in [m\u00B2\u22122m, m\u00B2+2m]", {
      x:NL_CX, y:NL_Y-55, fill:ACCENT,
      "font-size":"20", "font-weight":"bold", "text-anchor":"middle",
      "font-family":"system-ui", opacity:"0"
    }, nlGroup);

    // ═════════════════════════════════════════════════════════════════
    // EQUATION WORKSPACE  (Acts 2 and 4)
    // ═════════════════════════════════════════════════════════════════
    eqGroup = el("g", {opacity:"0"}, svg);
    var EQ_CX = 500, EQ_TOP = 155;

    // Each stage: a <g> with a main line and a sub-line
    var stages = [
      // Act 2 — degree collapse
      { main:"d = m\u00B2 + a  divides  m\u2074 + 1",       sub:"Define our potential divisor d." },
      { main:"m\u00B2 \u2261 \u2212a  (mod d)",              sub:"In \u2124/d\u2124, m\u00B2 and \u2212a are the same." },
      { main:"m\u2074 \u2261 a\u00B2  (mod d)",              sub:"Square both sides: m\u2074 = (m\u00B2)\u00B2 \u2261 (\u2212a)\u00B2." },
      // result banner
      { main:"d | m\u2074+1  \u27F9  d | a\u00B2+1",        sub:"The massive m\u2074 collapsed to the tiny a\u00B2+1 !" },
      // Act 4 — bounding r
      { main:"r = (a\u00B2+1) / (m\u00B2+a)   where r \u2208 \u2124\u207A", sub:"r is the integer multiple." },
      { main:"max a = 2m  \u27F9  a\u00B2 + 1 \u2264 4m\u00B2 + 1",   sub:"Plug in the worst case: a = 2m." },
    ];

    eqSteps = [];
    for (var s = 0; s < stages.length; s++) {
      var sg = el("g", {opacity:"0"}, eqGroup);
      var isResult = (s === 3);
      txt(stages[s].main, {
        x: EQ_CX, y: EQ_TOP,
        fill: isResult ? ACCENT : TEXT,
        "font-size": isResult ? "26" : "24",
        "font-weight": isResult ? "bold" : "500",
        "text-anchor":"middle", "font-family":"system-ui, monospace"
      }, sg);
      txt(stages[s].sub, {
        x: EQ_CX, y: EQ_TOP + 44,
        fill: DIM, "font-size":"16", "text-anchor":"middle",
        "font-family":"system-ui"
      }, sg);
      eqSteps.push(sg);
    }

    // ═════════════════════════════════════════════════════════════════
    // DIAL  (Act 4: The Squeeze)
    // ═════════════════════════════════════════════════════════════════
    dialGroup = el("g", {opacity:"0", transform:"translate(500,230)"}, svg);

    // Background disc
    el("circle", {cx:0, cy:0, r:145,
                  fill:"rgba(15,14,23,0.75)", stroke:PRIMARY, "stroke-width":"2"}, dialGroup);

    // Semicircle arc track  (bottom half hidden, top is the gauge)
    el("path", {d:"M -130,0 A 130,130 0 0,1 130,0",
                fill:"none", stroke:"rgba(99,102,241,0.35)", "stroke-width":"18",
                "stroke-linecap":"round"}, dialGroup);

    // Coloured sector — ceiling region near r=4 (red)
    el("path", {d:"M 92,92 A 130,130 0 0,1 130,0",
                fill:"none", stroke:CORAL, "stroke-width":"18",
                "stroke-linecap":"round", opacity:"0.6"}, dialGroup);

    // Tick marks at r=0..4  (angle = -180 + r*45, in degrees)
    var rAngles = [-180, -135, -90, -45, 0];   // r = 0,1,2,3,4  mapped to -180°..0°
    for (var ri = 0; ri <= 4; ri++) {
      var ra = rAngles[ri] * Math.PI / 180;
      var rx0 = Math.cos(ra)*108, ry0 = Math.sin(ra)*108;
      var rx1 = Math.cos(ra)*130, ry1 = Math.sin(ra)*130;
      el("line", {x1:rx0, y1:ry0, x2:rx1, y2:ry1,
                  stroke: ri===4 ? CORAL : LIGHT, "stroke-width":"3"}, dialGroup);
      txt(""+ri, {
        x: Math.cos(ra)*148, y: Math.sin(ra)*148 + 5,
        fill: ri===4 ? CORAL : TEXT,
        "font-size":"20", "text-anchor":"middle",
        "font-family":"system-ui", "font-weight": ri===4 ? "bold" : "normal"
      }, dialGroup);
    }

    // Needle (starts at r=0, leftmost = -180°)
    dialNeedle = el("line", {
      x1:0, y1:0, x2:-115, y2:0,
      stroke:ACCENT, "stroke-width":"5",
      "stroke-linecap":"round"
    }, dialGroup);

    // r label under needle pivot
    dialRLabel = txt("r \u2208 { 1, 2, 3 }", {
      x:0, y:60, fill:ACCENT, "font-size":"22", "font-weight":"bold",
      "text-anchor":"middle", "font-family":"system-ui", opacity:"0"
    }, dialGroup);

    // "< 4" ceiling note
    txt("< 4", {x:115, y:-20, fill:CORAL, "font-size":"20",
                "text-anchor":"middle", "font-family":"system-ui"}, dialGroup);

    // ═════════════════════════════════════════════════════════════════
    // GAUNTLET  (Act 5)
    // ═════════════════════════════════════════════════════════════════
    gaunGroup = el("g", {opacity:"0", transform:"translate(500,245)"}, svg);

    // ── Case 1: r = 3  (mod-3 clock) ─────────────────────────────────
    gaunCase1 = el("g", {opacity:"0"}, gaunGroup);
    txt("r = 3 ?", {x:0, y:-170, fill:TEXT, "font-size":"26",
                    "font-weight":"bold", "text-anchor":"middle",
                    "font-family":"system-ui"}, gaunCase1);
    txt("a\u00B2 + 1 = 3(m\u00B2+a)  \u27F9  3 | a\u00B2+1", {
      x:0, y:-135, fill:LIGHT, "font-size":"17", "text-anchor":"middle",
      "font-family":"system-ui"}, gaunCase1);

    // mod-3 clock face
    el("circle", {cx:0, cy:0, r:75, fill:"rgba(99,102,241,0.12)",
                  stroke:PRIMARY, "stroke-width":"2"}, gaunCase1);
    var mod3pos = [
      [0, -65, "0"],
      [Math.cos(30*Math.PI/180)*65,   Math.sin(30*Math.PI/180)*65,   "2"],
      [Math.cos(150*Math.PI/180)*65,  Math.sin(150*Math.PI/180)*65,  "1"]
    ];
    for (var ci = 0; ci < mod3pos.length; ci++) {
      el("circle", {cx:mod3pos[ci][0], cy:mod3pos[ci][1], r:9, fill:PRIMARY}, gaunCase1);
      txt(mod3pos[ci][2], {x:mod3pos[ci][0], y:mod3pos[ci][1]+5,
                           fill:TEXT, "font-size":"14", "text-anchor":"middle",
                           "font-family":"system-ui"}, gaunCase1);
    }
    // clock hand (starts pointing up → 0)
    var clockHand = el("line", {x1:0, y1:0, x2:0, y2:-58,
                                 stroke:ACCENT, "stroke-width":"3.5",
                                 "stroke-linecap":"round"}, gaunCase1);
    gaunCase1._hand = clockHand;

    var clockResult = txt("a\u00B2 mod 3 \u2208 {0,1}  \u27F9  a\u00B2+1 \u2208 {1,2}  \u2014 never 0!", {
      x:0, y:105, fill:CORAL, "font-size":"14.5", "text-anchor":"middle",
      "font-family":"system-ui", opacity:"0"
    }, gaunCase1);
    gaunCase1._result = clockResult;

    var xStamp1 = txt("\u2717", {x:0, y:30, fill:CORAL, "font-size":"90",
                             "text-anchor":"middle", "font-family":"system-ui",
                             opacity:"0"}, gaunCase1);
    gaunCase1._xstamp = xStamp1;

    // ── Case 2: r = 2  (irrational) ──────────────────────────────────
    gaunCase2 = el("g", {opacity:"0"}, gaunGroup);
    txt("r = 2 ?", {x:0, y:-170, fill:TEXT, "font-size":"26",
                    "font-weight":"bold", "text-anchor":"middle",
                    "font-family":"system-ui"}, gaunCase2);

    var eq2lines = [
      {t:"a\u00B2+1 = 2(m\u00B2+a)",       y:-130},
      {t:"(a\u22121)\u00B2 = 2m\u00B2",     y:-85},
      {t:"a\u22121 = m\u221A2",             y:-40},
      {t:"\u221A2 = (a\u22121)/m   \u2192  IRRATIONAL!", y:15, col:CORAL},
    ];
    gaunCase2._eqs = [];
    for (var ei = 0; ei < eq2lines.length; ei++) {
      var line = eq2lines[ei];
      var e2 = txt(line.t, {
        x:0, y:line.y, fill: line.col || LIGHT,
        "font-size": ei === 3 ? "21" : "22",
        "font-weight": ei === 3 ? "bold" : "normal",
        "text-anchor":"middle", "font-family":"system-ui, monospace",
        opacity: ei === 0 ? "1" : "0"
      }, gaunCase2);
      gaunCase2._eqs.push(e2);
    }
    var xStamp2 = txt("\u2717", {x:0, y:115, fill:CORAL, "font-size":"90",
                              "text-anchor":"middle", "font-family":"system-ui",
                              opacity:"0"}, gaunCase2);
    gaunCase2._xstamp = xStamp2;

    // ── Case 3: r = 1  (gap between squares) ─────────────────────────
    gaunCase3 = el("g", {opacity:"0"}, gaunGroup);
    txt("r = 1 ?", {x:0, y:-170, fill:TEXT, "font-size":"26",
                    "font-weight":"bold", "text-anchor":"middle",
                    "font-family":"system-ui"}, gaunCase3);
    txt("m\u00B2 = a\u00B2\u2212a+1  =  ?", {x:0, y:-130, fill:LIGHT, "font-size":"20",
                               "text-anchor":"middle", "font-family":"system-ui"}, gaunCase3);

    // Two pillars: (a−1)² on left, a² on right
    var pW = 80, pH = 130;
    el("rect", {x:-210, y:-pH/2, width:pW, height:pH,
                fill:"rgba(99,102,241,0.35)", stroke:LIGHT, "stroke-width":"2"}, gaunCase3);
    txt("(a\u22121)\u00B2", {x:-210+pW/2, y:pH/2+22, fill:LIGHT,
                   "font-size":"15", "text-anchor":"middle", "font-family":"system-ui"}, gaunCase3);

    el("rect", {x:130, y:-pH/2, width:pW, height:pH,
                fill:"rgba(99,102,241,0.35)", stroke:LIGHT, "stroke-width":"2"}, gaunCase3);
    txt("a\u00B2", {x:130+pW/2, y:pH/2+22, fill:LIGHT,
                "font-size":"15", "text-anchor":"middle", "font-family":"system-ui"}, gaunCase3);

    // Gap label
    txt("gap", {x:-40, y:15, fill:"rgba(255,255,255,0.25)",
                "font-size":"20", "text-anchor":"middle",
                "font-family":"system-ui"}, gaunCase3);

    // Falling ball (m²) — starts above, drops into gap
    var mBall  = el("circle", {cx:-40, cy:-190, r:16, fill:ACCENT, opacity:"0"}, gaunCase3);
    var mBallL = txt("m\u00B2", {x:-40, y:-215, fill:ACCENT,
                             "font-size":"17", "text-anchor":"middle",
                             "font-family":"system-ui", opacity:"0"}, gaunCase3);
    gaunCase3._ball  = mBall;
    gaunCase3._ballL = mBallL;

    var xStamp3 = txt("\u2717", {x:-40, y:115, fill:CORAL, "font-size":"90",
                              "text-anchor":"middle", "font-family":"system-ui",
                              opacity:"0"}, gaunCase3);
    gaunCase3._xstamp = xStamp3;

    // ── Final: all three failed ───────────────────────────────────────
    gaunFinal = el("g", {opacity:"0"}, gaunGroup);
    txt("All three cases fail.", {x:0, y:-30, fill:TEXT,
                                   "font-size":"24", "text-anchor":"middle",
                                   "font-family":"system-ui"}, gaunFinal);
    txt("The interval [m\u00B2\u22122m, m\u00B2+2m] contains NO divisors of m\u2074+1.", {
      x:0, y:20, fill:ACCENT, "font-size":"18", "font-weight":"bold",
      "text-anchor":"middle", "font-family":"system-ui"
    }, gaunFinal);
  }

  // ── timelineAction ────────────────────────────────────────────────────
  function timelineAction(tl, method, params, t) {
    switch (method) {

      // ── Act 1, beat 1: reveal number line ────────────────────────────
      case "zoom_number_line":
        if (zoomStep === 0) {
          tl.to(nlGroup, {opacity:1, duration:0.7, ease:"power2.out"}, t);
          tl.to(nlCenterDot,  {opacity:1, duration:0.5, ease:"back.out(2)"}, t + 0.5);
          tl.to(nlCenterLabel,{opacity:1, duration:0.4}, t + 0.7);
        } else {
          // Final beat of Act 5: zoom out to empty interval
          tl.to(gaunGroup, {opacity:0, duration:0.6}, t);
          tl.to(nlGroup,   {opacity:1, duration:0.8, ease:"power2.out"}, t + 0.4);
          tl.to(nlEmptyLbl,{opacity:1, duration:0.8, ease:"back.out(2)"}, t + 1.0);
          tl.to(nlBracket, {attr:{fill:"rgba(99,102,241,0.07)"}, duration:1.0}, t + 0.8);
        }
        zoomStep++;
        break;

      // ── Act 1, beat 2: draw the [80,120] bracket ─────────────────────
      case "draw_bracket":
        tl.to(nlBracket,     {opacity:1, duration:0.7, ease:"power2.out"}, t);
        tl.to(nlBrackLabelL, {opacity:1, duration:0.4}, t + 0.4);
        tl.to(nlBrackLabelR, {opacity:1, duration:0.4}, t + 0.6);
        break;

      // ── Act 1, beat 3: drop 73 × 137 onto the number line ───────────
      case "drop_factorization":
        // 73 drops in from above
        tl.to(nlFactor73Dot, {opacity:1, attr:{cy:NL_Y}, duration:0.9,
                               ease:"bounce.out"}, t);
        tl.to(nlFactor73Lbl, {opacity:1, duration:0.4}, t + 0.5);
        // 137 drops in, slightly staggered
        tl.to(nlFactor137Dot, {opacity:1, attr:{cy:NL_Y}, duration:0.9,
                                ease:"bounce.out"}, t + 0.35);
        tl.to(nlFactor137Lbl, {opacity:1, duration:0.4}, t + 0.85);
        // "outside" callouts
        tl.to(nlOutsideLbl73,  {opacity:1, duration:0.4}, t + 1.0);
        tl.to(nlOutsideLbl137, {opacity:1, duration:0.4}, t + 1.1);
        break;

      // ── Acts 2 & 4: morph equation (6 total calls, index 0..5) ────────
      case "morph_equation":
        if (morphStep === 0) {
          // Reset ALL steps to hidden first — Act 2 leaves steps visible;
          // Act 4 re-enters the same eqGroup and must not inherit stale state.
          for (var si = 0; si < eqSteps.length; si++) {
            tl.set(eqSteps[si], {opacity:0}, t);
          }
          tl.to(nlGroup,    {opacity:0.25, duration:0.6}, t);
          tl.to(eqGroup,    {opacity:1, duration:0.5}, t + 0.3);
          tl.to(eqSteps[0], {opacity:1, duration:0.7, ease:"power2.out"}, t + 0.5);
        } else {
          // Hide every prior step explicitly (prevents any stale visibility)
          for (var sj = 0; sj < morphStep; sj++) {
            tl.to(eqSteps[sj], {opacity:0, duration:0.35}, t);
          }
          tl.to(eqSteps[morphStep], {opacity:1, duration:0.7, ease:"power2.out"}, t + 0.3);
        }
        morphStep++;
        break;

      // ── Act 3, beats 1–2: co-divisor arc ─────────────────────────────
      case "draw_codivisor_arc":
        if (arcStep === 0) {
          // First call: show left dot, then draw arc to right dot
          tl.to(nlGroup,  {opacity:1, duration:0.4}, t);
          tl.to(eqGroup,  {opacity:0, duration:0.4}, t);
          tl.to(arcDotL,  {opacity:1, duration:0.5, ease:"back.out(2)"}, t + 0.3);
          tl.to(arcPath,  {opacity:1, strokeDashoffset:0, duration:1.4,
                            ease:"power2.inOut"}, t + 0.6);
          tl.to(arcDotR,  {opacity:1, duration:0.5, ease:"back.out(2)"}, t + 1.8);
        } else {
          // Second call: show the "+0.49" fractional overshoot label
          tl.to(arcFracLbl, {opacity:1, duration:0.6, ease:"back.out(2)"}, t);
          // Pulse arc amber
          tl.to(arcPath, {attr:{stroke:"#fbbf24"}, duration:0.3}, t + 0.3);
        }
        arcStep++;
        break;

      // ── Act 3, beat 3: dim left half, snap co-divisor to boundary ────
      case "snap_and_dim":
        tl.to(nlLeftDimmer, {opacity:1, duration:0.8, ease:"power2.out"}, t);
        tl.to(arcFracLbl,   {opacity:0, duration:0.3}, t + 0.3);
        // Snap arc right dot exactly to x=120
        tl.to(arcDotR, {attr:{cx: xAt(120)}, duration:0.35, ease:"power3.in"}, t + 0.5);
        break;

      // ── Act 4, beat 3: sweep the r-value dial ────────────────────────
      case "sweep_dial":
        tl.to(eqGroup,    {opacity:0, duration:0.5}, t);
        tl.to(dialGroup,  {opacity:1, duration:0.8, ease:"power2.out"}, t + 0.4);
        // Sweep needle from r=0 (−180°) toward r=4 (0°), then stop just short
        tl.to(dialNeedle, {
          rotation: 167,             // stops just before 0°
          transformOrigin:"0 0",
          duration: 2.2, ease:"power2.out"
        }, t + 0.8);
        // Then show "r ∈ {1,2,3}" label
        tl.to(dialRLabel, {opacity:1, duration:0.6, ease:"back.out(2)"}, t + 2.8);
        break;

      // ── Act 5: run gauntlet (3 calls, one per case) ──────────────────
      case "run_gauntlet":
        if (gauntStep === 0) {
          // Transition to gauntlet view
          tl.to(dialGroup, {opacity:0, duration:0.4}, t);
          tl.to(nlGroup,   {opacity:0.15, duration:0.5}, t);
          tl.to(gaunGroup, {opacity:1, duration:0.7}, t + 0.3);
          // Show Case 1 (r=3)
          tl.to(gaunCase1, {opacity:1, duration:0.7, ease:"power2.out"}, t + 0.6);
          // Spin clock hand: 0 → 120° → 240° → 360°
          tl.to(gaunCase1._hand, {rotation:120,  transformOrigin:"0 0",
                                   duration:0.5}, t + 1.2);
          tl.to(gaunCase1._hand, {rotation:240,  transformOrigin:"0 0",
                                   duration:0.5}, t + 1.8);
          tl.to(gaunCase1._hand, {rotation:360,  transformOrigin:"0 0",
                                   duration:0.5}, t + 2.4);
          tl.to(gaunCase1._result, {opacity:1, duration:0.5}, t + 2.6);
          tl.to(gaunCase1._xstamp, {opacity:0.75, duration:0.35,
                                     ease:"back.out(2)"}, t + 3.0);

        } else if (gauntStep === 1) {
          // Dim Case 1, show Case 2 (r=2)
          tl.to(gaunCase1, {opacity:0.15, duration:0.4}, t);
          tl.to(gaunCase2, {opacity:1, duration:0.7, ease:"power2.out"}, t + 0.3);
          // Reveal algebra steps one by one (eq[0] already visible at opacity 1)
          tl.to(gaunCase2._eqs[1], {opacity:1, duration:0.5}, t + 0.9);
          tl.to(gaunCase2._eqs[2], {opacity:1, duration:0.5}, t + 1.6);
          tl.to(gaunCase2._eqs[3], {opacity:1, duration:0.5}, t + 2.3);
          tl.to(gaunCase2._xstamp, {opacity:0.75, duration:0.35,
                                     ease:"back.out(2)"}, t + 2.9);

        } else if (gauntStep === 2) {
          // Dim Case 2, show Case 3 (r=1)
          tl.to(gaunCase2, {opacity:0.15, duration:0.4}, t);
          tl.to(gaunCase3, {opacity:1, duration:0.7, ease:"power2.out"}, t + 0.3);
          // Ball appears, then drops into the gap between pillars
          tl.to([gaunCase3._ball, gaunCase3._ballL], {opacity:1, duration:0.5}, t + 0.8);
          tl.to(gaunCase3._ball,  {attr:{cy:-15}, duration:1.1, ease:"bounce.out"}, t + 1.2);
          tl.to(gaunCase3._ballL, {attr:{y:-40},  duration:1.1, ease:"bounce.out"}, t + 1.2);
          tl.to(gaunCase3._xstamp, {opacity:0.75, duration:0.35,
                                     ease:"back.out(2)"}, t + 2.5);
          // Clear all case panels before the final banner so nothing overlaps
          tl.to(gaunCase1, {opacity:0, duration:0.5}, t + 3.1);
          tl.to(gaunCase2, {opacity:0, duration:0.5}, t + 3.1);
          tl.to(gaunCase3, {opacity:0, duration:0.5}, t + 3.1);
          tl.to(gaunFinal, {opacity:1, duration:1.0}, t + 3.5);
        }
        gauntStep++;
        break;
    }
  }

  return {
    name: "gauntlet_viz",
    init: init,
    getElements: function() {
      return { nlGroup: nlGroup, eqGroup: eqGroup,
               dialGroup: dialGroup, gaunGroup: gaunGroup };
    },
    timelineAction: timelineAction,
    executeAction: function(actionDef, tl, t) {
      timelineAction(tl, actionDef.vizAction, actionDef.params || {}, t);
    }
  };
})();
