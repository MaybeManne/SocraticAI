# Projectile Range: Teaching Plan

---

## 1. Solution Walkthrough

### Setting Up the Physics

A ball launches from the origin at angle θ = 45° with speed v₀ = 20 m/s. We decompose the initial velocity:

- **Horizontal:** v₀ₓ = v₀ cos(45°) = 20 · (√2/2) = 10√2 m/s
- **Vertical:** v₀ᵧ = v₀ sin(45°) = 20 · (√2/2) = 10√2 m/s

### Equations of Motion

With no air resistance:

$$x(t) = v_{0x} \cdot t = 10\sqrt{2}\, t$$

$$y(t) = v_{0y} \cdot t - \frac{1}{2}g t^2 = 10\sqrt{2}\, t - 4.9\, t^2$$

### Finding Time of Flight

The ball lands when y(t) = 0:

$$10\sqrt{2}\, t - 4.9\, t^2 = 0$$
$$t\,(10\sqrt{2} - 4.9\, t) = 0$$

So t = 0 (launch) or:
$$t = \frac{10\sqrt{2}}{4.9} = \frac{20\sqrt{2}}{9.8} \approx \frac{28.28}{9.8} \approx 2.887 \text{ s}$$

### Finding the Range

$$R = x(t_{\text{land}}) = 10\sqrt{2} \cdot \frac{10\sqrt{2}}{4.9} = \frac{10\sqrt{2} \cdot 10\sqrt{2}}{4.9} = \frac{200}{4.9} \approx 40.8 \text{ m}$$

### The Elegant General Formula (Key Insight)

Using the identity sin(2θ):

$$R = \frac{v_0^2 \sin(2\theta)}{g}$$

At θ = 45°: sin(90°) = 1, so:

$$R = \frac{v_0^2}{g} = \frac{400}{9.8} \approx 40.8 \text{ m}$$

This confirms our result and reveals **why 45° is the optimal angle** — sin(2θ) is maximized at 2θ = 90°.

---

## 2. Key "Aha" Moments

### Aha #1 — Decomposing the Velocity (Early)
**What the student realizes:** A single diagonal arrow secretly contains two independent stories — a horizontal one that never changes, and a vertical one fighting gravity. These two stories run simultaneously but independently.

**Visual moment:** The launch arrow at 45° visually "splits" — the diagonal arrow spawns a horizontal green arrow and a vertical blue arrow, which slide apart like puzzle pieces. The student sees them as genuinely separate.

**Narrative position:** End of the Setup segment. The "complication" — motion in 2D — is immediately dissolved by this decomposition.

### Aha #2 — The Parabola's Symmetry (Middle)
**What the student realizes:** The trajectory is perfectly symmetric. Whatever the ball does going up, it undoes on the way down. This means the total flight time is exactly twice the time to reach the apex.

**Visual moment:** A vertical dashed line drops from the apex of the drawn trajectory. The left half of the arc glows, then mirrors onto the right half. A clock ticking upward pauses at the apex, then runs an identical tick downward.

**Narrative position:** After the trajectory is drawn. This is the "turning point" of the lesson.

### Aha #3 — The Cancellation that Produces the Clean Formula (Climax)
**What the student realizes:** When you multiply the horizontal velocity (v₀cosθ) by the flight time (2v₀sinθ/g), the v₀ and trig terms multiply together into sin(2θ) via a double-angle identity. The algebra isn't grinding — it's beautiful compression.

**Visual moment:** The range expression is written out. Then the terms v₀cosθ · 2v₀sinθ group together in a box, and the identity `2sinθcosθ = sin(2θ)` fires as a visual substitution — the two separate trig functions literally merge into one.

**Narrative position:** The algebraic payoff. The "aha" of elegance.

### Aha #4 — 45° is the Sweet Spot (Payoff)
**What the student realizes:** The formula R = v₀²sin(2θ)/g contains a sin(2θ) term, and a sine function is maximized at 90°. So 2θ = 90° → θ = 45°. Our specific problem didn't just give us the answer — it secretly used the *optimal angle*.

**Visual moment:** A fan of trajectories appears at angles 15°, 30°, 45°, 60°, 75°, all launched at the same speed. The 45° arc lands the farthest. Then a sin(2θ) curve appears beside them, with the peak at θ = 45° glowing gold.

---

## 3. Visual Journey

### The Scene
A 2D coordinate plane. Origin at lower-left. The x-axis is the ground (labeled "horizontal distance"). The y-axis points up. A small ball icon sits at the origin ready to launch. The color palette is clean: white background, dark axes, with specific highlight colors:
- **Gold** for the trajectory arc
- **Green** for horizontal components
- **Blue** for vertical components
- **Red** for gravity

### Beat-by-Beat Visual Plan

**Opening beat:** The ball sits at the origin. A faint question mark hovers above it. "How far does it travel?" The axes are clean; nothing else is on screen yet.

**Beat 2 — The launch angle:** A gold arrow grows from the origin at 45°, labeled "v₀ = 20 m/s." A protractor arc flicks in from the x-axis to the arrow, labeled "45°." This is the only thing on screen — maximum attention on the setup.

**Beat 3 — Decomposition:** The gold arrow is still there. A green dashed arrow slides out horizontally from its tail, growing to the same horizontal projection (labeled "v₀cos45° = 10√2"). A blue dashed arrow slides out vertically from its tail (labeled "v₀sin45° = 10√2"). Both are drawn as if the diagonal is the hypotenuse of a right triangle. The student now sees the vector triangle clearly.

**Beat 4 — The trajectory begins:** The ball launches. The arc is drawn slowly, like a pencil tracing it. As the ball rises, a small blue upward arrow (vertical velocity) shrinks. As it falls, the arrow flips downward and grows. The green horizontal arrow alongside stays constant throughout — never changes size. This is running commentary in vector form.

**Beat 5 — Apex highlight:** The ball pauses visually at the apex. A dashed vertical line drops from it to the ground. The apex is marked with a dot. A small label: "v_y = 0 here." The horizontal velocity arrow still glows — the ball is still moving sideways even at the top.

**Beat 6 — Symmetry reveal:** The left half of the arc glows gold. It then reflects/mirrors onto the right half — a visual fold. The right half draws itself as a ghost copy of the left. Then both halves glow together.

**Beat 7 — Time of flight equation:** The equation y(t) = 0 fades in above the arc. The factoring step appears below it: t(10√2 − 4.9t) = 0. The "t = 0" solution grays out (that's the launch). The second solution lights up in gold: t = 20√2/9.8 ≈ 2.89 s.

**Beat 8 — Range calculation:** A vertical dashed line rises at x = 40.8 m from the x-axis. The arc's endpoint lands exactly on it. A bold bracket spans the ground from x=0 to x=40.8, labeled "R ≈ 40.8 m."

**Beat 9 — General formula reveal:** The messy expression R = v₀cosθ · (2v₀sinθ/g) appears. Then `2v₀cosθ · v₀sinθ` boxes itself, and the identity `2sinθcosθ → sin(2θ)` fires, collapsing it to R = v₀²sin(2θ)/g. This is a slow, deliberate animation — terms grouping, then compressing.

**Beat 10 — The fan of angles:** Six arcs appear simultaneously at θ = 15°, 30°, 45°, 60°, 75°, 90°. All launched from origin. The 45° arc is gold and reaches furthest. The others are gray. Landing dots appear on the x-axis, and the 40.8 m landing dot pulses.

**Beat 11 — The sine curve:** A graph of sin(2θ) vs. θ slides in beside the fan of arcs. Each arc's landing distance maps to a dot on the sine curve. The dot at θ = 45° sits precisely at the peak. The curve's maximum is circled in gold.

---

## 4. Emotional & Narrative Arc

### Setup — "A Simple Question"
*Tone: calm, accessible, slightly playful*

We have a ball, a ground, an angle, and a speed. How far does it travel? Sounds like one motion problem — but the diagonal direction immediately creates discomfort. Where do you even start? The opening visual is sparse and slightly mysterious.

### Complication — "Two Directions at Once"
*Tone: building tension*

The ball moves sideways AND up AND then down... simultaneously. We need a way to untangle this. The tension: 2D motion feels hard. The resolution: decompose. But even after decomposition, we have two coupled equations. How do they connect?

### Insight — "Time is the Bridge"
*Tone: the turning point*

The vertical equation gives us time. Time feeds into the horizontal equation. These two independent stories are linked by one shared clock — the flight time. Once you find when y = 0, everything else follows mechanically. The symmetry visual makes this feel inevitable rather than lucky.

### Payoff — "The Universe Chose 45°"
*Tone: wonder and satisfaction*

The number 40.8 m is satisfying on its own. But the formula R = v₀²sin(2θ)/g is beautiful. And the fan of arcs showing 45° as the winner — that's the "wow" moment. The problem didn't just have a specific answer. It was secretly asking: why is 45° special? And now we see it geometrically, algebraically, and visually all at once.

---

## 5. Teaching Segments

### Segment 1 — The Setup (≈ 30 sec)
**Objective:** Establish the problem and build curiosity.

**Narrator says:** "Imagine you're throwing a ball. You launch it at exactly 45 degrees, with a speed of 20 meters per second. It arcs through the air and lands somewhere on the ground. The question is: how far away does it land?"

**Student sees:** The bare coordinate plane appears. The ball sits at the origin. A gold velocity arrow grows from it at 45°. A protractor arc labels the angle. The ball hasn't moved yet — we're just looking at the setup.

**Transition:** "Now, here's what makes this problem interesting. The ball is moving at an angle — not just sideways, not just upward. Both at once. So let's untangle that."

---

### Segment 2 — Velocity Decomposition (≈ 45 sec)
**Objective:** Show that diagonal motion = horizontal + vertical components.

**Narrator says:** "Any velocity at an angle can be split into two independent pieces. A horizontal piece — the sideways speed that stays constant forever — and a vertical piece — the upward speed that gravity will fight down to zero and beyond."

**Student sees:** The gold arrow remains. A right triangle assembles beneath it — horizontal green leg grows, then vertical blue leg, then the gold hypotenuse is already there. Labels appear: v₀cos45°, v₀sin45°. Then numerical values: both equal 10√2 ≈ 14.1 m/s. The two colored arrows pulse once, independently, to emphasize their separateness.

**Transition:** "These two components live independent lives. Let's follow them through the flight."

---

### Segment 3 — Tracing the Trajectory (≈ 45 sec)
**Objective:** Build intuition for what happens in flight — velocity vectors changing.

**Narrator says:** "As the ball flies, the horizontal velocity never changes — there's nothing pushing it sideways. But the vertical velocity? Gravity pulls it down at 9.8 meters per second every second. The ball slows upward, stops at the top, then accelerates downward."

**Student sees:** The ball launches and the arc is drawn in real-time (slightly slow-motion). Alongside the ball, two arrows travel with it: green horizontal (constant) and blue vertical (shrinking upward, zeroing at apex, growing downward). The apex is marked with a glowing dot. Label: "v_y = 0 at peak." The arc finishes landing back at y = 0.

**Transition:** "Notice the arc is perfectly symmetric. That's not a coincidence — it's a consequence of the physics."

---

### Segment 4 — Symmetry and Time of Flight (≈ 60 sec)
**Objective:** Use symmetry to find total flight time from the vertical equation alone.

**Narrator says:** "The left half and right half of this arc are mirror images. So the time to reach the top equals the time to fall back down. To find the total time, we set the vertical position equal to zero — that's the landing condition — and solve."

**Student sees:**
1. The arc's left half glows gold, then visually folds/reflects to show the right half — they're identical.
2. The equation y(t) = 10√2·t − 4.9t² fades in.
3. Set equal to zero: a "= 0" materializes on the right.
4. Factoring: the expression factors into t(10√2 − 4.9t) = 0.
5. Two solutions light up. t = 0 grays out with a note "that's the launch." t = 10√2/4.9 lights up gold, numerically ≈ 2.89 seconds.

**Transition:** "Two point eight nine seconds in the air. Now we use that time to find how far the ball traveled horizontally."

---

### Segment 5 — Computing the Range (≈ 40 sec)
**Objective:** Plug time into the horizontal equation to get the range.

**Narrator says:** "The horizontal motion is the simple part. Constant speed, no acceleration. Distance equals speed times time. We multiply our horizontal velocity — 10 root 2 — by our flight time — about 2.89 seconds."

**Student sees:**
1. The horizontal equation x(t) = 10√2 · t appears.
2. The flight time substitutes in: x = 10√2 · (10√2/4.9).
3. The multiplication plays out: 10√2 · 10√2 = 10 · 10 · √2 · √2 = 100 · 2 = 200.
4. Result: R = 200/4.9 ≈ 40.8 m. Each step appears one at a time.
5. A vertical dashed line strikes the x-axis at 40.8 m. The arc's landing point touches it exactly. A bold bracket labels the ground distance: "R ≈ 40.8 m."

**Transition:** "Forty point eight meters. But let's not stop there — there's something more beautiful hiding in this calculation."

---

### Segment 6 — The Elegant Formula (≈ 60 sec)
**Objective:** Derive the general range formula, emphasizing the sin(2θ) identity.

**Narrator says:** "Instead of numbers, let's use symbols. The range for any angle θ and any initial speed v₀ is: horizontal velocity times flight time. That's v₀cosθ times 2v₀sinθ over g. Watch what happens when we group terms."

**Student sees:**
1. General expression appears: R = v₀cosθ · (2v₀sinθ/g)
2. The two trig terms — cosθ and sinθ — glow and slide together into a bracket: [2 sinθ cosθ]
3. A new identity label fades in above: "Identity: 2sinθcosθ = sin(2θ)"
4. The bracketed expression morphs into sin(2θ) — visually compresses.
5. Final formula: R = v₀²sin(2θ)/g glows in gold.
6. Our specific values plug in: (400 · sin90°) / 9.8 = 400/9.8 ≈ 40.8 m. ✓

**Transition:** "And now the formula tells us something we never explicitly asked."

---

### Segment 7 — The 45° Payoff (≈ 50 sec)
**Objective:** Reveal why 45° maximizes range — the visual and conceptual climax.

**Narrator says:** "The range depends on sin(2θ). A sine function reaches its maximum value of 1 when its argument is 90 degrees. So 2θ = 90° means θ = 45°. Our problem didn't just have a specific answer — it used the one angle that squeezes maximum distance from any given launch speed."

**Student sees:**
1. Six arcs fan out from origin — θ = 15°, 30°, 45°, 60°, 75°, 90° — all in gray.
2. The 45° arc redraws itself in gold, slightly thicker.
3. Landing dots appear on the x-axis for each arc. The 40.8 m dot pulses.
4. A graph of R vs. θ (the sin(2θ) curve) slides in to the right of the scene, x-axis labeled 0° to 90°, y-axis labeled 0 to v₀²/g.
5. Each arc's landing distance maps to a dot on the curve, one by one.
6. The curve peaks at θ = 45° — a gold star appears on the peak.
7. Final zoom-out: the fan of arcs and the sine curve sit side by side. The 45° arc and the peak glow together.

---

## 6. Interactive Checkpoints

### Checkpoint 1 — After Segment 2 (Decomposition)
**Concept tested:** Correctly identifying horizontal and vertical velocity components.

**Question type:** Fill-in-the-blank

> "A ball is launched at 45° with speed 20 m/s. What is the horizontal component of the initial velocity?"
> Answer: **10√2 m/s** (accept 14.1 m/s)

**Good wrong answers:**
- 20 m/s — misconception: thinking speed = horizontal speed (forgot to decompose)
- 10 m/s — misconception: dividing by 2 instead of by √2
- 9.8 m/s — misconception: confusing with gravitational acceleration

**If wrong:** Show the vector triangle again. Emphasize that the diagonal is the hypotenuse, and the components are the legs. "Which is longer: a side of a right triangle or its hypotenuse?" Run a mini-lesson on SOH-CAH-TOA with a simple visual: a right triangle with labeled sides, showing cos = adjacent/hypotenuse, with the 45° triangle as the specific case.

---

### Checkpoint 2 — After Segment 4 (Time of Flight)
**Concept tested:** Setting up the landing condition and solving for time.

**Question type:** Multiple choice

> "Why do we set y(t) = 0 to find the time of flight?"
> A) Because velocity is zero at that point
> B) Because the ball has returned to ground level ✓
> C) Because horizontal distance is zero
> D) Because gravity stops acting

**Good wrong answers:**
- A is the most tempting — students confuse "ball stops moving" with "ball lands." (velocity = 0 is the apex condition, not landing)
- D is the gravity misconception

**If wrong on A:** Show two separate animations: (1) ball at apex — velocity arrow is horizontal, y is at maximum, not zero. (2) Ball landing — velocity arrow points downward-diagonally, y = 0. "These are two very different moments."

---

### Checkpoint 3 — After Segment 6 (The Formula)
**Concept tested:** Applying the general range formula.

**Question type:** Fill-in-the-blank (numerical)

> "Using R = v₀²sin(2θ)/g, find the range for a ball launched at **30°** with v₀ = 20 m/s. (Use g = 9.8)"
> Answer: **400 · sin(60°) / 9.8 = 400 · (√3/2) / 9.8 ≈ 35.4 m**

**Good wrong answers:**
- 40.8 m — student plugged in 45° again (didn't change the angle)
- 20.4 m — student used sin(30°) instead of sin(2·30° = 60°) — the classic "forgot the double-angle" error

**If wrong:** Replay the sin(2θ) identity animation from Segment 6. Emphasize with a flashing highlight: "The argument is 2θ — twice the launch angle." Show a table: θ = 30° → 2θ = 60° → sin(60°) = √3/2.

---

## 7. Visualization Requirements

### Scene Setup
**Type:** 2D coordinate plane (landscape orientation). Origin at lower-left, x-axis horizontal (ground), y-axis vertical. Grid lines are faint. Scene is approximately 50 m wide × 30 m tall in world coordinates.

### Objects Needed
- `Ball` — small circle, positioned at coordinates (x, y)
- `VelocityArrow` — 2D vector arrow with color, tail position, magnitude, angle
- `TrajectoryArc` — parametric curve drawn progressively
- `DashedLine` — vertical or horizontal dashed line segment
- `BracketLabel` — horizontal bracket along x-axis with text label
- `EquationBlock` — LaTeX equation rendered at a screen position, with step-by-step reveal
- `AngleArc` — protractor arc between x-axis and a vector
- `FanOfArcs` — multiple `TrajectoryArc` instances at different angles
- `SineCurveGraph` — a graph inset showing R vs. θ, with dots mapping to arcs
- `ApexDot` — glowing point at trajectory apex
- `ReflectionOverlay` — shaded copy of half-arc that mirrors visually

### Animation Methods

```
initScene(params: {xRange: [0,50], yRange: [0,30]})
  — draws axes, labels, faint grid

placeBall(params: {x: 0, y: 0})
  — renders ball icon at origin

drawVelocityArrow(params: {speed: 20, angle: 45, color: "gold"})
  — grows arrow from origin over 0.8s

drawAngleArc(params: {angle: 45, label: "45°"})
  — sweeps protractor arc from x-axis to velocity arrow

decomposeVelocity(params: {speed: 20, angle: 45})
  — slides horizontal green arrow rightward, vertical blue arrow upward
  — forms right triangle with existing gold arrow
  — labels: "v₀cos45° = 10√2" on green, "v₀sin45° = 10√2" on blue

animateLaunch(params: {speed: 20, angle: 45, g: 9.8})
  — moves ball along parabolic path in slow motion (3s)
  — simultaneously updates live velocity arrows (horizontal constant, vertical changing)

markApex(params: {})
  — places glowing dot at trajectory apex
  — drops dashed vertical line from apex to ground
  — shows label "v_y = 0" near apex

reflectArcSymmetry(params: {})
  — highlights left half of arc in gold
  — animates mirror reflection of left half onto right half
  — both halves pulse together

showEquation(params: {step: "yOfT"})
  — fades in y(t) = 10√2·t − 4.9t² above the arc

showEquation(params: {step: "setZero"})
  — appends "= 0" to equation

showEquation(params: {step: "factored"})
  — morphs equation into t(10√2 − 4.9t) = 0

highlightSolution(params: {solution: "nonzero"})
  — grays out t=0 branch
  — lights up t = 10√2/4.9 ≈ 2.89 s in gold

showEquation(params: {step: "horizontal"})
  — shows x(t) = 10√2 · t

substituteTime(params: {t: 2.887})
  — animates t value substituting into horizontal equation
  — steps through: 10√2 · (10√2/4.9) → 200/4.9 → 40.8 m

drawRangeBracket(params: {range: 40.8})
  — strikes dashed vertical line at x = 40.8
  — draws bold bracket from x=0 to x=40.8 along ground
  — labels: "R ≈ 40.8 m"

showGeneralFormula(params: {step: "expanded"})
  — shows R = v₀cosθ · (2v₀sinθ / g)

groupTrigTerms(params: {})
  — draws box around "2 sinθ cosθ"
  — fades in identity label "2sinθcosθ = sin(2θ)"

collapseToSin2Theta(params: {})
  — animates boxed terms morphing into sin(2θ)
  — final formula: R = v₀²sin(2θ)/g glows gold

verifyWithNumbers(params: {v0: 20, theta: 45, g: 9.8})
  — shows (400 · sin90°) / 9.8 → 400/9.8 → 40.8 m ✓
  — checkmark appears

showFanOfTrajectories(params: {angles: [15,30,45,60,75,90], speed: 20, g: 9.8})
  — draws all arcs simultaneously in gray
  — redraws 45° arc in gold, thicker
  — places landing dots on x-axis for each

showRangeVsAngleGraph(params: {})
  — slides in a graph panel on the right side
  — draws sin(2θ) curve from 0° to 90°
  — maps each fan arc's landing distance to a dot on the curve, one by one
  — highlights peak at θ = 45° with gold star

zoomOutFinalShot(params: {})
  — zooms out to show both the fan-of-arcs and the sine curve side by side
  — 45° arc and curve peak glow together
  — final label: "R_max = v₀²/g ≈ 40.8 m at θ = 45°"
```

### Timing & Choreography Notes

- **Show-before-tell rule:** Every visual fires 0.5–1 second before the narrator names it.
- **Dimming:** When an equation step is being examined, all other equations dim to 30% opacity.
- **Color consistency:** Green = horizontal always. Blue = vertical always. Red = gravity (g label). Gold = answer, trajectory, key result.
- **Pacing:** Slow animations during insights (1.5–2.5s), snappier animations for "routine" algebra steps (0.5–0.8s).
- **Segment transitions:** Between each segment, all non-essential elements fade to 15% opacity, and the new segment's first visual element appears fresh. This creates a "new chapter" feel without a hard cut.