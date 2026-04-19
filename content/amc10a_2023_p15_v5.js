/* ═══════════════════════════════════════════════════════════════════
   SECTION 1 — Custom factory registration
   Runs after engine modules (cards.js, gates.js) have loaded.
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", function () {
  var EX = window.EX;
  if (!EX) return;

  /* ── Patch VizPanel to support live DOM element migration ───────── */
  /* When an interactive-chart card sets showInPanel:true, it stores a
     rebuild function here.  On .inline("figure"), instead of cloneNode
     (which loses event listeners), we call the rebuild fn to create a
     fresh interactive instance that goes into the notebook.            */
  window._CHART_REBUILD_FN = null;

  if (EX.VizPanel && EX.VizPanel._appendOverlayClone) {
    var _origOverlayClone = EX.VizPanel._appendOverlayClone.bind(EX.VizPanel);
    EX.VizPanel._appendOverlayClone = function (beatId) {
      if (window._CHART_REBUILD_FN) {
        var rebuildFn = window._CHART_REBUILD_FN;
        window._CHART_REBUILD_FN = null;
        /* Build a fresh interactive chart element (inline / compact size) */
        var freshEl = rebuildFn(true);
        var outer = document.createElement("div");
        outer.className = "beat-card beat-card--viz-inline viz-inline";
        var inner = document.createElement("div");
        inner.className = "viz-inline-content";
        inner.style.cssText = "background:rgba(15,14,23,0.96);border-radius:8px;"
          + "padding:14px 10px 10px;display:flex;flex-direction:column;"
          + "align-items:center;width:100%";
        inner.appendChild(freshEl);
        outer.appendChild(inner);
        outer.style.opacity = "1";
        outer.style.transform = "none";
        EX.EventBus.emit("notebook:appendBeat", { beatId: beatId + "-viz", element: outer });
      } else {
        _origOverlayClone(beatId);
      }
    };
  }

  /* ── Interactive gate factory ──────────────────────────────────── */
  if (EX.GateSystem) {
    EX.GateSystem.gateFactories["interactive"] = function (id, data, onResolve) {
      var el = document.createElement("div");
      el.className = "beat-card beat-card--fill-in";
      el.style.cssText = "padding:18px 20px";

      /* Title */
      var titleEl = document.createElement("div");
      titleEl.style.cssText = "font-size:.8rem;color:#818cf8;font-weight:700;text-transform:uppercase;"
        + "letter-spacing:1.5px;margin-bottom:8px;display:flex;align-items:center;gap:8px";
      titleEl.innerHTML = "<span style='display:inline-block;width:6px;height:6px;border-radius:50%;"
        + "background:#818cf8'></span>" + (data.title || "Explorer");
      el.appendChild(titleEl);

      if (data.description) {
        var descEl = document.createElement("div");
        descEl.style.cssText = "font-size:.86rem;color:rgba(255,255,255,0.5);margin-bottom:14px;line-height:1.55";
        descEl.textContent = data.description;
        el.appendChild(descEl);
      }

      /* Embedded SVG preview for circle visualisation */
      var previewSvg = null;
      if (data.vizSync) {
        previewSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        previewSvg.setAttribute("viewBox", "0 0 280 280");
        previewSvg.style.cssText = "width:100%;max-width:260px;height:auto;display:block;"
          + "margin:0 auto 14px;border-radius:10px;background:#0f0e17;"
          + "box-shadow:0 0 0 1px rgba(99,102,241,0.15)";
        el.appendChild(previewSvg);
      }

      /* ── Mini bar-chart SVG (ring-calc only — no vizSync) ── */
      var barChartSvg = null;
      if (!data.vizSync && data.compute) {
        barChartSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        barChartSvg.setAttribute("viewBox", "0 0 260 88");
        barChartSvg.style.cssText = "width:100%;max-width:260px;height:auto;display:block;"
          + "margin:0 auto 12px;border-radius:8px;background:rgba(15,14,23,0.6);"
          + "box-shadow:0 0 0 1px rgba(99,102,241,0.12)";
        el.appendChild(barChartSvg);
      }

      /* ── Celebration banner (explorer gate only) ── */
      var celebEl = null;
      if (data.label === "explorer") {
        celebEl = document.createElement("div");
        celebEl.style.cssText = "overflow:hidden;border-radius:8px;margin-bottom:10px;"
          + "max-height:0;opacity:0;transition:max-height .4s ease,opacity .35s ease";
        celebEl.innerHTML = "<div style='padding:10px 14px;"
          + "background:linear-gradient(135deg,rgba(245,158,11,0.18),rgba(34,197,94,0.15));"
          + "border:1px solid rgba(245,158,11,0.45);border-radius:8px;"
          + "display:flex;align-items:center;gap:10px'>"
          + "<span style='font-size:1.35rem'>&#x2728;</span>"
          + "<div><div style='font-size:.82rem;font-weight:700;color:#fbbf24;letter-spacing:.5px'>"
          + "EXACT ANSWER FOUND!</div>"
          + "<div style='font-size:.76rem;color:rgba(255,255,255,0.65);margin-top:2px'>"
          + "64 circles \u2192 2080\u03C0 \u2265 2023\u03C0 \u2713 \u00B7 "
          + "62 circles \u2192 1953\u03C0 &lt; 2023\u03C0 \u00D7</div>"
          + "</div>"
          + "<span style='font-size:1.35rem;margin-left:auto'>&#x1F3C6;</span></div>";
        el.appendChild(celebEl);
      }

      var firstCrossingStamped = false; /* true once user visits n=64 */
      var celebrationFired    = false;  /* one-shot celebration guard */

      /* Slider */
      var slider, valBadge;
      if (data.slider) {
        var sliderRow = document.createElement("div");
        sliderRow.style.cssText = "display:flex;align-items:center;gap:10px;margin-bottom:12px";

        var minLbl = document.createElement("span");
        minLbl.style.cssText = "font-size:.75rem;color:rgba(255,255,255,0.3);flex-shrink:0;min-width:1.5rem;text-align:right";
        minLbl.textContent = data.slider.min;

        slider = document.createElement("input");
        slider.type = "range";
        slider.min = data.slider.min;
        slider.max = data.slider.max;
        slider.step = data.slider.step || 1;
        slider.value = data.slider.default || data.slider.min;
        slider.style.cssText = "flex:1;height:4px;border-radius:2px;outline:none;cursor:pointer;"
          + "accent-color:#818cf8;background:rgba(129,140,248,0.25);transition:accent-color .2s";

        var maxLbl = document.createElement("span");
        maxLbl.style.cssText = "font-size:.75rem;color:rgba(255,255,255,0.3);flex-shrink:0;min-width:2rem";
        maxLbl.textContent = data.slider.max;

        valBadge = document.createElement("div");
        valBadge.style.cssText = "background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);"
          + "border-radius:8px;padding:4px 12px;font-size:.95rem;font-weight:700;color:#c4b5fd;"
          + "font-family:monospace;flex-shrink:0;min-width:3.5rem;text-align:center;"
          + "transition:background .2s,border-color .2s,color .2s";
        valBadge.textContent = slider.value;

        sliderRow.appendChild(minLbl);
        sliderRow.appendChild(slider);
        sliderRow.appendChild(maxLbl);
        sliderRow.appendChild(valBadge);
        el.appendChild(sliderRow);
      }

      /* Display grid */
      var displayGrid = document.createElement("div");
      displayGrid.style.cssText = "display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:14px";
      el.appendChild(displayGrid);

      /* Draw nested circles into a preview SVG (explorer gate) */
      function drawCirclesPreview(n, svg) {
        if (!svg) return;
        var ns2 = "http://www.w3.org/2000/svg";
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        var CX2 = 140, BY2 = 268;
        var numRings = Math.floor(n / 2);
        var sc = Math.min(108 / Math.max(numRings, 2), 24);

        function mkEl(tag, attrs) {
          var e = document.createElementNS(ns2, tag);
          for (var k in attrs) e.setAttribute(k, attrs[k]);
          return e;
        }

        /* defs: glow filter, gold glow, gradient for outermost ring */
        var defs = mkEl("defs", {});

        /* Standard ring glow */
        var filt = mkEl("filter", { id: "ringGlowP", x: "-30%", y: "-30%", width: "160%", height: "160%" });
        var fe1 = mkEl("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "3", result: "blur" });
        var feMrg = mkEl("feMerge", {});
        var feMrg1 = mkEl("feMergeNode", { in: "blur" });
        var feMrg2 = mkEl("feMergeNode", { in: "SourceGraphic" });
        feMrg.appendChild(feMrg1); feMrg.appendChild(feMrg2);
        filt.appendChild(fe1); filt.appendChild(feMrg);
        defs.appendChild(filt);

        /* Gold glow for n=32 anchor */
        var filtG = mkEl("filter", { id: "goldGlowP", x: "-50%", y: "-50%", width: "200%", height: "200%" });
        var feG1 = mkEl("feFlood", { "flood-color": "#f59e0b", "flood-opacity": "0.7", result: "flood" });
        var feG2 = mkEl("feComposite", { in: "flood", in2: "SourceGraphic", operator: "in", result: "colored" });
        var feG3 = mkEl("feGaussianBlur", { in: "colored", stdDeviation: "5", result: "blur" });
        var feMrgG = mkEl("feMerge", {});
        feMrgG.appendChild(mkEl("feMergeNode", { in: "blur" }));
        feMrgG.appendChild(mkEl("feMergeNode", { in: "SourceGraphic" }));
        filtG.appendChild(feG1); filtG.appendChild(feG2); filtG.appendChild(feG3); filtG.appendChild(feMrgG);
        defs.appendChild(filtG);

        /* Gradient for newest (outermost) shaded ring — green when meets target */
        var nn = Math.floor(n / 2);
        var total = nn * (2 * nn + 1);
        var meetsTarget = total >= 2023;
        var gradStop1 = meetsTarget ? "#22c55e" : "#818cf8";
        var gradStop2 = meetsTarget ? "#4ade80" : "#a78bfa";
        var grad = mkEl("radialGradient", { id: "newestRingGrad", cx: "50%", cy: "50%", r: "50%" });
        var gs1 = mkEl("stop", { offset: "70%", "stop-color": gradStop1, "stop-opacity": "0.85" });
        var gs2 = mkEl("stop", { offset: "100%", "stop-color": gradStop2, "stop-opacity": "0.3" });
        grad.appendChild(gs1); grad.appendChild(gs2);
        defs.appendChild(grad);
        svg.appendChild(defs);

        /* Background with dot grid */
        svg.appendChild(mkEl("rect", { width: "280", height: "280", fill: "#0a0917" }));
        for (var gx = 14; gx <= 266; gx += 28) {
          for (var gy = 14; gy <= 266; gy += 28) {
            svg.appendChild(mkEl("circle", { cx: gx, cy: gy, r: "0.8", fill: "rgba(99,102,241,0.18)" }));
          }
        }

        /* Draw circles back to front */
        var RING_COLORS = [
          "rgba(99,102,241,0.72)", "rgba(139,92,246,0.65)",
          "rgba(79,70,229,0.72)", "rgba(124,58,237,0.65)"
        ];
        for (var r = numRings; r >= 1; r--) {
          var isNewest = (r === numRings);
          var isShaded = (r % 2 === 0);

          var circAttrs = {
            cx: CX2, cy: BY2, r: r * sc,
            fill: isShaded
              ? (isNewest ? "url(#newestRingGrad)" : RING_COLORS[((r / 2) - 1) % 4])
              : "#0a0917",
            stroke: isNewest ? (meetsTarget ? "rgba(34,197,94,0.55)" : "rgba(129,140,248,0.55)") : "rgba(255,255,255,0.04)",
            "stroke-width": isNewest ? "1.2" : "0.5"
          };
          if (isNewest) circAttrs.filter = "url(#ringGlowP)";
          svg.appendChild(mkEl("circle", circAttrs));

          /* Ring label inside outermost shaded ring */
          if (isShaded && isNewest && r >= 4) {
            var kIdx = r / 2;
            var ringArea = 4 * kIdx - 1;
            var labelY = BY2 - r * sc + sc * 0.62;
            var lbl = mkEl("text", {
              x: CX2, y: labelY, "text-anchor": "middle",
              fill: meetsTarget ? "rgba(34,255,140,0.9)" : "rgba(200,200,255,0.85)",
              "font-size": Math.min(sc * 0.52, 9), "font-family": "system-ui", "font-weight": "700"
            });
            lbl.textContent = "k=" + kIdx + " \u00B7 " + ringArea + "\u03C0";
            svg.appendChild(lbl);
          }
        }

        /* Anchor at n=32 (64 circles): gold dashed ring + glow dot */
        if (numRings >= 32) {
          svg.appendChild(mkEl("circle", {
            cx: CX2, cy: BY2, r: 32 * sc,
            fill: "none", stroke: "#f59e0b", "stroke-width": "1.5",
            "stroke-dasharray": "4 3", opacity: "0.7"
          }));
        }
        var anchorDot = mkEl("circle", {
          cx: CX2, cy: BY2, r: Math.max(3, sc * 0.15),
          fill: "#f59e0b", filter: numRings >= 32 ? "url(#goldGlowP)" : ""
        });
        svg.appendChild(anchorDot);

        /* First-crossing badge (green pill, top-right) */
        if (firstCrossingStamped) {
          var badgeG = mkEl("g", {});
          badgeG.appendChild(mkEl("rect", {
            x: "186", y: "6", width: "88", height: "17",
            rx: "8.5", fill: "rgba(34,197,94,0.18)", stroke: "rgba(34,197,94,0.5)", "stroke-width": "0.8"
          }));
          var badgeTxt = mkEl("text", {
            x: "230", y: "18", "text-anchor": "middle",
            fill: "#4ade80", "font-size": "7.5", "font-family": "system-ui", "font-weight": "700"
          });
          badgeTxt.textContent = "\u2713 first cross: 64 circles";
          badgeG.appendChild(badgeTxt);
          svg.appendChild(badgeG);
        }

        /* Status bar at bottom of SVG */
        svg.appendChild(mkEl("rect", {
          x: "0", y: "272", width: "280", height: "16",
          fill: meetsTarget ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.12)"
        }));
        var statusTxt = mkEl("text", {
          x: "140", y: "283", "text-anchor": "middle",
          fill: meetsTarget ? "#4ade80" : "#f87171",
          "font-size": "8.5", "font-family": "system-ui", "font-weight": "700"
        });
        statusTxt.textContent = n + " circles \u2192 " + total + "\u03C0 "
          + (meetsTarget ? "\u2265 2023\u03C0 \u2713" : "< 2023\u03C0");
        svg.appendChild(statusTxt);
      }

      /* Draw mini bar chart SVG (ring-calc gate) */
      function drawBarChart(k, svg) {
        if (!svg) return;
        var ns2 = "http://www.w3.org/2000/svg";
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        var W = 260, H = 88, padL = 24, padB = 18, padT = 10, padR = 8;
        var plotW = W - padL - padR, plotH = H - padT - padB;
        var maxK = 12, maxArea = 4 * maxK - 1;

        function mkE(tag, attrs) {
          var e = document.createElementNS(ns2, tag);
          for (var a in attrs) e.setAttribute(a, attrs[a]);
          return e;
        }

        svg.appendChild(mkE("rect", { width: W, height: H, fill: "rgba(15,14,23,0)" }));

        /* Grid lines */
        for (var gl = 0; gl <= 4; gl++) {
          var gy2 = padT + plotH - (gl / 4) * plotH;
          svg.appendChild(mkE("line", {
            x1: padL, y1: gy2, x2: W - padR, y2: gy2,
            stroke: "rgba(99,102,241,0.12)", "stroke-width": "0.6"
          }));
          if (gl > 0) {
            var lv = Math.round((gl / 4) * maxArea);
            var lt = mkE("text", { x: padL - 3, y: gy2 + 3, "text-anchor": "end", fill: "rgba(255,255,255,0.25)", "font-size": "6", "font-family": "system-ui" });
            lt.textContent = lv;
            svg.appendChild(lt);
          }
        }

        var barW = plotW / maxK * 0.7;
        var barGap = plotW / maxK;

        for (var i = 1; i <= maxK; i++) {
          var area = 4 * i - 1;
          var bx = padL + (i - 0.5) * barGap - barW / 2;
          var bh = (area / maxArea) * plotH;
          var by2 = padT + plotH - bh;
          var isCurrent = (i === k);
          var isPast = (i < k);
          var fill = isCurrent ? "#f59e0b" : isPast ? "rgba(99,102,241,0.55)" : "rgba(99,102,241,0.15)";
          svg.appendChild(mkE("rect", { x: bx, y: by2, width: barW, height: bh, rx: "1.5", fill: fill }));

          if (isCurrent) {
            var vt = mkE("text", { x: bx + barW / 2, y: by2 - 3, "text-anchor": "middle", fill: "#fbbf24", "font-size": "7.5", "font-family": "system-ui", "font-weight": "700" });
            vt.textContent = area;
            svg.appendChild(vt);
            var xt = mkE("text", { x: bx + barW / 2, y: H - 4, "text-anchor": "middle", fill: "#fbbf24", "font-size": "6.5", "font-family": "system-ui" });
            xt.textContent = "k=" + i;
            svg.appendChild(xt);
          }
        }

        var tn = mkE("text", { x: W - padR, y: padT + 7, "text-anchor": "end", fill: "rgba(255,255,255,0.3)", "font-size": "6.5", "font-family": "system-ui" });
        tn.textContent = "Area = 4k\u22121 (linear in k)";
        svg.appendChild(tn);
      }

      /* Continue button — declared before updateDisplay so celebration can reference it */
      var btn = document.createElement("button");
      btn.style.cssText = "width:100%;padding:9px 16px;border:1px solid rgba(99,102,241,0.35);"
        + "background:rgba(99,102,241,0.13);color:#c4b5fd;font-size:.84rem;font-family:inherit;"
        + "border-radius:8px;cursor:pointer;transition:background .2s,border-color .2s,color .2s";
      btn.textContent = "Continue \u2192";
      btn.addEventListener("mouseenter", function () {
        if (!btn.disabled) btn.style.background = "rgba(99,102,241,0.28)";
      });
      btn.addEventListener("mouseleave", function () {
        if (!btn.disabled) btn.style.background = btn._celebStyle || "rgba(99,102,241,0.13)";
      });

      function updateDisplay(val) {
        if (valBadge) {
          valBadge.textContent = val;
          if (data.label === "explorer") {
            if (val === 64) {
              valBadge.style.background = "rgba(245,158,11,0.25)";
              valBadge.style.borderColor = "rgba(245,158,11,0.6)";
              valBadge.style.color = "#fbbf24";
            } else {
              valBadge.style.background = "rgba(99,102,241,0.18)";
              valBadge.style.borderColor = "rgba(99,102,241,0.3)";
              valBadge.style.color = "#c4b5fd";
            }
          }
        }

        if (barChartSvg) drawBarChart(val, barChartSvg);
        if (previewSvg) drawCirclesPreview(val, previewSvg);

        if (data.compute) {
          var result = data.compute(val);

          if (data.label === "explorer") {
            var meetsNow = (result.statusColor === "#22c55e");
            if (meetsNow && !firstCrossingStamped) {
              firstCrossingStamped = true;
            }
            if (val === 64) {
              if (!celebrationFired) {
                celebrationFired = true;
                if (slider) slider.style.accentColor = "#f59e0b";
                if (celebEl) {
                  celebEl.style.maxHeight = "80px";
                  celebEl.style.opacity = "1";
                }
                btn._celebStyle = "rgba(245,158,11,0.18)";
                btn.style.background = "rgba(245,158,11,0.18)";
                btn.style.borderColor = "rgba(245,158,11,0.55)";
                btn.style.color = "#fbbf24";
              }
            } else {
              celebrationFired = false;
              if (slider) slider.style.accentColor = "#818cf8";
              if (celebEl) {
                celebEl.style.maxHeight = "0";
                celebEl.style.opacity = "0";
              }
              btn._celebStyle = null;
              btn.style.background = "rgba(99,102,241,0.13)";
              btn.style.borderColor = "rgba(99,102,241,0.35)";
              btn.style.color = "#c4b5fd";
            }
          }

          displayGrid.innerHTML = "";
          (data.displays || []).forEach(function (d) {
            var isHL = d.style === "highlight", isLG = d.style === "large", isST = d.style === "status";
            var meetsForColor = data.label === "explorer" && result.statusColor === "#22c55e";
            var cell = document.createElement("div");
            var cellBg = (isHL && meetsForColor) ? "rgba(34,197,94,0.08)"
              : isHL ? "rgba(245,158,11,0.08)" : "rgba(99,102,241,0.07)";
            var cellBorder = (isHL && meetsForColor) ? "rgba(34,197,94,0.2)"
              : isHL ? "rgba(245,158,11,0.18)" : "rgba(99,102,241,0.13)";
            cell.style.cssText = "background:" + cellBg + ";border:1px solid " + cellBorder + ";"
              + "border-radius:6px;padding:6px 10px;transition:background .25s,border-color .25s";
            var lab2 = document.createElement("div");
            lab2.style.cssText = "font-size:.62rem;color:rgba(255,255,255,0.32);text-transform:uppercase;"
              + "letter-spacing:.7px;margin-bottom:3px";
            lab2.textContent = d.label;
            var valEl = document.createElement("div");
            valEl.style.cssText = "font-size:" + (isLG ? "1.1rem" : isHL ? ".98rem" : ".86rem") + ";"
              + "font-weight:" + (isHL || isLG ? "700" : "500") + ";"
              + "color:" + (isST ? (result.statusColor || "#e0e7ff")
                           : isHL ? (meetsForColor ? "#4ade80" : "#fbbf24")
                           : isLG ? "#c4b5fd" : "#e0e7ff") + ";"
              + "font-family:monospace;transition:color .25s";
            valEl.textContent = String(result[d.field] || "");
            cell.appendChild(lab2);
            cell.appendChild(valEl);
            displayGrid.appendChild(cell);
          });
        }

        if (data.onSlide) data.onSlide(val);
      }

      if (slider) {
        var initVal = parseInt(slider.value);
        updateDisplay(initVal);
        slider.addEventListener("input", function () { updateDisplay(parseInt(this.value)); });
      }
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.textContent = "\u2713 Exploring complete";
        btn.style.color = "#22c55e";
        btn.style.borderColor = "rgba(34,197,94,0.4)";
        setTimeout(function () { onResolve(true); }, 700);
      });
      el.appendChild(btn);
      return el;
    };
  }

  /* ── Interactive chart card factory ────────────────────────────── */
  if (EX.CardSystem) {
    EX.CardSystem.factories["interactive-chart"] = function (id, data) {

      /* ── Inner builder — called once for the panel and again for inline ── */
      function buildChartEl(isInline) {
        var W = isInline ? 390 : 462, H = isInline ? 210 : 248;
        var pad = { t: 14, r: isInline ? 52 : 58, b: 32, l: isInline ? 40 : 44 };
        var pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
        var ns3 = "http://www.w3.org/2000/svg";
        var xMax = data.xMax || 80, yMax = data.yMax || 3200;

        function sx(v) { return pad.l + (v / xMax) * pw; }
        function sy(v) { return pad.t + ph - (v / yMax) * ph; }

        function mkSvg(tag, attrs, parent) {
          var e = document.createElementNS(ns3, tag);
          for (var k in attrs) e.setAttribute(k, attrs[k]);
          if (parent) parent.appendChild(e);
          return e;
        }

        var wrap = document.createElement("div");
        wrap.className = "beat-card beat-card--plot-2d";
        if (!isInline) wrap.style.cssText = "margin:0;border:none;background:transparent;padding:0";

        if (data.title && isInline) {
          var tEl2 = document.createElement("div");
          tEl2.className = "plot-title";
          tEl2.textContent = data.title;
          wrap.appendChild(tEl2);
        }

        var svg = document.createElementNS(ns3, "svg");
        svg.setAttribute("viewBox", "0 0 " + W + " " + H);
        svg.setAttribute("class", "plot-svg");
        svg.style.cssText = "cursor:crosshair;display:block;width:100%";

        /* Grid */
        [0, 500, 1000, 1500, 2000, 2500, 3000].forEach(function (yv) {
          mkSvg("line", { x1: pad.l, x2: W - pad.r, y1: sy(yv), y2: sy(yv), "class": "plot-grid-line" }, svg);
          if (yv > 0) {
            var ylT = mkSvg("text", { x: pad.l - 4, y: sy(yv) + 3, "text-anchor": "end", "class": "plot-axis-text" }, svg);
            ylT.textContent = (yv / 1000).toFixed(1) + "k";
          }
        });

        [0, 20, 40, 60, 64, 80].forEach(function (xv) {
          var xtl = mkSvg("text", {
            x: sx(xv), y: H - pad.b + 14, "text-anchor": "middle", "class": "plot-axis-text",
            fill: xv === 64 ? "#22c55e" : "rgba(255,255,255,0.3)"
          }, svg);
          xtl.textContent = xv;
          if (xv === 64) {
            mkSvg("line", {
              x1: sx(64), x2: sx(64), y1: pad.t, y2: H - pad.b + 5,
              stroke: "rgba(34,197,94,0.22)", "stroke-width": "1", "stroke-dasharray": "4,3"
            }, svg);
          }
        });

        /* Axis labels */
        var xLabEl = mkSvg("text", { x: pad.l + pw / 2, y: H - 2, "text-anchor": "middle", "class": "plot-label-text" }, svg);
        xLabEl.textContent = data.xLabel || "Number of circles";
        var yLabEl = mkSvg("text", {
          x: 9, y: pad.t + ph / 2, "text-anchor": "middle", "class": "plot-label-text",
          transform: "rotate(-90,9," + (pad.t + ph / 2) + ")"
        }, svg);
        yLabEl.textContent = data.yLabel || "Total area (\u00D7\u03C0)";

        /* Threshold line */
        if (data.threshold) {
          mkSvg("line", {
            x1: pad.l, x2: W - pad.r, y1: sy(data.threshold.value), y2: sy(data.threshold.value),
            "class": "plot-threshold-line"
          }, svg);
          var tlbEl = mkSvg("text", {
            x: W - pad.r + 3, y: sy(data.threshold.value) + 3,
            "class": "plot-threshold-text", "font-size": "8.5"
          }, svg);
          tlbEl.textContent = data.threshold.label || ("" + data.threshold.value + "\u03C0");
        }

        /* Curve */
        var points = [];
        for (var c4 = 2; c4 <= 80; c4 += 2) {
          var n4 = c4 / 2;
          points.push({ x: c4, y: n4 * (2 * n4 + 1) });
        }
        var pathD4 = points.map(function (p, i) {
          return (i === 0 ? "M" : "L") + sx(p.x).toFixed(1) + "," + sy(p.y).toFixed(1);
        }).join(" ");
        var curvePath = mkSvg("path", { d: pathD4, "class": "plot-curve", fill: "none" }, svg);

        /* Annotation dots & labels */
        var anns = data.annotations || [
          { x: 62, color: "#ef4444", label: "62\u219219 53\u03C0 \u00D7" },
          { x: 64, color: "#22c55e", label: "64\u21922080\u03C0 \u2713", highlight: true }
        ];
        var dotsG = mkSvg("g", {}, svg);
        anns.forEach(function (ann) {
          var n5 = ann.x / 2, y5 = n5 * (2 * n5 + 1);
          mkSvg("circle", {
            cx: sx(ann.x).toFixed(1), cy: sy(y5).toFixed(1),
            r: ann.highlight ? "5" : "3.5",
            fill: ann.color || "#818cf8", opacity: "0"
          }, dotsG);
          var lbl5 = mkSvg("text", {
            x: sx(ann.x).toFixed(1), y: (sy(y5) - 10).toFixed(1),
            "text-anchor": ann.x > 60 ? "end" : "middle",
            fill: ann.color || "#818cf8",
            "font-size": isInline ? "8.5" : "10",
            "font-family": "system-ui", "font-weight": "700", opacity: "0"
          }, dotsG);
          lbl5.textContent = ann.label || (ann.x + "\u2192" + y5 + "\u03C0");
        });

        /* Hover UI */
        var hoverLine = mkSvg("line", {
          y1: pad.t, y2: H - pad.b,
          stroke: "rgba(255,255,255,0.12)", "stroke-width": "1", "stroke-dasharray": "3,3"
        }, svg);
        hoverLine.style.display = "none";
        var hoverDot = mkSvg("circle", { r: "4", fill: "#818cf8" }, svg);
        hoverDot.style.display = "none";
        var hoverLbl = mkSvg("text", {
          fill: "#e0e7ff", "font-size": isInline ? "9" : "10.5",
          "font-family": "system-ui", "font-weight": "700"
        }, svg);
        hoverLbl.style.display = "none";
        svg.appendChild(hoverLbl);

        /* Hit rect */
        var hitRect = mkSvg("rect", { x: pad.l, y: pad.t, width: pw, height: ph, fill: "transparent" }, svg);

        function doHover(clientX, clientY) {
          var rect3 = svg.getBoundingClientRect();
          if (!rect3.width) return;
          var scale5 = W / rect3.width;
          var mx5 = (clientX - rect3.left) * scale5;
          var dataX5 = ((mx5 - pad.l) / pw) * xMax;
          var c5 = Math.round(dataX5 / 2) * 2;
          c5 = Math.max(2, Math.min(80, c5));
          var n5b = c5 / 2, y5b = n5b * (2 * n5b + 1);
          if (y5b > yMax * 1.1) return;
          var plotY5 = Math.min(sy(y5b), H - pad.b);
          hoverLine.setAttribute("x1", sx(c5)); hoverLine.setAttribute("x2", sx(c5));
          hoverLine.style.display = "";
          hoverDot.setAttribute("cx", sx(c5)); hoverDot.setAttribute("cy", plotY5);
          hoverDot.setAttribute("fill", y5b >= 2023 ? "#22c55e" : "#818cf8");
          hoverDot.style.display = "";
          var lx5 = sx(c5) + (c5 > 60 ? -5 : 5);
          hoverLbl.setAttribute("x", lx5);
          hoverLbl.setAttribute("y", plotY5 - 8);
          hoverLbl.setAttribute("text-anchor", c5 > 60 ? "end" : "start");
          hoverLbl.setAttribute("fill", y5b >= 2023 ? "#22c55e" : "#c4b5fd");
          hoverLbl.textContent = c5 + " circles \u2192 " + y5b + "\u03C0";
          hoverLbl.style.display = "";
        }
        hitRect.addEventListener("mousemove", function (e) { doHover(e.clientX, e.clientY); });
        hitRect.addEventListener("mouseleave", function () {
          hoverLine.style.display = hoverDot.style.display = hoverLbl.style.display = "none";
        });
        hitRect.addEventListener("touchmove", function (e) {
          e.preventDefault();
          if (e.touches[0]) doHover(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });

        wrap.appendChild(svg);

        if (data.note) {
          var noteEl = document.createElement("div");
          noteEl.className = "plot-note";
          EX.K.mixed(data.note, noteEl);
          wrap.appendChild(noteEl);
        }

        /* Animate curve */
        setTimeout(function () {
          try {
            var len5 = curvePath.getTotalLength ? curvePath.getTotalLength() : 3000;
            curvePath.style.strokeDasharray = len5;
            curvePath.style.strokeDashoffset = len5;
            curvePath.getBoundingClientRect();
            curvePath.style.transition = "stroke-dashoffset 2.4s cubic-bezier(.22,.68,0,1.1)";
            curvePath.style.strokeDashoffset = "0";
          } catch (e2) { /* silent */ }
          var kids = dotsG.children;
          for (var i5 = 0; i5 < kids.length; i5++) {
            (function (item5, idx5) {
              setTimeout(function () {
                item5.style.transition = "opacity .45s";
                item5.setAttribute("opacity", "1");
              }, 2300 + idx5 * 250);
            })(kids[i5], i5);
          }
        }, 150);

        return wrap;
      }
      /* ── End buildChartEl ── */

      if (data.showInPanel) {
        /* Show full-size chart in the main viz panel, register rebuild fn */
        EX.VizPanel.setMode("figure");
        var container = EX.VizPanel.overlayDiv;
        container.innerHTML = "";
        if (data.title) {
          var panelTitle = document.createElement("div");
          panelTitle.style.cssText = "font-size:.85rem;color:#818cf8;font-weight:700;"
            + "text-transform:uppercase;letter-spacing:2px;margin-bottom:14px";
          panelTitle.textContent = data.title;
          container.appendChild(panelTitle);
        }
        container.appendChild(buildChartEl(false)); /* full / panel size */
        window._CHART_REBUILD_FN = buildChartEl;    /* stash for inline migration */
        return null;                                 /* nothing in notebook yet */
      }

      /* Default: show directly in notebook (inline size) */
      return buildChartEl(true);
    };
  }
});


/* ═══════════════════════════════════════════════════════════════════
   SECTION 2 — Viz Plugin v4
   Key changes: scale=25 (fits 500px), fixed diff arrow positions,
   vivid subtraction animation, animated Gauss pairing table.
   ═══════════════════════════════════════════════════════════════════ */
window.EXPLAINER_VIZ = (function () {
  var svg, config;
  var fG, sG, lG, finG, annotG, gaussG;
  var gridBg, bgGlow;
  var fills = {}, strks = {}, rLab = {}, kLab = {};
  var cDot, cLabel;

  var RING_COLORS = [
    "rgba(99,102,241,0.58)", "rgba(139,92,246,0.53)",
    "rgba(79,70,229,0.58)", "rgba(124,58,237,0.53)"
  ];

  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function ringColor(k) { return RING_COLORS[(k - 1) % RING_COLORS.length]; }

  /* Computed position of circle r's centre */
  function cc(r) {
    return { cx: config.cx, cy: config.baseY - r * config.scale };
  }

  /* X-position of the "diff column" — always outside the outermost circle */
  function diffColX() {
    return config.cx + config.circleCount * config.scale + 14;
  }

  return {
    name: "nested_circles_v4",

    init: function (svgElement, vizConfig) {
      svg = svgElement;
      config = vizConfig;
      var CX = config.cx, BY = config.baseY, S = config.scale;
      var N = config.circleCount;
      var DARK = config.darkColor;
      var SC = config.strokeColor;

      /* ── Defs ── */
      var defs = svgEl("defs", {}, svg);

      var rg = svgEl("radialGradient", { id: "gloV4", cx: "50%", cy: "55%", r: "50%" }, defs);
      svgEl("stop", { offset: "0%", "stop-color": "#6366f1", "stop-opacity": "0.20" }, rg);
      svgEl("stop", { offset: "100%", "stop-color": "#6366f1", "stop-opacity": "0" }, rg);

      var flt = svgEl("filter", { id: "ringGlowV4", x: "-20%", y: "-20%", width: "140%", height: "140%" }, defs);
      svgEl("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "2.5", result: "blur" }, flt);
      var mg = svgEl("feMerge", {}, flt);
      svgEl("feMergeNode", { in: "blur" }, mg);
      svgEl("feMergeNode", { in: "SourceGraphic" }, mg);

      var hlFlt = svgEl("filter", { id: "hlGlowV4", x: "-30%", y: "-30%", width: "160%", height: "160%" }, defs);
      svgEl("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "5", result: "blur" }, hlFlt);
      var hlMg = svgEl("feMerge", {}, hlFlt);
      svgEl("feMergeNode", { in: "blur" }, hlMg);
      svgEl("feMergeNode", { in: "SourceGraphic" }, hlMg);

      /* Red glow for subtraction */
      var redFlt = svgEl("filter", { id: "redGlowV4", x: "-25%", y: "-25%", width: "150%", height: "150%" }, defs);
      svgEl("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "6", result: "blur" }, redFlt);
      var redMg = svgEl("feMerge", {}, redFlt);
      svgEl("feMergeNode", { in: "blur" }, redMg);
      svgEl("feMergeNode", { in: "SourceGraphic" }, redMg);

      /* ── NEW: Diagonal strikethrough hatch pattern for subtraction visual ── */
      /* 8×8 tile, diagonal lines at 45° — applied as fill on the inner-circle  */
      /* overlay mask circle to signal "this area is being removed"              */
      var hatchPat = svgEl("pattern", {
        id: "subHatchV4", width: "8", height: "8",
        patternUnits: "userSpaceOnUse", patternTransform: "rotate(45 0 0)"
      }, defs);
      svgEl("rect", { width: "8", height: "8", fill: "rgba(239,68,68,0.50)" }, hatchPat);
      svgEl("line", {
        x1: "0", y1: "0", x2: "0", y2: "8",
        stroke: "#ef4444", "stroke-width": "3.2", "stroke-opacity": "1"
      }, hatchPat);

      /* Gold glow for ring-reveal pulse after subtraction completes */
      var goldFlt = svgEl("filter", { id: "goldGlowV4", x: "-25%", y: "-25%", width: "150%", height: "150%" }, defs);
      svgEl("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "5", result: "blur" }, goldFlt);
      var goldMg = svgEl("feMerge", {}, goldFlt);
      svgEl("feMergeNode", { in: "blur" }, goldMg);
      svgEl("feMergeNode", { in: "SourceGraphic" }, goldMg);

      /* Grid pattern */
      var pat = svgEl("pattern", { id: "gridV4", width: "40", height: "40", patternUnits: "userSpaceOnUse" }, defs);
      svgEl("path", { d: "M40 0L0 0 0 40", fill: "none", stroke: "rgba(255,255,255,0.024)", "stroke-width": ".5" }, pat);

      /* Arrow marker */
      var marker = svgEl("marker", {
        id: "diffArrowV4", viewBox: "0 0 8 8", refX: "4", refY: "4",
        markerWidth: "5", markerHeight: "5", orient: "auto-start-reverse"
      }, defs);
      svgEl("path", { d: "M1,1 L7,4 L1,7 Z", fill: "#f59e0b" }, marker);

      /* ── Background ── */
      svgEl("rect", { width: "500", height: "500", fill: DARK }, svg);
      gridBg = svgEl("rect", { width: "500", height: "500", fill: "url(#gridV4)", opacity: "0" }, svg);
      bgGlow = svgEl("circle", { cx: CX, cy: "290", r: "260", fill: "url(#gloV4)", opacity: "0" }, svg);

      /* ── Groups ── */
      fG     = svgEl("g", { id: "fGv4" }, svg);
      sG     = svgEl("g", { id: "sGv4" }, svg);
      lG     = svgEl("g", { id: "lGv4" }, svg);
      annotG = svgEl("g", { id: "annotGv4" }, svg);
      gaussG = svgEl("g", { id: "gaussGv4", opacity: "0" }, svg);
      finG   = svgEl("g", { id: "finGv4", opacity: "0" }, svg);

      /* ── Common point ── */
      cDot = svgEl("circle", { cx: CX, cy: BY, r: "5", fill: "#f59e0b", opacity: "0", filter: "url(#ringGlowV4)" }, svg);
      cLabel = svgEl("text", {
        x: CX, y: BY + 18, "text-anchor": "middle",
        fill: "rgba(255,255,255,0.35)", "font-size": "9.5", opacity: "0", "font-family": "system-ui"
      }, svg);
      cLabel.textContent = "common point";

      /* ── Filled circles (back-to-front) ── */
      for (var r = N; r >= 1; r--) {
        var c = cc(r);
        fills[r] = svgEl("circle", {
          cx: c.cx, cy: c.cy, r: r * S,
          fill: r % 2 === 0 ? ringColor(r / 2) : DARK, opacity: "0"
        }, fG);
      }

      /* ── Stroke circles + radius labels ── */
      for (var r = 1; r <= N; r++) {
        var c = cc(r), sr = r * S, ci = 2 * Math.PI * sr;
        strks[r] = svgEl("circle", {
          cx: c.cx, cy: c.cy, r: sr, fill: "none", stroke: SC, "stroke-width": "1.5",
          "stroke-dasharray": ci, "stroke-dashoffset": ci, opacity: ".7",
          transform: "rotate(90 " + c.cx + " " + c.cy + ")"
        }, sG);

        rLab[r] = svgEl("text", {
          x: CX + sr + 10, y: c.cy,
          "text-anchor": "start", "dominant-baseline": "central",
          fill: "rgba(255,255,255,0.5)", "font-size": "11", opacity: "0",
          "font-family": "system-ui", "font-weight": "500"
        }, lG);
        rLab[r].textContent = "r\u202F=\u202F" + r;
      }

      /* ── K labels (ring midpoints) ── */
      var kCount = Math.floor(N / 2);
      for (var k = 1; k <= kCount; k++) {
        var midY = BY - (4 * k - 1) * S / 2;
        kLab[k] = svgEl("text", {
          x: CX, y: midY, "text-anchor": "middle", "dominant-baseline": "central",
          fill: "#e0e7ff", "font-size": "13", "font-weight": "700", opacity: "0", "font-family": "system-ui"
        }, lG);
        kLab[k].textContent = "k\u202F=\u202F" + k;
      }
    },

    getElements: function () {
      return { fills: fills, strks: strks, rLab: rLab, kLab: kLab, fG: fG, sG: sG, lG: lG, finG: finG, annotG: annotG };
    },

    timelineAction: function (tl, method, params, t) {
      var CX = config.cx, BY = config.baseY, S = config.scale;
      var DARK = config.darkColor;
      var N = config.circleCount;
      var self = this;

      switch (method) {

        /* ── Background ── */
        case "showGrid":
          tl.to(gridBg, { opacity: 1, duration: params.duration || 1.0 }, t);
          break;
        case "showGlow":
          tl.to(bgGlow, { opacity: 1, duration: params.duration || 1.2 }, t);
          break;
        case "showDot":
          tl.to(cDot, { opacity: 1, duration: 0.5, ease: "back.out(3)" }, t);
          tl.to(cLabel, { opacity: 1, duration: 0.6 }, t + 0.25);
          break;

        /* ── Circle drawing ── */
        case "drawCircle":
          var r = typeof params === "number" ? params : params.r;
          tl.to(strks[r], { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut" }, t);
          tl.to(fills[r], { opacity: 1, duration: 0.5 }, t + 1.0);
          tl.to(rLab[r], { opacity: 1, duration: 0.3 }, t + 0.3);
          if (r < N) tl.to(rLab[r], { opacity: 0, duration: 0.2 }, t + 1.8);
          if (r % 2 === 0) {
            var kk = r / 2;
            tl.to(kLab[kk], { opacity: 1, duration: 0.35 }, t + 1.3);
            if (kk < Math.floor(N / 2)) tl.to(kLab[kk], { opacity: 0, duration: 0.2 }, t + 1.8);
          }
          break;

        case "drawCirclePair":
          this.timelineAction(tl, "drawCircle", { r: params.from }, t);
          this.timelineAction(tl, "drawCircle", { r: params.from + 1 }, t + 1.0);
          break;

        /* ── Highlighting ── */
        case "highlightCircle":
          tl.to(strks[params.r], { attr: { stroke: "#f59e0b", "stroke-width": "3" }, filter: "url(#hlGlowV4)", duration: 0.4 }, t);
          tl.to(rLab[params.r], { opacity: 1, attr: { fill: "#fbbf24" }, duration: 0.3 }, t);
          break;

        case "unhighlightCircle":
          tl.to(strks[params.r], { attr: { stroke: config.strokeColor, "stroke-width": "1.5" }, filter: "none", duration: 0.3 }, t);
          tl.to(rLab[params.r], { attr: { fill: "rgba(255,255,255,0.5)" }, duration: 0.3 }, t);
          break;

        case "highlightRingPair":
          this.timelineAction(tl, "highlightCircle", { r: 2 * params.k - 1 }, t);
          this.timelineAction(tl, "highlightCircle", { r: 2 * params.k }, t + 0.15);
          break;

        case "unhighlightRingPair":
          this.timelineAction(tl, "unhighlightCircle", { r: 2 * params.k - 1 }, t);
          this.timelineAction(tl, "unhighlightCircle", { r: 2 * params.k }, t + 0.1);
          break;

        case "focusRing":
          var target = params.k || 1;
          var kCount = Math.floor(N / 2);
          for (var k = 1; k <= kCount; k++) {
            var dim = k !== target;
            tl.to(fills[2 * k], { attr: { fill: k === target ? "rgba(245,158,11,0.58)" : ringColor(k) }, opacity: dim ? 0.18 : 1, duration: 0.5 }, t);
            tl.to(fills[2 * k - 1], { opacity: dim ? 0.12 : 1, duration: 0.5 }, t);
            tl.to(kLab[k], { opacity: k === target ? 1 : 0, duration: 0.3 }, t);
          }
          break;

        case "unfocusRings":
          var kCount = Math.floor(N / 2);
          for (var k = 1; k <= kCount; k++) {
            tl.to(fills[2 * k], { attr: { fill: ringColor(k) }, opacity: 1, duration: 0.5 }, t);
            tl.to(fills[2 * k - 1], { opacity: 1, duration: 0.5 }, t);
            tl.to(kLab[k], { opacity: 1, duration: 0.3 }, t);
          }
          break;

        case "focusMultipleRings":
          var targets = params.rings || [];
          var kCount = Math.floor(N / 2);
          for (var k = 1; k <= kCount; k++) {
            var isTarget = targets.indexOf(k) !== -1;
            tl.to(fills[2 * k], { attr: { fill: isTarget ? "rgba(245,158,11,0.58)" : ringColor(k) }, opacity: isTarget ? 1 : 0.18, duration: 0.5 }, t);
            tl.to(fills[2 * k - 1], { opacity: isTarget ? 1 : 0.12, duration: 0.5 }, t);
            tl.to(kLab[k], { opacity: isTarget ? 1 : 0, duration: 0.3 }, t);
          }
          break;

        /* ── Ring area annotations — FIXED: labels at diffColX() ── */
        case "showRingArea":
          var k = params.k;
          var area = 4 * k - 1;
          var midY = BY - (4 * k - 1) * S / 2;
          var areaX = diffColX();
          var alab = svgEl("text", {
            x: areaX, y: midY + 1,
            "text-anchor": "middle", "dominant-baseline": "central",
            fill: "rgba(251,191,36,0)", "font-size": "10.5",
            "font-family": "system-ui", "font-weight": "700"
          }, annotG);
          alab.textContent = area + "\u03C0";
          tl.to(alab, { attr: { fill: "rgba(251,191,36,0.95)" }, duration: 0.5 }, t);

          /* Dot connector from the ring's right boundary to the area label column */
          var rbX = CX + 2 * k * S;
          var connX1 = rbX + 4, connX2 = areaX - 16;
          if (connX1 < connX2) {
            var connLine = svgEl("line", {
              x1: connX1, y1: midY, x2: connX2, y2: midY,
              stroke: "rgba(245,158,11,0)", "stroke-width": "0.8", "stroke-dasharray": "3,2"
            }, annotG);
            tl.to(connLine, { attr: { stroke: "rgba(245,158,11,0.45)" }, duration: 0.4 }, t + 0.2);
          }
          break;

        /* FIXED: arrows at diffColX(), pointing upward in a clean column */
        case "showDiffArrow":
          var fromK = params.from, toK = params.to;
          var fromY = BY - (4 * fromK - 1) * S / 2;
          var toY   = BY - (4 * toK - 1) * S / 2;
          var arrowX = diffColX() + 22;

          var arrow = svgEl("line", {
            x1: arrowX, y1: fromY, x2: arrowX, y2: fromY,
            stroke: "#f59e0b", "stroke-width": "1.5",
            "marker-end": "url(#diffArrowV4)", opacity: "0"
          }, annotG);

          var midArrowY = (fromY + toY) / 2;
          var dLabel = svgEl("text", {
            x: arrowX + 11, y: midArrowY + 1,
            "text-anchor": "start", "dominant-baseline": "central",
            fill: "rgba(245,158,11,0)", "font-size": "9.5",
            "font-family": "system-ui", "font-weight": "700"
          }, annotG);
          dLabel.textContent = "+4\u03C0";

          tl.to(arrow, { opacity: 1, duration: 0.2 }, t);
          tl.to(arrow, { attr: { y2: toY }, duration: 0.55, ease: "power2.out" }, t + 0.2);
          tl.to(dLabel, { attr: { fill: "rgba(245,158,11,0.85)" }, duration: 0.35 }, t + 0.55);
          break;

        case "clearAnnotations":
          tl.to(annotG, { opacity: 0, duration: 0.3 }, t);
          tl.call(function () {
            annotG.innerHTML = "";
            annotG.setAttribute("opacity", "1");
          }, null, t + 0.35);
          break;

        /* ── Pulse effects ── */
        case "pulseRing":
          var k = typeof params === "number" ? params : (params.ring || params.k);
          tl.to(fills[2 * k], { attr: { fill: "rgba(245,158,11,0.65)" }, duration: 0.3 }, t);
          tl.to(fills[2 * k], { attr: { fill: ringColor(k) }, duration: 0.5 }, t + 0.65);
          break;

        case "pulseRingWithArea":
          this.timelineAction(tl, "pulseRing", { k: params.k }, t);
          this.timelineAction(tl, "showRingArea", { k: params.k }, t + 0.1);
          break;

        case "revealAreasSequentially":
          var maxK = params.maxK || Math.floor(N / 2);
          var pace = params.pace || 1.5;
          for (var k = 1; k <= maxK; k++) {
            this.timelineAction(tl, "pulseRingWithArea", { k: k }, t + (k - 1) * pace);
            if (k > 1) {
              this.timelineAction(tl, "showDiffArrow", { from: k - 1, to: k }, t + (k - 1) * pace + 0.35);
            }
          }
          break;

        /* ── Label helpers ── */
        case "showAllKLabels":
          var kCount = Math.floor(N / 2);
          for (var k = 1; k <= kCount; k++) {
            tl.to(kLab[k], { opacity: 1, duration: 0.25 }, t + (k - 1) * 0.12);
          }
          break;

        case "hideKLabels":
          var kCount = Math.floor(N / 2);
          for (var k = 1; k <= kCount; k++) {
            tl.to(kLab[k], { opacity: 0, duration: 0.2 }, t);
          }
          break;

        case "hideAllRadiusLabels":
          for (var r = 1; r <= N; r++) tl.to(rLab[r], { opacity: 0, duration: 0.2 }, t);
          break;

        case "hideLabelAndDot":
          tl.to(rLab[N], { opacity: 0, duration: 0.2 }, t);
          tl.to(cLabel, { opacity: 0, duration: 0.2 }, t + 0.3);
          break;

        /* ════════════════════════════════════════════════════════════
           REDESIGNED Subtraction animation — clear visual story:
           BEFORE: full outer disc shown, THEN inner hatched + removed,
           AFTER: clean coloured ring with area label.
           ════════════════════════════════════════════════════════════ */
        case "animateSubtraction":
          var k = params.k;
          var innerR = 2 * k - 1, outerR = 2 * k;
          var innerCy = BY - innerR * S;

          /* ── BEFORE banner: "outer circle = π(2k)²" ─────────────── */
          var beforeLbl = svgEl("text", {
            x: CX, y: BY - outerR * S - 14,
            "text-anchor": "middle", "dominant-baseline": "central",
            fill: "rgba(129,140,248,0)", "font-size": "11", "font-weight": "700",
            "font-family": "system-ui", "letter-spacing": "0.3px"
          }, annotG);
          beforeLbl.textContent = "BEFORE  \u2014  outer disc: \u03C0(" + (2 * k) + ")\u00B2 = " + (4 * k * k) + "\u03C0";
          tl.to(beforeLbl, { attr: { fill: "rgba(129,140,248,0.85)" }, duration: 0.35 }, t);

          /* Step 1 — outer ring glows amber: "look at the outer disc" */
          tl.to(fills[outerR], {
            attr: { fill: "rgba(245,158,11,0.42)" }, filter: "url(#hlGlowV4)", duration: 0.35
          }, t + 0.05);

          /* Step 2 — inner circle pulses red border: attention cue */
          tl.to(strks[innerR], {
            attr: { stroke: "#ef4444", "stroke-width": "3" }, filter: "url(#redGlowV4)", duration: 0.3
          }, t + 0.4);

          /* Step 3 — overlay HATCH mask circle on the inner circle:
                      "REMOVE THIS" diagonal strikethrough                 */
          var hatchOverlay = svgEl("circle", {
            cx: CX, cy: innerCy, r: innerR * S,
            fill: "url(#subHatchV4)", opacity: "0",
            filter: "url(#redGlowV4)"
          }, annotG);

          /* "REMOVE THIS" stamp label centred in the inner circle */
          var stampLbl = svgEl("text", {
            x: CX, y: innerCy,
            "text-anchor": "middle", "dominant-baseline": "central",
            fill: "rgba(255,255,255,0)", "font-size": "10.5", "font-weight": "900",
            "font-family": "system-ui", "letter-spacing": "1px"
          }, annotG);
          stampLbl.textContent = "\u2212 REMOVE \u2212";

          /* Subtraction formula label */
          var subLabel = svgEl("text", {
            x: CX, y: innerCy + innerR * S + 16,
            "text-anchor": "middle", "dominant-baseline": "central",
            fill: "rgba(239,68,68,0)", "font-size": "11.5", "font-weight": "700",
            "font-family": "system-ui"
          }, annotG);
          subLabel.textContent = "\u2212\u03C0(" + (2 * k - 1) + ")\u00B2  =  \u2212" + ((2 * k - 1) * (2 * k - 1)) + "\u03C0";

          tl.to(hatchOverlay, { opacity: 1, duration: 0.45, ease: "power2.out" }, t + 0.65);
          tl.to(stampLbl,    { attr: { fill: "rgba(255,255,255,0.95)" }, duration: 0.3 }, t + 0.85);
          tl.to(subLabel,    { attr: { fill: "rgba(239,68,68,0.92)" }, duration: 0.35 }, t + 0.95);

          /* Dismiss "BEFORE" label */
          tl.to(beforeLbl, { attr: { fill: "rgba(129,140,248,0)" }, duration: 0.25 }, t + 1.05);

          /* ── SUBTRACTION HAPPENS — hatch + stamp slam out, fill erases ── */
          tl.to(hatchOverlay, { opacity: 0, duration: 0.55, ease: "power3.in" }, t + 1.35);
          tl.to(stampLbl,     { attr: { fill: "rgba(255,255,255,0)" }, duration: 0.3 }, t + 1.35);
          tl.to(subLabel,     { attr: { fill: "rgba(239,68,68,0)" }, duration: 0.3 }, t + 1.45);

          /* Inner circle fill vanishes to dark — the "erasure" */
          tl.to(fills[innerR], {
            attr: { fill: DARK }, filter: "none", duration: 0.65, ease: "power2.inOut"
          }, t + 1.4);
          tl.to(strks[innerR], {
            attr: { stroke: config.strokeColor, "stroke-width": "1.5" }, filter: "none", duration: 0.4
          }, t + 1.4);

          /* ── AFTER: ring pulses gold + area label ─────────────────── */
          /* "AFTER" banner */
          var afterLbl = svgEl("text", {
            x: CX, y: BY - outerR * S - 14,
            "text-anchor": "middle", "dominant-baseline": "central",
            fill: "rgba(34,197,94,0)", "font-size": "11", "font-weight": "700",
            "font-family": "system-ui", "letter-spacing": "0.3px"
          }, annotG);
          afterLbl.textContent = "AFTER  \u2014  ring area = " + (4 * k - 1) + "\u03C0";
          tl.to(afterLbl, { attr: { fill: "rgba(34,197,94,0.88)" }, duration: 0.4 }, t + 1.85);

          /* Ring pulses bright gold with glow */
          tl.to(fills[outerR], {
            attr: { fill: "rgba(245,158,11,0.75)" }, filter: "url(#goldGlowV4)", duration: 0.35
          }, t + 1.7);

          /* Area result label floats in the ring midpoint */
          var areaK = 4 * k - 1;
          var midYK = BY - (4 * k - 1) * S / 2;
          var ringLabel = svgEl("text", {
            x: CX, y: midYK,
            "text-anchor": "middle", "dominant-baseline": "central",
            fill: "rgba(251,191,36,0)", "font-size": "13.5", "font-weight": "700",
            "font-family": "system-ui"
          }, annotG);
          ringLabel.textContent = "= " + areaK + "\u03C0";
          tl.to(ringLabel, { attr: { fill: "rgba(251,191,36,0.95)" }, duration: 0.45 }, t + 1.95);

          /* Ring settles to its normal colour, glow fades */
          tl.to(fills[outerR], {
            attr: { fill: ringColor(k) }, filter: "none", duration: 0.55
          }, t + 2.35);
          break;

        /* ── Animated Gauss Pairing ── */
        case "showGaussPairing":
          /* Fade circles away, reveal Gauss table */
          tl.to([fG, sG, lG, annotG], { opacity: 0, duration: 0.6 }, t);
          tl.to(cDot, { opacity: 0, duration: 0.4 }, t);

          /* ── Layout constants ── */
          var gN = 4;                      /* example: n = 4 terms         */
          var gVals  = [3,  7,  11, 15];   /* S written forward             */
          var gRvals = [15, 11, 7,  3];    /* S written reversed            */
          var gColSum = 18;                /* each column sums to 18π       */
          var gColW = 60, gColH = 30, gColGap = 10;
          var gTotalW = gN * (gColW + gColGap) - gColGap;
          var gStartX = CX - gTotalW / 2;
          /* Row Y (top edge of each box) */
          var gRow1Y = 100, gRow2Y = 154;  /* the two S= rows              */
          var gRow3Y = 214;                /* 2S= sum row                   */
          /* Running "2S = Xπ" counter below the table */
          var gCounterY = 308;
          /* Final "S = 36π" reveal */
          var gResultY  = 388;
          /* Right-edge x for the "S =" row-label text */
          var gLabelX   = gStartX - 8;
          /* How far arches rise above row-1 boxes */
          var gArcLift  = 42;

          /* Clear old gauss content; stash live refs on the group element itself
             so animatePairColumn and showGaussResult can reach them without
             fragile querySelectorAll index arithmetic.                          */
          gaussG.innerHTML = "";
          gaussG.setAttribute("opacity", "0");
          gaussG._pairCols   = [];          /* per-column element bundle          */
          gaussG._counterEl  = null;        /* running "2S = Xπ" text node        */
          gaussG._resultEl   = null;        /* final "S = 36π" text node          */
          gaussG._div2El     = null;        /* "÷2" annotation                    */
          gaussG._tagEl      = null;        /* confirmation tagline               */
          gaussG._accumProxy = { val: 0 }; /* GSAP-tweened proxy for counter     */

          /* ── Section title ── */
          svgEl("text", {
            x: CX, y: 64, "text-anchor": "middle",
            fill: "rgba(99,102,241,0.9)", "font-size": "14.5", "font-weight": "700",
            "font-family": "system-ui", "letter-spacing": "0.5px"
          }, gaussG).textContent = "Gauss Pairing Trick  (n\u202F=\u202F4)";

          /* ── Row labels ── */
          (function () {
            function lbl(txt, rowTopY) {
              svgEl("text", {
                x: gLabelX, y: rowTopY + gColH / 2,
                "text-anchor": "end", "dominant-baseline": "central",
                fill: "rgba(255,255,255,0.65)", "font-size": "13", "font-weight": "600",
                "font-family": "system-ui"
              }, gaussG).textContent = txt;
            }
            lbl("S\u202F=",  gRow1Y);
            lbl("S\u202F=",  gRow2Y);
            lbl("2S\u202F=", gRow3Y);
          })();

          /* ── Separator line between row-2 and row-3 ── */
          gaussG._sepLine = svgEl("line", {
            x1: gStartX - 4,           y1: gRow2Y + gColH + 10,
            x2: gStartX + gTotalW + 4, y2: gRow2Y + gColH + 10,
            stroke: "rgba(255,255,255,0.22)", "stroke-width": "1.2", opacity: "0"
          }, gaussG);

          /* ── Column boxes + pairing arches ── */
          for (var gci = 0; gci < gN; gci++) {
            (function (ci) {
              var bx  = gStartX + ci * (gColW + gColGap);
              var cx2 = bx + gColW / 2;

              /* Row-1 box (S forward) */
              var r1bg = svgEl("rect", {
                x: bx, y: gRow1Y, width: gColW, height: gColH, rx: "6",
                fill: "rgba(99,102,241,0.28)", stroke: "rgba(99,102,241,0.45)",
                "stroke-width": "1.2", opacity: "0"
              }, gaussG);
              var r1txt = svgEl("text", {
                x: cx2, y: gRow1Y + gColH / 2,
                "text-anchor": "middle", "dominant-baseline": "central",
                fill: "#e0e7ff", "font-size": "13.5", "font-weight": "700",
                "font-family": "system-ui", opacity: "0"
              }, gaussG);
              r1txt.textContent = gVals[ci] + "\u03C0";

              /* Row-2 box (S reversed) */
              var r2bg = svgEl("rect", {
                x: bx, y: gRow2Y, width: gColW, height: gColH, rx: "6",
                fill: "rgba(139,92,246,0.24)", stroke: "rgba(139,92,246,0.4)",
                "stroke-width": "1.2", opacity: "0"
              }, gaussG);
              var r2txt = svgEl("text", {
                x: cx2, y: gRow2Y + gColH / 2,
                "text-anchor": "middle", "dominant-baseline": "central",
                fill: "#c4b5fd", "font-size": "13.5", "font-weight": "700",
                "font-family": "system-ui", opacity: "0"
              }, gaussG);
              r2txt.textContent = gRvals[ci] + "\u03C0";

              /* Row-3 sum box — hidden until animatePairColumn fires */
              var r3bg = svgEl("rect", {
                x: bx, y: gRow3Y, width: gColW, height: gColH, rx: "6",
                fill: "rgba(245,158,11,0)", stroke: "rgba(245,158,11,0)",
                "stroke-width": "1.8", opacity: "0"
              }, gaussG);
              var r3txt = svgEl("text", {
                x: cx2, y: gRow3Y + gColH / 2,
                "text-anchor": "middle", "dominant-baseline": "central",
                fill: "rgba(251,191,36,0)", "font-size": "13.5", "font-weight": "700",
                "font-family": "system-ui", opacity: "0"
              }, gaussG);
              r3txt.textContent = gColSum + "\u03C0";

              /* Pairing arch drawn ABOVE the table.
                 Both boxes share the same cx2 (same column), so the arch fans
                 left and right symmetrically.  A two-segment cubic bézier:
                   M cx2, gRow1Y               (top of row-1 box)
                   C cx2-fan, gRow1Y
                     cx2-fan, gArcPeakY
                     cx2, gArcPeakY            (crown of arch)
                   C cx2+fan, gArcPeakY
                     cx2+fan, gRow2Y+gColH
                     cx2, gRow2Y+gColH         (bottom of row-2 box)
              */
              var gArcPeakY = gRow1Y - gArcLift;
              var gArcFan   = gColW * 0.60;
              var arcD = [
                "M", cx2, gRow1Y,
                "C", cx2 - gArcFan, gRow1Y,
                     cx2 - gArcFan, gArcPeakY,
                     cx2, gArcPeakY,
                "C", cx2 + gArcFan, gArcPeakY,
                     cx2 + gArcFan, gRow2Y + gColH,
                     cx2, gRow2Y + gColH
              ].join(" ");

              var arc = svgEl("path", {
                d: arcD, fill: "none",
                stroke: "rgba(245,158,11,0)", "stroke-width": "2.4",
                "stroke-linecap": "round",
                "stroke-dasharray": "220", "stroke-dashoffset": "220"
              }, gaussG);

              /* Small "= 18π" badge at the arch crown */
              var arcBadge = svgEl("text", {
                x: cx2, y: gArcPeakY - 7,
                "text-anchor": "middle",
                fill: "rgba(251,191,36,0)", "font-size": "11", "font-weight": "700",
                "font-family": "system-ui"
              }, gaussG);
              arcBadge.textContent = "= " + gColSum + "\u03C0";

              gaussG._pairCols.push({
                r1bg: r1bg, r1txt: r1txt,
                r2bg: r2bg, r2txt: r2txt,
                r3bg: r3bg, r3txt: r3txt,
                arc:  arc,  arcBadge: arcBadge
              });
            })(gci);
          }

          /* ── Running "2S = Xπ" counter row ── */
          svgEl("text", {
            x: gLabelX, y: gCounterY,
            "text-anchor": "end", "dominant-baseline": "central",
            fill: "rgba(255,255,255,0.5)", "font-size": "14", "font-weight": "600",
            "font-family": "system-ui"
          }, gaussG).textContent = "2S\u202F=";

          gaussG._counterEl = svgEl("text", {
            x: gLabelX + 10, y: gCounterY,
            "text-anchor": "start", "dominant-baseline": "central",
            fill: "rgba(245,158,11,0.9)", "font-size": "24", "font-weight": "800",
            "font-family": "system-ui", opacity: "0"
          }, gaussG);
          gaussG._counterEl.textContent = "0\u03C0";

          /* ── Final result elements: divider line, ÷2 label, S=36π, tagline ── */
          var gDivY = gResultY - 28;
          svgEl("line", {
            x1: CX - 62, y1: gDivY, x2: CX + 62, y2: gDivY,
            stroke: "rgba(255,255,255,0)", "stroke-width": "1.2",
            id: "gaussDivLine"
          }, gaussG);

          gaussG._div2El = svgEl("text", {
            x: CX + 70, y: gDivY - 8,
            "text-anchor": "start", "dominant-baseline": "central",
            fill: "rgba(255,255,255,0)", "font-size": "12", "font-weight": "600",
            "font-family": "system-ui"
          }, gaussG);
          gaussG._div2El.textContent = "\u00F72";

          gaussG._resultEl = svgEl("text", {
            x: CX, y: gResultY,
            "text-anchor": "middle", "dominant-baseline": "central",
            fill: "rgba(34,197,94,0)", "font-size": "28", "font-weight": "800",
            "font-family": "system-ui"
          }, gaussG);
          gaussG._resultEl.textContent = "S\u202F=\u202F36\u03C0";

          gaussG._tagEl = svgEl("text", {
            x: CX, y: gResultY + 28,
            "text-anchor": "middle", "dominant-baseline": "central",
            fill: "rgba(34,197,94,0)", "font-size": "11.5", "font-weight": "600",
            "font-family": "system-ui"
          }, gaussG);
          gaussG._tagEl.textContent = "= 4 \u00D7 (2\u00B74\u202F+\u202F1)\u03C0 \u2713";

          /* ── Entrance animation ── */
          tl.to(gaussG, { opacity: 1, duration: 0.5 }, t + 0.7);

          /* Stagger-reveal all row-1 and row-2 boxes */
          var gAllRow12 = [];
          for (var gci2 = 0; gci2 < gN; gci2++) {
            var gcol0 = gaussG._pairCols[gci2];
            gAllRow12.push(gcol0.r1bg, gcol0.r1txt, gcol0.r2bg, gcol0.r2txt);
          }
          tl.to(gAllRow12, { opacity: 1, duration: 0.45, stagger: 0.07 }, t + 1.1);
          tl.to(gaussG._sepLine, { opacity: 1, duration: 0.4 }, t + 1.6);
          /* Counter fades in showing "0π", ready to count up */
          tl.to(gaussG._counterEl, { opacity: 1, duration: 0.4 }, t + 1.75);
          break;

        case "animatePairColumn":
          /* Dramatic per-column pairing sequence:
               1. Row-1 + row-2 boxes flash gold
               2. Pairing arch draws itself (stroke-dashoffset to 0)
               3. Arch crown badge "= 18pi" pops in
               4. Row-3 sum box bounces into view
               5. Running "2S = Xpi" counter increments via GSAP proxy tween
          */
          (function (colIdx) {
            var gcol = gaussG._pairCols && gaussG._pairCols[colIdx];
            if (!gcol) return;
            var newSum = (colIdx + 1) * 18;

            /* Step 1 — flash row-1 + row-2 boxes amber */
            tl.to(gcol.r1bg, {
              attr: { fill: "rgba(245,158,11,0.42)", stroke: "#f59e0b", "stroke-width": "2" },
              duration: 0.28
            }, t);
            tl.to(gcol.r2bg, {
              attr: { fill: "rgba(245,158,11,0.42)", stroke: "#f59e0b", "stroke-width": "2" },
              duration: 0.28
            }, t + 0.09);

            /* Step 2 — arch draws itself with a gold stroke */
            tl.to(gcol.arc, {
              attr: { stroke: "rgba(245,158,11,0.88)", "stroke-dashoffset": "0" },
              duration: 0.52, ease: "power2.out"
            }, t + 0.20);

            /* Step 3 — badge pops at the crown */
            tl.to(gcol.arcBadge, {
              attr: { fill: "rgba(251,191,36,0.95)" },
              duration: 0.30, ease: "back.out(2)"
            }, t + 0.60);

            /* Step 4 — row-3 box bounces in */
            tl.to(gcol.r3bg, {
              attr: {
                fill: "rgba(245,158,11,0.22)",
                stroke: "rgba(245,158,11,0.75)", "stroke-width": "1.8"
              },
              opacity: 1, duration: 0.38, ease: "back.out(2.2)"
            }, t + 0.46);
            tl.to(gcol.r3txt, {
              attr: { fill: "rgba(251,191,36,0.95)" },
              opacity: 1, duration: 0.28
            }, t + 0.58);

            /* Step 5 — counter counts up smoothly via proxy */
            var proxy = gaussG._accumProxy;
            tl.to(proxy, {
              val: newSum,
              duration: 0.58, ease: "power1.out",
              onUpdate: function () {
                if (gaussG._counterEl) {
                  gaussG._counterEl.textContent = Math.round(proxy.val) + "\u03C0";
                }
              }
            }, t + 0.44);

          })(params.col || 0);
          break;

        case "showGaussResult":
          /* Finale:
               1. Counter pulses bright then dims (absorbed by the result)
               2. Divider line sweeps across
               3. Division-by-2 annotation appears
               4. "S = 36pi" zooms in green
               5. Brief golden flash then settles green
               6. Tagline confirmation fades in
          */
          /* 1. Counter pulse */
          tl.to(gaussG._counterEl, {
            attr: { fill: "#fde68a", "font-size": "28" }, duration: 0.22, ease: "power2.out"
          }, t);
          tl.to(gaussG._counterEl, {
            attr: { fill: "rgba(245,158,11,0.38)", "font-size": "24" },
            duration: 0.52, ease: "power2.in"
          }, t + 0.52);

          /* 2. Divider line */
          (function () {
            var divLine = gaussG.querySelector("#gaussDivLine");
            if (divLine) {
              tl.to(divLine, { attr: { stroke: "rgba(255,255,255,0.42)" }, duration: 0.38 }, t + 0.36);
            }
          })();

          /* 3. div2 annotation */
          tl.to(gaussG._div2El, {
            attr: { fill: "rgba(255,255,255,0.65)" }, duration: 0.30
          }, t + 0.50);

          /* 4. Result text fades in */
          tl.to(gaussG._resultEl, {
            attr: { fill: "rgba(34,197,94,0.9)" }, duration: 0.52, ease: "back.out(1.6)"
          }, t + 0.78);

          /* 5. Golden flash then settle green */
          tl.to(gaussG._resultEl, {
            attr: { fill: "#fbbf24" }, filter: "url(#hlGlowV4)", duration: 0.18
          }, t + 1.38);
          tl.to(gaussG._resultEl, {
            attr: { fill: "rgba(34,197,94,0.95)" }, filter: "none",
            duration: 0.50, ease: "power2.out"
          }, t + 1.56);

          /* 6. Tagline */
          tl.to(gaussG._tagEl, {
            attr: { fill: "rgba(34,197,94,0.72)" }, duration: 0.38
          }, t + 1.20);
          break;

        case "clearGauss":
          tl.to(gaussG, { opacity: 0, duration: 0.5 }, t);
          tl.to([fG, sG, lG], { opacity: 1, duration: 0.6 }, t + 0.4);
          tl.to(cDot, { opacity: 1, duration: 0.4 }, t + 0.5);
          break;

        /* ════════════════════════════════════════════════════════════
           REDESIGNED Final zoom-out — three-phase celebration:
           Phase A: rapid count-up flicker through all 64 circles
           Phase B: zoom-out reveals full 64-circle nested rings
           Phase C: radial burst from common point + answer box
           ════════════════════════════════════════════════════════════ */
        case "showFinal":
          var FC = config.finalCount, FS = config.finalScale;

          /* Pre-build the 64-circle final geometry (hidden) */
          finG.innerHTML = "";
          for (var r = FC; r >= 1; r--) {
            svgEl("circle", {
              cx: CX, cy: BY - r * FS, r: r * FS,
              fill: r % 2 === 0 ? ringColor(r / 2) : DARK
            }, finG);
          }
          svgEl("circle", { cx: CX, cy: BY, r: "3", fill: "#f59e0b", filter: "url(#ringGlowV4)" }, finG);

          /* Answer box (starts hidden, revealed in phase C) */
          var ansBox = svgEl("g", { opacity: "0" }, finG);
          svgEl("rect", {
            x: CX - 72, y: "30", width: "144", height: "44", rx: "9",
            fill: "rgba(34,197,94,0.15)", stroke: "#22c55e", "stroke-width": "2"
          }, ansBox);
          svgEl("rect", {
            x: CX - 68, y: "34", width: "136", height: "36", rx: "7",
            fill: "rgba(34,197,94,0.08)"
          }, ansBox);
          var ansText = svgEl("text", {
            x: CX, y: "57", "text-anchor": "middle", "dominant-baseline": "central",
            fill: "#22c55e", "font-size": "19", "font-weight": "900",
            "font-family": "system-ui", "letter-spacing": "1px"
          }, ansBox);
          ansText.textContent = "64 CIRCLES";

          /* Phase A: fade out current working view */
          tl.to([fG, sG, lG, annotG, gaussG], { opacity: 0, duration: 0.5 }, t);
          tl.to(cDot, { opacity: 0, duration: 0.3 }, t);

          /* Phase A: count-up flicker — rapid succession of ring count badges */
          /* We build a single text element and use .call() to snap its value  */
          var countBadge = svgEl("text", {
            x: CX, y: "245", "text-anchor": "middle", "dominant-baseline": "central",
            fill: "rgba(129,140,248,0.70)", "font-size": "48", "font-weight": "900",
            "font-family": "system-ui", opacity: "0"
          }, finG);
          countBadge.textContent = "2";

          /* Show badge */
          tl.to(countBadge, { opacity: 1, duration: 0.1 }, t + 0.45);

          /* Flash through circle counts 2, 4, 6 … 64 at ~17 fps */
          var flashStep = 0.06; /* seconds per step */
          var flashCounts = [];
          for (var fc = 2; fc <= 64; fc += 2) { flashCounts.push(fc); }

          for (var fi = 0; fi < flashCounts.length; fi++) {
            (function (fcount, foffset) {
              tl.call(function () {
                countBadge.textContent = fcount;
                /* Colour shifts from indigo → amber → green as we approach 64 */
                if (fcount <= 40) {
                  countBadge.setAttribute("fill", "rgba(129,140,248,0.70)");
                } else if (fcount <= 60) {
                  countBadge.setAttribute("fill", "rgba(245,158,11,0.82)");
                } else {
                  countBadge.setAttribute("fill", "rgba(34,197,94,0.95)");
                }
              }, null, t + 0.45 + foffset);
            })(flashCounts[fi], fi * flashStep);
          }

          /* Phase B: count badge fades, final geometry fades in */
          var phaseB = t + 0.45 + flashCounts.length * flashStep + 0.1;
          tl.to(countBadge, { opacity: 0, duration: 0.35 }, phaseB);
          tl.to(finG, { opacity: 1, duration: 1.4, ease: "power2.inOut" }, t + 0.35);

          /* Phase C: radial burst — delegate to burstEffect */
          self.timelineAction(tl, "burstEffect", { t: phaseB + 0.3 }, phaseB + 0.3);

          /* Phase C: answer box slams in */
          tl.to(ansBox, { opacity: 1, duration: 0.5, ease: "back.out(2.2)" }, phaseB + 0.7);
          break;

        /* ── Radial burst from common point ──────────────────────── */
        /* Draws 12 radial rays emanating from (CX, BY), then fades   */
        case "burstEffect":
          var numRays  = 12;
          var rayLen   = 68;
          var rayGroup = svgEl("g", { opacity: "0" }, finG);
          for (var ri = 0; ri < numRays; ri++) {
            var angleDeg = (ri / numRays) * 360;
            var angleRad = angleDeg * Math.PI / 180;
            var x2ray    = (CX + Math.cos(angleRad) * rayLen).toFixed(2);
            var y2ray    = (BY + Math.sin(angleRad) * rayLen).toFixed(2);
            var hue      = ri % 3;
            var rayColor = hue === 0 ? "rgba(245,158,11,0.85)"
                         : hue === 1 ? "rgba(129,140,248,0.80)"
                         :             "rgba(34,197,94,0.75)";
            var ray = svgEl("line", {
              x1: CX, y1: BY, x2: CX, y2: BY,
              stroke: rayColor, "stroke-width": "2.2",
              "stroke-linecap": "round", opacity: "0.9"
            }, rayGroup);
            /* Stagger each ray slightly for a burst feel */
            tl.call(
              (function (rayEl, tx2, ty2) {
                return function () {
                  if (typeof gsap !== "undefined") {
                    gsap.to(rayEl, { attr: { x2: tx2, y2: ty2 }, duration: 0.35, ease: "power2.out" });
                  } else {
                    rayEl.setAttribute("x2", tx2);
                    rayEl.setAttribute("y2", ty2);
                  }
                };
              })(ray, x2ray, y2ray),
              null,
              t + ri * 0.018
            );
          }
          tl.to(rayGroup, { opacity: 1, duration: 0.18 }, t);
          tl.to(rayGroup, { opacity: 0, duration: 0.7, ease: "power2.in" }, t + 0.65);
          break;

        /* ── Count-up stand-alone action (also usable independently) ── */
        case "countUpCircles":
          var cuGroup = svgEl("g", { opacity: "0" }, finG);
          var cuBadge = svgEl("text", {
            x: CX, y: "240", "text-anchor": "middle", "dominant-baseline": "central",
            fill: "#c4b5fd", "font-size": "52", "font-weight": "900",
            "font-family": "system-ui"
          }, cuGroup);
          cuBadge.textContent = "2";
          tl.to(cuGroup, { opacity: 1, duration: 0.1 }, t);
          var cuMax    = params.max  || FC;
          var cuStep   = params.step || 2;
          var cuPace   = params.pace || 0.06;
          var cuT      = t + 0.1;
          for (var cn = cuStep; cn <= cuMax; cn += cuStep) {
            (function (val, offset) {
              tl.call(function () { cuBadge.textContent = val; }, null, offset);
            })(cn, cuT);
            cuT += cuPace;
          }
          tl.to(cuGroup, { opacity: 0, duration: 0.4 }, cuT + 0.1);
          break;
      }
    },

    drawInteractive: function (n, container) {
      /* container: optional SVG element to draw into; falls back to #isvg */
      var isvg = container || document.getElementById("isvg");
      if (!isvg) return;
      while (isvg.firstChild) isvg.removeChild(isvg.firstChild);
      var CX = config.cx, BY = config.baseY, DARK = config.darkColor;
      var sc = Math.min(220 / n, 50);
      svgEl("rect", { width: "500", height: "500", fill: DARK }, isvg);
      for (var r = n; r >= 1; r--) {
        svgEl("circle", {
          cx: CX, cy: BY - r * sc, r: r * sc,
          fill: r % 2 === 0 ? RING_COLORS[((r / 2) - 1) % 4] : DARK,
          stroke: "rgba(255,255,255,0.03)", "stroke-width": "0.5"
        }, isvg);
      }
      svgEl("circle", { cx: CX, cy: BY, r: Math.max(2, sc * 0.1), fill: "#f59e0b" }, isvg);
    },

    executeAction: function (actionDef, tl, t) {
      this.timelineAction(tl, actionDef.vizAction, actionDef, t);
    },

    highlightRingForCalc: function (k, maxK) {
      for (var j = 1; j <= maxK; j++) {
        gsap.to(fills[2 * j], { attr: { fill: j === k ? "rgba(245,158,11,0.65)" : ringColor(j) }, duration: 0.3 });
        gsap.to(kLab[j], { opacity: j === k ? 1 : 0, duration: 0.3 });
      }
    }
  };
})();


/* ═══════════════════════════════════════════════════════════════════
   SECTION 3 — Lesson Definition
   ═══════════════════════════════════════════════════════════════════ */
MX.lesson("Nested Circles \u2014 The 2023\u03C0 Threshold", function (L) {

  L.source("AMC 10A 2023 #15 (Modified)");
  L.meta({ answer: "64" });

  L.problem(
    "An even number of circles are nested, starting with radius $1$ and increasing by $1$, "
    + "all sharing a common point. The region between every other circle is shaded, "
    + "starting from inside the circle of radius $2$ but outside the circle of radius $1$. "
    + "What is the **least number of circles** needed so the total shaded area is at least $2023\\pi$?",
    { highlight: "Least even number of circles for shaded area \u2265 2023\u03C0" }
  );

  L.viz({
    plugin: "nested_circles_v4",
    config: {
      cx: 250, baseY: 450,
      scale: 25,           /* v4: reduced from 32 so N=8 fits in 500px with annotation room */
      circleCount: 8,
      darkColor: "#0f0e17",
      strokeColor: "#818cf8",
      finalCount: 64, finalScale: 3.4
    }
  });

  L.marker("visualization");


  /* ════════════════════════════════════════════════════════════════
     ACT 1 — Building the Picture  (HOOK version)
     Opens with a provocative title card beat, then builds each
     circle with mounting tension before the pattern reveals itself.
     ════════════════════════════════════════════════════════════════ */
  L.act("Building the Picture", function (A) {
    A.vizPanel("svg");

    /* ── Beat 0: Hook — the question, then silence, then the anchor ── */
    A.say("How many circles until the shaded area beats two-thousand and twenty-three pi? We will build the figure — one circle at a time — and find out.")
     .card("text", { content: "**How many circles** until the shaded area beats $2023\\pi$?" });

    /* ── Beat 1: Stage is set — the anchor point appears first ── */
    A.say("Before a single circle is drawn, one thing exists: a single point. Every circle in this problem touches it. That shared anchor is the whole reason the figure is possible.")
     .do("showGrid")
     .do("showGlow", {}, "+0.4")
     .do("showDot", {}, "+0.8");

    /* ── Beat 2: First circle — small and alone ── */
    A.say("Circle one. Radius one. Just a small disc sitting on the anchor. By itself it tells us nothing about shading — we need at least two circles before anything interesting happens.")
     .do("drawCircle", { r: 1 });

    /* ── Beat 3: Second circle — first shaded ring is born ── */
    A.say("Now radius two expands outward from the same anchor point. Watch the space between the two circles — that coloured band that just appeared? That is ring number one. Our very first shaded region. It has an area. We will calculate it.")
     .do("drawCircle", { r: 2 });

    /* ── Beat 4: Third circle — shading skips, pattern teased ── */
    A.say("Radius three. But notice: no new shading. The gap between circles two and three is dark, left empty. The first pattern hint: not every gap is shaded.")
     .do("drawCircle", { r: 3 });

    /* ── Beat 5: Fourth circle — pattern locks in, feels inevitable ── */
    A.say("Radius four \u2014 and the shading is back! Shade \u2026 skip \u2026 shade \u2026 skip. It alternates with perfect regularity. Once you see it you cannot unsee it.")
     .do("drawCircle", { r: 4 });

    /* ── Beat 6: Complete the 8-circle working example ── */
    A.say("Let's fill out our working example: four more circles, arriving in pairs. Each pair adds exactly one more shaded ring.")
     .do("drawCirclePair", { from: 5 })
     .do("drawCirclePair", { from: 7 }, "+1.5");

    /* ── Beat 7: Reveal the ring labels, land the structural insight ── */
    A.say("Eight circles. Four shaded rings \u2014 one for every two circles. The labels k equals one through four mark each ring. With two-n circles you always get exactly n rings. That one-to-two ratio is the key that unlocks the whole problem.")
     .do("showAllKLabels")
     .show("$2n$ circles $\\rightarrow$ $n$ shaded rings.\n\n**Ring $k$** sits between radii $2k{-}1$ and $2k$.");
  });


  /* ── Gate: shading pattern ── */
  L.ask({
    question: "Which boundaries define the shaded rings?",
    options: [
      "Odd $\\to$ even: $(1{\\to}2),\\ (3{\\to}4),\\ (5{\\to}6),\\ \\ldots$",
      "Even $\\to$ odd: $(2{\\to}3),\\ (4{\\to}5),\\ (6{\\to}7),\\ \\ldots$",
      "Every ring is shaded",
      "Only the outermost ring"
    ],
    correct: 0,
    explain: {
      "correct": "Exactly \u2014 shading runs from each odd radius to the next even one. Ring k: radii (2k\u22121) to 2k.",
      "1": "Look again: the first shaded band starts at radius 1 (odd) \u2192 2 (even), not at 2\u21923.",
      "2": "The pattern alternates \u2014 only every other ring is shaded.",
      "3": "All four rings are shaded in an 8-circle example, not just the outermost."
    }
  });


  /* ════════════════════════════════════════════════════════════════
     ACT 2 — Computing a Ring's Area
     ════════════════════════════════════════════════════════════════ */
  L.act("Computing a Ring's Area", function (A) {
    A.vizPanel("svg");

    A.say("Here's the one move that unlocks everything: a ring is just the big circle with the small circle punched out. Watch the subtraction happen live for ring k equals one.")
     .do("focusRing", { k: 1 })
     .do("highlightRingPair", { k: 1 }, "+0.5");

    A.say("Outer circle: π·2² = 4π. Inner circle: π·1² = π. Four pi in, one pi out — watch that inner disc flash red and vanish. What's left is pure ring.")
     .do("animateSubtraction", { k: 1 }, "+0.5");
  });


  /* ── Gate: circle area (wrongPath has full circle-area recap) ── */
  L.askFillIn({
    label: "outer-area",
    prompt: "The outer circle has radius $2$. What is $\\pi(2)^2\\,?$ &ensp; [___]",
    blank: { answer: ["4\u03C0", "4pi", "4\\pi", "4 pi"], width: 70, placeholder: "?\u03C0" },
    hint: "Square the radius first: $2^2 = 4$. Then multiply by $\\pi$.",
    successMessage: "Right \u2014 the outer area is $4\\pi$.",
    wrongPath: function (B) {

      B.act("Circle Area \u2014 Quick Recap", function (A) {
        A.vizPanel("figure");
        A.say("Area equals π r squared — and that exponent two is not a coincidence. Area lives in two dimensions. Double the radius and you quadruple the room inside. Watch each circle light up: the jumps are squares, not multiples.")
         .card("recap", {
           title: "Circle Area Formula",
           content: [
             { type: "latex", value: "A = \\pi r^2", display: true },
             { type: "text", value: "**Why $r^2$?** Area fills 2-D space. Double $r$ \u2192 four times the area. Triple $r$ \u2192 nine times." },
             { type: "step", num: 1, value: "$r = 1 \\Rightarrow A = \\pi(1)^2 = \\boldsymbol{\\pi}$" },
             { type: "step", num: 2, value: "$r = 2 \\Rightarrow A = \\pi(2)^2 = \\boldsymbol{4\\pi}$" },
             { type: "step", num: 3, value: "$r = 3 \\Rightarrow A = \\pi(3)^2 = \\boldsymbol{9\\pi}$" },
             { type: "example", value: "The multipliers are $1, 4, 9$ \u2014 perfect squares. That pattern is $r^2$ at work." }
           ],
           figure: {
             title: "Area scales as r\u00B2 — animated",
             svg: "<svg viewBox='0 0 380 145' style='width:370px;height:145px'>"
               + "<style>"
               + "@keyframes fadeIn1{0%{opacity:0;fill:rgba(99,102,241,0)}60%{opacity:1;fill:rgba(99,102,241,0.55)}100%{fill:rgba(99,102,241,0.40)}}"
               + "@keyframes fadeIn2{0%,33%{opacity:0;fill:rgba(139,92,246,0)}80%{opacity:1;fill:rgba(139,92,246,0.55)}100%{fill:rgba(139,92,246,0.40)}}"
               + "@keyframes fadeIn3{0%,60%{opacity:0;fill:rgba(109,40,217,0)}100%{opacity:1;fill:rgba(109,40,217,0.45)}}"
               + "@keyframes popLabel{0%{opacity:0;transform:scale(0.4)}80%{transform:scale(1.15)}100%{opacity:1;transform:scale(1)}}"
               + ".c1{animation:fadeIn1 1s ease-out 0.2s both}"
               + ".c2{animation:fadeIn2 1s ease-out 1.2s both}"
               + ".c3{animation:fadeIn3 1s ease-out 2.2s both}"
               + ".l1{animation:popLabel 0.5s ease-out 0.9s both;transform-origin:45px 65px}"
               + ".l2{animation:popLabel 0.5s ease-out 1.9s both;transform-origin:140px 65px}"
               + ".l3{animation:popLabel 0.5s ease-out 2.9s both;transform-origin:275px 65px}"
               + "</style>"
               + "<circle class='c1' cx='45' cy='60' r='22' stroke='#818cf8' stroke-width='1.5'/>"
               + "<circle class='c2' cx='140' cy='60' r='44' stroke='#a78bfa' stroke-width='1.5'/>"
               + "<circle class='c3' cx='275' cy='65' r='66' stroke='#7c3aed' stroke-width='1.5'/>"
               + "<text class='l1' x='45' y='60' text-anchor='middle' dominant-baseline='central' fill='#e0e7ff' font-size='11' font-weight='700' font-family='system-ui'>\u03C0</text>"
               + "<text class='l2' x='140' y='60' text-anchor='middle' dominant-baseline='central' fill='#e0e7ff' font-size='13' font-weight='700' font-family='system-ui'>4\u03C0</text>"
               + "<text class='l3' x='275' y='65' text-anchor='middle' dominant-baseline='central' fill='#e0e7ff' font-size='14' font-weight='700' font-family='system-ui'>9\u03C0</text>"
               + "<text x='45' y='97' text-anchor='middle' fill='rgba(255,255,255,0.5)' font-size='9' font-family='system-ui'>r = 1</text>"
               + "<text x='140' y='117' text-anchor='middle' fill='rgba(255,255,255,0.5)' font-size='9' font-family='system-ui'>r = 2</text>"
               + "<text x='275' y='143' text-anchor='middle' fill='rgba(255,255,255,0.5)' font-size='9' font-family='system-ui'>r = 3</text>"
               + "<text x='348' y='50' fill='rgba(245,158,11,0.85)' font-size='10' font-weight='700' font-family='system-ui'>\u00D7 1</text>"
               + "<text x='348' y='66' fill='rgba(245,158,11,0.85)' font-size='10' font-weight='700' font-family='system-ui'>\u00D7 4</text>"
               + "<text x='348' y='82' fill='rgba(245,158,11,0.85)' font-size='10' font-weight='700' font-family='system-ui'>\u00D7 9</text>"
               + "</svg>",
             caption: "Each circle fades in sequentially \u2014 area multiplies by $r^2$"
           }
         })
         .inline("figure");
      });

      B.act("Area vs. Circumference \u2014 Know the Difference", function (A) {
        A.vizPanel("figure");
        A.say("Classic trap: confusing area with circumference. The edge is one-dimensional — just 2πr. The inside is two-dimensional — πr squared. One exponent, one dimension. Two exponent, two dimensions. Never mix them up again.")
         .card("recap", {
           title: "Area vs. Circumference",
           content: [
             { type: "step", num: 1, value: "**Circumference** (edge, 1-D): $C = 2\\pi r$" },
             { type: "step", num: 2, value: "**Area** (filled, 2-D): $A = \\pi r^2$" },
             { type: "text", value: "**Quick rule:** the exponent on $r$ equals the number of dimensions \u2014 1 for a line, 2 for a surface." }
           ],
           figure: {
             title: "Area (filled) vs. Circumference (edge)",
             svg: "<svg viewBox='0 0 320 135' style='width:310px;height:135px'>"
               + "<style>"
               + "@keyframes fillPulse{0%{fill:rgba(99,102,241,0.12)}50%{fill:rgba(99,102,241,0.50)}100%{fill:rgba(99,102,241,0.32)}}"
               + "@keyframes dashSpin{from{stroke-dashoffset:302}to{stroke-dashoffset:0}}"
               + ".afill{animation:fillPulse 2.4s ease-in-out 0.3s both}"
               + ".cedge{animation:dashSpin 2s linear 0.5s both}"
               + "</style>"
               + "<circle class='afill' cx='82' cy='56' r='48' stroke='#818cf8' stroke-width='1.5'/>"
               + "<text x='82' y='56' text-anchor='middle' dominant-baseline='central' fill='#e0e7ff' font-size='18' font-weight='700' font-family='system-ui'>\u03C0r\u00B2</text>"
               + "<text x='82' y='118' text-anchor='middle' fill='rgba(255,255,255,0.6)' font-size='11' font-family='system-ui'>Area (filled)</text>"
               + "<circle class='cedge' cx='236' cy='56' r='48' fill='none' stroke='#f59e0b' stroke-width='3.5' stroke-dasharray='301' stroke-dashoffset='302'/>"
               + "<text x='236' y='56' text-anchor='middle' dominant-baseline='central' fill='#fbbf24' font-size='18' font-weight='700' font-family='system-ui'>2\u03C0r</text>"
               + "<text x='236' y='118' text-anchor='middle' fill='rgba(255,255,255,0.6)' font-size='11' font-family='system-ui'>Circumference (edge)</text>"
               + "</svg>",
             caption: "Left: area fills the circle. Right: circumference traces the edge."
           }
         })
         .inline("figure");
      });

      /* Re-check: make sure the concept sticks before continuing */
      B.askFillIn({
        label: "outer-area-recheck",
        prompt: "Let\u2019s make sure it clicks. A circle has radius $r = 5$. What is its area? &ensp; [___]",
        blank: { answer: ["25\u03C0", "25pi", "25\\pi", "25 pi"], width: 75, placeholder: "?\u03C0" },
        hint: "Use $A = \\pi r^2$: square $5$ first, then multiply by $\\pi$.",
        successMessage: "Yes! $\\pi(5)^2 = 25\\pi$. Now apply the same move: the outer circle has $r = 2$, so its area is $\\pi(2)^2 = 4\\pi$."
      });
    }
  });

  L.askFillIn({
    label: "ring-1-area",
    prompt: "So the first ring's area is $4\\pi - \\pi =$ [___]",
    blank: { answer: ["3\u03C0", "3pi", "3\\pi", "3 pi"], width: 70, placeholder: "?\u03C0" },
    hint: "Subtract inner from outer: $4\\pi - \\pi$.",
    successMessage: "$3\\pi$ \u2014 our first data point!"
  });


  /* ════════════════════════════════════════════════════════════════
     ACT 3 — The General Ring Formula
     ════════════════════════════════════════════════════════════════ */
  L.act("The General Ring Formula", function (A) {
    A.vizPanel("svg");

    A.say("What we just did for ring one works for every single ring. Ring k lives between radii 2k−1 and 2k. Now watch the algebra — something beautiful is about to cancel.")
     .do("unfocusRings")
     .do("unhighlightRingPair", { k: 1 });

    A.say("Outer minus inner. That's it. π times 2k squared, minus π times (2k−1) squared.")
     .show("$A_k = \\pi(2k)^2 - \\pi(2k{-}1)^2$");

    A.say("Expand both squares. Brace yourself — there's a gorgeous cancellation coming.")
     .show("$= \\pi\\bigl[4k^2 - (4k^2 - 4k + 1)\\bigr]$");

    A.say("The 4k² terms vanish against each other — completely! What survives is shockingly simple.")
     .show("$= \\pi\\bigl[\\cancel{4k^2} - \\cancel{4k^2} + 4k - 1\\bigr]$");

    A.say("Linear! Not quadratic, not complicated — just π times (4k − 1). One formula, infinitely many rings.")
     .show({ type: "latex", content: "A_k = \\pi(4k - 1)", highlight: true });
  });


  L.askFillIn({
    label: "verify-ring-2",
    prompt: "**Check it:** Ring $k=2$ (between radii $3$ and $4$). &ensp; $A_2 = \\pi(4{\\cdot}2-1) =$ [___]",
    blank: { answer: ["7\u03C0", "7pi", "7\\pi", "7 pi"], width: 70, placeholder: "?\u03C0" },
    hint: "$4 \\times 2 - 1 = 7$.",
    successMessage: "$7\\pi$ \u2713 \u2014 also equal to $\\pi(16) - \\pi(9) = 7\\pi$. Formula confirmed."
  });

  L.askFillIn({
    label: "verify-ring-3",
    prompt: "One more check: Ring $k=3$ (radii $5$ and $6$). &ensp; $A_3 = \\pi(4{\\cdot}3-1) =$ [___]",
    blank: { answer: ["11\u03C0", "11pi", "11\\pi", "11 pi"], width: 70, placeholder: "?\u03C0" },
    hint: "$4 \\times 3 - 1 = 11$. Double-check: $\\pi(36) - \\pi(25) = 11\\pi$. \u2713",
    successMessage: "$11\\pi$ \u2713 \u2014 we're building confidence in the formula."
  });


  /* ── Interactive: Ring Area Explorer ── */
  L.ask({
    type: "interactive",
    label: "ring-calc",
    title: "Ring Area Explorer",
    description: "Slide to see each ring's area calculated. Try rings beyond k\u202F=\u202F4 to build intuition.",
    slider: { min: 1, max: 12, step: 1, default: 1 },
    onSlide: function (k) {
      var maxK = 4;
      if (window.EXPLAINER_VIZ) window.EXPLAINER_VIZ.highlightRingForCalc(k, maxK);
    },
    compute: function (k) {
      var area = 4 * k - 1;
      return {
        ring: "k\u202F=\u202F" + k,
        radii: (2 * k - 1) + " \u2192 " + (2 * k),
        outerArea: Math.pow(2 * k, 2) + "\u03C0",
        innerArea: Math.pow(2 * k - 1, 2) + "\u03C0",
        ringArea: area + "\u03C0",
        formula: "4\u00B7" + k + "\u202F\u2212\u202F1\u202F=\u202F" + area
      };
    },
    displays: [
      { field: "ring",      label: "Ring",                  style: "large" },
      { field: "radii",     label: "Between radii" },
      { field: "outerArea", label: "Outer circle area" },
      { field: "innerArea", label: "Inner circle area" },
      { field: "ringArea",  label: "Ring area",             style: "highlight" },
      { field: "formula",   label: "Via \u03C0(4k\u22121)" }
    ]
  });


  /* ════════════════════════════════════════════════════════════════
     ACT 4 — Spotting the Pattern
     ════════════════════════════════════════════════════════════════ */
  L.act("Spotting the Pattern", function (A) {
    A.vizPanel("svg");

    A.say("Now watch all four rings fire up in sequence. Look at the areas appearing to the right — don't just see numbers, hunt for structure.")
     .do("revealAreasSequentially", { maxK: 4, pace: 1.5 });

    A.say("Three pi. Seven pi. Eleven pi. Fifteen pi. Something is constant here — it's screaming at you. Can you hear it before I say it?")
     .show("Ring areas: $\\;3\\pi,\\; 7\\pi,\\; 11\\pi,\\; 15\\pi,\\; \\ldots$");

    A.say("Every single jump is identical. That's no accident — that's an arithmetic sequence, and it's about to hand us a shortcut.")
     .inline("svg");
  });


  /* ── Gate: constant difference ── */
  L.askFillIn({
    label: "find-diff",
    prompt: "$7\\pi - 3\\pi = \\;?$\\quad $11\\pi - 7\\pi = \\;?$\\quad $15\\pi - 11\\pi = \\;?$\n\nCommon difference: [___]",
    blank: { answer: ["4\u03C0", "4pi", "4\\pi", "4 pi", "4"], width: 70, placeholder: "?\u03C0" },
    hint: "Subtract any two consecutive areas: $7 - 3$, or $11 - 7$, or $15 - 11$.",
    successMessage: "Every ring area is exactly $4\\pi$ more than the last. That\u2019s a powerful clue!"
  });


  /* ── Gate: type of sequence ── */
  L.ask({
    question: "A sequence where each term increases by a constant amount is called\u2026",
    options: [
      "Arithmetic sequence",
      "Geometric sequence",
      "Fibonacci sequence",
      "Harmonic sequence"
    ],
    correct: 0,
    explain: {
      "correct": "Right \u2014 constant *additive* difference means arithmetic. First term $3\\pi$, common difference $d = 4\\pi$.",
      "1": "Geometric sequences *multiply* by a constant ratio (like 2, 6, 18\u2026). Ours *adds* $4\\pi$ each time.",
      "2": "Fibonacci adds the two previous terms. Our pattern is simpler \u2014 a fixed step.",
      "3": "Harmonic sequences involve reciprocals ($1, \\tfrac{1}{2}, \\tfrac{1}{3}, \\ldots$). Not our pattern."
    },
    wrongPath: function (B) {
      B.act("Arithmetic Sequences \u2014 Quick Review", function (A) {
        A.vizPanel("figure");
        A.say("Same amount added every step — that's an arithmetic sequence. Our ring areas start at 3π and climb by exactly 4π each time. That fixed step is your golden ticket to the sum formula. Watch the bars grow — the equal step brackets are your proof.")
         .card("recap", {
           title: "Arithmetic Sequences",
           content: [
             { type: "text", value: "**Key idea:** each term is exactly $d$ more than the one before it. Equal steps every time." },
             { type: "step", num: 1, value: "Our ring areas: $3\\pi,\\ 7\\pi,\\ 11\\pi,\\ 15\\pi,\\ \\ldots$" },
             { type: "step", num: 2, value: "Common difference: $d = 7\\pi - 3\\pi = 4\\pi$" },
             { type: "step", num: 3, value: "General term: $a_n = a_1 + (n{-}1)d = 3\\pi + (n{-}1)\\cdot4\\pi$" },
             { type: "example", value: "Term 5: $a_5 = 3\\pi + 4 \\times 4\\pi = 19\\pi$ \u2014 always $+4\\pi$ per step." }
           ],
           figure: {
             title: "Staircase of equal steps (+4\u03C0 each)",
             svg: "<svg viewBox='0 0 310 120' style='width:300px;height:120px'>"
               + "<line x1='18' y1='105' x2='292' y2='105' stroke='rgba(255,255,255,0.15)' stroke-width='1'/>"
               + "<rect x='23' y='77' width='46' height='28' rx='3' fill='rgba(99,102,241,0.55)' stroke='#818cf8' stroke-width='1'>"
               + "<animate attributeName='height' from='0' to='28' dur='0.5s' begin='0.1s' fill='freeze'/>"
               + "<animate attributeName='y' from='105' to='77' dur='0.5s' begin='0.1s' fill='freeze'/>"
               + "</rect>"
               + "<rect x='83' y='61' width='46' height='44' rx='3' fill='rgba(129,140,248,0.55)' stroke='#a78bfa' stroke-width='1'>"
               + "<animate attributeName='height' from='0' to='44' dur='0.5s' begin='0.7s' fill='freeze'/>"
               + "<animate attributeName='y' from='105' to='61' dur='0.5s' begin='0.7s' fill='freeze'/>"
               + "</rect>"
               + "<rect x='143' y='45' width='46' height='60' rx='3' fill='rgba(139,92,246,0.55)' stroke='#8b5cf6' stroke-width='1'>"
               + "<animate attributeName='height' from='0' to='60' dur='0.5s' begin='1.3s' fill='freeze'/>"
               + "<animate attributeName='y' from='105' to='45' dur='0.5s' begin='1.3s' fill='freeze'/>"
               + "</rect>"
               + "<rect x='203' y='29' width='46' height='76' rx='3' fill='rgba(124,58,237,0.55)' stroke='#7c3aed' stroke-width='1'>"
               + "<animate attributeName='height' from='0' to='76' dur='0.5s' begin='1.9s' fill='freeze'/>"
               + "<animate attributeName='y' from='105' to='29' dur='0.5s' begin='1.9s' fill='freeze'/>"
               + "</rect>"
               + "<path d='M69,77 H83 V61' fill='none' stroke='#f59e0b' stroke-width='1.6' stroke-dasharray='3,2' opacity='0'>"
               + "<animate attributeName='opacity' from='0' to='1' dur='0.3s' begin='1.1s' fill='freeze'/>"
               + "</path>"
               + "<path d='M129,61 H143 V45' fill='none' stroke='#f59e0b' stroke-width='1.6' stroke-dasharray='3,2' opacity='0'>"
               + "<animate attributeName='opacity' from='0' to='1' dur='0.3s' begin='1.7s' fill='freeze'/>"
               + "</path>"
               + "<path d='M189,45 H203 V29' fill='none' stroke='#f59e0b' stroke-width='1.6' stroke-dasharray='3,2' opacity='0'>"
               + "<animate attributeName='opacity' from='0' to='1' dur='0.3s' begin='2.3s' fill='freeze'/>"
               + "</path>"
               + "<text x='76' y='57' text-anchor='middle' fill='#f59e0b' font-size='9' font-weight='700' font-family='system-ui' opacity='0'>+4\u03C0<animate attributeName='opacity' from='0' to='1' dur='0.3s' begin='1.2s' fill='freeze'/></text>"
               + "<text x='136' y='41' text-anchor='middle' fill='#f59e0b' font-size='9' font-weight='700' font-family='system-ui' opacity='0'>+4\u03C0<animate attributeName='opacity' from='0' to='1' dur='0.3s' begin='1.8s' fill='freeze'/></text>"
               + "<text x='196' y='25' text-anchor='middle' fill='#f59e0b' font-size='9' font-weight='700' font-family='system-ui' opacity='0'>+4\u03C0<animate attributeName='opacity' from='0' to='1' dur='0.3s' begin='2.4s' fill='freeze'/></text>"
               + "<text x='46' y='115' text-anchor='middle' fill='rgba(255,255,255,0.75)' font-size='10' font-family='system-ui'>3\u03C0</text>"
               + "<text x='106' y='115' text-anchor='middle' fill='rgba(255,255,255,0.75)' font-size='10' font-family='system-ui'>7\u03C0</text>"
               + "<text x='166' y='115' text-anchor='middle' fill='rgba(255,255,255,0.75)' font-size='10' font-family='system-ui'>11\u03C0</text>"
               + "<text x='226' y='115' text-anchor='middle' fill='rgba(255,255,255,0.75)' font-size='10' font-family='system-ui'>15\u03C0</text>"
               + "</svg>",
             caption: "Each bar rises by the same $+4\\pi$ step \u2014 the staircase of an arithmetic sequence"
           }
         })
         .inline("figure");
      });

      /* Re-check: confirm the concept before re-joining the main path */
      B.ask({
        question: "Our ring areas are $3\\pi, 7\\pi, 11\\pi, 15\\pi, \\ldots$ What is the common difference $d$?",
        options: [
          "$d = 4\\pi$ \u2014 each term is $4\\pi$ larger than the previous",
          "$d = 3\\pi$ \u2014 the starting value $a_1$",
          "$d = 7/3$ \u2014 ratio of second term to first",
          "$d = 2\\pi$ \u2014 half the first term"
        ],
        correct: 0,
        explain: {
          "correct": "Exactly \u2014 $7\\pi - 3\\pi = 11\\pi - 7\\pi = 15\\pi - 11\\pi = 4\\pi$. Constant addition each step \u2192 arithmetic sequence.",
          "1": "$3\\pi$ is the first term $a_1$, not the step between terms.",
          "2": "$7/3$ isn\u2019t even constant across consecutive pairs. Arithmetic means *add*, not *multiply*.",
          "3": "$2\\pi$ is not the gap between consecutive terms \u2014 subtract two adjacent terms to find $d$."
        }
      });
    }
  });

  /* ── NEW Gate: nth term formula practice ── */
  L.askFillIn({
    label: "nth-term",
    prompt: "Using the formula $A_k = \\pi(4k-1)$, what is $A_5$ (ring $k=5$)? [___]",
    blank: { answer: ["19\u03C0", "19pi", "19\\pi", "19 pi"], width: 70, placeholder: "?\u03C0" },
    hint: "$4 \\times 5 - 1 = 19$.",
    successMessage: "$19\\pi$ \u2013 the sequence continues $3, 7, 11, 15, 19, \\ldots$"
  });


  /* ════════════════════════════════════════════════════════════════
     ACT 5 — Summing All Rings (Gauss trick, animated in SVG)
     ════════════════════════════════════════════════════════════════ */
  L.act("Summing All the Rings", function (A) {
    A.vizPanel("svg");

    A.say("We need to add all n ring areas — 3π up through (4n−1)π. There is a trick so elegant it feels like cheating: write the sum forward, write it backward, stack them.")
     .show("$S = 3 + 7 + 11 + \\cdots + (4n{-}1)$")
     .do("showGaussPairing", {}, "+0.5");

    A.say("Column one — 3π meets 15π. They sum to 18π. Hold onto that number.")
     .do("animatePairColumn", { col: 0 }, "+0.3");

    A.say("Column two: 7π and 11π. Wait — 18π again? Every single column?")
     .do("animatePairColumn", { col: 1 }, "+0.3");

    A.say("Eighteen π. Eighteen π. Every column, without exception. Four columns, four times 18π — so 2S equals n times (4n+2)π. We're almost there.")
     .do("animatePairColumn", { col: 2 }, "+0.3")
     .do("animatePairColumn", { col: 3 }, "+1.0");

    A.say("Divide by two, factor out a two upstairs — and watch the formula compress into something gorgeous. This is the payoff.")
     .do("showGaussResult", {}, "+0.5")
     .show({ type: "latex", content: "\\text{Total shaded area} = \\pi \\cdot n(2n + 1)", highlight: true });

    A.say("And just to nail the coffin shut: the sigma notation confirms it instantly. Sum of k from 1 to n, factor, simplify — same answer, same beauty.")
     .do("clearGauss", {}, "+0.5")
     .card("derivation", {
       title: "Algebraic Confirmation",
       steps: [
         { latex: "\\sum_{k=1}^{n} \\pi(4k-1) = \\pi\\Bigl[4 \\cdot \\tfrac{n(n+1)}{2} - n\\Bigr]" },
         { latex: "= \\pi\\bigl[2n(n+1) - n\\bigr] = \\pi(2n^2 + n)" },
         { latex: "= \\pi \\cdot n(2n+1) \\qquad \\checkmark", highlight: true }
       ]
     });
  });


  /* ── Gate: verify n=4 ── */
  L.askFillIn({
    label: "verify-n4",
    prompt: "**Sanity check:** For $n=4$ rings: &ensp; $\\pi \\cdot 4(2{\\cdot}4+1) = \\pi \\cdot 4 \\times$ [___]",
    blank: { answer: ["9"], width: 60, placeholder: "?" },
    hint: "$2 \\times 4 + 1 = 9$.",
    successMessage: "$4 \\times 9 = 36$, so total $= 36\\pi$. Matches $3\\pi + 7\\pi + 11\\pi + 15\\pi = 36\\pi$ \u2713"
  });

  /* ── NEW Gate: sum formula recall (with wrongPath recap) ── */
  L.ask({
    question: "For $n$ rings with first term $a_1=3\\pi$ and difference $d=4\\pi$, the sum formula $S=\\tfrac{n}{2}(a_1+a_n)$ gives the same result because each pair sums to\u2026",
    options: [
      "$a_1 + a_n = 3\\pi + (4n{-}1)\\pi = (4n+2)\\pi$",
      "$a_1 \\cdot a_n = 3\\pi \\cdot (4n{-}1)\\pi$",
      "$a_n - a_1 = (4n-4)\\pi$",
      "$a_1 / a_n$"
    ],
    correct: 0,
    explain: {
      "correct": "Exactly \u2014 each pair (first + last) sums to $(4n+2)\\pi$. Multiply by $n/2$ pairs to get $n(2n+1)\\pi$.",
      "1": "The sum formula adds, it doesn't multiply terms together.",
      "2": "That's the difference, not the sum \u2014 the Gauss trick pairs first with last.",
      "3": "Division doesn't appear here."
    },
    wrongPath: function (B) {
      B.act("Arithmetic Series Sum Formula \u2014 Recap", function (A) {
        A.vizPanel("figure");
        A.say("Here's Gauss's genius in one line: pair the first term with the last, the second with the second-to-last — every pair sums to the same number. n over two pairs, all equal. Watch the outer arc: 3π meets 15π, giving 18π. Inner arc: 7π meets 11π — again 18π. Two pairs, each 18π. Done.")
         .card("recap", {
           title: "Arithmetic Series: Sum Formula",
           content: [
             { type: "latex", value: "S_n = \\dfrac{n}{2}\\,(a_1 + a_n)", display: true },
             { type: "text", value: "**The trick:** every symmetric pair (first+last, second+second-to-last, \u2026) adds to the same constant. There are $n/2$ such pairs." },
             { type: "step", num: 1, value: "Our terms: $a_1 = 3\\pi$, $a_n = \\pi(4n-1)$" },
             { type: "step", num: 2, value: "Pair sum: $a_1 + a_n = 3\\pi + (4n-1)\\pi = (4n+2)\\pi$" },
             { type: "step", num: 3, value: "$S = \\tfrac{n}{2}(4n+2)\\pi = n(2n+1)\\pi$ \u2713" },
             { type: "example", value: "$n=4$: $S = \\tfrac{4}{2}(3\\pi+15\\pi) = 2 \\times 18\\pi = 36\\pi$ \u2713" }
           ],
           figure: {
             title: "Gauss Pairing (n = 4): arcs appear sequentially",
             svg: "<svg viewBox='0 0 320 100' style='width:310px;height:100px'>"
               + "<rect x='10' y='8' width='52' height='24' rx='4' fill='rgba(99,102,241,0.28)' stroke='#818cf8' stroke-width='1'/>"
               + "<text x='36' y='24' text-anchor='middle' fill='#e0e7ff' font-size='11' font-weight='700' font-family='system-ui'>3\u03C0</text>"
               + "<rect x='74' y='8' width='52' height='24' rx='4' fill='rgba(99,102,241,0.28)' stroke='#818cf8' stroke-width='1'/>"
               + "<text x='100' y='24' text-anchor='middle' fill='#e0e7ff' font-size='11' font-weight='700' font-family='system-ui'>7\u03C0</text>"
               + "<rect x='138' y='8' width='52' height='24' rx='4' fill='rgba(99,102,241,0.28)' stroke='#818cf8' stroke-width='1'/>"
               + "<text x='164' y='24' text-anchor='middle' fill='#e0e7ff' font-size='11' font-weight='700' font-family='system-ui'>11\u03C0</text>"
               + "<rect x='202' y='8' width='52' height='24' rx='4' fill='rgba(99,102,241,0.28)' stroke='#818cf8' stroke-width='1'/>"
               + "<text x='228' y='24' text-anchor='middle' fill='#e0e7ff' font-size='11' font-weight='700' font-family='system-ui'>15\u03C0</text>"
               /* outer arc: 3pi <-> 15pi, fades in after 0.3s */
               + "<path d='M36,32 Q132,62 228,32' fill='none' stroke='#f59e0b' stroke-width='2' stroke-dasharray='5,3' opacity='0'><animate attributeName='opacity' from='0' to='1' dur='0.4s' begin='0.3s' fill='freeze'/></path>"
               + "<text x='132' y='68' text-anchor='middle' fill='#f59e0b' font-size='10' font-weight='700' font-family='system-ui' opacity='0'>3\u03C0 + 15\u03C0 = 18\u03C0<animate attributeName='opacity' from='0' to='1' dur='0.4s' begin='0.7s' fill='freeze'/></text>"
               /* inner arc: 7pi <-> 11pi, fades in after 1.2s */
               + "<path d='M100,32 Q132,50 164,32' fill='none' stroke='rgba(245,158,11,0.6)' stroke-width='1.5' stroke-dasharray='4,3' opacity='0'><animate attributeName='opacity' from='0' to='1' dur='0.4s' begin='1.2s' fill='freeze'/></path>"
               + "<text x='132' y='82' text-anchor='middle' fill='rgba(245,158,11,0.8)' font-size='10' font-weight='700' font-family='system-ui' opacity='0'>7\u03C0 + 11\u03C0 = 18\u03C0<animate attributeName='opacity' from='0' to='1' dur='0.4s' begin='1.6s' fill='freeze'/></text>"
               /* result line */
               + "<text x='160' y='97' text-anchor='middle' fill='rgba(34,197,94,0.9)' font-size='11' font-weight='700' font-family='system-ui' opacity='0'>S = 2 pairs \u00D7 18\u03C0 = 36\u03C0<animate attributeName='opacity' from='0' to='1' dur='0.4s' begin='2.1s' fill='freeze'/></text>"
               + "</svg>",
             caption: "Outer arc then inner arc, each summing to $18\\pi$ \u2014 $S = \\tfrac{n}{2}(a_1+a_n)$"
           }
         })
         .inline("figure");
      });

      /* Re-check: apply the formula once before rejoining */
      B.askFillIn({
        label: "sum-formula-recheck",
        prompt: "For $n=4$ rings: $a_1=3\\pi$, $a_4=15\\pi$. Use $S = \\tfrac{n}{2}(a_1+a_n)$ to find $S$. &ensp; [___]",
        blank: { answer: ["36\u03C0", "36pi", "36\\pi", "36 pi"], width: 75, placeholder: "?\u03C0" },
        hint: "$S = \\tfrac{4}{2}(3\\pi + 15\\pi) = 2 \\times 18\\pi$",
        successMessage: "Exactly \u2014 $2 \\times 18\\pi = 36\\pi$. The formula pairs first and last, counts the pairs, done."
      });
    }
  });


  /* ════════════════════════════════════════════════════════════════
     ACT 6 — Crossing the Threshold
     ════════════════════════════════════════════════════════════════ */
  L.act("Crossing the Threshold", function (A) {
    A.vizPanel("svg");

    A.say("We have our weapon: n(2n+1)π. Now we point it at the target. When does this beast first crack 2023?")
     .do("clearAnnotations")
     .do("hideKLabels")
     .do("hideAllRadiusLabels")
     .show("$n(2n + 1) \\geq 2023$");

    A.say("Ignore the small stuff: 2n² ≈ 2023 gives n ≈ 31.8. We're hunting an integer — so we test n equals 31 and n equals 32.")
     .show("$n \\approx \\sqrt{2023/2} \\approx 31.8$");

    A.say("n equals 31: 31 times 63 is 1953. Agonizingly close — but under. The threshold holds.")
     .card("derivation", {
       title: "Testing Boundary Values",
       steps: [
         { latex: "n = 31:\\quad 31 \\times 63 = 1{,}953 < 2{,}023 \\qquad \\textcolor{#ef4444}{\\boldsymbol{\\times}}", wrong: true },
         { latex: "n = 32:\\quad 32 \\times 65 = 2{,}080 \\geq 2{,}023 \\qquad \\textcolor{#22c55e}{\\boldsymbol{\\checkmark}}", highlight: true }
       ]
     });

    A.say("n equals 32: 32 times 65 is 2080. We're over! And since circles equal 2n, the answer is sixty-four. That's it.")
     .show({ type: "latex", content: "n = 32 \\;\\Rightarrow\\; 2n = \\boxed{64} \\text{ circles}", highlight: true });
  });


  /* ── Gate: verify n=32 ── */
  L.askFillIn({
    label: "verify-32",
    prompt: "Confirm: $32 \\times (2 \\cdot 32 + 1) = 32 \\times$ [___]",
    blank: { answer: ["65"], width: 60, placeholder: "?" },
    hint: "$2 \\times 32 + 1 = 65$.",
    successMessage: "$32 \\times 65 = 2080 \\geq 2023$ \u2713 and $31 \\times 63 = 1953 < 2023$ \u2713. So $n=32$ is the minimum."
  });


  /* ════════════════════════════════════════════════════════════════
     ACT 7 — Visualising the Growth
     Chart appears full-size in the main panel, then migrates inline.
     ════════════════════════════════════════════════════════════════ */
  L.act("Visualising the Growth", function (A) {
    A.vizPanel("figure");   /* switch main panel to figure mode */

    A.say("Here's the whole story in one chart. That orange line is the enemy: 2023π. Our curve starts below it — then at exactly 64 circles, it punches through. Hover the curve to watch the moment of crossing in real time.")
     .card("interactive-chart", {
       title: "Total Shaded Area vs. Number of Circles",
       xLabel: "Circles (2n)",
       yLabel: "Area (\u00D7\u03C0)",
       xMax: 80,
       yMax: 3200,
       threshold: { value: 2023, label: "2023\u03C0 target", color: "#f59e0b" },
       annotations: [
         { x: 62, color: "#ef4444", label: "62\u219219 53\u03C0 \u00D7" },
         { x: 64, color: "#22c55e", label: "64\u21922080\u03C0 \u2713", highlight: true }
       ],
       note: "Hover any point to see exact values. The curve crosses $2023\\pi$ between $62$ and $64$ circles. Since we need an **even** number, the answer is $\\boxed{64}$.",
       showInPanel: true   /* render big in panel first */
     })
     .inline("figure");   /* then shrink to notebook */
  });


  L.marker("conclusion");


  /* ════════════════════════════════════════════════════════════════
     ACT 8 — The Complete Picture  (CELEBRATION version)
     Three-phase finale:
       Phase A — rapid count-up flicker through all 64 circles
       Phase B — zoom-out reveals all 64 nested rings in full colour
       Phase C — radial burst from common point + dramatic answer box
     ════════════════════════════════════════════════════════════════ */
  L.act("The Complete Picture", function (A) {
    A.vizPanel("svg");

    /* ── Beat 1: tension before the reveal ── */
    A.say("Sixty-four circles. Let that sink in as they all appear. Each glowing ring is one term in the sequence — 32 steps, each one adding more area than the last.")
     .do("hideLabelAndDot");

    /* ── Beat 2: the full three-phase showFinal celebration ── */
    /* Phase A (count-up flicker) + Phase B (zoom-out) + Phase C (burst + box) */
    A.say("Watch the count race toward 64 — each tick is one more circle joining the stack. The shaded area climbs, and climbs, and climbs, until it punches clean through 2023π.")
     .do("showFinal", {}, "+0.3");

    /* ── Beat 3: let the image breathe, then land the summary ── */
    A.say("Sixty-four circles. Thirty-two rings. Two thousand eighty π — beating 2023π by 57π to spare. We didn't just cross the threshold. We cleared it cleanly. The answer is sixty-four.")
     .inline("svg")
     .card("split", {
       content: {
         title: "Answer",
         latex: "\\boxed{64 \\text{ circles}}",
         text: "$n = 32$ rings $\\Rightarrow$ $2n = 64$ circles\n\n"
             + "Total: $32 \\times 65\\,\\pi = 2{,}080\\pi \\geq 2{,}023\\pi$ \u2713\n\n"
             + "Margin: $2{,}080\\pi - 2{,}023\\pi = 57\\pi$ to spare.\n\n"
             + "**The least number of circles is $\\mathbf{64}$.**"
       }
     });
  });


  /* ════════════════════════════════════════════════════════════════
     POST-SOLUTION — Interactive Circle Explorer
     ════════════════════════════════════════════════════════════════ */
  L.ask({
    type: "interactive",
    label: "explorer",
    title: "Shaded Area Explorer",
    description: "Drag the slider to see nested circles build up in real time. Watch the shaded area grow and see when it first crosses the 2023\u03C0 threshold.",
    slider: { min: 2, max: 100, step: 2, default: 64 },
    vizSync: true,
    compute: function (numCircles) {
      var n = Math.floor(numCircles / 2);
      var total = n * (2 * n + 1);
      var meets = total >= 2023;
      return {
        circles: numCircles,
        rings: n,
        totalArea: total + "\u03C0",
        formula: n + " \u00D7 " + (2 * n + 1) + " = " + total,
        status: meets ? "\u2713 \u2265 2023\u03C0" : "\u00D7 < 2023\u03C0",
        statusColor: meets ? "#22c55e" : "#ef4444"
      };
    },
    displays: [
      { field: "circles",   label: "Total circles",       style: "large" },
      { field: "rings",     label: "Shaded rings (n)" },
      { field: "formula",   label: "n(2n\u202F+\u202F1)" },
      { field: "totalArea", label: "Total shaded area",   style: "highlight" },
      { field: "status",    label: "Target met?",         style: "status" }
    ]
  });


  /* ── Verification gate ── */
  L.askFillIn({
    label: "verify-series",
    prompt: "**Cross-check with series formula:** $S = \\tfrac{n}{2}(a_1+a_n) = \\tfrac{32}{2}(3\\pi + 127\\pi) = 16 \\times$ [___] $\\pi$",
    blank: { answer: ["130", "130\u03C0", "130pi"], width: 70, placeholder: "?" },
    hint: "Last ring $k=32$: $A_{32} = \\pi(4{\\cdot}32-1) = 127\\pi$. First: $3\\pi$. Sum: $3+127=130$.",
    successMessage: "$16 \\times 130 = 2080$ \u2192 total $= 2080\\pi$. Confirmed!"
  });


  /* ── Practice gate ── */
  L.askFillIn({
    label: "practice",
    prompt: "**Your turn:** With $20$ circles (same pattern), what is the total shaded area?\n\n($n = 10$ rings, use $\\pi \\cdot n(2n{+}1)$)\n\nAnswer: [___]",
    blank: { answer: ["210\u03C0", "210pi", "210\\pi", "210 pi"], width: 80, placeholder: "?\u03C0" },
    hint: "$n=10$: $10 \\times (2{\\cdot}10+1) = 10 \\times 21 = 210$.",
    successMessage: "$210\\pi$ \u2014 well done! The technique generalises."
  });


  /* ── Challenge gate ── */
  L.askFillIn({
    label: "challenge",
    prompt: "**Challenge:** Smallest even number of circles for shaded area $\\geq 5000\\pi$?\n\nSolve $n(2n{+}1) \\geq 5000$.\n\n[___] circles",
    blank: { answer: ["100"], width: 70, placeholder: "?" },
    hint: "$n \\approx \\sqrt{5000/2} \\approx 50$. Test: $50 \\times 101 = 5050 \\geq 5000$ \u2713; $49 \\times 99 = 4851 < 5000$ \u00D7. So $n=50$, circles $= 2n$.",
    successMessage: "100 circles! ($n=50$: $50 \\times 101 = 5050\\pi \\geq 5000\\pi$, while $49 \\times 99 = 4851\\pi$ falls short.)"
  });

});
