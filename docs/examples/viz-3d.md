# Example: 3D Visualization Plugin

**File:** `examples/04_viz_3d.js`  
**Build:** `./build.sh --mx examples/04_viz_3d.js dist/examples/04_viz_3d.html`

This example shows a Three.js 3D visualization plugin. The engine loads a `<canvas>` element instead of the SVG when the viz panel mode is `"3d"`.

---

## Plugin structure

3D plugins use `window.EXPLAINER_VIZ_3D` (not `EXPLAINER_VIZ`). The engine's `engine/viz-3d.js` creates the canvas, sets up the Three.js renderer, and calls `init` with the scene, camera, and renderer objects.

```js
window.EXPLAINER_VIZ_3D = (function() {
  var scene, camera, renderer, cube, _selfRotate = false;

  return {
    // Called with THREE objects already set up
    init: function(threeScene, threeCamera, threeRenderer, THREE) {
      scene    = threeScene;
      camera   = threeCamera;
      renderer = threeRenderer;

      // Build geometry
      var geometry = new THREE.BoxGeometry(1, 1, 1);
      var material = new THREE.MeshPhongMaterial({ color: 0x818cf8 });
      cube = new THREE.Mesh(geometry, material);
      scene.add(cube);

      // Wireframe overlay
      var wireframe = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })
      );
      cube.add(wireframe);
    },

    // Called every animation frame
    renderFn: function(renderer, scene, camera) {
      if (_selfRotate) {
        cube.rotation.x += 0.005;
        cube.rotation.y += 0.01;
      }
      renderer.render(scene, camera);
    },

    // Scheduled GSAP actions on the master timeline
    timelineAction: function(tl, method, params, t) {
      if (method === "showCube") {
        tl.to(cube.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: "back.out(1.7)" }, t);

      } else if (method === "enableSpin") {
        tl.call(function() { _selfRotate = true; }, null, t);

      } else if (method === "stopSpin") {
        tl.call(function() { _selfRotate = false; }, null, t);

      } else if (method === "rotateTo") {
        tl.to(cube.rotation, {
          x: params.x || 0,
          y: params.y || 0,
          z: params.z || 0,
          duration: params.duration || 1
        }, t);

      } else if (method === "colorCube") {
        // THREE.Color lerp between current and target
        tl.to({ t: 0 }, {
          t: 1, duration: 0.6,
          onUpdate: function() {
            cube.material.color.setHex(parseInt(params.color.replace("#", ""), 16));
          }
        }, t);
      }
    }
  };
})();
```

---

## Key differences from SVG plugins

| | SVG plugin (`EXPLAINER_VIZ`) | 3D plugin (`EXPLAINER_VIZ_3D`) |
|--|---|---|
| Interface | `init(svgEl, config)` | `init(scene, camera, renderer, THREE)` |
| Rendering | Passive — GSAP modifies SVG attributes | Active — `renderFn` called every frame |
| Animations | Tween SVG element attributes via GSAP | Tween Three.js object properties |
| Panel mode | `"svg"` | `"3d"` |

---

## Enabling 3D mode

In your content script:

```js
L.act("3D Geometry", function(A) {
  A.vizPanel("3d");   // switch to 3D canvas

  A.say("Here's our cube.")
   .do("showCube");

  A.say("Let it spin.")
   .do("enableSpin");
});
```

---

## Animation patterns

### Tweening Three.js object properties

Three.js objects expose their transform as nested objects (`position`, `rotation`, `scale`). GSAP can tween them directly:

```js
tl.to(cube.position, { x: 2, duration: 1 }, t);
tl.to(cube.rotation, { y: Math.PI, duration: 1.5 }, t);
tl.to(cube.scale,    { x: 0, y: 0, z: 0, duration: 0.5 }, t);
```

### Discrete state changes

Use `tl.call()` for changes that can't be tweened:

```js
tl.call(function() { _selfRotate = true; }, null, t);
```

### Color animation

Three.js colors aren't directly GSAP-tweeneable, so use a `t: 0 → 1` trick with `onUpdate`:

```js
var startColor = cube.material.color.clone();
var endColor = new THREE.Color(params.color);
tl.to({ t: 0 }, {
  t: 1, duration: 0.8,
  onUpdate: function() {
    cube.material.color.lerpColors(startColor, endColor, this.targets()[0].t);
  }
}, t);
```
