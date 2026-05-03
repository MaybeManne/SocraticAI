## Teaching Plan: Nested Circles and Shaded Areas

### 1. Solution Walkthrough

**Key Insight:**
- The area between two consecutive circles (radii k and k+1) is π(k+1)² - πk² = π(2k + 1)
- Since we shade every other ring (k=2-1, k=4-3,...), the shaded area is the sum of all odd-indexed rings:
  
  $\text{Shaded Area} = \sum_{m=1}^{n/2} \pi(4m - 1) = \pi\left(2n^2 + n\right)$

**Verification:**
- For n=8 (as in the example):
  $2(8)^2 + 8 = 136$ → $136\pi$ total shaded area
- Each shaded ring contributes:
  - m=1: ring 2-1 → 3π
  - m=2: ring 4-3 → 7π
  - m=3: ring 6-5 → 11π
  - m=4: ring 8-7 → 15π
  Sum: 3+7+11+15 = 36π (matches formula for n=4)

**Final Calculation:**
Solve $2n^2 + n \geq 2023$ → n ≥ 31.8 → need 32 circles (next even number)

### 2. Key "Aha" Moments

1. **Ring Area Formula:**
   - Visual: As a new circle grows, highlight the annular ring it creates with the previous circle
   - Narrator: "Each new radius k creates a ring with area π(2k + 1)"
   - Timing: Show algebraic derivation only after the visual intuition is clear

2. **Alternating Pattern:**
   - Visual: Color every other ring (starting with the first) in alternating colors
   - Narrator: "Notice how the shaded rings follow an arithmetic progression"
   - Timing: After showing 4-5 rings, pause to let the pattern sink in

3. **Summation Insight:**
   - Visual: Stack the shaded rings vertically as rectangles with heights proportional to their areas
   - Narrator: "The total shaded area forms a quadratic function of n"
   - Timing: Reveal the stacked visualization while deriving the summation formula

### 3. Visual Journey

**Initial Setup:**
- Draw concentric circles growing outwards from center (all sharing common point)
- Label radii: 1, 2, 3,... up to n
- Highlight the first shaded region (between r=1 and r=2) in blue

**Key Animations:**
1. `drawCircle(radius, color)` - draws each new circle with growing animation
2. `highlightRing(k)` - fills the area between circles k and k+1 with translucent color
3. `showAreaFormula(k)` - displays π((k+1)² - k²) = π(2k + 1) next to highlighted ring
4. `stackRings()` - transforms shaded rings into vertical rectangles showing area progression
5. `plotQuadratic()` - shows graph of 2n² + n growing toward the target 2023 line

### 4. Emotional & Narrative Arc

**Act 1: The Puzzle (0:00-0:45)**
- Visual: Slowly draw the nested circles up to n=8 (as in example)
- Narration: "At first glance, this infinite nesting seems complex... but there's surprising structure"

**Act 2: The Pattern (0:45-2:00)**
- Visual: Highlight individual rings and show their areas
- Narration: "Each new ring's area follows a simple linear growth..."

**Act 3: The Summation (2:00-3:30)**
- Visual: Stack the shaded areas and reveal quadratic relationship
- Narration: "When we collect all shaded rings, a beautiful quadratic pattern emerges"

**Act 4: The Solution (3:30-end)**
- Visual: Animate the quadratic curve crossing the 2023 threshold
- Narration: "Solving this gives us our magic number - just 32 circles create this enormous shaded area!"

### 5. Teaching Segments

1. **Introduction to Nested Circles**
   - Visual: Draw first 3 circles with alternating shading
   - Objective: Understand the basic construction

2. **Single Ring Area**
   - Visual: Isolate one ring and show area calculation
   - Objective: Derive π(2k + 1) formula

3. **Shading Pattern**
   - Visual: Apply shading to every other ring
   - Objective: Recognize the selection pattern

4. **Summation Setup**
   - Visual: Index the shaded rings (m=1,2,...n/2)
   - Objective: Set up the summation bounds

5. **Quadratic Discovery**
   - Visual: Convert summation to closed-form 2n² + n
   - Objective: Find the general solution

6. **Threshold Crossing**
   - Visual: Animate n increasing until shaded area > 2023π
   - Objective: Solve the inequality

### 6. Interactive Checkpoints

1. **After Ring Area Formula:**
   - Q: What's the area between radius 5 and 6?
   - Options: [11π, 10π, 9π, 12π]
   - Misconception: Thinking it's π(k+1 - k) instead of π((k+1)² - k²)

2. **After Summation:**
   - Q: For n=10, how many terms are in the shaded sum?
   - Options: [4, 5, 10, 20]
   - Misconception: Not recognizing n/2 terms

### 7. Visualization Requirements

**Scene Type:** Polar coordinate system with growing concentric circles

**Required Animations:**
1. `drawConcentricCircles(n)` - draws n nested circles
2. `highlightShadedRings(n)` - fills every other ring (starting from first)
3. `showRingArea(k)` - displays π(2k + 1) formula next to ring k
4. `transformToBarChart()` - converts shaded areas to vertical bars
5. `plotFunction(f(n))` - graphs 2n² + n with horizontal line at 2023
6. `highlightSolution(n=32)` - pulses the solution circle

**Parameters Needed:**
- Circle radii: 1 through n
- Shading pattern: every other ring starting with first
- Area formulas: for each shaded ring
- Quadratic function: 2n² + n
- Threshold value: 2023

This visual narrative will create a satisfying journey from the concrete example to the general solution, with clear visual proofs at each stage. The quadratic growth revelation serves as the climactic "aha" moment, made visceral through the animated graph crossing the threshold.