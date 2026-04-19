window.EXPLAINER_VIZ = (function() {
  var svg, config;
  var archerG, vectorG, splitG, trajectoryG, motionG, equationG, finalG, multiG;
  var arrow, positionDot, trail;
  var leftPanelG, rightPanelG, splitActive = false;
  var xGraph, yGraph, xGraphElements = [], yGraphElements = [];
  var velocityVector, vxVector, vyVector, velocityLabels = [];
  var equationElements = [], solutionSteps = [];
  var trajectoryPath, fullTrajectory;
  var timeOfFlightMarker, rangeMarker;
  var multiTrajectories = [], currentTrajectory = null;

  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // Physics calculations
  var g = 9.8;
  var v0 = 40;
  var angle = 30;
  var angleRad = angle * Math.PI / 180;
  var vx = v0 * Math.cos(angleRad);
  var vy = v0 * Math.sin(angleRad);
  var timeOfFlight = 2 * vy / g;
  var maxHeight = vy * vy / (2 * g);
  var range = vx * timeOfFlight;

  // Coordinate transformations
  function worldToSvg(x, y) {
    return {
      x: config.origin.x + x * config.scale.x,
      y: config.origin.y - y * config.scale.y
    };
  }

  function getTrajectoryPoint(t) {
    var x = vx * t;
    var y = vy * t - 0.5 * g * t * t;
    return worldToSvg(x, y);
  }

  return {
    name: "projectile_motion",

    init: function(svgElement, vizConfig) {
      svg = svgElement;
      config = vizConfig;

      // Background
      svgEl("rect", { width: "800", height: "400", fill: "#0f0e17" }, svg);
      
      // Grid pattern
      var defs = svgEl("defs", {}, svg);
      var gridPattern = svgEl("pattern", { 
        id: "grid", width: "20", height: "20", 
        patternUnits: "userSpaceOnUse" 
      }, defs);
      svgEl("path", { 
        d: "M20 0L0 0 0 20", 
        fill: "none", 
        stroke: "rgba(255,255,255,0.025)", 
        "stroke-width": "0.5" 
      }, gridPattern);

      // Glow filter
      var glowFilter = svgEl("filter", {
        id: "glow", x: "-20%", y: "-20%", width: "140%", height: "140%"
      }, defs);
      svgEl("feGaussianBlur", { 
        in: "SourceGraphic", stdDeviation: "3", result: "blur" 
      }, glowFilter);
      var merge = svgEl("feMerge", {}, glowFilter);
      svgEl("feMergeNode", { in: "blur" }, merge);
      svgEl("feMergeNode", { in: "SourceGraphic" }, merge);

      // Arrow marker
      var marker = svgEl("marker", {
        id: "arrowhead", viewBox: "0 0 10 10", refX: "8", refY: "3",
        markerWidth: "6", markerHeight: "6", orient: "auto"
      }, defs);
      svgEl("path", { 
        d: "M0,0 L0,6 L9,3 z", 
        fill: "#f59e0b" 
      }, marker);

      // Background grid
      svgEl("rect", { 
        width: "800", height: "400", 
        fill: "url(#grid)", 
        opacity: "0" 
      }, svg);

      // Coordinate axes
      var axes = svgEl("g", { opacity: "0.3" }, svg);
      svgEl("line", {
        x1: config.origin.x, y1: 0,
        x2: config.origin.x, y2: 400,
        stroke: "rgba(255,255,255,0.15)", "stroke-width": "1"
      }, axes);
      svgEl("line", {
        x1: 0, y1: config.origin.y,
        x2: 800, y2: config.origin.y,
        stroke: "rgba(255,255,255,0.15)", "stroke-width": "1"
      }, axes);

      // Main groups
      archerG = svgEl("g", { opacity: "0" }, svg);
      vectorG = svgEl("g", { opacity: "0" }, svg);
      splitG = svgEl("g", { opacity: "0" }, svg);
      trajectoryG = svgEl("g", { opacity: "0" }, svg);
      motionG = svgEl("g", { opacity: "0" }, svg);
      equationG = svgEl("g", { opacity: "0" }, svg);
      finalG = svgEl("g", { opacity: "0" }, svg);
      multiG = svgEl("g", { opacity: "0" }, svg);

      // Split screen panels
      leftPanelG = svgEl("g", { opacity: "0" }, splitG);
      rightPanelG = svgEl("g", { opacity: "0" }, splitG);

      // Archer figure
      var archerPos = worldToSvg(0, 0);
      var archerFig = svgEl("g", {}, archerG);
      
      // Simple archer representation
      svgEl("circle", {
        cx: archerPos.x - 8, cy: archerPos.y - 20, r: "4",
        fill: "#e0e7ff"
      }, archerFig);
      
      svgEl("line", {
        x1: archerPos.x - 8, y1: archerPos.y - 15,
        x2: archerPos.x - 8, y2: archerPos.y,
        stroke: "#e0e7ff", "stroke-width": "3"
      }, archerFig);
      
      // Bow
      var bowEndX = archerPos.x + 15 * Math.cos(angleRad);
      var bowEndY = archerPos.y - 15 * Math.sin(angleRad);
      svgEl("path", {
        d: "M" + archerPos.x + "," + (archerPos.y - 10) + 
          " Q" + (bowEndX + 5) + "," + (bowEndY - 5) + 
          " " + bowEndX + "," + bowEndY,
        fill: "none", stroke: "#818cf8", "stroke-width": "2"
      }, archerFig);

      // Initial velocity vector
      var vectorEnd = worldToSvg(vx/5, vy/5);
      velocityVector = svgEl("line", {
        x1: archerPos.x, y1: archerPos.y,
        x2: archerPos.x, y2: archerPos.y,
        stroke: "#f59e0b", "stroke-width": "3",
        "marker-end": "url(#arrowhead)",
        opacity: "0"
      }, vectorG);

      // Component vectors (initially hidden)
      vxVector = svgEl("line", {
        x1: archerPos.x, y1: archerPos.y,
        x2: archerPos.x, y2: archerPos.y,
        stroke: "#6366f1", "stroke-width": "2",
        "marker-end": "url(#arrowhead)",
        opacity: "0"
      }, vectorG);

      vyVector = svgEl("line", {
        x1: archerPos.x, y1: archerPos.y,
        x2: archerPos.x, y2: archerPos.y,
        stroke: "#818cf8", "stroke-width": "2", 
        "marker-end": "url(#arrowhead)",
        opacity: "0"
      }, vectorG);

      // Trajectory path
      trajectoryPath = svgEl("path", {
        d: "",
        fill: "none",
        stroke: "#f59e0b",
        "stroke-width": "2",
        opacity: "0"
      }, trajectoryG);

      // Position dot and trail
      positionDot = svgEl("circle", {
        cx: archerPos.x, cy: archerPos.y, r: "4",
        fill: "#f59e0b",
        filter: "url(#glow)",
        opacity: "0"
      }, motionG);

      trail = svgEl("path", {
        d: "",
        fill: "none",
        stroke: "#f59e0b",
        "stroke-width": "1",
        opacity: "0.6"
      }, motionG);

      // Create x(t) and y(t) graphs for split screen
      this.createSplitScreenGraphs();
    },

    createSplitScreenGraphs: function() {
      // Left panel - x(t) graph
      var leftPanel = svgEl("rect", {
        x: "50", y: "50", width: "300", height: "150",
        fill: "rgba(6,182,212,0.1)", stroke: "#06b6d4",
        "stroke-width": "1", rx: "8", opacity: "0"
      }, leftPanelG);

      svgEl("text", {
        x: "200", y: "40", "text-anchor": "middle",
        fill: "#06b6d4", "font-size": "14", "font-weight": "700"
      }, leftPanelG).textContent = "Horizontal: x(t) = v₀ₓt";

      // Right panel - y(t) graph  
      var rightPanel = svgEl("rect", {
        x: "450", y: "50", width: "300", height: "150", 
        fill: "rgba(139,92,246,0.1)", stroke: "#8b5cf6",
        "stroke-width": "1", rx: "8", opacity: "0"
      }, rightPanelG);

      svgEl("text", {
        x: "600", y: "40", "text-anchor": "middle", 
        fill: "#8b5cf6", "font-size": "14", "font-weight": "700"
      }, rightPanelG).textContent = "Vertical: y(t) = v₀ₜt - ½gt²";

      // Graph elements will be added when needed
    },

    getElements: function() {
      return {
        archerG: archerG,
        vectorG: vectorG,
        trajectoryG: trajectoryG,
        motionG: motionG
      };
    },

    timelineAction: function(tl, method, params, t) {
      var archerPos = worldToSvg(0, 0);
      
      switch(method) {
        case "drawArcher":
          tl.to(archerG, { opacity: 1, duration: 0.8, ease: "power2.out" }, t);
          break;

        case "showInitialVelocityVector":
          var vectorEnd = worldToSvg(params.magnitude/8, params.magnitude/8 * Math.tan(angleRad));
          tl.to(velocityVector, { opacity: 1, duration: 0.3 }, t);
          tl.to(velocityVector, {
            attr: { x2: vectorEnd.x, y2: vectorEnd.y },
            duration: 0.8, ease: "power2.out"
          }, t + 0.2);
          tl.to(vectorG, { opacity: 1, duration: 0.5 }, t);
          
          // Add velocity label
          var vLabel = svgEl("text", {
            x: vectorEnd.x + 10, y: vectorEnd.y - 5,
            fill: params.color || "#f59e0b", "font-size": "12", "font-weight": "700",
            opacity: "0"
          }, vectorG);
          vLabel.textContent = "v₀ = " + params.magnitude + " m/s";
          velocityLabels.push(vLabel);
          tl.to(vLabel, { opacity: 1, duration: 0.4 }, t + 0.6);
          break;

        case "splitVelocityVector":
          // Animate vector decomposition
          var vxEnd = worldToSvg(vx/5, 0);
          var vyEnd = worldToSvg(0, vy/5);
          
          tl.to(vxVector, { opacity: 1, duration: 0.3 }, t);
          tl.to(vxVector, {
            attr: { x2: vxEnd.x, y2: vxEnd.y },
            duration: 0.6, ease: "power2.out"
          }, t + 0.2);
          
          tl.to(vyVector, { opacity: 1, duration: 0.3 }, t + 0.4);
          tl.to(vyVector, {
            attr: { x2: vyEnd.x, y2: vyEnd.y },
            duration: 0.6, ease: "power2.out"
          }, t + 0.6);
          
          // Fade main vector
          tl.to(velocityVector, { opacity: 0.3, duration: 0.5 }, t + 0.8);
          break;

        case "calculateComponents":
          // Show component calculations
          var compText = svgEl("text", {
            x: archerPos.x + 100, y: archerPos.y - 50,
            fill: "#e0e7ff", "font-size": "11", "font-weight": "600",
            opacity: "0"
          }, vectorG);
          compText.textContent = "vₓ = " + params.vx + " m/s, vᵧ = " + params.vy + " m/s";
          
          tl.to(compText, { opacity: 1, duration: 0.5 }, t);
          velocityLabels.push(compText);
          break;

        case "createSplitScreen":
          splitActive = true;
          tl.to(splitG, { opacity: 1, duration: 0.7 }, t);
          tl.to([leftPanelG, rightPanelG], { opacity: 1, duration: 0.5 }, t + 0.3);
          break;

        case "showMotionGraphs":
          // Draw linear x(t) graph
          if (params.xType === "constant") {
            var xPath = "M70,180 L330,120";
            var xGraph = svgEl("path", {
              d: xPath, fill: "none", stroke: "#06b6d4",
              "stroke-width": "2", opacity: "0"
            }, leftPanelG);
            xGraphElements.push(xGraph);
            tl.to(xGraph, { opacity: 1, duration: 0.8 }, t);
          }
          
          // Draw parabolic y(t) graph  
          if (params.yType === "parabolic") {
            var yPath = "M470,180 Q600,80 730,180";
            var yGraph = svgEl("path", {
              d: yPath, fill: "none", stroke: "#8b5cf6",
              "stroke-width": "2", opacity: "0"
            }, rightPanelG);
            yGraphElements.push(yGraph);
            tl.to(yGraph, { opacity: 1, duration: 0.8 }, t + 0.3);
          }
          break;

        case "mergeSplitScreens":
          splitActive = false;
          tl.to(splitG, { opacity: 0, duration: 0.5 }, t);
          break;

        case "startArrowMotion":
          // Begin projectile animation
          tl.to(motionG, { opacity: 1, duration: 0.3 }, t);
          
          // Animate position dot along trajectory
          var duration = timeOfFlight * (params.realTimeSpeed || 1);
          var pathPoints = [];
          var numPoints = 50;
          
          for (var i = 0; i <= numPoints; i++) {
            var time = (i / numPoints) * timeOfFlight;
            var point = getTrajectoryPoint(time);
            pathPoints.push(point);
          }
          
          // Animate dot along path
          pathPoints.forEach(function(point, index) {
            var delay = t + (index / numPoints) * duration;
            tl.to(positionDot, {
              attr: { cx: point.x, cy: point.y },
              duration: duration / numPoints,
              ease: "none"
            }, delay);
          });
          break;

        case "showPositionDot":
          tl.to(positionDot, { opacity: 1, duration: 0.4 }, t);
          
          // Create trail effect
          tl.call(function() {
            var trailPath = "M" + archerPos.x + "," + archerPos.y;
            trail.setAttribute("d", trailPath);
            trail.setAttribute("opacity", "0.6");
          }, null, t);
          break;

        case "updateVelocityVector":
          // Update velocity vector during motion
          if (typeof gsap !== "undefined") {
            tl.call(function() {
              // This would update the velocity vector in real-time
              // For simplicity, showing static update
            }, null, t);
          }
          break;

        case "highlightPeak":
          var peakTime = vy / g;
          var peakPoint = getTrajectoryPoint(peakTime);
          
          if (params.pulse) {
            var peakMarker = svgEl("circle", {
              cx: peakPoint.x, cy: peakPoint.y, r: "6",
              fill: "none", stroke: "#f59e0b", "stroke-width": "2",
              opacity: "0"
            }, trajectoryG);
            
            tl.to(peakMarker, { opacity: 1, duration: 0.3 }, t);
            tl.to(peakMarker, { 
              attr: { r: "12" }, duration: 0.5, ease: "power2.out" 
            }, t + 0.2);
            tl.to(peakMarker, { 
              attr: { r: "6" }, duration: 0.5, ease: "power2.out" 
            }, t + 0.7);
          }
          break;

        case "drawSymmetryLines":
          var peakTime = vy / g;
          var peakPoint = getTrajectoryPoint(peakTime);
          
          var symmetryLine = svgEl("line", {
            x1: peakPoint.x, y1: config.origin.y,
            x2: peakPoint.x, y2: peakPoint.y,
            stroke: "rgba(255,255,255,0.3)",
            "stroke-width": "1",
            "stroke-dasharray": params.style === "dashed" ? "5,5" : "none",
            opacity: "0"
          }, trajectoryG);
          
          tl.to(symmetryLine, { opacity: 1, duration: 0.6 }, t);
          break;

        case "markTimeIntervals":
          var peakTime = vy / g;
          var peakPoint = getTrajectoryPoint(peakTime);
          
          // Up phase label
          var upLabel = svgEl("text", {
            x: peakPoint.x - 30, y: config.origin.y + 20,
            fill: "#e0e7ff", "font-size": "11", "text-anchor": "middle",
            opacity: "0"
          }, trajectoryG);
          upLabel.textContent = params.up;
          
          // Down phase label
          var downLabel = svgEl("text", {
            x: peakPoint.x + 30, y: config.origin.y + 20,
            fill: "#e0e7ff", "font-size": "11", "text-anchor": "middle",
            opacity: "0"
          }, trajectoryG);
          downLabel.textContent = params.down;
          
          tl.to([upLabel, downLabel], { opacity: 1, duration: 0.5 }, t);
          break;

        case "animateGraphCombination":
          if (params.sequence === "merge") {
            // Show how x(t) and y(t) combine
            tl.to(trajectoryG, { opacity: 1, duration: 0.5 }, t);
          }
          break;

        case "drawFullTrajectory":
          var pathData = "M" + archerPos.x + "," + archerPos.y;
          var numPoints = 100;
          
          for (var i = 1; i <= numPoints; i++) {
            var time = (i / numPoints) * timeOfFlight;
            var point = getTrajectoryPoint(time);
            pathData += " L" + point.x + "," + point.y;
          }
          
          fullTrajectory = svgEl("path", {
            d: pathData,
            fill: "none",
            stroke: "#f59e0b",
            "stroke-width": "2",
            opacity: "0"
          }, trajectoryG);
          
          if (params.style === "smooth") {
            tl.to(fullTrajectory, { opacity: 0.8, duration: 1.0 }, t);
          }
          break;

        case "showKinematicEquation":
          if (params.equation === "vertical") {
            var eqText = svgEl("text", {
              x: "400", y: "100", "text-anchor": "middle",
              fill: "#e0e7ff", "font-size": "14", "font-weight": "600",
              opacity: "0"
            }, equationG);
            eqText.textContent = "y = v₀ₜt - ½gt²";
            equationElements.push(eqText);
            
            tl.to(equationG, { opacity: 1, duration: 0.5 }, t);
            tl.to(eqText, { opacity: 1, duration: 0.6 }, t + 0.2);
          }
          break;

        case "solveEquation":
          if (params.steps === "setup") {
            var stepText = svgEl("text", {
              x: "400", y: "130", "text-anchor": "middle",
              fill: "#fbbf24", "font-size": "12", "font-weight": "500",
              opacity: "0"
            }, equationG);
            stepText.textContent = "0 = 20t - 4.9t²";
            solutionSteps.push(stepText);
            
            tl.to(stepText, { opacity: 1, duration: 0.5 }, t);
          }
          break;

        case "highlightTimeOfFlight":
          timeOfFlightMarker = svgEl("text", {
            x: "400", y: "160", "text-anchor": "middle",
            fill: "#22c55e", "font-size": "16", "font-weight": "700",
            opacity: "0"
          }, equationG);
          timeOfFlightMarker.textContent = "t = " + params.t + " s";
          
          tl.to(timeOfFlightMarker, { opacity: 1, duration: 0.5 }, t);
          break;

        case "calculateRange":
          if (params.formula === "distance") {
            rangeMarker = svgEl("text", {
              x: "400", y: "190", "text-anchor": "middle",
              fill: "#f59e0b", "font-size": "14", "font-weight": "600",
              opacity: "0"
            }, equationG);
            rangeMarker.textContent = "Range = " + Math.round(range) + " m";
            
            tl.to(rangeMarker, { opacity: 1, duration: 0.5 }, t);
          }
          break;

        case "drawRangeMeasurement":
          var rangeEnd = worldToSvg(range, 0);
          
          if (params.style === "groundLine") {
            var measureLine = svgEl("line", {
              x1: archerPos.x, y1: config.origin.y + 15,
              x2: rangeEnd.x, y2: config.origin.y + 15,
              stroke: "#22c55e", "stroke-width": "2",
              "marker-end": "url(#arrowhead)",
              opacity: "0"
            }, finalG);
            
            var measureText = svgEl("text", {
              x: (archerPos.x + rangeEnd.x) / 2, y: config.origin.y + 35,
              fill: "#22c55e", "font-size": "12", "font-weight": "700",
              "text-anchor": "middle", opacity: "0"
            }, finalG);
            measureText.textContent = Math.round(range) + " m";
            
            tl.to(finalG, { opacity: 1, duration: 0.3 }, t);
            tl.to([measureLine, measureText], { opacity: 1, duration: 0.6 }, t + 0.2);
          }
          break;

        case "showMultipleTrajectories":
          tl.to(multiG, { opacity: 1, duration: 0.3 }, t);
          
          params.angles.forEach(function(angle, index) {
            var angleRad = angle * Math.PI / 180;
            var vxAngle = v0 * Math.cos(angleRad);
            var vyAngle = v0 * Math.sin(angleRad);
            var timeAngle = 2 * vyAngle / g;
            
            var pathData = "M" + archerPos.x + "," + archerPos.y;
            var numPoints = 50;
            
            for (var i = 1; i <= numPoints; i++) {
              var time = (i / numPoints) * timeAngle;
              var x = vxAngle * time;
              var y = vyAngle * time - 0.5 * g * time * time;
              if (y < 0) break;
              var point = worldToSvg(x, y);
              pathData += " L" + point.x + "," + point.y;
            }
            
            var trajectory = svgEl("path", {
              d: pathData,
              fill: "none",
              stroke: index === 2 ? "#f59e0b" : "rgba(129,140,248,0.6)", // Highlight 45°
              "stroke-width": index === 2 ? "2" : "1.5",
              opacity: "0"
            }, multiG);
            
            multiTrajectories.push(trajectory);
            
            tl.to(trajectory, { opacity: 0.8, duration: 0.5 }, t + index * 0.2);
          });
          break;

        case "highlightOptimalAngle":
          if (params.maxRange && params.angle === 45) {
            // Highlight the 45° trajectory
            multiTrajectories.forEach(function(traj, index) {
              if (index === 2) { // 45° is at index 2
                tl.to(traj, { 
                  attr: { stroke: "#f59e0b", "stroke-width": "3" },
                  duration: 0.5 
                }, t);
              } else {
                tl.to(traj, { opacity: 0.3, duration: 0.5 }, t);
              }
            });
          }
          break;

        case "emphasizeOurAnswer":
          if (params.highlight) {
            // Find our 30° trajectory and highlight it
            var ourTrajectory = multiTrajectories[1]; // 30° is at index 1
            if (ourTrajectory) {
              tl.to(ourTrajectory, {
                attr: { stroke: "#22c55e", "stroke-width": "3" },
                duration: 0.5
              }, t);
            }
            
            // Add answer label
            var answerLabel = svgEl("text", {
              x: "400", y: "50", "text-anchor": "middle",
              fill: "#22c55e", "font-size": "18", "font-weight": "700",
              opacity: "0"
            }, finalG);
            answerLabel.textContent = "30° → " + Math.round(range) + " m";
            
            tl.to(answerLabel, { opacity: 1, duration: 0.6 }, t + 0.3);
          }
          break;
      }
    },

    executeAction: function(actionDef, tl, t) {
      this.timelineAction(tl, actionDef.vizAction, actionDef, t);
    }
  };
})();