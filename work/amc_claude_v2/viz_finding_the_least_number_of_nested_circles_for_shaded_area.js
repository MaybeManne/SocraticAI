window.EXPLAINER_VIZ = (function() {
  var svg;

  /* ── Fixed geometry: CX=210, BY=480, S=26 → all 8 circles fit within 0 0 800 520 ── */
  var CX = 210, BY = 480, S = 26;

  /* Graph region (right panel, x>430) */
  var GR = {
    x0: 445, y0: 50, w: 330, h: 295,
    nMax: 50, yMax: 5500,
    sx: function(n)  { return this.x0 + (n / this.nMax) * this.w; },
    sy: function(v)  { return this.y0 + this.h - Math.min(v / this.yMax, 1) * this.h; }
  };

  /* Slider region (right panel, below graph) */
  var SL = { x: 445, y: 365, w: 330, trackY: 393, minN: 1, maxN: 50 };

  /* Module-level element refs */
  var circleStrokes = {}, circleFills = {}, shadedRings = {};
  var dividerLine, commonDot;
  var formulaG, fmlText;
  var graphG, curvePath, threshLine, threshLabel;
  var intVLine, intHLine, intDot, intBadge;
  var interG, sliderFill, sliderThumb, sliderValEl, sliderAreaEl;
  var sliderDot, sliderVLine;   /* dynamic graph indicator tied to slider */
  var dragging = false;

  var RING_COLORS = [
    'rgba(99,102,241,0.58)', 'rgba(139,92,246,0.53)',
    'rgba(79,70,229,0.58)',  'rgba(124,58,237,0.53)'
  ];
  function ringColor(k) { return RING_COLORS[(k - 1) % RING_COLORS.length]; }

  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ── Slider + live graph update ── */
  function updateSlider(n) {
    n = Math.max(SL.minN, Math.min(SL.maxN, n));
    var frac = (n - SL.minN) / (SL.maxN - SL.minN);
    var cx = SL.x + frac * SL.w;
    sliderThumb.setAttribute('cx', cx);
    sliderFill.setAttribute('width', Math.max(0, cx - SL.x));
    sliderValEl.textContent = 'n = ' + n;
    var total = n * (2 * n + 1);
    var meets = total >= 2023;
    sliderAreaEl.textContent = n + '\u00d7' + (2*n+1) + ' = ' + total + (meets ? ' \u2265 2023 \u2713' : ' < 2023 \u00d7');
    sliderAreaEl.setAttribute('fill', meets ? '#22c55e' : '#f87171');

    /* Move dot and vertical line on the graph */
    if (sliderDot && sliderVLine) {
      var gx = GR.sx(n);
      var gy = GR.sy(total);
      if (gx > GR.x0 + GR.w) gx = GR.x0 + GR.w;
      if (gy < GR.y0) gy = GR.y0;
      sliderDot.setAttribute('cx', gx);
      sliderDot.setAttribute('cy', gy);
      sliderVLine.setAttribute('x1', gx);
      sliderVLine.setAttribute('x2', gx);
      sliderVLine.setAttribute('y1', GR.y0 + GR.h);
      sliderVLine.setAttribute('y2', gy);
      var dotColor = meets ? '#22c55e' : '#f59e0b';
      sliderDot.setAttribute('fill', dotColor);
      sliderVLine.setAttribute('stroke', dotColor);
    }
  }

  return {
    name: 'nested_circles_lesson',

    init: function(svgElement, vizConfig) {
      svg = svgElement;
      svg.setAttribute('viewBox', '0 0 800 520');

      /* ── Defs ── */
      var defs = svgEl('defs', {}, svg);

      var rg = svgEl('radialGradient', { id: 'bgGlow', cx: '26%', cy: '58%', r: '50%' }, defs);
      svgEl('stop', { offset: '0%',   'stop-color': '#6366f1', 'stop-opacity': '0.14' }, rg);
      svgEl('stop', { offset: '100%', 'stop-color': '#6366f1', 'stop-opacity': '0'    }, rg);

      var flt = svgEl('filter', { id: 'ringGlow', x: '-25%', y: '-25%', width: '150%', height: '150%' }, defs);
      svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '4', result: 'blur' }, flt);
      var mg = svgEl('feMerge', {}, flt);
      svgEl('feMergeNode', { in: 'blur' }, mg);
      svgEl('feMergeNode', { in: 'SourceGraphic' }, mg);

      var aflt = svgEl('filter', { id: 'accentGlow', x: '-40%', y: '-40%', width: '180%', height: '180%' }, defs);
      svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '6', result: 'blur' }, aflt);
      var amg = svgEl('feMerge', {}, aflt);
      svgEl('feMergeNode', { in: 'blur' }, amg);
      svgEl('feMergeNode', { in: 'SourceGraphic' }, amg);

      var pat = svgEl('pattern', { id: 'grid', width: '40', height: '40', patternUnits: 'userSpaceOnUse' }, defs);
      svgEl('path', { d: 'M40 0L0 0 0 40', fill: 'none', stroke: 'rgba(255,255,255,0.018)', 'stroke-width': '0.5' }, pat);

      var cg = svgEl('linearGradient', { id: 'curveGrad', x1: '0%', y1: '0%', x2: '100%', y2: '0%' }, defs);
      svgEl('stop', { offset: '0%',   'stop-color': '#818cf8' }, cg);
      svgEl('stop', { offset: '65%',  'stop-color': '#a78bfa' }, cg);
      svgEl('stop', { offset: '100%', 'stop-color': '#22c55e' }, cg);

      /* ── Background ── */
      svgEl('rect', { width: 800, height: 520, fill: '#0f0e17' }, svg);
      svgEl('rect', { width: 800, height: 520, fill: 'url(#grid)' }, svg);
      svgEl('rect', { width: 800, height: 520, fill: 'url(#bgGlow)' }, svg);

      /* Divider line between left and right panels */
      dividerLine = svgEl('line', {
        x1: 428, y1: 20, x2: 428, y2: 510,
        stroke: 'rgba(99,102,241,0.28)', 'stroke-width': 1, opacity: 0
      }, svg);

      /* ── Circle groups (largest drawn first so fills stack correctly) ── */
      var shadingG = svgEl('g', {}, svg);
      var strokeG  = svgEl('g', {}, svg);

      for (var r = 8; r >= 1; r--) {
        var cy_r = BY - r * S;
        var rad  = r * S;
        var circ = 2 * Math.PI * rad;

        circleFills[r] = svgEl('circle', {
          cx: CX, cy: cy_r, r: rad,
          fill: r % 2 === 0 ? ringColor(r / 2) : '#0f0e17',
          opacity: 0
        }, shadingG);

        circleStrokes[r] = svgEl('circle', {
          cx: CX, cy: cy_r, r: rad,
          fill: 'none', stroke: '#818cf8', 'stroke-width': 1.6,
          'stroke-dasharray': circ, 'stroke-dashoffset': circ, opacity: 0
        }, strokeG);
      }

      /* Common bottom point shared by all circles */
      commonDot = svgEl('circle', {
        cx: CX, cy: BY, r: 5,
        fill: '#f59e0b', filter: 'url(#accentGlow)', opacity: 0
      }, svg);

      /* Pre-created shaded ring overlays k=1..4 */
      for (var rr = 1; rr <= 4; rr++) {
        var outerR = 2 * rr, innerR = 2 * rr - 1;
        var ringG = svgEl('g', { opacity: 0 }, svg);
        svgEl('circle', { cx: CX, cy: BY - outerR*S, r: outerR*S, fill: 'rgba(245,158,11,0.5)', filter: 'url(#ringGlow)' }, ringG);
        svgEl('circle', { cx: CX, cy: BY - innerR*S, r: innerR*S, fill: '#0f0e17' }, ringG);
        svgEl('circle', { cx: CX, cy: BY - outerR*S, r: outerR*S, fill: 'none', stroke: '#f59e0b', 'stroke-width': 2.2 }, ringG);
        shadedRings[rr] = ringG;
      }

      /* Formula hint strip at bottom of left panel (briefly shown by fadeInFormula) */
      formulaG = svgEl('g', { opacity: 0 }, svg);
      svgEl('rect', { x: 8, y: 492, width: 410, height: 22, rx: 6,
        fill: 'rgba(15,14,23,0.85)', stroke: '#334155', 'stroke-width': 1 }, formulaG);
      fmlText = svgEl('text', {
        x: 18, y: 507,
        fill: '#818cf8', 'font-size': 13, 'font-family': 'Menlo, monospace', 'font-weight': 600
      }, formulaG);
      fmlText.textContent = 'A\u2096 = \u03c0(2k)\u00b2 \u2212 \u03c0(2k\u22121)\u00b2';

      /* ── Graph panel (right panel) ── */
      graphG = svgEl('g', { opacity: 0 }, svg);

      svgEl('rect', {
        x: 432, y: 28, width: 356, height: GR.h + GR.y0 - 28 + 18, rx: 14,
        fill: 'rgba(15,14,23,0.92)', stroke: '#334155', 'stroke-width': 1
      }, graphG);

      var gTitle = svgEl('text', {
        x: GR.x0 + GR.w / 2, y: 44,
        'text-anchor': 'middle', fill: '#94a3b8',
        'font-size': 10, 'font-family': 'system-ui', 'font-weight': 700, 'letter-spacing': '1.5px'
      }, graphG);
      gTitle.textContent = 'n(2n+1) vs n';

      /* Axes */
      svgEl('line', { x1: GR.x0, y1: GR.y0 + GR.h, x2: GR.x0 + GR.w, y2: GR.y0 + GR.h,
        stroke: 'rgba(255,255,255,0.25)', 'stroke-width': 1.2 }, graphG);
      svgEl('line', { x1: GR.x0, y1: GR.y0, x2: GR.x0, y2: GR.y0 + GR.h,
        stroke: 'rgba(255,255,255,0.25)', 'stroke-width': 1.2 }, graphG);

      var axX = svgEl('text', {
        x: GR.x0 + GR.w / 2, y: GR.y0 + GR.h + 20,
        'text-anchor': 'middle', fill: 'rgba(255,255,255,0.4)',
        'font-size': 10, 'font-family': 'system-ui'
      }, graphG);
      axX.textContent = 'n (rings)';

      var axY = svgEl('text', {
        x: GR.x0 - 30, y: GR.y0 + GR.h / 2,
        'text-anchor': 'middle', fill: 'rgba(255,255,255,0.4)',
        'font-size': 10, 'font-family': 'system-ui',
        transform: 'rotate(-90,' + (GR.x0 - 30) + ',' + (GR.y0 + GR.h / 2) + ')'
      }, graphG);
      axY.textContent = 'n(2n+1)';

      /* Y grid lines + labels */
      var yTicks = [1000, 2000, 3000, 4000, 5000];
      for (var yi = 0; yi < yTicks.length; yi++) {
        var yv = yTicks[yi];
        var gy = GR.sy(yv);
        svgEl('line', { x1: GR.x0, y1: gy, x2: GR.x0 + GR.w, y2: gy,
          stroke: 'rgba(255,255,255,0.06)', 'stroke-width': 0.8 }, graphG);
        var ylbl = svgEl('text', {
          x: GR.x0 - 5, y: gy + 4, 'text-anchor': 'end',
          fill: 'rgba(255,255,255,0.3)', 'font-size': 9, 'font-family': 'system-ui'
        }, graphG);
        ylbl.textContent = yv;
      }

      /* X tick labels */
      var xTicks = [10, 20, 30, 32, 40, 50];
      for (var xi = 0; xi < xTicks.length; xi++) {
        var xv = xTicks[xi];
        var gx2 = GR.sx(xv);
        if (gx2 > GR.x0 + GR.w - 3) continue;
        var xtl = svgEl('text', {
          x: gx2, y: GR.y0 + GR.h + 14, 'text-anchor': 'middle',
          fill: xv === 32 ? '#f59e0b' : 'rgba(255,255,255,0.28)',
          'font-size': 9, 'font-family': 'system-ui'
        }, graphG);
        xtl.textContent = xv;
      }

      /* Curve n(2n+1) */
      var pts = [];
      for (var n = 1; n <= 50; n++) {
        var nx = GR.sx(n);
        var ny = GR.sy(n * (2*n + 1));
        if (ny < GR.y0) ny = GR.y0;
        pts.push((n === 1 ? 'M' : 'L') + nx.toFixed(1) + ',' + ny.toFixed(1));
      }
      curvePath = svgEl('path', {
        d: pts.join(' '), fill: 'none',
        stroke: 'url(#curveGrad)', 'stroke-width': 2.5,
        'stroke-linecap': 'round', opacity: 0
      }, graphG);

      /* Threshold line at 2023 */
      var tY = GR.sy(2023);
      threshLine = svgEl('line', {
        x1: GR.x0, y1: tY, x2: GR.x0 + GR.w, y2: tY,
        stroke: '#f59e0b', 'stroke-width': 1.8, 'stroke-dasharray': '7,4', opacity: 0
      }, graphG);
      threshLabel = svgEl('text', {
        x: GR.x0 + GR.w - 4, y: tY - 6, 'text-anchor': 'end',
        fill: '#f59e0b', 'font-size': 10, 'font-family': 'system-ui', 'font-weight': 700, opacity: 0
      }, graphG);
      threshLabel.textContent = '2023';

      /* Static intersection markers at n=32 */
      var iX = GR.sx(32);
      var iY = GR.sy(32 * 65);  /* 32*(2*32+1)=32*65=2080 */
      intVLine = svgEl('line', {
        x1: iX, y1: GR.y0 + GR.h, x2: iX, y2: iY,
        stroke: '#22c55e', 'stroke-width': 1.5, 'stroke-dasharray': '5,3', opacity: 0
      }, graphG);
      intHLine = svgEl('line', {
        x1: GR.x0, y1: iY, x2: iX, y2: iY,
        stroke: '#22c55e', 'stroke-width': 1.5, 'stroke-dasharray': '5,3', opacity: 0
      }, graphG);
      intDot = svgEl('circle', {
        cx: iX, cy: iY, r: 7, fill: '#22c55e', filter: 'url(#accentGlow)', opacity: 0
      }, graphG);

      /* Answer badge */
      var bx = iX + 10;
      if (bx + 162 > GR.x0 + GR.w) bx = iX - 166;
      var by2 = iY - 48;
      if (by2 < GR.y0 + 4) by2 = GR.y0 + 4;
      intBadge = svgEl('g', { opacity: 0 }, graphG);
      svgEl('rect', {
        x: bx - 4, y: by2 - 16, width: 162, height: 44, rx: 8,
        fill: 'rgba(34,197,94,0.13)', stroke: '#22c55e', 'stroke-width': 1
      }, intBadge);
      var bt1 = svgEl('text', {
        x: bx + 2, y: by2,
        fill: '#22c55e', 'font-size': 11, 'font-family': 'system-ui', 'font-weight': 700
      }, intBadge);
      bt1.textContent = 'n=32: 2080 \u2265 2023 \u2713';
      var bt2 = svgEl('text', {
        x: bx + 2, y: by2 + 16,
        fill: '#4ade80', 'font-size': 11, 'font-family': 'system-ui'
      }, intBadge);
      bt2.textContent = '\u21d2 2n = 64 circles';

      /* Dynamic graph indicator (moves with slider) — starts at n=32 */
      sliderVLine = svgEl('line', {
        x1: GR.sx(32), y1: GR.y0 + GR.h, x2: GR.sx(32), y2: GR.sy(2080),
        stroke: '#22c55e', 'stroke-width': 1.5, 'stroke-dasharray': '4,3', opacity: 0
      }, graphG);
      sliderDot = svgEl('circle', {
        cx: GR.sx(32), cy: GR.sy(2080), r: 8,
        fill: '#22c55e', filter: 'url(#accentGlow)', opacity: 0
      }, graphG);

      /* ── Interactive slider ── */
      interG = svgEl('g', { opacity: 0 }, svg);

      /* Panel background */
      svgEl('rect', {
        x: 432, y: SL.y - 5, width: 356, height: 95, rx: 12,
        fill: 'rgba(15,14,23,0.92)', stroke: '#334155', 'stroke-width': 1
      }, interG);

      var sLbl = svgEl('text', {
        x: SL.x, y: SL.y + 13,
        fill: '#94a3b8', 'font-size': 10, 'font-family': 'system-ui',
        'font-weight': 700, 'letter-spacing': '1.5px'
      }, interG);
      sLbl.textContent = 'EXPLORE: DRAG TO CHANGE n';

      /* Track */
      svgEl('rect', {
        x: SL.x, y: SL.trackY - 3, width: SL.w, height: 6, rx: 3,
        fill: '#1e293b', stroke: '#334155', 'stroke-width': 1
      }, interG);

      /* Fill (dynamic width) */
      sliderFill = svgEl('rect', {
        x: SL.x, y: SL.trackY - 3, width: SL.w * 0.62, height: 6, rx: 3, fill: '#6366f1'
      }, interG);

      /* Thumb */
      sliderThumb = svgEl('circle', {
        cx: SL.x + SL.w * 0.62, cy: SL.trackY, r: 10,
        fill: '#f59e0b', stroke: '#fef3c7', 'stroke-width': 2,
        cursor: 'grab', filter: 'url(#accentGlow)'
      }, interG);

      /* Value label */
      sliderValEl = svgEl('text', {
        x: SL.x + SL.w + 16, y: SL.trackY + 5,
        'text-anchor': 'start', fill: '#fbbf24',
        'font-size': 13, 'font-family': 'Menlo, monospace', 'font-weight': 700
      }, interG);
      sliderValEl.textContent = 'n = 32';

      /* Area result */
      sliderAreaEl = svgEl('text', {
        x: SL.x, y: SL.trackY + 24,
        fill: '#22c55e', 'font-size': 12, 'font-family': 'Menlo, monospace'
      }, interG);
      sliderAreaEl.textContent = '32\u00d765 = 2080 \u2265 2023 \u2713';

      /* ── Drag handlers ── */
      function onDragStart(e) {
        dragging = true;
        sliderThumb.setAttribute('cursor', 'grabbing');
        e.preventDefault();
      }
      function onDragMove(e) {
        if (!dragging) return;
        var rect = svg.getBoundingClientRect();
        var scaleX = 800 / rect.width;
        var clientX = (e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0));
        var svgX = (clientX - rect.left) * scaleX;
        var frac = Math.max(0, Math.min(1, (svgX - SL.x) / SL.w));
        var n = Math.round(SL.minN + frac * (SL.maxN - SL.minN));
        updateSlider(n);
      }
      function onDragEnd() { dragging = false; sliderThumb.setAttribute('cursor', 'grab'); }

      sliderThumb.addEventListener('mousedown', onDragStart);
      sliderThumb.addEventListener('touchstart', onDragStart, { passive: false });
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);
      document.addEventListener('touchmove', onDragMove, { passive: true });
      document.addEventListener('touchend', onDragEnd);

      updateSlider(32);
    },

    getElements: function() {
      return { circleStrokes: circleStrokes, circleFills: circleFills, shadedRings: shadedRings };
    },

    timelineAction: function(tl, method, params, t) {
      switch (method) {

        case 'drawCircle': {
          var r = params.radius || params.r || 1;
          if (r < 1 || r > 8) break;
          var circ2 = 2 * Math.PI * r * S;

          tl.to(circleStrokes[r], { opacity: 0.9, duration: 0.1 }, t);
          tl.to(circleStrokes[r], { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, t + 0.05);
          tl.to(circleFills[r],   { opacity: 1, duration: 0.5, ease: 'power2.out' }, t + 0.7);

          if (r === 1) {
            tl.to(dividerLine, { opacity: 1, duration: 0.7, ease: 'power2.out' }, t + 0.4);
            tl.to(commonDot,   { opacity: 1, duration: 0.4, ease: 'back.out(2)' }, t + 0.5);
          }
          break;
        }

        case 'highlightShadedArea': {
          var r1 = params.r1, r2 = params.r2;
          var kk = Math.ceil(r2 / 2);
          if (kk < 1 || kk > 4) break;

          for (var ri = 1; ri <= 8; ri++) {
            if (ri !== r1 && ri !== r2) {
              tl.to(circleFills[ri],   { opacity: 0.09, duration: 0.35 }, t);
              tl.to(circleStrokes[ri], { opacity: 0.14, duration: 0.35 }, t);
            }
          }
          tl.to(circleStrokes[r1], { attr: { stroke: '#f59e0b', 'stroke-width': 2.8 }, duration: 0.3 }, t + 0.15);
          tl.to(circleStrokes[r2], { attr: { stroke: '#f59e0b', 'stroke-width': 2.8 }, duration: 0.3 }, t + 0.25);
          tl.to(shadedRings[kk],   { opacity: 1, duration: 0.5, ease: 'back.out(1.5)' }, t + 0.4);
          break;
        }

        case 'fadeInFormula': {
          tl.to(formulaG, { opacity: 1, duration: 0.4, ease: 'power2.out'  }, t);
          tl.to(formulaG, { opacity: 0, duration: 0.4, ease: 'power2.in'   }, t + 3.5);
          break;
        }

        case 'drawGraph': {
          tl.to(graphG, { opacity: 1, duration: 0.5, ease: 'power2.out' }, t);
          tl.call(function() {
            try {
              var len = curvePath.getTotalLength ? curvePath.getTotalLength() : 600;
              curvePath.setAttribute('stroke-dasharray', len);
              curvePath.setAttribute('stroke-dashoffset', len);
            } catch(e) {}
          }, null, t + 0.3);
          tl.to(curvePath,    { strokeDashoffset: 0, opacity: 1, duration: 2.0, ease: 'power2.inOut' }, t + 0.4);
          tl.to(threshLine,   { opacity: 1, duration: 0.5 }, t + 1.8);
          tl.to(threshLabel,  { opacity: 1, duration: 0.4 }, t + 2.1);
          /* Show dynamic indicator */
          tl.to(sliderVLine,  { opacity: 0.7, duration: 0.4 }, t + 2.3);
          tl.to(sliderDot,    { opacity: 1, duration: 0.4, ease: 'back.out(2)' }, t + 2.5);
          tl.to(interG,       { opacity: 1, duration: 0.5 }, t + 2.7);
          break;
        }

        case 'highlightIntersection': {
          tl.to(intVLine, { opacity: 1, duration: 0.5 }, t);
          tl.to(intHLine, { opacity: 1, duration: 0.5 }, t + 0.15);
          tl.to(intDot,   { opacity: 1, duration: 0.4, ease: 'back.out(3)' }, t + 0.4);
          tl.to(intDot,   { attr: { r: 12 }, duration: 0.2 }, t + 0.7);
          tl.to(intDot,   { attr: { r: 7  }, duration: 0.3, ease: 'power2.inOut' }, t + 0.9);
          tl.to(intBadge, { opacity: 1, duration: 0.5, ease: 'back.out(1.8)' }, t + 0.8);
          tl.to(threshLine, { attr: { stroke: '#fbbf24', 'stroke-width': 2.5 }, duration: 0.25 }, t + 0.3);
          tl.to(threshLine, { attr: { stroke: '#f59e0b', 'stroke-width': 1.8 }, duration: 0.5  }, t + 1.1);
          break;
        }

        default: break;
      }
    },

    executeAction: function(actionDef, tl, t) {
      this.timelineAction(tl, actionDef.method || actionDef.vizAction, actionDef.params || {}, t);
    }
  };
})();
