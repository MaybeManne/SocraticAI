/* examples/04_viz_3d.js — Three.js 3D Visualization Plugin
   Demonstrates the EXPLAINER_VIZ_3D interface: self-animating _renderFn,
   GSAP timeline actions for rotation/position/opacity, and dispose().
   Topic: 3D coordinate axes and a rotating cube.
   Build: ./build.sh --mx examples/04_viz_3d.js dist/examples/04_viz_3d.html */

// ── 3D Viz Plugin ─────────────────────────────────────────────────────────────
window.EXPLAINER_VIZ_3D = (function() {
  "use strict";

  var _scene, _camera, _renderer;
  var _cube, _axes = [], _grid;
  var _labels = {};   // text sprites not needed for this example
  var _orbitAngle = 0;
  var _selfRotate = true;   // continuous self-rotation in _renderFn

  // ─── Helper: create a text sprite for axis labels ─────────────────────────
  function makeAxisLine(THREE, from, to, color) {
    var mat = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
    var pts = [ new THREE.Vector3(from[0], from[1], from[2]),
                new THREE.Vector3(to[0],   to[1],   to[2]) ];
    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(geo, mat);
  }

  // ─── init — build scene ───────────────────────────────────────────────────
  function init(canvasEl, vizConfig, THREE, renderer) {
    _renderer = renderer;

    // Scene
    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0x0f0e17);
    _scene.fog = new THREE.Fog(0x0f0e17, 18, 35);

    // Camera
    var w = canvasEl.clientWidth  || 500;
    var h = canvasEl.clientHeight || 400;
    _camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100);
    _camera.position.set(5, 3.5, 6);
    _camera.lookAt(0, 0.5, 0);

    // Renderer config
    renderer.setSize(w, h, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // ── Lights ──────────────────────────────────────────────────────────────
    var ambient = new THREE.AmbientLight(0x8888cc, 0.6);
    _scene.add(ambient);

    var dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 8);
    dirLight.castShadow = true;
    _scene.add(dirLight);

    var fillLight = new THREE.PointLight(0x818cf8, 0.8, 20);
    fillLight.position.set(-4, 2, -4);
    _scene.add(fillLight);

    // ── Grid ─────────────────────────────────────────────────────────────────
    _grid = new THREE.GridHelper(10, 10, 0x334155, 0x1e293b);
    _grid.position.y = -1.5;
    _scene.add(_grid);

    // ── Axes (X=red, Y=green, Z=blue) ─────────────────────────────────────
    var axLen = 3.5;
    var xAxis = makeAxisLine(THREE, [-axLen, 0, 0], [axLen, 0, 0], 0xf87171);
    var yAxis = makeAxisLine(THREE, [0, -0.5, 0],   [0, axLen, 0], 0x4ade80);
    var zAxis = makeAxisLine(THREE, [-axLen, 0, 0],  [axLen, 0, 0], 0x60a5fa); // reuse x dir
    // Proper Z axis
    var zAxisReal = makeAxisLine(THREE, [0, 0, -axLen], [0, 0, axLen], 0x60a5fa);

    [xAxis, yAxis, zAxisReal].forEach(function(a) {
      _scene.add(a);
      _axes.push(a);
    });
    // Start axes invisible (revealed by timelineAction)
    _axes.forEach(function(a) { a.visible = false; });

    // ── Cube ─────────────────────────────────────────────────────────────────
    var geo = new THREE.BoxGeometry(2, 2, 2);
    // Multi-material: each face a slightly different shade for depth
    var faceColors = [0x818cf8, 0x6366f1, 0xa78bfa, 0x7c3aed, 0x4f46e5, 0x8b5cf6];
    var mats = faceColors.map(function(c) {
      return new THREE.MeshPhongMaterial({
        color: c,
        shininess: 60,
        transparent: true,
        opacity: 0
      });
    });
    _cube = new THREE.Mesh(geo, mats);
    _cube.position.set(0, 0.5, 0);
    _cube.castShadow = true;
    _scene.add(_cube);

    // Wireframe overlay
    var wfGeo = new THREE.EdgesGeometry(geo);
    var wfMat = new THREE.LineBasicMaterial({ color: 0xe0e7ff, transparent: true, opacity: 0, linewidth: 1 });
    var wireframe = new THREE.LineSegments(wfGeo, wfMat);
    _cube.add(wireframe);
    _labels.wireframe = wireframe;

    // ── _renderFn: called every animation frame ───────────────────────────
    this._renderFn = function(rend) {
      if (_selfRotate && _cube) {
        _cube.rotation.y += 0.008;
        _cube.rotation.x += 0.003;
      }
      rend.render(_scene, _camera);
    };
  }

  // ─── timelineAction — GSAP-driven animations ──────────────────────────────
  function timelineAction(tl, method, params, t) {
    var p = params || {};
    var dur = p.duration != null ? p.duration : 1.0;

    switch (method) {

      // Fade in the cube
      case "showCube":
        _selfRotate = false;  // pause auto-spin while GSAP takes over
        _cube.material.forEach(function(m) {
          tl.to(m, { opacity: 1, duration: dur, ease: "power2.inOut" }, t);
        });
        tl.to(_labels.wireframe.material, { opacity: 0.6, duration: dur, ease: "power2.inOut" }, t);
        break;

      // Re-enable self-rotation
      case "enableSpin":
        _selfRotate = true;
        break;

      // Stop self-rotation
      case "stopSpin":
        _selfRotate = false;
        break;

      // Rotate cube to a specific angle — params: { x?, y?, z?, duration }
      case "rotateTo":
        var rotTarget = {};
        if (p.x != null) rotTarget.x = p.x;
        if (p.y != null) rotTarget.y = p.y;
        if (p.z != null) rotTarget.z = p.z;
        tl.to(_cube.rotation, Object.assign({ duration: dur, ease: "power2.inOut" }, rotTarget), t);
        break;

      // Move cube — params: { x?, y?, z?, duration }
      case "moveCube":
        var posTarget = {};
        if (p.x != null) posTarget.x = p.x;
        if (p.y != null) posTarget.y = p.y;
        if (p.z != null) posTarget.z = p.z;
        tl.to(_cube.position, Object.assign({ duration: dur, ease: "back.out(1.2)" }, posTarget), t);
        break;

      // Scale cube — params: { s, duration }
      case "scaleCube":
        var s = p.s != null ? p.s : 1;
        tl.to(_cube.scale, { x: s, y: s, z: s, duration: dur, ease: "elastic.out(1, 0.5)" }, t);
        break;

      // Show axis lines by fading them in
      case "showAxes":
        _axes.forEach(function(a) {
          a.visible = true;
          tl.to(a.material, { opacity: 1, duration: 0.5, ease: "power1.in" }, t);
        });
        break;

      // Colour tween — params: { targetHex, duration }  (tweens via lerp on a dummy)
      case "colorCube":
        var dummy = { t: 0 };
        var startColors = _cube.material.map(function(m) { return m.color.clone(); });
        var endColor = new (window._THREE_REF || { Color: function(){} }).Color(p.targetHex || 0x34d399);
        // We stash THREE for colour tween
        if (window._THREE_REF) {
          endColor = new window._THREE_REF.Color(p.targetHex || 0x34d399);
          tl.to(dummy, {
            t: 1,
            duration: dur,
            ease: "power2.inOut",
            onUpdate: function() {
              _cube.material.forEach(function(m, i) {
                m.color.lerpColors(startColors[i], endColor, dummy.t);
              });
            }
          }, t);
        }
        break;

      // Camera dolly — params: { z, duration }
      case "dollyCamera":
        var camTarget = {};
        if (p.x != null) camTarget.x = p.x;
        if (p.y != null) camTarget.y = p.y;
        if (p.z != null) camTarget.z = p.z;
        tl.to(_camera.position, Object.assign({ duration: dur, ease: "power2.inOut" }, camTarget), t);
        break;

      // Fade cube out
      case "hideCube":
        _cube.material.forEach(function(m) {
          tl.to(m, { opacity: 0, duration: dur, ease: "power1.in" }, t);
        });
        tl.to(_labels.wireframe.material, { opacity: 0, duration: dur, ease: "power1.in" }, t);
        break;
    }
  }

  // ─── dispose ─────────────────────────────────────────────────────────────
  function dispose() {
    _selfRotate = false;
    if (_cube) {
      _cube.geometry.dispose();
      _cube.material.forEach(function(m) { m.dispose(); });
    }
    if (_grid) {
      _grid.geometry.dispose();
      _grid.material.dispose();
    }
    _axes.forEach(function(a) {
      a.geometry.dispose();
      a.material.dispose();
    });
    _scene = null;
    _camera = null;
    _cube = null;
  }

  return {
    init: init,
    timelineAction: timelineAction,
    dispose: dispose,
    _renderFn: null   // set by init()
  };
})();


// ── Lesson ────────────────────────────────────────────────────────────────────
MX.lesson("3D Viz: Coordinate Space and the Cube", function(L) {

  L.source("code2html_v2 Examples");
  L.problem("Explore 3D coordinate space using a Three.js scene with GSAP-driven animations.");

  // Tell the engine to use 3D viz mode
  L.viz({ plugin: "3d", config: {} });

  // ── Act 1: Axes ──────────────────────────────────────────────────────────
  L.act("The 3D Coordinate System", function(A) {
    A.vizPanel("3d");

    A.say("Three-dimensional space is described by three perpendicular axes: $x$, $y$, and $z$.")
     .do("showAxes", {}, 0)
     .duration(3);

    A.say("Red is the $x$-axis, green is $y$, and blue is $z$. Together they form a right-handed coordinate system.")
     .show("Every point in 3D space is a triple $(x, y, z)$.");
  });

  // ── Act 2: Show the cube ─────────────────────────────────────────────────
  L.act("A Unit Cube", function(A) {
    A.vizPanel("3d");

    A.say("A cube has 6 faces, 12 edges, and 8 vertices — one of the five Platonic solids.")
     .do("showCube", { duration: 1.5 }, 0.5)
     .duration(4);

    A.say("The cube is self-rotating via `_renderFn` — the Three.js render loop runs independently of GSAP.")
     .show("The `_renderFn(renderer)` is called every animation frame by the engine's `requestAnimationFrame` loop.");

    A.say("GSAP can take over at any point to tween Three.js object properties directly.")
     .do("stopSpin", {}, 0)
     .do("rotateTo", { y: 0, x: 0, duration: 1.0 }, 0)
     .duration(3);
  });

  // ── Act 3: GSAP-driven transforms ────────────────────────────────────────
  L.act("GSAP-Driven 3D Animation", function(A) {
    A.vizPanel("3d");

    A.say("Rotate the cube 180° around the $y$-axis using a GSAP tween.")
     .do("rotateTo", { y: 3.14159, duration: 1.5 }, 0)
     .duration(2.5);

    A.say("Scale it up — elastic easing gives a satisfying overshoot.")
     .do("scaleCube", { s: 1.5, duration: 1.0 }, 0)
     .duration(2);

    A.say("Move it upward and back to centre.")
     .do("moveCube", { y: 2.0, duration: 0.6 }, 0)
     .do("moveCube", { y: 0.5, duration: 0.6 }, 0.8)
     .do("scaleCube", { s: 1.0, duration: 0.6 }, 0.4)
     .duration(2.5);

    A.say("Dolly the camera closer for a dramatic close-up.")
     .do("dollyCamera", { z: 3.5, duration: 1.2 }, 0)
     .duration(2);

    A.say("Pull back to the wide view.")
     .do("dollyCamera", { z: 6.0, duration: 1.0 }, 0)
     .do("enableSpin", {}, 1.1)
     .duration(2.5);
  });

  // ── Gate ────────────────────────────────────────────────────────────────
  L.ask({
    question: "How many faces does a cube have?",
    options: ["4", "6", "8", "12"],
    correct: 1,
    explain: {
      "0": "That is a tetrahedron. A cube has 6 faces — top, bottom, front, back, left, right.",
      "1": "Correct! Top, bottom, front, back, left, right — 6 square faces.",
      "2": "8 is the number of vertices (corners), not faces.",
      "3": "12 is the number of edges, not faces."
    }
  });

  // ── Act 4: Summary ───────────────────────────────────────────────────────
  L.act("3D Plugin Patterns", function(A) {
    A.vizPanel("3d");

    A.say("This example demonstrated the full EXPLAINER_VIZ_3D interface.")
     .card("recap", {
       title: "Three.js Plugin Patterns Used",
       items: [
         "**_renderFn**: called every frame — drives self-animation (continuous rotation)",
         "**GSAP .to(mesh.rotation)**: directly tweens Three.js object properties",
         "**Opacity**: transparent materials fade in/out via `m.opacity`",
         "**Scale**: `tl.to(mesh.scale, {x,y,z})` for resize animations",
         "**Camera dolly**: `tl.to(camera.position, {z})` for cinematic moves",
         "**dispose()**: cleans up geometries and materials to prevent GPU leaks"
       ]
     });
  });

});
