/* ═══════════════════════════════════════════════════════════════════
   Gate System v2 — Interactive gate factories (quiz, fill-in, proof-builder)

   Fixes from v1:
   - Fill-in: after 3 wrong attempts, calls onResolve(false) → triggers wrongPath
   - Proof-builder: consistent with fill-in — wrong answers trigger wrongPath
   - All gate types: wrong answer always → wrongPath branch
   ═══════════════════════════════════════════════════════════════════ */
(function() {
"use strict";

var EX = window.EX;
var EventBus = EX.EventBus;
var K = EX.K;
var FillIn = EX.FillIn;
var $ = EX.$;

var GateSystem = {
  gateFactories: {},

  init: function() {
    var self = this;
    EventBus.on("gate:enter", function(data) {
      self.renderGate(data.milestone);
    });
    EventBus.on("gate:renderPassed", function(data) {
      self.renderPassedGate(data.milestone);
    });
  },

  renderGate: function(milestone) {
    var type = milestone.gate.type;
    var factory = this.gateFactories[type];
    if (!factory) {
      console.warn("[GateSystem] No factory for gate type:", type);
      EventBus.emit("gate:resolve", { correct: true, milestone: milestone });
      return null;
    }

    var onResolve = function(correct) {
      EventBus.emit("gate:resolve", { correct: correct, milestone: milestone });
    };

    var el = factory(milestone.id, milestone.gate, onResolve);
    if (el) {
      EventBus.emit("notebook:appendMilestone", { milestoneId: milestone.id, element: el });
      EventBus.emit("scroll:observe", { element: el });
      EX.Notebook.activate(milestone.id);
      EX.Notebook.scrollTo(milestone.id);
    }
    return el;
  },

  renderPassedGate: function(milestone) {
    var el = document.createElement("div");
    el.className = "beat-card beat-card--quiz past entered";
    var q = document.createElement("div"); q.className = "quiz-question";
    var qText = milestone.gate.question || milestone.gate.prompt || milestone.gate.instruction || "";
    K.mixed(qText, q);
    q.style.opacity = "0.5";
    el.appendChild(q);
    EventBus.emit("notebook:appendMilestone", { milestoneId: milestone.id + "-passed", element: el });
  }
};


/* ── Gate: quiz ── */
GateSystem.gateFactories.quiz = function(id, data, onResolve) {
  var el = document.createElement("div");
  el.className = "beat-card beat-card--quiz slide-card--quiz";
  var q = document.createElement("div"); q.className = "quiz-question";
  K.mixed(data.question, q);
  el.appendChild(q);
  var opts = document.createElement("div"); opts.className = "quiz-options";
  var letters = "ABCDEFGH";
  data.options.forEach(function(opt, i) {
    var btn = document.createElement("button"); btn.className = "quiz-opt"; btn.dataset.idx = i;
    var letter = document.createElement("span"); letter.className = "opt-letter"; letter.textContent = letters[i];
    btn.appendChild(letter);
    var text = document.createElement("span");
    K.mixed(opt, text);
    btn.appendChild(text);
    opts.appendChild(btn);
  });
  el.appendChild(opts);
  var explain = document.createElement("div"); explain.className = "quiz-explain";
  el.appendChild(explain);

  var resolved = false;
  var btns = el.querySelectorAll(".quiz-opt");
  function resolve(picked) {
    if (resolved) return;
    resolved = true;
    var ci = data.correct !== undefined ? data.correct : data.correctIndex;
    btns.forEach(function(b, i) {
      b.style.pointerEvents = "none";
      if (i === ci) b.classList.add("correct");
      else if (i === picked) b.classList.add("wrong-pick");
      else b.classList.add("dimmed");
    });
    var key = picked === ci ? "correct" : String(picked);
    var explanations = data.explanations || data.explain || {};
    explain.textContent = explanations[key] || explanations.correct || "";
    explain.classList.add("visible");
    var correct = picked === ci;
    setTimeout(function() { onResolve(correct); }, correct ? 2000 : 3000);
  }
  btns.forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      resolve(parseInt(btn.dataset.idx));
    });
  });
  return el;
};

/* ── Gate: fill-in ── (v2 fix: onResolve(false) after 3 wrong attempts) */
GateSystem.gateFactories["fill-in"] = function(id, data, onResolve) {
  var el = document.createElement("div");
  el.className = "beat-card beat-card--fill-in slide-card--fill-in";
  var prompt = document.createElement("div"); prompt.className = "fill-prompt";
  K.renderWithBlank(data.prompt, prompt, data.blank || {});
  el.appendChild(prompt);
  var hint = document.createElement("div"); hint.className = "fill-hint";
  hint.textContent = data.hint || "";
  el.appendChild(hint);
  var success = document.createElement("div"); success.className = "fill-success";
  success.textContent = data.successMessage || "Correct!";
  el.appendChild(success);

  var inp = el.querySelector(".fill-blank");
  var attempts = 0;
  function check() {
    var val = inp.value.trim();
    if (!val) return;
    var accepted = data.blank ? data.blank.answer : (data.answer || []);
    if (FillIn.validate(val, accepted)) {
      inp.classList.remove("wrong"); inp.classList.add("correct");
      inp.disabled = true;
      success.classList.add("visible");
      setTimeout(function() { onResolve(true); }, 1500);
    } else {
      attempts++;
      inp.classList.add("wrong");
      setTimeout(function() { inp.classList.remove("wrong"); }, 400);
      hint.classList.add("visible");
      if (attempts >= 3) {
        // v2 FIX: reveal answer but trigger wrongPath
        inp.value = accepted[0];
        inp.classList.add("correct"); inp.disabled = true;
        success.textContent = "The answer is " + accepted[0];
        success.classList.add("visible");
        setTimeout(function() { onResolve(false); }, 2000); // was onResolve(true) in v1!
      }
    }
  }
  inp.addEventListener("keydown", function(e) { if (e.key === "Enter") check(); });
  setTimeout(function() { inp.focus(); }, 300);
  return el;
};

/* ── Gate: proof-builder ── (v2 fix: consistent wrongPath triggering) */
GateSystem.gateFactories["proof-builder"] = function(id, data, onResolve) {
  var el = document.createElement("div");
  el.className = "beat-card beat-card--proof-builder slide-card--proof-builder";
  var inst = document.createElement("div"); inst.className = "pb-instruction";
  K.mixed(data.instruction, inst);
  el.appendChild(inst);

  var slotsDiv = document.createElement("div"); slotsDiv.className = "pb-slots";
  for (var i = 0; i < data.slots; i++) {
    var slot = document.createElement("div"); slot.className = "pb-slot"; slot.dataset.slotIdx = i;
    slotsDiv.appendChild(slot);
  }
  el.appendChild(slotsDiv);

  var tray = document.createElement("div"); tray.className = "pb-tray";
  data.availablePieces.forEach(function(p) {
    var piece = document.createElement("div"); piece.className = "pb-piece";
    piece.dataset.pieceId = p.id;
    piece.draggable = true;
    K.inline(p.latex, piece);
    tray.appendChild(piece);
  });
  el.appendChild(tray);

  var checkBtn = document.createElement("button"); checkBtn.className = "pb-check"; checkBtn.textContent = "Check";
  el.appendChild(checkBtn);
  var hintEl = document.createElement("div"); hintEl.className = "pb-hint";
  hintEl.textContent = data.hint || "Try rearranging the pieces.";
  el.appendChild(hintEl);

  var slots = el.querySelectorAll(".pb-slot");
  var pieces = el.querySelectorAll(".pb-piece");
  var slotContents = new Array(data.slots).fill(null);
  var checkAttempts = 0;

  function placePiece(pieceId, slotIdx) {
    for (var i = 0; i < slotContents.length; i++) {
      if (slotContents[i] === pieceId) {
        slotContents[i] = null;
        slots[i].innerHTML = ""; slots[i].classList.remove("filled");
      }
    }
    slotContents[slotIdx] = pieceId;
    var pieceData = data.availablePieces.find(function(p) { return p.id === pieceId; });
    slots[slotIdx].innerHTML = "";
    K.inline(pieceData.latex, slots[slotIdx]);
    slots[slotIdx].classList.add("filled");
    var p = el.querySelector('.pb-piece[data-piece-id="' + pieceId + '"]');
    if (p) p.classList.add("used");
  }

  pieces.forEach(function(piece) {
    piece.addEventListener("dragstart", function(e) {
      e.dataTransfer.setData("text/plain", piece.dataset.pieceId);
      piece.classList.add("dragging");
    });
    piece.addEventListener("dragend", function() { piece.classList.remove("dragging"); });
    piece.addEventListener("pointerdown", function(e) {
      if (e.pointerType === "mouse") return;
      e.preventDefault();
      var clone = piece.cloneNode(true);
      clone.style.cssText = "position:fixed;z-index:999;pointer-events:none;opacity:0.8";
      document.body.appendChild(clone);
      function move(ev) { clone.style.left = (ev.clientX - 20) + "px"; clone.style.top = (ev.clientY - 20) + "px"; }
      function up(ev) {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        clone.remove();
        var target = document.elementFromPoint(ev.clientX, ev.clientY);
        if (target && target.classList.contains("pb-slot")) placePiece(piece.dataset.pieceId, parseInt(target.dataset.slotIdx));
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      move(e);
    });
  });

  slots.forEach(function(slot) {
    slot.addEventListener("dragover", function(e) { e.preventDefault(); slot.classList.add("over"); });
    slot.addEventListener("dragleave", function() { slot.classList.remove("over"); });
    slot.addEventListener("drop", function(e) {
      e.preventDefault(); slot.classList.remove("over");
      placePiece(e.dataTransfer.getData("text/plain"), parseInt(slot.dataset.slotIdx));
    });
    slot.addEventListener("click", function() {
      var idx = parseInt(slot.dataset.slotIdx);
      if (slotContents[idx]) {
        var pid = slotContents[idx];
        slotContents[idx] = null;
        slot.innerHTML = ""; slot.classList.remove("filled");
        var p = el.querySelector('.pb-piece[data-piece-id="' + pid + '"]');
        if (p) p.classList.remove("used");
      }
    });
  });

  checkBtn.addEventListener("click", function() {
    checkAttempts++;
    var correct = true;
    for (var i = 0; i < data.correctOrder.length; i++) {
      if (slotContents[i] !== data.correctOrder[i]) {
        correct = false;
        slots[i].classList.add("wrong");
        setTimeout(function(s) { return function() { s.classList.remove("wrong"); }; }(slots[i]), 500);
      } else {
        slots[i].classList.add("correct");
      }
    }
    if (correct) {
      setTimeout(function() { onResolve(true); }, 1500);
    } else {
      hintEl.classList.add("visible");
      // v2 FIX: after 3 failed checks, trigger wrongPath
      if (checkAttempts >= 3) {
        // Show correct order
        for (var i = 0; i < data.correctOrder.length; i++) {
          var pid = data.correctOrder[i];
          var pd = data.availablePieces.find(function(p) { return p.id === pid; });
          slots[i].innerHTML = "";
          K.inline(pd.latex, slots[i]);
          slots[i].classList.add("correct");
        }
        checkBtn.disabled = true;
        setTimeout(function() { onResolve(false); }, 2000);
      }
    }
  });

  return el;
};

/* ── Gate: interactive (slider) ── */
GateSystem.gateFactories.interactive = function(id, data, onResolve) {
  var el = document.createElement("div");
  el.className = "beat-card beat-card--interactive slide-card--interactive";
  var t = document.createElement("div"); t.className = "int-title"; t.textContent = data.title;
  el.appendChild(t);

  var slider = document.createElement("input"); slider.type = "range"; slider.className = "int-slider";
  slider.min = data.slider.min; slider.max = data.slider.max;
  slider.step = data.slider.step; slider.value = data.slider.default;
  el.appendChild(slider);

  var info = document.createElement("div"); info.className = "int-info";
  el.appendChild(info);

  if (data.challenge) {
    var ch = document.createElement("div"); ch.className = "int-challenge";
    K.mixed(data.challenge, ch);
    el.appendChild(ch);
  }

  var cont = document.createElement("button"); cont.className = "int-continue"; cont.textContent = "Continue \u2192";
  el.appendChild(cont);

  var computeFn = typeof data.compute === "function" ? data.compute : new Function("n", "return (" + data.compute + ")(n);");
  function update(n) {
    var result = computeFn(n);
    var html = "";
    if (data.displays) {
      data.displays.forEach(function(d) {
        var val = result[d.field];
        var cls = d.style === "large" ? "av" : "iv";
        html += '<div>' + d.label + ': <span class="' + cls + '">' + val + '</span></div>';
      });
    }
    info.innerHTML = html;
  }

  slider.addEventListener("input", function() { update(parseInt(this.value)); });
  cont.addEventListener("click", function() { onResolve(true); });
  update(parseInt(slider.value));
  return el;
};

/* ── Gate: practice ── */
GateSystem.gateFactories.practice = function(id, data, onResolve) {
  var el = document.createElement("div");
  el.className = "beat-card beat-card--practice slide-card--practice";
  var label = document.createElement("div"); label.className = "practice-label"; label.textContent = "Practice Problem";
  el.appendChild(label);
  var prob = document.createElement("div"); prob.className = "practice-problem";
  K.mixed(data.problem, prob);
  el.appendChild(prob);
  var prompt = document.createElement("div"); prompt.className = "fill-prompt";
  prompt.textContent = "Your answer: ";
  var inp = document.createElement("input"); inp.type = "text"; inp.className = "fill-blank";
  inp.placeholder = "?"; inp.style.width = "80px";
  prompt.appendChild(inp);
  el.appendChild(prompt);
  var hint = document.createElement("div"); hint.className = "fill-hint";
  hint.textContent = data.hint || "";
  el.appendChild(hint);
  var success = document.createElement("div"); success.className = "fill-success";
  el.appendChild(success);

  var attempts = 0;
  inp.addEventListener("keydown", function(e) {
    if (e.key !== "Enter") return;
    var val = inp.value.trim();
    if (!val) return;
    if (FillIn.validate(val, data.answer || [])) {
      inp.classList.add("correct"); inp.disabled = true;
      success.textContent = data.explanation || "Correct!";
      success.classList.add("visible");
      if (onResolve) setTimeout(function() { onResolve(true); }, 1500);
    } else {
      attempts++;
      inp.classList.add("wrong");
      setTimeout(function() { inp.classList.remove("wrong"); }, 400);
      hint.classList.add("visible");
      if (attempts >= 3) {
        inp.value = (data.answer || [""])[0];
        inp.classList.add("correct"); inp.disabled = true;
        success.textContent = data.explanation || "Answer: " + (data.answer || [""])[0];
        success.classList.add("visible");
        // v2 FIX: trigger wrongPath
        if (onResolve) setTimeout(function() { onResolve(false); }, 2000);
      }
    }
  });
  setTimeout(function() { inp.focus(); }, 300);
  return el;
};

EX.GateSystem = GateSystem;

})();
