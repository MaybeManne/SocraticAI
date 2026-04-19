# Animations Reference

All animation functions return an `AnimDef` — an object with `{ apply(tl, at), duration }`. You schedule them onto a GSAP timeline by calling `.apply(tl, t)`.

Inside a `MX.vizPlugin()` method, this looks like:

```js
return {
  showCircle: function(tl, params, t) {
    MX.drawBorder(circle, { duration: 1 }).apply(tl, t);
    MX.fadeIn(label,  { duration: 0.5 }).apply(tl, t + 0.8);
  }
};
```

---

## Entrance animations

### `MX.fadeIn(mob, opts?)`

Fade the mobject in, optionally with directional drift.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `duration` | `number` | `0.6` | Seconds |
| `from` | `string` | `null` | `"up"` \| `"down"` \| `"left"` \| `"right"` |
| `distance` | `number` | `20` | Drift distance in SVG units |
| `ease` | `string` | `"power2.out"` | GSAP ease |

```js
MX.fadeIn(label, { from: "up", duration: 0.5 }).apply(tl, t);
```

### `MX.growFromCenter(mob, opts?)`

Scale from 0 to full size from the mobject's center.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `0.6` |
| `ease` | `string` | `"back.out(1.7)"` |

### `MX.spiralIn(mob, opts?)`

Rotate while scaling in.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `0.8` |
| `ease` | `string` | `"power2.out"` |

### `MX.drawBorder(mob, opts?)`

Draw the mobject's stroke using the stroke-dashoffset technique, then fade in the fill.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `1.2` |
| `ease` | `string` | `"power2.inOut"` |

```js
MX.drawBorder(square, { duration: 1.5 }).apply(tl, t);
```

### `MX.write(mob, opts?)`

Character-by-character reveal (works best with `TexMobject`).

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `1.5` |
| `ease` | `string` | `"power2.out"` |

---

## Exit animations

### `MX.fadeOut(mob, opts?)`

Fade the mobject out, optionally with directional drift.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `0.6` |
| `to` | `string` | `null` | `"up"` \| `"down"` \| `"left"` \| `"right"` |
| `distance` | `number` | `20` |
| `ease` | `string` | `"power2.in"` |

### `MX.shrinkOut(mob, opts?)`

Scale to zero from center.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `0.5` |
| `ease` | `string` | `"power2.in"` |

### `MX.uncreate(mob, opts?)`

Reverse of `drawBorder` — retract stroke.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `1.0` |
| `ease` | `string` | `"power2.in"` |

---

## Emphasis animations

### `MX.indicate(mob, opts?)`

Flash the mobject with a color highlight, then restore.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `0.8` |
| `color` | `string` | `MX.C.YELLOW` |
| `ease` | `string` | `"power2.inOut"` |

### `MX.circumscribe(mob, opts?)`

Draw a rectangular box around the mobject.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `1.0` |
| `color` | `string` | `MX.C.YELLOW` |
| `padding` | `number` | `8` |
| `ease` | `string` | `"power2.inOut"` |

### `MX.flash(mob, opts?)`

Quick opacity flash.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `0.4` |
| `color` | `string` | `MX.C.WHITE` |
| `ease` | `string` | `"power2.out"` |

### `MX.wiggle(mob, opts?)`

Shake the mobject in place.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `0.6` |
| `amount` | `number` | `10` |
| `ease` | `string` | `"elastic.out"` |

### `MX.colorPulse(mob, opts?)`

Pulse between current color and a highlight color, multiple times.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `1.0` |
| `color` | `string` | `MX.C.AMBER` |
| `count` | `number` | `2` |

---

## Transform animations

### `MX.morphTo(mobA, mobB, opts?)`

Morph mobjectA's shape into mobjectB's shape. Falls back to a cross-fade if point counts differ.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `1.0` |
| `ease` | `string` | `"power2.inOut"` |

### `MX.replacementTransform(mobA, mobB, opts?)`

Move mobjectA to mobjectB's position while fading between them.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `1.0` |
| `ease` | `string` | `"power2.inOut"` |

### `MX.shiftAnim(mob, opts?)`

Animate a position delta.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `0.8` |
| `dx` | `number` | `0` |
| `dy` | `number` | `0` |
| `ease` | `string` | `"power2.inOut"` |

```js
MX.shiftAnim(circle, { dx: 100, duration: 0.6 }).apply(tl, t);
```

### `MX.moveToAnim(mob, opts?)`

Animate to an absolute position.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `0.8` |
| `x` | `number` | (required) |
| `y` | `number` | (required) |
| `ease` | `string` | `"power2.inOut"` |

### `MX.scaleAnim(mob, opts?)`

Animate scale.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `0.6` |
| `scale` | `number` | (required, also `s`) |
| `ease` | `string` | `"power2.inOut"` |

### `MX.rotateAnim(mob, opts?)`

Animate rotation.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `0.8` |
| `degrees` | `number` | (required, also `deg`) |
| `ease` | `string` | `"power2.inOut"` |

### `MX.moveAlongPath(mob, pathMob, opts?)`

Animate a mobject along a `PathMobject`.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `2.0` |
| `start` | `number` | `0` (0–1, fraction of path) |
| `end` | `number` | `1` |
| `ease` | `string` | `"none"` |

### `MX.orbit(mob, opts?)`

Animate circular motion around a center point.

| Option | Type | Default |
|--------|------|---------|
| `duration` | `number` | `2.0` |
| `cx` | `number` | `0` |
| `cy` | `number` | `0` |
| `radius` | `number` | `100` |
| `startAngle` | `number` | `0` |
| `endAngle` | `number` | `360` |
| `ease` | `string` | `"none"` |

### `MX.animate(mob, props, opts?)`

Generic GSAP tween. Pass any GSAP properties.

```js
MX.animate(circle, { x: 300, fill: "#f59e0b", duration: 1 }).apply(tl, t);
```

---

## Timing

### `MX.wait(duration?)`

A no-op animation for inserting a pause.

```js
MX.wait(0.5).apply(tl, t);
```

---

## Composition

### `MX.sequence(...anims)` / `MX.sequence([anims])`

Play animations one after another.

```js
var seq = MX.sequence(
  MX.drawBorder(leg_a),
  MX.drawBorder(leg_b),
  MX.drawBorder(hyp)
);
seq.apply(tl, t);
```

### `MX.parallel(...anims)` / `MX.parallel([anims])`

Play animations simultaneously.

```js
var par = MX.parallel(
  MX.fadeIn(circle),
  MX.fadeIn(label)
);
par.apply(tl, t);
```

### `MX.stagger(items, animFn, opts?)`

Apply the same animation to a list of items with a staggered delay between each.

| Option | Type | Default |
|--------|------|---------|
| `lag` | `number` | `0.1` | Delay between items (seconds) |
| `duration` | `number` | Inherits from `animFn` |

```js
var dots = [dot1, dot2, dot3, dot4];
MX.stagger(dots, function(d) { return MX.growFromCenter(d); }, { lag: 0.15 }).apply(tl, t);
```
