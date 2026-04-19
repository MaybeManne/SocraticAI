window.EXPLAINER_VIZ = (function() {
  var svg, config;
  var archerG, arrowG, vectorG, trajectoryG, equationG, graphG, measureG;
  var archer, arrow, trajectoryPath, groundLine;
  var vxVector, vyVector, initialVector;
  var timeMarkers = {};
  var isPlaying = false;
  var currentTime = 0;
  var physics = {};
  var sliderG, sliderThumb, sliderLabel, sliderRangeLabel, sliderSpeed;
  var livePath, liveArrow, liveTrail, liveHideTimer;
  var baseSpeed = 40;

  // Layout zones — non-overlapping rectangles, viewBox 800×400.
  // Trajectory scene occupies bottom half (y=190-400); overlay panels sit above/right.
  var Z = {
    SLIDER: { x: 510, y:  10, w: 280, h: 120 },   // angle slider
    EQN:    { x: 510, y: 140, w: 280, h:  60 },   // current key formula
    CALC:   { x: 510, y: 210, w: 280, h: 185 },   // derivation steps
  };
  var slots = {};  // slotId -> SVG group, cleared before reuse

  function clearSlot(slotId) {
    if (slots[slotId] && slots[slotId].parentNode) {
      slots[slotId].parentNode.removeChild(slots[slotId]);
    }
    slots[slotId] = null;
  }

  function panelBg(parent, zone) {
    svgEl("rect", {
      x: zone.x, y: zone.y, width: zone.w, height: zone.h, rx: "8",
      fill: "rgba(15,14,23,0.82)", stroke: "#334155", "stroke-width": "1"
    }, parent);
  }

  function rebuildLiveTrajectory() {
    if (!livePath) return;
    var origin = config.coordinateSystem.origin;
    var flightTime = getFlightTime();
    var d = "M " + origin[0] + " " + (origin[1] - 10);
    for (var i = 0; i <= 80; i++) {
      var time = (i / 80) * flightTime;
      var pos = calculateTrajectory(time);
      var s = worldToSvg(pos.x, pos.y);
      d += " L " + s.x + " " + s.y;
    }
    livePath.setAttribute("d", d);
    if (sliderRangeLabel) sliderRangeLabel.textContent = "Range: " + getRange().toFixed(1) + " m";
  }

  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // Coordinate system helpers
  function worldToSvg(x, y) {
    var origin = config.coordinateSystem.origin;
    var xScale = config.coordinateSystem.xScale;
    var yScale = config.coordinateSystem.yScale;
    return {
      x: origin[0] + x * xScale,
      y: origin[1] - y * yScale
    };
  }

  // Physics calculations
  function calculateTrajectory(t) {
    var v0x = physics.v0x || 34.64;
    var v0y = physics.v0y || 20;
    var g = physics.gravity || 9.8;
    
    return {
      x: v0x * t,
      y: v0y * t - 0.5 * g * t * t,
      vx: v0x,
      vy: v0y - g * t
    };
  }

  function getFlightTime() {
    var v0y = physics.v0y || 20;
    var g = physics.gravity || 9.8;
    return (2 * v0y) / g; // Time when y = 0
  }

  function getRange() {
    var v0x = physics.v0x || 34.64;
    return v0x * getFlightTime();
  }

  return {
    name: "archery_projectile",

    init: function(svgElement, vizConfig) {
      svg = svgElement;
      config = vizConfig;
      var origin = config.coordinateSystem.origin;

      // Initialize physics
      physics = {
        v0x: 34.64, // 40 * cos(30°)
        v0y: 20,    // 40 * sin(30°)
        gravity: config.gravity
      };

      // Create defs for filters and patterns
      var defs = svgEl("defs", {}, svg);
      
      // Glow filter
      var glowFilter = svgEl("filter", { 
        id: "glow", x: "-50%", y: "-50%", width: "200%", height: "200%" 
      }, defs);
      svgEl("feGaussianBlur", { 
        in: "SourceGraphic", stdDeviation: "3", result: "blur" 
      }, glowFilter);
      var feMerge = svgEl("feMerge", {}, glowFilter);
      svgEl("feMergeNode", { in: "blur" }, feMerge);
      svgEl("feMergeNode", { in: "SourceGraphic" }, feMerge);

      // Arrow marker
      var arrowMarker = svgEl("marker", {
        id: "arrowhead", viewBox: "0 0 10 10", refX: "8", refY: "3",
        markerWidth: "6", markerHeight: "6", orient: "auto"
      }, defs);
      svgEl("path", { 
        d: "M0,0 L0,6 L9,3 z", fill: "#f59e0b" 
      }, arrowMarker);

      // Background
      svgEl("rect", { 
        width: "800", height: "400", fill: "#0f0e17" 
      }, svg);

      // Coordinate axes
      var axesG = svgEl("g", { id: "axes", opacity: "0.6" }, svg);
      
      // X-axis
      svgEl("line", {
        x1: origin[0], y1: origin[1],
        x2: origin[0] + 180 * config.coordinateSystem.xScale, y2: origin[1],
        stroke: "#334155", "stroke-width": "1"
      }, axesG);
      
      // Y-axis  
      svgEl("line", {
        x1: origin[0], y1: origin[1],
        x2: origin[0], y2: origin[1] - 50 * config.coordinateSystem.yScale,
        stroke: "#334155", "stroke-width": "1"
      }, axesG);

      // Grid
      for (var x = 0; x <= 180; x += 20) {
        var pos = worldToSvg(x, 0);
        svgEl("line", {
          x1: pos.x, y1: origin[1],
          x2: pos.x, y2: origin[1] - 50 * config.coordinateSystem.yScale,
          stroke: "rgba(255,255,255,0.05)", "stroke-width": "0.5"
        }, axesG);
      }
      
      for (var y = 0; y <= 50; y += 10) {
        var pos = worldToSvg(0, y);
        svgEl("line", {
          x1: origin[0], y1: pos.y,
          x2: origin[0] + 180 * config.coordinateSystem.xScale, y2: pos.y,
          stroke: "rgba(255,255,255,0.05)", "stroke-width": "0.5"
        }, axesG);
      }

      // Ground line (emphasized y=0)
      groundLine = svgEl("line", {
        x1: origin[0], y1: origin[1],
        x2: origin[0] + 180 * config.coordinateSystem.xScale, y2: origin[1],
        stroke: "#818cf8", "stroke-width": "2", opacity: "0"
      }, svg);

      // Create groups
      archerG = svgEl("g", { id: "archer", opacity: "0" }, svg);
      arrowG = svgEl("g", { id: "arrow", opacity: "0" }, svg);
      vectorG = svgEl("g", { id: "vectors", opacity: "0" }, svg);
      trajectoryG = svgEl("g", { id: "trajectory", opacity: "0" }, svg);
      equationG = svgEl("g", { id: "equations", opacity: "0" }, svg);
      graphG = svgEl("g", { id: "graphs", opacity: "0" }, svg);
      measureG = svgEl("g", { id: "measurements", opacity: "0" }, svg);

      // Archer figure
      var archerPos = worldToSvg(0, 0);
      archer = svgEl("g", { transform: "translate(" + archerPos.x + "," + archerPos.y + ")" }, archerG);
      
      // Simple archer representation
      svgEl("circle", { cx: "0", cy: "-15", r: "4", fill: "#e2e8f0" }, archer);
      svgEl("rect", { x: "-3", y: "-11", width: "6", height: "12", fill: "#818cf8" }, archer);
      svgEl("line", { x1: "0", y1: "1", x2: "-8", y2: "-8", stroke: "#fbbf24", "stroke-width": "3" }, archer);

      // Arrow (initially at archer position)
      arrow = svgEl("circle", { 
        cx: archerPos.x, cy: archerPos.y - 10, r: "3", 
        fill: "#f59e0b", filter: "url(#glow)", opacity: "0" 
      }, arrowG);

      // Initial velocity vector
      initialVector = svgEl("line", {
        x1: archerPos.x, y1: archerPos.y - 10,
        x2: archerPos.x, y2: archerPos.y - 10,
        stroke: "#f59e0b", "stroke-width": "3",
        "marker-end": "url(#arrowhead)", opacity: "0"
      }, vectorG);

      // Component vectors
      vxVector = svgEl("line", {
        x1: archerPos.x, y1: archerPos.y - 10,
        x2: archerPos.x, y2: archerPos.y - 10,
        stroke: "#22c55e", "stroke-width": "2",
        "marker-end": "url(#arrowhead)", opacity: "0"
      }, vectorG);

      vyVector = svgEl("line", {
        x1: archerPos.x, y1: archerPos.y - 10,
        x2: archerPos.x, y2: archerPos.y - 10,
        stroke: "#3b82f6", "stroke-width": "2",
        "marker-end": "url(#arrowhead)", opacity: "0"
      }, vectorG);

      // Trajectory path
      trajectoryPath = svgEl("path", {
        d: "", fill: "none", stroke: "#818cf8", "stroke-width": "2",
        "stroke-dasharray": "200", "stroke-dashoffset": "200", opacity: "0"
      }, trajectoryG);
    },

    timelineAction: function(tl, method, params, t) {
      var origin = config.coordinateSystem.origin;
      
      switch (method) {
        case "createArcher":
          tl.to(archerG, { opacity: 1, duration: 0.8, ease: "power2.out" }, t);
          break;

        case "drawInitialVelocity":
          var angle = params.angle * Math.PI / 180;
          var magnitude = params.magnitude;
          var scale = 3; // Visual scaling for vector
          var endX = origin[0] + magnitude * Math.cos(angle) * scale;
          var endY = origin[1] - 10 - magnitude * Math.sin(angle) * scale;
          
          tl.to(initialVector, { 
            attr: { x2: endX, y2: endY }, 
            opacity: 1, duration: 1.0, ease: "power2.out" 
          }, t);
          break;

        case "splitVelocityVector":
          var duration = params.animationDuration || 2.0;
          var vx = params.horizontal;
          var vy = params.vertical;
          var scale = 3;
          
          // Horizontal component
          tl.to(vxVector, {
            attr: { 
              x2: origin[0] + vx * scale,
              y2: origin[1] - 10
            },
            opacity: 1, duration: duration * 0.4, ease: "power2.out"
          }, t);
          
          // Vertical component
          tl.to(vyVector, {
            attr: { 
              x1: origin[0] + vx * scale,
              y1: origin[1] - 10,
              x2: origin[0] + vx * scale,
              y2: origin[1] - 10 - vy * scale
            },
            opacity: 1, duration: duration * 0.4, ease: "power2.out"
          }, t + duration * 0.3);
          
          // Fade initial vector
          tl.to(initialVector, { 
            opacity: 0.3, duration: duration * 0.2 
          }, t + duration * 0.5);
          break;

        case "launchArrow":
          physics.v0x = params.v0x;
          physics.v0y = params.v0y;
          physics.gravity = params.gravity;
          isPlaying = true;
          currentTime = 0;
          
          tl.to(arrow, { opacity: 1, duration: 0.3 }, t);
          
          // Animate arrow along trajectory
          var flightTime = getFlightTime();
          tl.to({}, {
            duration: flightTime,
            ease: "none",
            onUpdate: function() {
              if (!isPlaying) return;
              currentTime = this.progress() * flightTime;
              var pos = calculateTrajectory(currentTime);
              var svgPos = worldToSvg(pos.x, pos.y);
              arrow.setAttribute("cx", svgPos.x);
              arrow.setAttribute("cy", svgPos.y);
            }
          }, t);
          break;

        case "drawTrajectoryPath":
          var flightTime = getFlightTime();
          var pathData = "M " + origin[0] + " " + (origin[1] - 10);
          
          for (var i = 0; i <= 100; i++) {
            var time = (i / 100) * flightTime;
            var pos = calculateTrajectory(time);
            var svgPos = worldToSvg(pos.x, pos.y);
            pathData += " L " + svgPos.x + " " + svgPos.y;
          }
          
          trajectoryPath.setAttribute("d", pathData);
          
          if (params.realTime) {
            tl.to(trajectoryPath, {
              opacity: 1,
              strokeDashoffset: 0,
              duration: flightTime,
              ease: "none"
            }, t);
          } else {
            tl.to(trajectoryPath, {
              opacity: 1,
              strokeDashoffset: 0,
              duration: 1.5,
              ease: "power2.out"
            }, t);
          }
          break;

        case "updateVelocityComponents":
          var time = params.time === "dynamic" ? currentTime : params.time;
          var pos = calculateTrajectory(time);
          var scale = 3;
          
          if (params.showVectors) {
            var arrowPos = worldToSvg(pos.x, pos.y);
            
            // Update horizontal vector (constant)
            tl.to(vxVector, {
              attr: {
                x1: arrowPos.x,
                y1: arrowPos.y,
                x2: arrowPos.x + pos.vx * scale,
                y2: arrowPos.y
              },
              duration: 0.3
            }, t);
            
            // Update vertical vector (changes with time)
            tl.to(vyVector, {
              attr: {
                x1: arrowPos.x,
                y1: arrowPos.y,
                x2: arrowPos.x,
                y2: arrowPos.y - pos.vy * scale
              },
              duration: 0.3
            }, t);
          }
          break;

        case "highlightComponent":
          var component = params.component;
          var intensity = params.intensity || 1.0;
          
          if (component === "horizontal") {
            tl.to(vxVector, {
              attr: { "stroke-width": 4 * intensity, stroke: "#22c55e" },
              filter: "url(#glow)",
              duration: 0.4
            }, t);
          } else if (component === "vertical") {
            tl.to(vyVector, {
              attr: { "stroke-width": 4 * intensity, stroke: "#3b82f6" },
              filter: "url(#glow)",
              duration: 0.4
            }, t);
          }
          break;

        case "isolateMotion":
          var motionType = params.motionType;
          var dimOpacity = params.dimOpacity || 0.3;
          
          if (motionType === "horizontal") {
            tl.to(vyVector, { opacity: dimOpacity, duration: 0.5 }, t);
            tl.to(vxVector, { opacity: 1, duration: 0.5 }, t);
          } else if (motionType === "vertical") {
            tl.to(vxVector, { opacity: dimOpacity, duration: 0.5 }, t);
            tl.to(vyVector, { opacity: 1, duration: 0.5 }, t);
          }
          break;

        case "showEquation":
          clearSlot("eqn");
          var eqZone = Z.EQN;
          var eqG = svgEl("g", { opacity: "0" }, equationG);
          slots["eqn"] = eqG;
          panelBg(eqG, eqZone);
          var eqLabel = svgEl("text", {
            x: eqZone.x + 12, y: eqZone.y + 18,
            fill: "#94a3b8", "font-size": "10",
            "font-family": "system-ui", "font-weight": "600",
            "letter-spacing": "0.08em"
          }, eqG);
          eqLabel.textContent = "EQUATION";
          var eqText = svgEl("text", {
            x: eqZone.x + 12, y: eqZone.y + 44,
            fill: "#f1f5f9", "font-size": "15",
            "font-family": "system-ui", "font-weight": "600"
          }, eqG);
          var eqMap = {
            "trigComponents": "vₓ = v₀cos(θ),  vᵧ = v₀sin(θ)",
            "range_formula":  "R = v₀² sin(2θ) / g",
            "x = 34.6t":      "x(t) = 34.6 · t",
            "y = 20t - 4.9t²":"y(t) = 20t − 4.9t²",
            "Range = v_x \\times t_{flight}": "Range = vₓ · t_flight",
            "t_peak = v_0y/g":"t_peak = v₀ᵧ / g"
          };
          eqText.textContent = eqMap[params.equation] || params.equation;
          tl.to(eqG, { opacity: 1, duration: 0.5, ease: "power2.out" }, t);
          tl.to(equationG, { opacity: 1, duration: 0.1 }, t);
          break;

        case "animateCalculation":
          clearSlot("calc");
          var calcZone = Z.CALC;
          var calcG = svgEl("g", { opacity: "1" }, equationG);
          slots["calc"] = calcG;
          panelBg(calcG, calcZone);
          svgEl("text", {
            x: calcZone.x + 12, y: calcZone.y + 22,
            fill: "#94a3b8", "font-size": "10",
            "font-family": "system-ui", "font-weight": "600",
            "letter-spacing": "0.08em"
          }, calcG).textContent = "DERIVATION";
          var rawSteps = Array.isArray(params.steps) ? params.steps : [];
          var stepLines = rawSteps.map(function(s) {
            if (typeof s === "string") return s;
            if (s && s.latex) return s.latex;
            return String(s);
          }).filter(function(s){ return s && s.length; });
          stepLines.forEach(function(step, i) {
            var line = svgEl("text", {
              x: calcZone.x + 14,
              y: calcZone.y + 52 + i * 28,
              fill: i === stepLines.length - 1 ? "#fbbf24" : "#e2e8f0",
              "font-size": "14", "font-family": "monospace",
              "font-weight": i === stepLines.length - 1 ? "700" : "500",
              opacity: "0"
            }, calcG);
            line.textContent = step
              .replace(/\\times/g, "×").replace(/\\cdot/g, "·")
              .replace(/\\approx/g, "≈").replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g,"$1/$2")
              .replace(/\\sqrt\{([^}]+)\}/g, "√($1)")
              .replace(/[\\{}]|\\text/g, "").replace(/\^2/g, "²").replace(/\^3/g, "³");
            tl.to(line, { opacity: 1, duration: 0.4, ease: "power2.out" },
                  t + i * 0.5);
          });
          break;

        case "createMotionGraph":
          clearSlot("calc");
          var gz = Z.CALC;
          var miniG = svgEl("g", { opacity: "0" }, graphG);
          slots["calc"] = miniG;
          panelBg(miniG, gz);
          svgEl("text", {
            x: gz.x + 12, y: gz.y + 22,
            fill: "#94a3b8", "font-size": "10",
            "font-family": "system-ui", "font-weight": "600",
            "letter-spacing": "0.08em"
          }, miniG).textContent =
            (params.type || "motion").toUpperCase() + " — " + (params.axis || "");
          var plotX = gz.x + 24, plotY = gz.y + 42;
          var plotW = gz.w - 40, plotH = gz.h - 60;
          svgEl("line", {
            x1: plotX, y1: plotY + plotH, x2: plotX + plotW, y2: plotY + plotH,
            stroke: "#475569", "stroke-width": "1"
          }, miniG);
          svgEl("line", {
            x1: plotX, y1: plotY, x2: plotX, y2: plotY + plotH,
            stroke: "#475569", "stroke-width": "1"
          }, miniG);
          var axisType = (params.axis || "vertical").toLowerCase();
          var flightT = getFlightTime();
          var curveD = "";
          for (var gi = 0; gi <= 60; gi++) {
            var gt = (gi / 60) * flightT;
            var gpos = calculateTrajectory(gt);
            var gv = axisType === "horizontal" ? gpos.vx : gpos.vy;
            var gMax = axisType === "horizontal" ? 40 : 22;
            var gMin = axisType === "horizontal" ? 0 : -22;
            var gRange = gMax - gMin;
            var px = plotX + (gi / 60) * plotW;
            var py = plotY + plotH - ((gv - gMin) / gRange) * plotH;
            curveD += (gi === 0 ? "M " : " L ") + px + " " + py;
          }
          svgEl("path", {
            d: curveD, fill: "none", stroke: "#818cf8", "stroke-width": "2"
          }, miniG);
          svgEl("text", {
            x: plotX, y: plotY + plotH + 14, fill: "#64748b", "font-size": "10",
            "font-family": "system-ui"
          }, miniG).textContent = "t=0";
          svgEl("text", {
            x: plotX + plotW - 18, y: plotY + plotH + 14,
            fill: "#64748b", "font-size": "10", "font-family": "system-ui"
          }, miniG).textContent = "t=" + flightT.toFixed(1) + "s";
          tl.to(miniG, { opacity: 1, duration: 0.7, ease: "power2.out" }, t);
          tl.to(graphG, { opacity: 1, duration: 0.1 }, t);
          break;

        case "measureDistance":
          var fromPos = params.from === "archer" ? worldToSvg(0, 0) : worldToSvg(getRange(), 0);
          var toPos = params.to === "landing" ? worldToSvg(getRange(), 0) : worldToSvg(0, 0);
          
          var measureLine = svgEl("line", {
            x1: fromPos.x, y1: fromPos.y + 20,
            x2: fromPos.x, y2: fromPos.y + 20,
            stroke: "#f59e0b", "stroke-width": "2",
            "stroke-dasharray": "5,5", opacity: "0"
          }, measureG);
          
          var measureLabel = svgEl("text", {
            x: (fromPos.x + toPos.x) / 2, y: fromPos.y + 40,
            "text-anchor": "middle", fill: "#fbbf24",
            "font-size": "14", "font-weight": "700", opacity: "0"
          }, measureG);
          measureLabel.textContent = params.label;
          
          tl.to(measureLine, { 
            attr: { x2: toPos.x },
            opacity: 1, duration: 1.0, ease: "power2.out" 
          }, t);
          tl.to(measureLabel, { 
            opacity: 1, duration: 0.5 
          }, t + 0.5);
          tl.to(measureG, { opacity: 1, duration: 0.1 }, t);
          break;

        case "markTimeInstant":
          var time = params.time;
          var event = params.event;
          var pos = calculateTrajectory(time);
          var svgPos = worldToSvg(pos.x, pos.y);
          
          var marker = svgEl("circle", {
            cx: svgPos.x, cy: svgPos.y, r: "6",
            fill: params.color || "#f59e0b",
            filter: "url(#glow)", opacity: "0"
          }, svg);
          
          tl.to(marker, { 
            opacity: 1, scale: 1.2, duration: 0.5, ease: "back.out(2)" 
          }, t);
          
          timeMarkers[event] = marker;
          break;

        case "pulseObject":
          var objectId = params.objectId;
          var intensity = params.intensity || 1.1;
          var duration = params.duration || 0.6;
          
          var target = objectId === "arrow" ? arrow : 
                      objectId === "trajectory_peak" ? timeMarkers.peak :
                      objectId === "ground_line" ? groundLine :
                      timeMarkers[objectId.replace("arrow_", "")] || arrow;
          
          if (target) {
            tl.to(target, { 
              scale: intensity, duration: duration * 0.4, ease: "power2.out" 
            }, t);
            tl.to(target, { 
              scale: 1, duration: duration * 0.6, ease: "power2.in" 
            }, t + duration * 0.4);
          }
          break;

        case "showGroundCondition":
          if (params.emphasis) {
            tl.to(groundLine, { 
              opacity: 1, 
              attr: { "stroke-width": "4", stroke: "#22c55e" },
              duration: 0.6 
            }, t);
          }
          break;

        case "celebrateResult":
          var pos = worldToSvg(getRange(), 0);
          
          // Burst effect
          for (var i = 0; i < 8; i++) {
            var angle = (i / 8) * 2 * Math.PI;
            var burstLine = svgEl("line", {
              x1: pos.x, y1: pos.y,
              x2: pos.x, y2: pos.y,
              stroke: "#fbbf24", "stroke-width": "3",
              "stroke-linecap": "round", opacity: "0"
            }, svg);
            
            tl.to(burstLine, {
              attr: {
                x2: pos.x + Math.cos(angle) * 30,
                y2: pos.y + Math.sin(angle) * 30
              },
              opacity: 1, duration: 0.3
            }, t);
            tl.to(burstLine, { opacity: 0, duration: 0.4 }, t + 0.6);
          }
          
          // Result text
          var resultText = svgEl("text", {
            x: pos.x, y: pos.y - 30, "text-anchor": "middle",
            fill: "#22c55e", "font-size": "18", "font-weight": "700",
            "font-family": "system-ui", opacity: "0"
          }, svg);
          resultText.textContent = params.value;
          
          tl.to(resultText, { 
            opacity: 1, scale: 1.2, duration: 0.6, ease: "back.out(2)" 
          }, t + 0.2);
          break;

        case "replayTrajectory":
          var speed = params.speed === "dramatic" ? 0.5 : (params.speed || 1.0);
          var flightTime = getFlightTime() / speed;
          
          // Reset arrow position
          arrow.setAttribute("cx", origin[0]);
          arrow.setAttribute("cy", origin[1] - 10);
          
          // Replay motion
          tl.to({}, {
            duration: flightTime,
            ease: "none",
            onUpdate: function() {
              var progress = this.progress();
              var time = progress * getFlightTime();
              var pos = calculateTrajectory(time);
              var svgPos = worldToSvg(pos.x, pos.y);
              arrow.setAttribute("cx", svgPos.x);
              arrow.setAttribute("cy", svgPos.y);
              
              if (params.showComponents) {
                // Update component vectors
                var scale = 3;
                vxVector.setAttribute("x1", svgPos.x);
                vxVector.setAttribute("y1", svgPos.y);
                vxVector.setAttribute("x2", svgPos.x + pos.vx * scale);
                vxVector.setAttribute("y2", svgPos.y);
                
                vyVector.setAttribute("x1", svgPos.x);
                vyVector.setAttribute("y1", svgPos.y);
                vyVector.setAttribute("x2", svgPos.x);
                vyVector.setAttribute("y2", svgPos.y - pos.vy * scale);
              }
            }
          }, t);
          break;

        case "addRealWorldScale":
          var scaleType = params.scaleType;
          
          if (scaleType === "football") {
            // Football field is ~100m, our range is ~141m
            var fieldLength = 100;
            var fieldPos = worldToSvg(fieldLength, 0);
            
            var fieldRect = svgEl("rect", {
              x: origin[0], y: origin[1] + 10,
              width: fieldLength * config.coordinateSystem.xScale, height: "15",
              fill: "rgba(34,197,94,0.2)", stroke: "#22c55e",
              "stroke-width": "1", opacity: "0"
            }, svg);
            
            var fieldLabel = svgEl("text", {
              x: origin[0] + (fieldLength * config.coordinateSystem.xScale) / 2,
              y: origin[1] + 40, "text-anchor": "middle",
              fill: "#22c55e", "font-size": "10", opacity: "0"
            }, svg);
            fieldLabel.textContent = "Football field (100m)";
            
            tl.to([fieldRect, fieldLabel], { 
              opacity: params.opacity || 0.7, duration: 0.8 
            }, t);
          }
          break;

        case "showAngleSlider":
          if (sliderG) { tl.to(sliderG, { opacity: 1, duration: 0.4 }, t); break; }
          clearSlot("calc");  // avoid overlap under slider zone if calc expands
          var panelX = Z.SLIDER.x, panelY = Z.SLIDER.y,
              panelW = Z.SLIDER.w, panelH = Z.SLIDER.h;
          sliderG = svgEl("g", { id: "angle-slider", opacity: "0" }, svg);
          svgEl("rect", {
            x: panelX, y: panelY, width: panelW, height: panelH, rx: "8",
            fill: "rgba(15,14,23,0.85)", stroke: "#6366f1", "stroke-width": "1"
          }, sliderG);
          sliderLabel = svgEl("text", {
            x: panelX + 12, y: panelY + 22, fill: "#e2e8f0",
            "font-size": "13", "font-family": "system-ui", "font-weight": "600"
          }, sliderG);
          sliderLabel.textContent = "Launch angle: 30°";
          sliderRangeLabel = svgEl("text", {
            x: panelX + 12, y: panelY + 96, fill: "#fbbf24",
            "font-size": "13", "font-family": "system-ui", "font-weight": "700"
          }, sliderG);
          sliderRangeLabel.textContent = "Range: " + getRange().toFixed(1) + " m";
          var trackX1 = panelX + 15, trackX2 = panelX + panelW - 15, trackY = panelY + 55;
          svgEl("line", {
            x1: trackX1, y1: trackY, x2: trackX2, y2: trackY,
            stroke: "#334155", "stroke-width": "4", "stroke-linecap": "round"
          }, sliderG);
          var initPct = 30 / 85;
          sliderThumb = svgEl("circle", {
            cx: trackX1 + initPct * (trackX2 - trackX1), cy: trackY, r: "9",
            fill: "#f59e0b", stroke: "#fbbf24", "stroke-width": "2",
            style: "cursor:grab", filter: "url(#glow)"
          }, sliderG);
          var dragging = false;
          function setFromEvent(ev) {
            var pt = svg.createSVGPoint();
            var touch = ev.touches ? ev.touches[0] : ev;
            pt.x = touch.clientX; pt.y = touch.clientY;
            var ctm = svg.getScreenCTM();
            if (!ctm) return;
            var loc = pt.matrixTransform(ctm.inverse());
            var pct = Math.max(0, Math.min(1, (loc.x - trackX1) / (trackX2 - trackX1)));
            var angle = 5 + pct * 80;
            var rad = angle * Math.PI / 180;
            physics.v0x = baseSpeed * Math.cos(rad);
            physics.v0y = baseSpeed * Math.sin(rad);
            sliderThumb.setAttribute("cx", trackX1 + pct * (trackX2 - trackX1));
            sliderLabel.textContent = "Launch angle: " + angle.toFixed(0) + "°";
            rebuildLiveTrajectory();
            if (livePath) {
              livePath.setAttribute("opacity", "0.9");
              if (liveHideTimer) clearTimeout(liveHideTimer);
              liveHideTimer = setTimeout(function() {
                if (!livePath) return;
                var fadeStart = Date.now();
                var fadeDur = 600;
                (function fade() {
                  var p = Math.min(1, (Date.now() - fadeStart) / fadeDur);
                  livePath.setAttribute("opacity", (0.9 * (1 - p)).toFixed(2));
                  if (p < 1) requestAnimationFrame(fade);
                })();
              }, 10000);
            }
          }
          sliderThumb.addEventListener("mousedown", function(e){ dragging = true; e.preventDefault(); });
          sliderThumb.addEventListener("touchstart", function(e){ dragging = true; e.preventDefault(); });
          window.addEventListener("mousemove", function(e){ if (dragging) setFromEvent(e); });
          window.addEventListener("touchmove", function(e){ if (dragging) setFromEvent(e); });
          window.addEventListener("mouseup", function(){ dragging = false; });
          window.addEventListener("touchend", function(){ dragging = false; });
          if (!livePath) {
            livePath = svgEl("path", {
              d: "", fill: "none", stroke: "#f59e0b", "stroke-width": "2.5",
              opacity: "0", filter: "url(#glow)"
            }, trajectoryG);
          }
          trajectoryG.setAttribute("opacity", "1");
          rebuildLiveTrajectory();
          tl.to(sliderG, { opacity: 1, duration: 0.6, ease: "power2.out" }, t);
          break;

        case "animateFlight":
          var origin2 = config.coordinateSystem.origin;
          var ft = getFlightTime();
          if (!liveArrow) {
            liveArrow = svgEl("circle", {
              cx: origin2[0], cy: origin2[1] - 10, r: "5",
              fill: "#fbbf24", filter: "url(#glow)"
            }, arrowG);
            liveTrail = svgEl("path", {
              d: "", fill: "none", stroke: "#fbbf24",
              "stroke-width": "2", opacity: "0.7"
            }, trajectoryG);
          }
          var trailD = "";
          tl.to({ p: 0 }, {
            p: 1, duration: ft, ease: "none",
            onUpdate: function() {
              var prog = this.targets()[0].p;
              var time = prog * ft;
              var pos = calculateTrajectory(time);
              var s = worldToSvg(pos.x, pos.y);
              liveArrow.setAttribute("cx", s.x);
              liveArrow.setAttribute("cy", s.y);
              trailD += (trailD ? " L " : "M ") + s.x + " " + s.y;
              liveTrail.setAttribute("d", trailD);
            }
          }, t);
          break;

        case "dimAllObjects":
          var opacity = params.opacity || 0.3;
          var excludeIds = params.excludeIds || [];
          
          var allGroups = [archerG, arrowG, vectorG, trajectoryG, equationG, graphG];
          allGroups.forEach(function(group) {
            if (excludeIds.indexOf(group.id) === -1) {
              tl.to(group, { opacity: opacity, duration: 0.5 }, t);
            }
          });
          break;
      }
    },

    executeAction: function(actionDef, tl, t) {
      this.timelineAction(tl, actionDef.method, actionDef.params, t);
    }
  };
})();