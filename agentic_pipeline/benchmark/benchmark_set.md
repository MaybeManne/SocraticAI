# Benchmark Problem Set

Manifest of the problems used for pipeline experiments (planner-prompt variants
v1–v6, pairwise judging, cross-domain generalization checks). Every variant run
and judge comparison to date was generated from one of these three inputs.

Note: this manifest is also what the future external-tool benchmarking work
(veo3 / Manimator / NotebookLM comparisons) will run against.

---

## 1. Nested Circles (AMC 10A 2023 P15, modified)

**Subject/domain:** math (competition geometry + algebra)

**Source file:** `agentic_pipeline/amc10a_2023_p15.md`

**Full problem statement** (exact pipeline input):

> An even number of circles are nested, starting with a radius of $1$ and
> increasing by $1$ each time, all sharing a common point. The region between
> every other circle is shaded, starting with the region inside the circle of
> radius $2$ but outside the circle of radius $1$. An example showing $8$
> circles is displayed below. What is the **least number of circles** needed to
> make the total shaded area at least $2023\pi$?

**Full worked solution:**

1. Label the circles by radius $1, 2, 3, \ldots, 2n$ (an even count $2n$). The
   shaded regions are the rings between consecutive circle pairs: between radii
   $1$ and $2$, between $3$ and $4$, …, between $2k-1$ and $2k$, …, between
   $2n-1$ and $2n$. (All circles share a common point rather than a common
   center, but ring *areas* depend only on the radii, so the area computation
   is identical to the concentric case.)
2. Area of the $k$-th shaded ring:
   $\pi (2k)^2 - \pi (2k-1)^2 = \pi \left(4k^2 - (4k^2 - 4k + 1)\right) = \pi (4k - 1)$.
3. Total shaded area with $n$ rings:
   $S_n = \pi \sum_{k=1}^{n} (4k - 1) = \pi \left(4 \cdot \frac{n(n+1)}{2} - n\right) = \pi \left(2n(n+1) - n\right) = \pi\, n(2n+1)$.
4. Require $S_n \ge 2023\pi$, i.e. $n(2n+1) = 2n^2 + n \ge 2023$.
5. Test values: $n = 31$ gives $2(961) + 31 = 1953 < 2023$ (not enough);
   $n = 32$ gives $2(1024) + 32 = 2080 \ge 2023$ ✓.
6. So $n = 32$ shaded rings are needed, which requires $2n = \boxed{64}$
   circles.

**Learning objectives:**
- Compute the area of an annulus (ring) as a difference of circle areas, and
  simplify $(2k)^2 - (2k-1)^2$ algebraically to a linear expression.
- Sum an arithmetic series ($\sum (4k-1)$) into a closed form and recognize why
  the total grows quadratically in the number of rings.
- Solve a quadratic inequality by testing candidate integer values, and
  translate the answer back into the problem's units (rings → circles).

**Difficulty/complexity notes:** Requires a multi-step **algebraic derivation**
(expand, cancel, sum a series) *coupled to* a **geometric visualization**
(nested tangent circles with alternating shaded rings). Stresses the pipeline
on: LaTeX-heavy narration (TTS math verbalization), ring-highlighting sync,
and a derivation-card-heavy act structure. Future additions should avoid
another "area summation + inequality" problem — that niche is covered.

---

## 2. Archer / Projectile Range

**Subject/domain:** physics (kinematics, projectile motion)

**Source file:** `agentic_pipeline/archer_problem.md`

**Full problem statement** (exact pipeline input):

> An archer shoots an arrow at 30 degrees above horizontal with initial speed
> 40 m/s. Find how far the arrow travels before hitting the ground.

**Full worked solution:**

1. Decompose the initial velocity into components:
   $v_x = v_0 \cos\theta = 40 \cos 30^\circ = 40 \cdot \frac{\sqrt{3}}{2} \approx 34.64$ m/s;
   $v_y = v_0 \sin\theta = 40 \sin 30^\circ = 40 \cdot \frac{1}{2} = 20$ m/s.
2. Vertical motion (launch and landing at the same height): the arrow rises,
   decelerating under gravity $g = 9.8\ \text{m/s}^2$, and returns to launch
   height. Time of flight:
   $t = \dfrac{2 v_y}{g} = \dfrac{2 \cdot 20}{9.8} \approx 4.08$ s.
3. Horizontal motion is uniform (no horizontal forces), so the range is
   $R = v_x \cdot t = 34.64 \cdot 4.08 \approx 141.4$ m.
4. Equivalently, via the range formula:
   $R = \dfrac{v_0^2 \sin(2\theta)}{g} = \dfrac{40^2 \sin 60^\circ}{9.8} = \dfrac{1600 \cdot \frac{\sqrt{3}}{2}}{9.8} = \dfrac{800\sqrt{3}}{9.8} \approx 141.4$ m.

   **Answer: ≈ 141 m** (≈ 141.4 m with $g = 9.8\ \text{m/s}^2$; ≈ 138.6 m if
   $g = 10$ is used).

**Learning objectives:**
- Decompose a launch velocity into independent horizontal and vertical
  components using trigonometry.
- Understand that vertical motion (accelerated by gravity) and horizontal
  motion (uniform) are independent, and that time of flight comes from the
  vertical component alone.
- Combine the two motions to derive the range, and connect the result to the
  general range formula $R = v_0^2 \sin(2\theta)/g$.

**Difficulty/complexity notes:** Requires **physics formula application** with
numeric plug-ins (less symbolic manipulation than circles) plus a
**trajectory/parabola plot** as the core visual — a moving projectile with
velocity-vector decomposition, not a static diagram. Stresses the pipeline on:
time-animated visuals, unit-laden narration ("meters per second"), and
degree/trig verbalization. Future additions should avoid another
single-formula kinematics plug-in problem.

---

## 3. Binary Search

**Subject/domain:** cs (algorithms, complexity analysis)

**Source file:** `agentic_pipeline/tests/binary_search_problem.md`

**Full problem statement** (exact pipeline input):

> Given a sorted array of n distinct integers, find the index of a target value
> using binary search. Explain why it runs in O(log n) instead of O(n), using
> the example array [2, 5, 8, 12, 16, 23, 38, 45, 56, 72, 91] (indices 0-10),
> target 45.

**Full worked solution** (as written step-by-step in the source file):

1. `low=0, high=10, mid=5, array[5]=23`. Since `45 > 23`, discard the left
   half: `low=6`.
2. `low=6, high=10, mid=8, array[8]=56`. Since `45 < 56`, discard the right
   half: `high=7`.
3. `low=6, high=7, mid=6, array[6]=38`. Since `45 > 38`: `low=7`.
4. `low=7, high=7, mid=7, array[7]=45`. **Found at index 7.**

Complexity argument: each step halves the remaining elements — after $k$ steps,
$n/2^k$ elements remain. The search ends when $n/2^k = 1$, so
$k = \log_2(n)$ — hence $O(\log n)$ versus $O(n)$ for a linear scan.
For $n = 11$ the worst case is $\lceil \log_2(11) \rceil = 4$ steps, and the
trace above finds target 45 at index 7 in exactly 4 steps.

**Learning objectives** (as stated in the source file):
- Divide-and-conquer strategy: discard half of the remaining search space on
  every comparison.
- Why repeated halving gives logarithmic time — the $n/2^k = 1 \Rightarrow k = \log_2 n$
  argument, contrasted against linear scan.
- Tracing comparisons step by step (low/mid/high pointer movement) on a
  concrete array.

**Difficulty/complexity notes:** Requires **algorithmic step tracing** (a
4-iteration pointer walk with state updates) plus an **array visualization**
(boxes, indices, low/mid/high pointers, discarded-region shading) — discrete
state transitions rather than continuous animation. Stresses the pipeline on:
wide horizontal layouts (11-element arrays overflow a 500px viewBox — a known
weak spot), pointer-highlight sync, and mixing a concrete trace with an
asymptotic argument. Future additions should avoid another array-scanning /
pointer-walk algorithm.

---

## Coverage summary (for choosing future problems)

| Problem | Domain | Core skill | Core visual | Motion type |
|---|---|---|---|---|
| Nested circles | math | algebraic derivation + series | nested circles / rings | build-up reveals |
| Archer | physics | formula application | trajectory plot + vectors | continuous animation |
| Binary search | cs | algorithmic tracing | array + pointers | discrete state steps |

Gaps worth filling next (non-duplicative): probability/counting (tree or grid
visual), calculus (curve + tangent/area visual), graph algorithms (node/edge
visual), data structures with pointers (linked list / tree rotation).

---

## TEMPLATE — copy this for new problems

## N. <Problem short name>

**Subject/domain:** <math | physics | cs>

**Source file:** `agentic_pipeline/<path>.md`

**Full problem statement** (exact pipeline input):

> <verbatim problem text — this exact text is what gets passed to the pipeline>

**Full worked solution:**

1. <step>
2. <step>
3. <final answer, boxed/bolded>

**Learning objectives:**
- <objective 1>
- <objective 2>
- <objective 3 (optional)>

**Difficulty/complexity notes:** <what skills + visual types this problem
stresses, and what it means for diversification — check the coverage summary
table above and state explicitly what NEW ground this problem covers that the
existing set does not.>
