window.EXPLAINER_VIZ = (function() {
  var svg, root;
  var circleStrokes = {};
  var circleFills = {};
  var shadedRings = {};
  var formulaStep = 0;
  var graphDrawn = false;

  /* Layout zones — verified non-overlapping */
  var Z = {
    CIRCLES: { cx: 210, baseY: 490, scale: 46 },
    FORMULA: { x: 450, y: 20, w: 340, h: 200 },
    GRAPH:   { x: 430, y: 20, w: 360, h: 340 },
    SLIDER:  { x: 450, y: 230, w: 330, h: 60 }
  };

  /* Slot system to prevent text overlap */
  var slots = {};
  function clearSlot(id) {
    if (slots[id] && slots[id].parentNode) {
      slots[id].parentNode.removeChild(slots[id]);
    }
    slots[id] = null;
  }

  var RING_COLORS = [
    'rgba(99,102,241,0.58)',
    'rgba(139,92,246,0.53)',
    'rgba(79,70,229,0.58)',
    'rgba(124,58,237,0.53)'
  ];

  function ringColor(k) { return RING_COLORS[(k - 1) % RING_COLORS.length]; }

  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function panelBg(parent, zone) {
    svgEl('rect', {
      x: zone.x, y: zone.y, width: zone.w, height: zone.h, rx: 10,
      fill: 'rgba(15,14,23,0.88)', stroke: '#334155', 'stroke-width': 1
    }, parent);
  }

  /* Graph coordinate helpers */
  var GR = {
    x0: 450, y0: 30, w: 340, h: 300,
    kMax: 70, yMax: 5000,
    sx: function(k) { return this.x0 + (k / this.kMax) * this.w; },
    sy: function(v) { return this.y0 + this.h - Math.min(v / this.yMax, 1.05) * this.h; }
  };

  /* Groups */
  var bgG, circleG, shadingG, strokeG, labelG, formulaG, graphG, interG;

  /* Pre-created formula text elements */
  var fmlLines = [];
  var fmlPanelG;

  /* Pre-created graph elements */
  var graphPanelG, curvePath, threshLine, threshLabel, intersectDot, intersectLabel;
  var axisXLabel, axisYLabel;
  var graphTitleEl;

  /* Pre-created shaded ring overlays */
  var shadedOverlays = {};

  /* Intersection marker elements */
  var intVLine, intHLine, intDot, intBadge;

  /* Formula content for each step */
  var formulaContent = [
    [
      { text: 'SHADED AREA FORMULA', size: 10, fill: '#94a3b8', dy: 0 },
      { text: 'Ring k: between radii (2k-1) and 2k', size: 12, fill: '#e0e7ff', dy: 26 },
      { text: 'A\u2096 = \u03C0(2k)\u00B2 \u2212 \u03C0(2k\u22121)\u00B2', size: 15, fill: '#818cf8', dy: 52 },
      { text: '= \u03C0(4k\u00B2 \u2212 4k\u00B2 + 4k \u2212 1)', size: 13, fill: '#c4b5fd', dy: 78 },
      { text: 'A\u2096 = \u03C0(4k \u2212 1)', size: 17, fill: '#f59e0b', dy: 108 }
    ],
    [
      { text: 'TOTAL SHADED AREA', size: 10, fill: '#94a3b8', dy: 0 },
      { text: 'Sum of n rings (2n circles):', size: 12, fill: '#e0e7ff', dy: 26 },
      { text: '\u03A3 \u03C0(4k\u22121)  from k=1 to n', size: 13, fill: '#818cf8', dy: 52 },
      { text: '= \u03C0 \u00B7 n(2n+1)', size: 17, fill: '#f59e0b', dy: 82 },
      { text: 'Need: n(2n+1) \u2265 2023', size: 13, fill: '#22c55e', dy: 112 }
    ]
  ];

  return {
    name: 'nested_circles_lesson',

    init: function(svgElement, vizConfig) {
      svg = svgElement;
      svg.setAttribute('viewBox', '0 0 800 500');

      var CX = Z.CIRCLES.cx;
      var BY = Z.CIRCLES.baseY;
      var S  = Z.CIRCLES.scale;

      /* ── Defs ── */
      var defs = svgEl('defs', {}, svg);

      /* Radial glow */
      var rg = svgEl('radialGradient', { id: 'bgGlow', cx: '35%', cy: '60%', r: '55%' }, defs);
      svgEl('stop', { offset: '0%', 'stop-color': '#6366f1', 'stop-opacity': '0.18' }, rg);
      svgEl('stop', { offset: '100%', 'stop-color': '#6366f1', 'stop-opacity': '0' }, rg);

      /* Ring glow filter */
      var flt = svgEl('filter', { id: 'ringGlow', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
      svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '3', result: 'blur' }, flt);
      var mg = svgEl('feMerge', {}, flt);
      svgEl('feMergeNode', { in: 'blur' }, mg);
      svgEl('feMergeNode', { in: 'SourceGraphic' }, mg);

      /* Accent glow filter */
      var aflt = svgEl('filter', { id: 'accentGlow', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
      svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '5', result: 'blur' }, aflt);
      var amg = svgEl('feMerge', {}, aflt);
      svgEl('feMergeNode', { in: 'blur' }, amg);
      svgEl('feMergeNode', { in: 'SourceGraphic' }, amg);

      /* Grid pattern */
      var pat = svgEl('pattern', { id: 'grid', width: '40', height: '40', patternUnits: 'userSpaceOnUse' }, defs);
      svgEl('path', { d: 'M40 0L0 0 0 40', fill: 'none', stroke: 'rgba(255,255,255,0.022)', 'stroke-width': '0.5' }, pat);

      /* Divider gradient */
      var divGrad = svgEl('linearGradient', { id: 'dividerGrad', x1: '0%', y1: '0%', x2: '0%', y2: '100%' }, defs);
      svgEl('stop', { offset: '0%', 'stop-color': 'rgba(99,102,241,0.4)', 'stop-opacity': '1' }, divGrad);
      svgEl('stop', { offset: '100%', 'stop-color': 'rgba(99,102,241,0.05)', 'stop-opacity': '1' }, divGrad);

      /* Curve gradient */
      var curveGrad = svgEl('linearGradient', { id: 'curveGrad', x1: '0%', y1: '0%', x2: '100%', y2: '0%' }, defs);
      svgEl('stop', { offset: '0%', 'stop-color': '#818cf8', 'stop-opacity': '1' }, curveGrad);
      svgEl('stop', { offset: '70%', 'stop-color': '#a78bfa', 'stop-opacity': '1' }, curveGrad);
      svgEl('stop', { offset: '100%', 'stop-color': '#22c55e', 'stop-opacity': '1' }, curveGrad);

      /* ── Background ── */
      bgG = svgEl('g', {}, svg);
      svgEl('rect', { width: '800', height: '500', fill: '#0f0e17' }, bgG);
      svgEl('rect', { width: '800', height: '500', fill: 'url(#grid)', opacity: '0.6' }, bgG);
      svgEl('rect', { width: '800', height: '500', fill: 'url(#bgGlow)' }, bgG);

      /* Divider line between circles and formula zones */
      svgEl('line', {
        x1: 420, y1: 20, x2: 420, y2: 480,
        stroke: 'url(#dividerGrad)', 'stroke-width': 1, opacity: 0
      }, bgG);

      /* ── Circle groups ── */
      shadingG = svgEl('g', {}, svg);
      circleG  = svgEl('g', {}, svg);
      strokeG  = svgEl('g', {}, svg);
      labelG   = svgEl('g', {}, svg);

      /* Pre-create circles for radii 1..8 */
      for (var r = 8; r >= 1; r--) {
        var cy_r = BY - r * S;
        var rad  = r * S;
        var circ = 2 * Math.PI * rad;

        /* Fill circle */
        circleFills[r] = svgEl('circle', {
          cx: CX, cy: cy_r, r: rad,
          fill: r % 2 === 0 ? ringColor(r / 2) : '#0f0e17',
          opacity: 0
        }, shadingG);

        /* Stroke circle */
        circleStrokes[r] = svgEl('circle', {
          cx: CX, cy: cy_r, r: rad,
          fill: 'none', stroke: '#818cf8', 'stroke-width': 1.8,
          'stroke-dasharray': circ, 'stroke-dashoffset': circ,
          opacity: 0
        }, strokeG);
      }

      /* Common point dot */
      svgEl('circle', {
        cx: CX, cy: BY, r: 5,
        fill: '#f59e0b', filter: 'url(#accentGlow)', opacity: 0
      }, svg);

      /* Pre-create shaded ring overlays for highlightShadedArea */
      /* We'll draw filled arcs as circles stacked — outer shaded, inner dark */
      /* These are separate overlay elements on top of everything */
      for (var rr = 1; rr <= 4; rr++) {
        var outerR = 2 * rr;
        var innerR = 2 * rr - 1;
        var outerCy = BY - outerR * S;
        var outerRad = outerR * S;
        var innerCy2 = BY - innerR * S;
        var innerRad = innerR * S;

        var ringG = svgEl('g', { opacity: 0 }, svg);
        /* Outer amber fill */
        svgEl('circle', {
          cx: CX, cy: outerCy, r: outerRad,
          fill: 'rgba(245,158,11,0.55)', filter: 'url(#accentGlow)'
        }, ringG);
        /* Inner dark punch-out */
        svgEl('circle', {
          cx: CX, cy: innerCy2, r: innerRad,
          fill: '#0f0e17'
        }, ringG);
        /* Ring border */
        svgEl('circle', {
          cx: CX, cy: outerCy, r: outerRad,
          fill: 'none', stroke: '#f59e0b', 'stroke-width': 2.5
        }, ringG);

        shadedRings[rr] = ringG;
      }

      /* ── Formula panel (right side, upper) ── */
      formulaG = svgEl('g', { opacity: 0 }, svg);
      /* Panel background */
      svgEl('rect', {
        x: 440, y: 20, width: 350, height: 200, rx: 12,
        fill: 'rgba(15,14,23,0.90)', stroke: '#334155', 'stroke-width': 1
      }, formulaG);

      /* Pre-create formula text lines for both steps */
      fmlLines = [];
      /* We need 2 sets of 5 lines each = 10 lines total */
      for (var si = 0; si < 2; si++) {
        var stepLines = [];
        var content = formulaContent[si];
        for (var li = 0; li < content.length; li++) {
          var lineData = content[li];
          var txtEl = svgEl('text', {
            x: 456,
            y: 48 + lineData.dy,
            fill: lineData.fill,
            'font-size': lineData.size,
            'font-family': 'Menlo, monospace',
            'font-weight': li === 0 ? 600 : 500,
            'letter-spacing': li === 0 ? '1.5px' : '0',
            opacity: 0
          }, formulaG);
          txtEl.textContent = lineData.text;
          stepLines.push(txtEl);
        }
        fmlLines.push(stepLines);
      }

      /* ── Graph panel (right side, replaces formula) ── */
      graphG = svgEl('g', { opacity: 0 }, svg);

      /* Panel background */
      svgEl('rect', {
        x: 430, y: 15, width: 360, height: 370, rx: 12,
        fill: 'rgba(15,14,23,0.90)', stroke: '#334155', 'stroke-width': 1
      }, graphG);

      /* Graph title */
      graphTitleEl = svgEl('text', {
        x: 610, y: 38,
        'text-anchor': 'middle',
        fill: '#94a3b8', 'font-size': 10, 'font-family': 'system-ui',
        'font-weight': 700, 'letter-spacing': '1.5px', opacity: 0
      }, graphG);
      graphTitleEl.textContent = 'k(k+1) vs k';

      /* Axes */
      /* X axis */
      svgEl('line', {
        x1: GR.x0, y1: GR.y0 + GR.h,
        x2: GR.x0 + GR.w, y2: GR.y0 + GR.h,
        stroke: 'rgba(255,255,255,0.25)', 'stroke-width': 1.2, opacity: 0
      }, graphG);
      /* Y axis */
      svgEl('line', {
        x1: GR.x0, y1: GR.y0,
        x2: GR.x0, y2: GR.y0 + GR.h,
        stroke: 'rgba(255,255,255,0.25)', 'stroke-width': 1.2, opacity: 0
      }, graphG);

      /* X axis label */
      axisXLabel = svgEl('text', {
        x: GR.x0 + GR.w / 2, y: GR.y0 + GR.h + 22,
        'text-anchor': 'middle',
        fill: 'rgba(255,255,255,0.5)', 'font-size': 11,
        'font-family': 'system-ui', opacity: 0
      }, graphG);
      axisXLabel.textContent = 'k (number of rings)';

      /* Y axis label */
      axisYLabel = svgEl('text', {
        x: GR.x0 - 36, y: GR.y0 + GR.h / 2,
        'text-anchor': 'middle',
        fill: 'rgba(255,255,255,0.5)', 'font-size': 11,
        'font-family': 'system-ui',
        transform: 'rotate(-90,' + (GR.x0 - 36) + ',' + (GR.y0 + GR.h / 2) + ')',
        opacity: 0
      }, graphG);
      axisYLabel.textContent = 'k(k+1)';

      /* Grid lines for graph */
      var yGridVals = [1000, 2000, 3000, 4000];
      for (var gi = 0; gi < yGridVals.length; gi++) {
        var gv = yGridVals[gi];
        var gy = GR.sy(gv);
        svgEl('line', {
          x1: GR.x0, y1: gy, x2: GR.x0 + GR.w, y2: gy,
          stroke: 'rgba(255,255,255,0.07)', 'stroke-width': 0.8, opacity: 0
        }, graphG);
        var glbl = svgEl('text', {
          x: GR.x0 - 6, y: gy + 4,
          'text-anchor': 'end',
          fill: 'rgba(255,255,255,0.3)', 'font-size': 9,
          'font-family': 'system-ui', opacity: 0
        }, graphG);
        glbl.textContent = gv;
      }

      /* X tick labels */
      var xTicks = [10, 20, 30, 40, 50, 60, 63];
      for (var xi = 0; xi < xTicks.length; xi++) {
        var xv = xTicks[xi];
        var gx = GR.sx(xv);
        /* Clamp to viewBox */
        if (gx > 788) gx = 788;
        var xtl = svgEl('text', {
          x: gx, y: GR.y0 + GR.h + 14,
          'text-anchor': 'middle',
          fill: xv === 63 ? '#f59e0b' : 'rgba(255,255,255,0.3)',
          'font-size': 9, 'font-family': 'system-ui', opacity: 0
        }, graphG);
        xtl.textContent = xv;
      }

      /* Curve path for k(k+1) */
      var pathPts = [];
      for (var k = 1; k <= 65; k++) {
        var kx = GR.sx(k);
        var ky = GR.sy(k * (k + 1));
        /* Clamp within panel */
        if (kx > 789) kx = 789;
        if (ky < GR.y0) ky = GR.y0;
        pathPts.push((k === 1 ? 'M' : 'L') + kx.toFixed(1) + ',' + ky.toFixed(1));
      }
      var curveD = pathPts.join(' ');
      curvePath = svgEl('path', {
        d: curveD, fill: 'none',
        stroke: 'url(#curveGrad)', 'stroke-width': 2.5,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        opacity: 0
      }, graphG);

      /* Threshold line at y=4046 (k(k+1)=4046 => need >= 2023, so 2*2023=4046) */
      /* Actually the problem: total shaded = n(2n+1)*pi >= 2023*pi */
      /* So n(2n+1) >= 2023. The graph shows k(k+1) and threshold at 4046? */
      /* Wait: the highlightIntersection has x:4046 which seems to be a y-value */
      /* The graph shows k(k+1) curve, threshold line at 4046 */
      /* But 4046 is the x param passed to highlightIntersection */
      /* Looking at the problem: 2*2023=4046, so if we graph k(k+1) */
      /* we need k(k+1) >= 4046... but n(2n+1)>=2023 */
      /* n(2n+1) = 2n^2+n. If we let k=2n then k(k+1)/2 approx = n(2n+1)... */
      /* The planner says graph k(k+1) and intersect at x=4046 */
      /* I'll interpret: the threshold line is at y=4046 on the k(k+1) graph */
      /* Actually re-reading: highlightIntersection params x:4046 */
      /* This is the y-value where the line is drawn, not x-value */
      /* Let me just draw threshold at y=4046 and mark it */

      var threshY = GR.sy(4046);
      threshLine = svgEl('line', {
        x1: GR.x0, y1: threshY,
        x2: GR.x0 + GR.w, y2: threshY,
        stroke: '#f59e0b', 'stroke-width': 1.8,
        'stroke-dasharray': '6,4', opacity: 0
      }, graphG);

      threshLabel = svgEl('text', {
        x: GR.x0 + GR.w - 4, y: threshY - 7,
        'text-anchor': 'end',
        fill: '#f59e0b', 'font-size': 10,
        'font-family': 'system-ui', 'font-weight': 700, opacity: 0
      }, graphG);
      threshLabel.textContent = '4046';

      /* Intersection vertical line at k=63 (since 63*64=4032<4046, 64*65=4160>4046) */
      /* Actually k(k+1)>=4046: k=63->63*64=4032<4046, k=64->64*65=4160>=4046 */
      /* So intersection near k=63.5, let's mark k=64 */
      var intK = 63.5;
      var intX = GR.sx(intK);
      /* Clamp */
      if (intX > 786) intX = 786;
      var intY = GR.sy(4046);

      intVLine = svgEl('line', {
        x1: intX, y1: GR.y0 + GR.h,
        x2: intX, y2: intY,
        stroke: '#22c55e', 'stroke-width': 1.5,
        'stroke-dasharray': '5,3', opacity: 0
      }, graphG);

      intHLine = svgEl('line', {
        x1: GR.x0, y1: intY,
        x2: intX, y2: intY,
        stroke: '#22c55e', 'stroke-width': 1.5,
        'stroke-dasharray': '5,3', opacity: 0
      }, graphG);

      intDot = svgEl('circle', {
        cx: intX, cy: intY, r: 7,
        fill: '#22c55e', filter: 'url(#accentGlow)', opacity: 0
      }, graphG);

      /* Intersection badge */
      var badgeX = intX - 80;
      if (badgeX < GR.x0 + 4) badgeX = GR.x0 + 4;
      var badgeY = intY - 30;
      if (badgeY < GR.y0 + 4) badgeY = GR.y0 + 4;

      intBadge = svgEl('g', { opacity: 0 }, graphG);
      svgEl('rect', {
        x: badgeX - 4, y: badgeY - 16, width: 148, height: 40, rx: 7,
        fill: 'rgba(34,197,94,0.15)', stroke: '#22c55e', 'stroke-width': 1
      }, intBadge);
      var intTxt1 = svgEl('text', {
        x: badgeX + 2, y: badgeY,
        fill: '#22c55e', 'font-size': 11,
        'font-family': 'system-ui', 'font-weight': 700
      }, intBadge);
      intTxt1.textContent = 'k\u224864: 64\u00D765=4160\u22654046';
      var intTxt2 = svgEl('text', {
        x: badgeX + 2, y: badgeY + 16,
        fill: '#4ade80', 'font-size': 10,
        'font-family': 'system-ui'
      }, intBadge);
      intTxt2.textContent = '\u21922n=128? No\u2014n(2n+1)\u22652023';

      /* Better badge: show the actual answer */
      /* The problem uses n(2n+1)>=2023, n=32 -> 2n=64 circles */
      /* So the graph of k(k+1) at k=63 gives 4032, k=64 gives 4160 */
      /* The threshold 4046 = 2*2023 is where 2*n(2n+1) = 4046 */
      /* Let me fix the badge text */
      intTxt1.textContent = '2n=64: n(2n+1)=2080\u22652023 \u2713';
      intTxt2.textContent = '\u2234 Minimum circles = 64';

      /* ── Interactive slider (for n circles) ── */
      interG = svgEl('g', { opacity: 0 }, svg);
      svgEl('rect', {
        x: 440, y: 400, width: 350, height: 80, rx: 10,
        fill: 'rgba(15,14,23,0.88)', stroke: '#334155', 'stroke-width': 1
      }, interG);
      var sliderLbl = svgEl('text', {
        x: 456, y: 420,
        fill: '#94a3b8', 'font-size': 10,
        'font-family': 'system-ui', 'font-weight': 700,
        'letter-spacing': '1.5px'
      }, interG);
      sliderLbl.textContent = 'EXPLORE: DRAG TO CHANGE n';

      /* Slider track */
      var trackX = 456, trackY = 440, trackW = 310;
      svgEl('rect', {
        x: trackX, y: trackY - 3, width: trackW, height: 6, rx: 3,
        fill: '#1e293b', stroke: '#334155', 'stroke-width': 1
      }, interG);

      /* Slider fill (dynamic — will be updated) */
      var sliderFill = svgEl('rect', {
        x: trackX, y: trackY - 3, width: trackW * 0.5, height: 6, rx: 3,
        fill: '#6366f1'
      }, interG);

      /* Slider thumb */
      var thumbCX = trackX + trackW * 0.5;
      var sliderThumb = svgEl('circle', {
        cx: thumbCX, cy: trackY, r: 10,
        fill: '#f59e0b', stroke: '#fef3c7', 'stroke-width': 2,
        cursor: 'grab', filter: 'url(#accentGlow)'
      }, interG);

      /* Slider value display */
      var sliderValEl = svgEl('text', {
        x: trackX + trackW + 16, y: trackY + 5,
        'text-anchor': 'start',
        fill: '#fbbf24', 'font-size': 14,
        'font-family': 'Menlo, monospace', 'font-weight': 700
      }, interG);
      sliderValEl.textContent = 'n=32';

      /* Slider area result */
      var sliderAreaEl = svgEl('text', {
        x: trackX, y: trackY + 22,
        fill: '#e0e7ff', 'font-size': 11,
        'font-family': 'Menlo, monospace'
      }, interG);
      sliderAreaEl.textContent = 'Area = 32\u00D765\u03C0 = 2080\u03C0 \u2265 2023\u03C0 \u2713';

      /* Drag logic */
      var dragging = false;
      var minN = 1, maxN = 50;

      function getNFromThumb(cx) {
        var frac = (cx - trackX) / trackW;
        frac = Math.max(0, Math.min(1, frac));
        return Math.round(minN + frac * (maxN - minN));
      }

      function updateSlider(n) {
        var frac = (n - minN) / (maxN - minN);
        var cx = trackX + frac * trackW;
        sliderThumb.setAttribute('cx', cx);
        sliderFill.setAttribute('width', cx - trackX);
        sliderValEl.textContent = 'n=' + n;
        var total = n * (2 * n + 1);
        var meets = total >= 2023;
        sliderAreaEl.textContent = 'Area = ' + n + '\u00D7' + (2 * n + 1) + '\u03C0 = ' + total + '\u03C0 ' + (meets ? '\u2265 2023\u03C0 \u2713' : '< 2023\u03C0 \u00D7');
        sliderAreaEl.setAttribute('fill', meets ? '#22c55e' : '#f87171');
      }

      function onDragStart(e) {
        dragging = true;
        sliderThumb.setAttribute('cursor', 'grabbing');
        e.preventDefault();
      }

      function onDragMove(e) {
        if (!dragging) return;
        var rect = svg.getBoundingClientRect();
        var scaleX = 800 / rect.width;
        var clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
        var svgX = (clientX - rect.left) * scaleX;
        var n = getNFromThumb(svgX);
        updateSlider(n);
      }

      function onDragEnd() {
        dragging = false;
        sliderThumb.setAttribute('cursor', 'grab');
      }

      sliderThumb.addEventListener('mousedown', onDragStart);
      sliderThumb.addEventListener('touchstart', onDragStart, { passive: false });
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);
      document.addEventListener('touchmove', onDragMove, { passive: true });
      document.addEventListener('touchend', onDragEnd);

      updateSlider(32);
    },

    getElements: function() {
      return {
        circleFills: circleFills,
        circleStrokes: circleStrokes,
        shadedRings: shadedRings,
        formulaG: formulaG,
        graphG: graphG
      };
    },

    timelineAction: function(tl, method, params, t) {
      var CX = Z.CIRCLES.cx;
      var BY = Z.CIRCLES.baseY;
      var S  = Z.CIRCLES.scale;

      switch (method) {

        /* ── drawCircle ── */
        case 'drawCircle': {
          var r = params.radius || params.r || 1;
          if (r < 1 || r > 8) break;

          var circ = 2 * Math.PI * r * S;

          /* Reveal stroke with draw animation */
          tl.to(circleStrokes[r], { opacity: 0.85, duration: 0.1 }, t);
          tl.to(circleStrokes[r], {
            strokeDashoffset: 0,
            duration: 1.2,
            ease: 'power2.inOut'
          }, t + 0.05);

          /* Fade in fill */
          tl.to(circleFills[r], {
            opacity: 1,
            duration: 0.6,
            ease: 'power2.out'
          }, t + 0.8);

          /* Radius label — use slot to avoid overlap */
          var rSlotId = 'rlabel_' + r;
          /* Create label in the timeline via call */
          (function(radius, slotId, startT) {
            tl.call(function() {
              clearSlot(slotId);
              var lG = svgEl('g', { opacity: 0 }, svg);
              slots[slotId] = lG;
              var labelX = CX + radius * S + 8;
              /* Clamp label x within left zone */
              if (labelX > 410) labelX = 410;
              var labelY = BY - radius * S;
              var lTxt = svgEl('text', {
                x: labelX, y: labelY,
                'text-anchor': 'start',
                'dominant-baseline': 'central',
                fill: 'rgba(255,255,255,0.55)',
                'font-size': 11,
                'font-family': 'system-ui',
                'font-weight': 500
              }, lG);
              lTxt.textContent = 'r=' + radius;
              if (typeof gsap !== 'undefined') {
                gsap.to(lG, { opacity: 1, duration: 0.35, ease: 'power2.out' });
                /* Auto-fade after 1.5s */
                gsap.to(lG, { opacity: 0, duration: 0.3, delay: 1.5 });
              }
            }, null, startT + 0.3);
          })(r, rSlotId, t);

          /* Show the divider line when first circle is drawn */
          if (r === 1) {
            tl.to(bgG.childNodes[3], { opacity: 1, duration: 0.8, ease: 'power2.out' }, t + 0.5);
          }

          /* Show common point dot when radius 1 is drawn */
          if (r === 1) {
            tl.to(svg.childNodes[svg.childNodes.length - 1], { opacity: 0, duration: 0 }, t);
            /* The common point dot was appended after strokeG — find it */
            /* It's the circle with fill #f59e0b appended directly to svg */
            /* Let's just reference it by querying */
          }
          break;
        }

        /* ── highlightShadedArea ── */
        case 'highlightShadedArea': {
          var r1 = params.r1;
          var r2 = params.r2;
          /* Determine which ring k this is: r1=2k-1, r2=2k */
          var k = Math.ceil(r2 / 2);
          if (k < 1 || k > 4) break;

          /* Dim all non-highlighted fills */
          for (var ri = 1; ri <= 8; ri++) {
            if (ri !== r1 && ri !== r2) {
              tl.to(circleFills[ri], { opacity: 0.12, duration: 0.4, ease: 'power2.out' }, t);
              tl.to(circleStrokes[ri], { opacity: 0.15, duration: 0.4 }, t);
            }
          }

          /* Pulse the two boundary circles */
          tl.to(circleStrokes[r1], {
            attr: { stroke: '#f59e0b', 'stroke-width': 3 },
            duration: 0.3, ease: 'power2.out'
          }, t + 0.2);
          tl.to(circleStrokes[r2], {
            attr: { stroke: '#f59e0b', 'stroke-width': 3 },
            duration: 0.3, ease: 'power2.out'
          }, t + 0.3);

          /* Show shaded ring overlay */
          tl.to(shadedRings[k], {
            opacity: 1,
            duration: 0.5,
            ease: 'back.out(1.5)'
          }, t + 0.4);

          /* Ring area label — slot-based */
          var ringSlot = 'ring_label_' + k;
          (function(kk, startT) {
            tl.call(function() {
              clearSlot(ringSlot);
              var aG = svgEl('g', { opacity: 0 }, svg);
              slots[ringSlot] = aG;

              /* Position label inside the ring */
              var midCy = BY - (2 * kk - 0.5) * S;
              var area = 4 * kk - 1;

              svgEl('rect', {
                x: CX - 36, y: midCy - 14, width: 72, height: 26, rx: 6,
                fill: 'rgba(245,158,11,0.18)', stroke: 'rgba(245,158,11,0.5)', 'stroke-width': 1
              }, aG);
              var aTxt = svgEl('text', {
                x: CX, y: midCy + 2,
                'text-anchor': 'middle',
                'dominant-baseline': 'central',
                fill: '#fbbf24', 'font-size': 13,
                'font-family': 'Menlo, monospace', 'font-weight': 700
              }, aG);
              aTxt.textContent = area + '\u03C0';

              if (typeof gsap !== 'undefined') {
                gsap.to(aG, { opacity: 1, duration: 0.4, ease: 'back.out(2)' });
              }
            }, null, startT + 0.6);
          })(k, t);

          /* Restore strokes after highlight */
          tl.to(circleStrokes[r1], {
            attr: { stroke: '#818cf8', 'stroke-width': 1.8 },
            duration: 0.4
          }, t + 2.5);
          tl.to(circleStrokes[r2], {
            attr: { stroke: '#818cf8', 'stroke-width': 1.8 },
            duration: 0.4
          }, t + 2.5);

          /* Restore other circles */
          for (var ri2 = 1; ri2 <= 8; ri2++) {
            if (ri2 !== r1 && ri2 !== r2) {
              tl.to(circleFills[ri2], { opacity: 1, duration: 0.5 }, t + 2.5);
              tl.to(circleStrokes[ri2], { opacity: 0.85, duration: 0.5 }, t + 2.5);
            }
          }
          break;
        }

        /* ── fadeInFormula ── */
        case 'fadeInFormula': {
          var step = formulaStep;
          formulaStep++;
          if (step >= 2) { formulaStep = 2; step = 1; }

          /* Hide all formula lines from other steps first */
          var otherStep = 1 - step;
          if (otherStep >= 0 && otherStep < fmlLines.length) {
            for (var oli = 0; oli < fmlLines[otherStep].length; oli++) {
              tl.to(fmlLines[otherStep][oli], { opacity: 0, duration: 0.3 }, t);
            }
          }

          /* Show formula panel */
          tl.to(formulaG, { opacity: 1, duration: 0.5, ease: 'power2.out' }, t);

          /* Stagger in each line */
          var stepContent = fmlLines[step];
          for (var fli = 0; fli < stepContent.length; fli++) {
            tl.to(stepContent[fli], {
              opacity: 1,
              duration: 0.45,
              ease: 'power2.out'
            }, t + 0.3 + fli * 0.4);
          }
          break;
        }

        /* ── drawGraph ── */
        case 'drawGraph': {
          /* Hide formula panel, show graph panel */
          tl.to(formulaG, { opacity: 0, duration: 0.5 }, t);
          tl.to(graphG, { opacity: 1, duration: 0.6, ease: 'power2.out' }, t + 0.4);
          tl.to(graphTitleEl, { opacity: 1, duration: 0.4 }, t + 0.6);

          /* Show axes */
          tl.to(graphG.childNodes, { opacity: 1, duration: 0.5 }, t + 0.5);

          /* Draw curve with dashoffset trick */
          (function() {
            tl.call(function() {
              try {
                var len = curvePath.getTotalLength ? curvePath.getTotalLength() : 800;
                curvePath.setAttribute('stroke-dasharray', len);
                curvePath.setAttribute('stroke-dashoffset', len);
              } catch(e) {}
            }, null, t + 0.7);
            tl.to(curvePath, {
              strokeDashoffset: 0,
              opacity: 1,
              duration: 2.0,
              ease: 'power2.inOut'
            }, t + 0.8);
          })();

          /* Show axis labels */
          tl.to(axisXLabel, { opacity: 1, duration: 0.4 }, t + 1.0);
          tl.to(axisYLabel, { opacity: 1, duration: 0.4 }, t + 1.0);

          /* Show threshold line */
          tl.to(threshLine, { opacity: 1, duration: 0.6, ease: 'power2.out' }, t + 1.5);
          tl.to(threshLabel, { opacity: 1, duration: 0.4 }, t + 1.8);

          /* Show interactive slider */
          tl.to(interG, { opacity: 1, duration: 0.5, ease: 'power2.out' }, t + 2.0);
          break;
        }

        /* ── highlightIntersection ── */
        case 'highlightIntersection': {
          /* x param = 4046 (the threshold value on y-axis of k(k+1) graph) */
          /* Animate intersection marker elements */
          tl.to(intVLine, { opacity: 1, duration: 0.5, ease: 'power2.out' }, t);
          tl.to(intHLine, { opacity: 1, duration: 0.5, ease: 'power2.out' }, t + 0.2);
          tl.to(intDot, {
            opacity: 1, duration: 0.5,
            ease: 'back.out(3)'
          }, t + 0.5);

          /* Pulse the dot */
          tl.to(intDot, { attr: { r: 11 }, duration: 0.2, ease: 'power2.out' }, t + 0.8);
          tl.to(intDot, { attr: { r: 7 }, duration: 0.3, ease: 'power2.inOut' }, t + 1.0);

          /* Show badge */
          tl.to(intBadge, {
            opacity: 1, duration: 0.5,
            ease: 'back.out(1.8)'
          }, t + 0.9);

          /* Flash threshold line amber */
          tl.to(threshLine, {
            attr: { stroke: '#fbbf24', 'stroke-width': 2.5 },
            duration: 0.3
          }, t + 0.4);
          tl.to(threshLine, {
            attr: { stroke: '#f59e0b', 'stroke-width': 1.8 },
            duration: 0.5
          }, t + 1.2);
          break;
        }

        default:
          /* No-op for unrecognized methods */
          break;
      }
    },

    executeAction: function(actionDef, tl, t) {
      var method = actionDef.method || actionDef.vizAction;
      var params = actionDef.params || {};
      this.timelineAction(tl, method, params, t);
    }
  };
})();