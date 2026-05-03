window.EXPLAINER_VIZ = (function() {
  var svg, config;
  var fills = {}, strokes = {}, rLab = {}, kLab = {};
  var fG, sG, lG, annotG;
  var cDot, cLabel;
  
  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  return {
    name: 'nested_circles',

    init: function(svgElement, vizConfig) {
      svg = svgElement;
      config = vizConfig;
      var CX = config.cx, BY = config.baseY, S = config.scale;
      var N = config.circleCount;
      var DARK = config.darkColor;
      var SC = config.strokeColor;

      /* Background */
      svgEl('rect', { width: '500', height: '500', fill: DARK }, svg);

      /* Groups */
      fG = svgEl('g', {}, svg);
      sG = svgEl('g', {}, svg);
      lG = svgEl('g', {}, svg);
      annotG = svgEl('g', {}, svg);

      /* Common point */
      cDot = svgEl('circle', { cx: CX, cy: BY, r: '5', fill: '#f59e0b', opacity: '0' }, svg);
      cLabel = svgEl('text', {
        x: CX, y: BY + 20, 'text-anchor': 'middle',
        fill: 'rgba(255,255,255,0.5)', 'font-size': '10', opacity: '0', 'font-family': 'system-ui'
      }, svg);
      cLabel.textContent = 'common point';

      /* Filled circles */
      for (var r = N; r >= 1; r--) {
        fills[r] = svgEl('circle', {
          cx: CX, cy: BY - r * S, r: r * S,
          fill: r % 2 === 0 ? 'rgba(99,102,241,0.55)' : DARK,
          opacity: '0'
        }, fG);
      }

      /* Stroke circles + labels */
      for (var r = 1; r <= N; r++) {
        var ci = 2 * Math.PI * r * S;
        strokes[r] = svgEl('circle', {
          cx: CX, cy: BY - r * S, r: r * S,
          fill: 'none', stroke: SC, 'stroke-width': '1.5',
          'stroke-dasharray': ci, 'stroke-dashoffset': ci,
          opacity: '0.7',
          transform: 'rotate(90 ' + CX + ' ' + (BY - r * S) + ')'
        }, sG);

        rLab[r] = svgEl('text', {
          x: CX + r * S + 12, y: BY - r * S,
          'text-anchor': 'start', 'dominant-baseline': 'central',
          fill: 'rgba(255,255,255,0.5)', 'font-size': '11', opacity: '0',
          'font-family': 'system-ui'
        }, lG);
        rLab[r].textContent = 'r = ' + r;
      }

      /* K labels */
      var kCount = Math.floor(N / 2);
      for (var k = 1; k <= kCount; k++) {
        var midY = BY - (4 * k - 1) * S / 2;
        kLab[k] = svgEl('text', {
          x: CX, y: midY, 'text-anchor': 'middle', 'dominant-baseline': 'central',
          fill: '#e0e7ff', 'font-size': '13', 'font-weight': '700', opacity: '0',
          'font-family': 'system-ui'
        }, lG);
        kLab[k].textContent = 'k = ' + k;
      }
    },

    timelineAction: function(tl, method, params, t) {
      var CX = config.cx, BY = config.baseY, S = config.scale;
      var N = config.circleCount;

      switch(method) {
        case 'drawCircle': {
          var r = params.radius;
          tl.to(strokes[r], { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' }, t);
          tl.to(fills[r], { opacity: 1, duration: 0.5 }, t + 1.0);
          tl.to(rLab[r], { opacity: 1, duration: 0.3 }, t + 0.3);
          if (r % 2 === 0) {
            var k = r / 2;
            tl.to(kLab[k], { opacity: 1, duration: 0.35 }, t + 1.3);
          }
          break;
        }

        case 'highlightShadedArea': {
          var r1 = params.r1, r2 = params.r2;
          tl.to(fills[r2], { attr: { fill: 'rgba(245,158,11,0.55)' }, duration: 0.5 }, t);
          tl.to(strokes[r1], { attr: { stroke: '#f59e0b' }, duration: 0.4 }, t);
          tl.to(strokes[r2], { attr: { stroke: '#f59e0b' }, duration: 0.4 }, t + 0.1);
          break;
        }

        case 'fadeInFormula': {
          var formula = svgEl('text', {
            x: CX, y: 50, 'text-anchor': 'middle',
            fill: '#e0e7ff', 'font-size': '16', 'font-weight': '700',
            'font-family': 'system-ui', opacity: '0'
          }, annotG);
          formula.textContent = params.formula || '';
          tl.to(formula, { opacity: 1, y: '-=4', duration: 0.6, ease: 'power2.out' }, t);
          break;
        }

        case 'drawGraph': {
          var graphGroup = svgEl('g', { opacity: '0' }, svg);
          
          /* Graph axes */
          svgEl('line', {
            x1: 100, y1: 400, x2: 400, y2: 400,
            stroke: '#818cf8', 'stroke-width': '1.5'
          }, graphGroup);
          svgEl('line', {
            x1: 100, y1: 100, x2: 100, y2: 400,
            stroke: '#818cf8', 'stroke-width': '1.5'
          }, graphGroup);
          
          /* Graph curve */
          var path = svgEl('path', {
            d: 'M100,400',
            fill: 'none', stroke: '#f59e0b', 'stroke-width': '2'
          }, graphGroup);
          
          /* Equation label */
          var eqLabel = svgEl('text', {
            x: 250, y: 50, 'text-anchor': 'middle',
            fill: '#e0e7ff', 'font-size': '14', 'font-weight': '700',
            'font-family': 'system-ui'
          }, graphGroup);
          eqLabel.textContent = params.equation || '';
          
          tl.to(graphGroup, { opacity: 1, duration: 0.8 }, t);
          break;
        }

        case 'highlightIntersection': {
          var x = params.x;
          var dot = svgEl('circle', {
            cx: 100 + (300 * x / 100), cy: 400 - (300 * 2023 / 3200),
            r: '6', fill: '#f59e0b', opacity: '0'
          }, svg);
          tl.to(dot, { opacity: 1, duration: 0.5, ease: 'back.out(2)' }, t);
          break;
        }
      }
    },

    executeAction: function(actionDef, tl, t) {
      this.timelineAction(tl, actionDef.method, actionDef.params || {}, t);
    }
  };
})();