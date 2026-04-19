# Example: AMC 10A 2023 Problem 15

**File:** `content/amc10a_2023_p15_v5.js`  
**Build:** `./build.sh --mx content/amc10a_2023_p15_v5.js dist/amc10a.html`

This is the production lesson the library was built around. It teaches a competition math problem involving nested circles, using a custom visualization plugin with per-lesson interactive gates and custom factory overrides.

---

## The problem

> Find the least number of circles such that they tile a larger circle with an inner circle removed.

The lesson walks through the geometric setup, derives the threshold condition, proves the answer using area comparison, and ends with a quiz gate.

---

## Notable patterns

### Custom factory registration in the content file

The content file (which runs after engine modules load) patches `EX.GateSystem.gateFactories` to add a domain-specific interactive gate with a live SVG preview:

```js
document.addEventListener("DOMContentLoaded", function() {
  var EX = window.EX;

  // Register a bespoke "interactive" gate that embeds its own SVG preview
  EX.GateSystem.gateFactories["interactive"] = function(id, data, onResolve) {
    var el = document.createElement("div");
    // ... build a slider + live SVG + computed result display ...
    return el;
  };
});
```

This is the pattern to use when the built-in `interactive` gate doesn't match your visualization needs. The custom factory receives the same `(id, data, onResolve)` signature.

### VizPanel overlay clone override

```js
if (EX.VizPanel && EX.VizPanel._appendOverlayClone) {
  var _orig = EX.VizPanel._appendOverlayClone.bind(EX.VizPanel);
  EX.VizPanel._appendOverlayClone = function(beatId) {
    if (window._CHART_REBUILD_FN) {
      // Build a fresh interactive element instead of cloneNode()
      var freshEl = window._CHART_REBUILD_FN(true);
      // ... wrap and append to notebook
    } else {
      _orig(beatId);
    }
  };
}
```

`cloneNode()` doesn't preserve event listeners. This pattern stores a `_CHART_REBUILD_FN` that creates a fresh element with working listeners, and overrides the overlay clone path to call it instead.

### vizSync in interactive gates

The custom interactive gate uses `data.vizSync = true` to embed a small SVG preview that mirrors the main visualization:

```js
if (data.vizSync) {
  var previewSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  previewSvg.setAttribute("viewBox", "0 0 280 280");
  // ... render nested circles for current slider value n
  el.appendChild(previewSvg);
}
```

This keeps the student's mental model consistent between the main viz and the gate, without requiring the main SVG panel to update during a gate.

---

## Lesson structure

```
Act 1 — Setting Up the Problem
  - Establish the circle layout
  - Show the nested configuration
  - .inline() to preserve the diagram

Act 2 — The Key Ratio
  - Derive the radius ratio condition
  - Bar chart showing n vs. area ratio

Act 3 — Proving the Threshold
  - Derivation card: step-by-step algebra
  - Viz: annotate the critical value

Marker — "The Answer"

Act 4 — Confirming n = 64
  - Substitute n=64 and n=63
  - Show why 64 works and 63 doesn't

Gate — quiz (did you follow the argument?)
  WrongPath → Act 5 (Recap of the key inequality)
```

---

## Audio + subtitle integration

The lesson was produced with TTS audio. The compiled HTML includes an inline `audio_nested_circles_the_2023_threshold.js` that adds to the base lesson:

```js
// content/audio_nested_circles_the_2023_threshold.js (auto-generated)
L.audio = {
  "act-1": "data:audio/mpeg;base64,...",
  "act-2": "data:audio/mpeg;base64,..."
};
L.subtitles = {
  "act-1": [
    { start: 0, end: 3.8, text: "Let's set up the problem.", words: [
      { word: "Let's", offset: 0.0 },
      { word: "set",   offset: 0.52 },
      { word: "up",    offset: 0.71 },
      { word: "the",   offset: 0.89 },
      { word: "problem", offset: 1.0 }
    ]}
  ]
};
L.beatTimings = {
  "act-1": [
    { beatId: "b1", startTime: 0,   endTime: 4.2 },
    { beatId: "b2", startTime: 4.2, endTime: 9.1 }
  ]
};
```

Build with audio:

```bash
./build.sh --mx content/amc10a_2023_p15_v5.js dist/amc10a.html \
  content/audio_nested_circles_the_2023_threshold.js
```
