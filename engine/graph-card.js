/* ═══════════════════════════════════════════════════════════════════
   Graph Card + Code Runner Card — Stage 1 expansion

   Registers two new card factories into CardSystem:
     "graph"       — JSXGraph interactive math (function plots, draggable points,
                     geometric constructions). Lazy-loads JSXGraph v1.9.2.
     "code-runner" — p5.js sandbox with live textarea editor. Runs in a
                     sandboxed iframe (allow-scripts, no parent DOM access).

   Load order: must come after engine/cards.js (needs EX.CardSystem)
   ═══════════════════════════════════════════════════════════════════ */
(function() {
"use strict";

var EX = window.EX;
var K  = EX.K;

/* ─────────────────────────── lazy loaders ────────────────────────────── */

var _jsxLoaded  = false;
var _jsxPending = [];

function ensureJSX(cb) {
  if (typeof JXG !== "undefined") { cb(); return; }
  _jsxPending.push(cb);
  if (_jsxLoaded) return;
  _jsxLoaded = true;
  var link = document.createElement("link");
  link.rel  = "stylesheet";
  link.href = "https://cdn.jsdelivr.net/npm/jsxgraph@1.9.2/distrib/jsxgraph.css";
  document.head.appendChild(link);
  var s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/jsxgraph@1.9.2/distrib/jsxgraphcore.js";
  s.onload = function() {
    var q = _jsxPending.splice(0);
    q.forEach(function(fn) { fn(); });
  };
  document.head.appendChild(s);
}

/* ──────────────────────────── "graph" card ───────────────────────────── */

EX.CardSystem.factories["graph"] = function(id, data) {
  var el = document.createElement("div");
  el.className = "beat-card beat-card--graph";
  el.dataset.beatId = id;

  if (data.title) {
    var t = document.createElement("div");
    t.className = "plot-title";
    t.textContent = data.title;
    el.appendChild(t);
  }

  var w = data.width  || 360;
  var h = data.height || 220;

  // JSXGraph requires a unique DOM id — id can contain chars that break CSS,
  // so we sanitise it and add a timestamp to guarantee uniqueness.
  var boardId = "jsx-" + id.replace(/[^a-z0-9]/gi, "-") + "-" + Date.now();

  var boardDiv = document.createElement("div");
  boardDiv.id = boardId;
  boardDiv.style.cssText = "width:" + w + "px;height:" + h + "px;" +
    "border-radius:8px;overflow:hidden;background:#0f0e17;" +
    "border:1px solid rgba(99,102,241,0.25)";
  el.appendChild(boardDiv);

  ensureJSX(function() {
    var xR = data.xRange || [-5, 5];
    var yR = data.yRange || [-4, 4];

    var board = JXG.JSXGraph.initBoard(boardId, {
      boundingbox: [xR[0], yR[1], xR[1], yR[0]],
      axis: true,
      showCopyright: false,
      showNavigation: data.interactive !== false,
      pan:  { enabled: data.interactive !== false, needShift: false },
      zoom: { enabled: data.interactive !== false, wheel: true },
      defaultAxes: {
        x: {
          strokeColor: "rgba(224,231,255,0.25)",
          ticks: {
            strokeColor: "rgba(224,231,255,0.15)",
            label: { strokeColor: "rgba(224,231,255,0.55)", fontSize: 11 }
          }
        },
        y: {
          strokeColor: "rgba(224,231,255,0.25)",
          ticks: {
            strokeColor: "rgba(224,231,255,0.15)",
            label: { strokeColor: "rgba(224,231,255,0.55)", fontSize: 11 }
          }
        }
      }
    });

    // Background colour for the board (JSXGraph sets it on the SVG container)
    if (board.renderer && board.renderer.svgRoot) {
      board.renderer.svgRoot.style.background = "#0f0e17";
    }

    // Function graphs
    (data.functions || []).forEach(function(fnDef) {
      try {
        var fn = new Function("x", "return (" + fnDef.fn + ");");
        board.create("functiongraph", [fn, xR[0], xR[1]], {
          strokeColor: fnDef.color || "#818cf8",
          strokeWidth: 2.5,
          name: fnDef.name || ""
        });
      } catch (e) {
        console.warn("[graph-card] Bad function expr:", fnDef.fn, e);
      }
    });

    // Points
    (data.points || []).forEach(function(pt) {
      board.create("point", [pt.x, pt.y], {
        name:        pt.label || "",
        fixed:       !pt.draggable,
        size:        4,
        fillColor:   pt.color || "#f59e0b",
        strokeColor: "none",
        label: {
          strokeColor: "#e0e7ff",
          fontSize: 13,
          offset: [6, 6]
        }
      });
    });

    // Geometry objects (lines, circles)
    (data.geometryObjects || []).forEach(function(obj) {
      try {
        if (obj.type === "line") {
          board.create("line", [obj.p1, obj.p2], {
            strokeColor: obj.color || "#818cf8",
            strokeWidth: obj.strokeWidth || 1.5
          });
        } else if (obj.type === "circle") {
          board.create("circle", [obj.center, obj.radius], {
            strokeColor: obj.color || "#818cf8",
            fillColor: "none",
            strokeWidth: obj.strokeWidth || 1.5
          });
        } else if (obj.type === "segment") {
          board.create("segment", [obj.p1, obj.p2], {
            strokeColor: obj.color || "#818cf8",
            strokeWidth: obj.strokeWidth || 1.5
          });
        }
      } catch (e) {
        console.warn("[graph-card] Bad geometry object:", obj, e);
      }
    });
  });

  if (data.note) {
    var note = document.createElement("div");
    note.className = "plot-note";
    K.mixed(data.note, note);
    el.appendChild(note);
  }

  return el;
};

/* ─────────────────────────── "code-runner" card ─────────────────────── */

EX.CardSystem.factories["code-runner"] = function(id, data) {
  var el = document.createElement("div");
  el.className = "beat-card beat-card--code-runner";
  el.dataset.beatId = id;

  if (data.title) {
    var t = document.createElement("div");
    t.className = "plot-title";
    t.textContent = data.title;
    el.appendChild(t);
  }

  var canvasH = data.canvasHeight || (data.height ? data.height - 60 : 260);

  // ── Editor ──────────────────────────────────────────────────────────
  var defaultCode = data.initialCode ||
    "function setup() {\n  createCanvas(340, " + canvasH + ");\n  background(15, 14, 23);\n}\n\nfunction draw() {\n  // your code here\n}";

  var textarea = document.createElement("textarea");
  textarea.className = "code-runner-editor";
  textarea.value = defaultCode;
  textarea.rows  = 8;
  el.appendChild(textarea);

  // ── Toolbar ─────────────────────────────────────────────────────────
  var toolbar = document.createElement("div");
  toolbar.style.cssText = "display:flex;align-items:center;gap:8px;margin:6px 0 4px";

  var runBtn = document.createElement("button");
  runBtn.className = "code-runner-run-btn";
  runBtn.textContent = data.runLabel || "Run";
  toolbar.appendChild(runBtn);

  var errSpan = document.createElement("span");
  errSpan.style.cssText = "font-size:11px;color:#f87171;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis";
  toolbar.appendChild(errSpan);

  el.appendChild(toolbar);

  // ── Canvas wrap ─────────────────────────────────────────────────────
  var canvasWrap = document.createElement("div");
  canvasWrap.style.cssText = "border-radius:6px;overflow:hidden;background:#0f0e17;" +
    "border:1px solid rgba(99,102,241,0.25)";
  el.appendChild(canvasWrap);

  // ── iframe builder ──────────────────────────────────────────────────
  function buildHTML(code) {
    // Escape <\/script> tags inside user code so they don't close our script block
    var safeCode = code.replace(/<\/script/gi, "<\\/script");
    return [
      '<!DOCTYPE html><html><head>',
      '<meta charset="UTF-8">',
      '<style>',
      'html,body{margin:0;padding:0;overflow:hidden;background:#0f0e17}',
      'canvas{display:block}',
      '</style>',
      '<script src="https://cdn.jsdelivr.net/npm/p5@1.9.4/lib/p5.min.js"><\/script>',
      '</head><body>',
      '<script>\n' + safeCode + '\n<\/script>',
      '</body></html>'
    ].join("");
  }

  function runSketch() {
    errSpan.textContent = "";
    canvasWrap.innerHTML = "";
    var iframe = document.createElement("iframe");
    // allow-scripts: execute JS. No allow-same-origin → opaque origin,
    // so iframe cannot reach window.parent or lesson DOM.
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.style.cssText = "width:100%;height:" + canvasH + "px;border:none;border-radius:6px;display:block";
    try {
      iframe.srcdoc = buildHTML(textarea.value);
    } catch (e) {
      errSpan.textContent = "Error: " + e.message;
      return;
    }
    canvasWrap.appendChild(iframe);
  }

  runBtn.addEventListener("click", runSketch);

  if (data.autoRun !== false) {
    // Delay so the card is in the DOM before we create the iframe
    setTimeout(runSketch, 120);
  }

  if (data.note) {
    var note = document.createElement("div");
    note.className = "plot-note";
    K.mixed(data.note, note);
    el.appendChild(note);
  }

  return el;
};

})();
