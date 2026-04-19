# Example: SVG Visualization Plugin

**File:** `examples/03_viz_svg.js`  
**Build:** `./build.sh --mx examples/03_viz_svg.js dist/examples/03_viz_svg.html`

This example demonstrates a full `EXPLAINER_VIZ` plugin for a Pythagorean theorem lesson — triangle drawing, square construction, and formula reveal — using the raw plugin interface.

---

## Plugin structure

```js
window.EXPLAINER_VIZ = (function() {
  var svg, legA, legB, hyp, squareA, squareB, formula;

  return {
    init: function(svgEl, config) {
      svg = svgEl;

      // Build entire SVG scene with innerHTML — all initially invisible
      svg.innerHTML = [
        '<g id="triangle">',
        '  <line id="leg-a"   x1="80"  y1="400" x2="370" y2="400" stroke="#58C4DD" stroke-width="3" opacity="0"/>',
        '  <line id="leg-b"   x1="370" y1="400" x2="370" y2="100" stroke="#83C167" stroke-width="3" opacity="0"/>',
        '  <line id="hyp"     x1="80"  y1="400" x2="370" y2="100" stroke="#F0AC5F" stroke-width="3" opacity="0"/>',
        '</g>',
        '<text id="formula" x="225" y="470" text-anchor="middle" fill="white" font-size="22" opacity="0">',
        '  a² + b² = c²',
        '</text>'
      ].join("\n");

      // Cache references
      legA    = svg.querySelector("#leg-a");
      legB    = svg.querySelector("#leg-b");
      hyp     = svg.querySelector("#hyp");
      formula = svg.querySelector("#formula");
    },

    timelineAction: function(tl, method, params, t) {
      var dur = params.duration || 1;

      if (method === "drawLegA") {
        var len = legA.getTotalLength();
        gsap.set(legA, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
        tl.to(legA, { strokeDashoffset: 0, duration: dur, ease: "power2.inOut" }, t);

      } else if (method === "drawLegB") {
        var len = legB.getTotalLength();
        gsap.set(legB, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
        tl.to(legB, { strokeDashoffset: 0, duration: dur, ease: "power2.inOut" }, t);

      } else if (method === "drawHyp") {
        var len = hyp.getTotalLength();
        gsap.set(hyp, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
        tl.to(hyp, { strokeDashoffset: 0, duration: dur, ease: "power2.inOut" }, t);

      } else if (method === "showFormula") {
        tl.fromTo(formula,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
          t
        );

      } else if (method === "highlightHyp") {
        tl.to(hyp, { stroke: "#ffffff", strokeWidth: 5, duration: 0.3 }, t)
          .to(hyp, { stroke: "#F0AC5F", strokeWidth: 3, duration: 0.3 }, t + 0.6);
      }
    }
  };
})();
```

---

## Key patterns

### Build with innerHTML, not createElement

`svg.innerHTML = "..."` sets the entire scene in one call and ensures element order (z-order) is correct. It's faster than many `appendChild` calls for static scenes.

### `getTotalLength()` for draw animations

```js
var len = legA.getTotalLength();
gsap.set(legA, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
tl.to(legA, { strokeDashoffset: 0, duration: 1 }, t);
```

The stroke-dashoffset technique: set both `dasharray` and `dashoffset` to the path's total length, then tween `dashoffset` to 0. The line appears to draw itself. Must call `gsap.set()` with a fresh length measurement each time `init` runs (since `init` rebuilds the SVG).

### Highlight-and-restore

```js
tl.to(hyp, { stroke: "#ffffff", strokeWidth: 5, duration: 0.3 }, t)
  .to(hyp, { stroke: "#F0AC5F", strokeWidth: 3, duration: 0.3 }, t + 0.6);
```

Two tweens on the same element: one to jump to highlight state, one to return to original. The gap (`t + 0.6`) is the hold time.

### The IIFE pattern

```js
window.EXPLAINER_VIZ = (function() {
  var svg, legA; // private state
  return { init: ..., timelineAction: ... };
})();
```

The IIFE creates a closure — `svg` and element references are private to the plugin and can't be accidentally overwritten by the content script.

---

## Corresponding content

```js
L.act("Drawing the Triangle", function(A) {
  A.vizPanel("svg");

  A.say("Let's start with leg a — the horizontal base.")
   .do("drawLegA");

  A.say("Now the vertical leg b.")
   .do("drawLegB");

  A.say("Finally, the hypotenuse — the side connecting them across.")
   .do("drawHyp");

  A.say("And there's the relationship: a squared plus b squared equals c squared.")
   .do("showFormula", {}, "+0.3")
   .inline();
});
```

Each `.do()` method name maps exactly to a branch in `timelineAction`. The `"+0.3"` offset fires the formula 0.3 s after the beat starts — giving the narration a brief head start before the visual appears.
