# Math Explainer v2

A modular scrollytelling + timeline engine for building interactive, animated math lessons, powered by a **multi-agent AI pipeline**. Given a math problem, a chain of specialized LLM agents plans the pedagogy in natural language, structures it into a lesson plan, authors narration and visualizations, assembles executable code, and reviews the result — producing a complete interactive lesson end-to-end.

A human author can also write content directly using the Act/Beat/Milestone DSL. The engine handles playback, card rendering, quizzes, subtitles, audio sync, and SVG visualization.

Each lesson compiles to a **single self-contained HTML file** (~500 KB without audio) that runs in any modern browser with zero server dependencies.

---

## Quick Start

```bash
cd code2html_v2

# Build the example lesson (AMC 10A 2023 #15 — Nested Circles)
bash build.sh --mx content/amc10a_2023_p15_v3.js dist/amc10a_2023_p15.html

# Open in browser
open dist/amc10a_2023_p15.html      # macOS
xdg-open dist/amc10a_2023_p15.html  # Linux
# or serve locally:
python3 -m http.server 8000 -d dist
```

Click anywhere or press **Space** to start playback. Use arrow keys to seek +/-5s.

### With TTS Audio (optional)

```bash
export ELEVENLABS_API_KEY=your_key_here

# Generate per-act audio + beat-level timing + word-aligned subtitles
python3 generate_audio.py content/amc10a_2023_p15_v3.js

# Rebuild with audio baked in
bash build.sh --mx \
  content/amc10a_2023_p15_v3.js \
  dist/amc10a_2023_p15.html \
  content/audio_amc10a_2023_p15.js
```

### Agentic pipeline — generate a lesson from a problem statement

```bash
pip install -r agentic_pipeline/requirements.txt
playwright install chromium   # for screenshot feedback

# Blind run (Gemini, fast, no vision feedback)
python3 agentic_pipeline/orchestrator.py \
  --problem agentic_pipeline/archer_problem.md \
  --output dist/archer.html

# Sighted run — viz agent sees its own render + reviewer sees final page
python3 agentic_pipeline/orchestrator.py \
  --problem agentic_pipeline/archer_problem.md \
  --output dist/archer.html \
  --screenshot \
  --viz-screenshot-feedback \
  --model claude-sonnet-4-20250514
```

Every LLM stage has a retry loop. Guards catch known failure modes before assembly:
- `[___]` marker check on fill-in gate prompts (no marker → no input field renders)
- Layout audit on viz code: stacked-text-in-loop without `clearSlot`, out-of-bounds coords, freehand layout with no `Z.<ZONE>` references
- Reviewer DSL whitelist: rejects corrections that invent methods like `.pause()` / `.wait()`
- `--viz-screenshot-feedback` on a Gemini model prints a loud warning and skips Stage 4b (it needs Anthropic multimodal)

See `docs/guides/agentic-pipeline.md` for full details.

### Tests

```bash
./node_modules/.bin/vitest run             # 189 JS tests (engine, DSL, playback, gates)
python3 -m pytest agentic_pipeline/tests/  # 222 Python tests (validators, assembler, guards, e2e)
```

Total: **411 tests passing**.

---

## Architecture

```
code2html_v2/
├── build.sh                        # Inlines everything into one HTML
├── template.html                   # HTML5 shell (ARIA-labeled, dark theme)
├── explainer-lib.css               # All styles (dark theme, cards, controls)
├── generate_audio.py               # ElevenLabs TTS pipeline
│
├── mobject/                        # Scene-graph & DSL layer
│   ├── mobject.js                  #   SVG primitives + transform system
│   ├── anim.js                     #   Animation factory (20+ animations)
│   └── dsl.js                      #   Teacher DSL: MX.lesson()
│
├── engine/                         # Playback engine (EventBus-driven)
│   ├── core.js                     #   EventBus, LessonGraph, ActRunner
│   ├── notebook.js                 #   KaTeX helpers, FillIn validator
│   ├── cards.js                    #   Card-type factories
│   ├── gates.js                    #   Quiz / fill-in / proof-builder gates
│   ├── audio.js                    #   Async audio loading & sync
│   ├── subtitles.js                #   Word-level subtitle rendering
│   ├── viz-panel.js                #   SVG panel, overlay, inline migration
│   ├── controls.js                 #   Play/pause, scrubber, speed, toggles
│   ├── scroll-sync.js              #   Bidirectional scroll ↔ timeline
│   └── init.js                     #   Wires modules, boots lesson
│
├── pipeline/                       # Agentic AI content pipeline
│   ├── orchestrator.py             #   6-stage pipeline driver
│   ├── assembler.py                #   Deterministic JS code generation
│   ├── validate.py                 #   JSON schema + cross-ref validation
│   ├── prompts/                    #   Agent system prompts
│   │   ├── solution_planner.md     #     Stage 1: Solution planning (NL)
│   │   ├── planner.md              #     Stage 2: Narrative → structured plan
│   │   ├── act_worker.md           #     Stage 3: Beat/gate authoring
│   │   ├── viz_worker.md           #     Stage 4: SVG visualization
│   │   └── reviewer.md             #     Stage 6: QA review
│   ├── schemas/                    #   JSON schemas for each artifact
│   └── examples/                   #   Reference artifacts + output
│
├── content/                        # Lesson content files
│   ├── amc10a_2023_p15_v3.js       #   Example lesson (DSL + inline viz)
│   ├── viz_nested_circles.js       #   Standalone viz plugin (alternative)
│   └── audio_*.js                  #   Generated TTS + subtitles
│
└── dist/                           # Built output
```

## Core Concepts

| Concept | Description |
|---|---|
| **Beat** | Atomic unit: one narration sentence + optional notebook card + optional viz actions |
| **Act** | Continuous timed segment: one GSAP timeline, one audio track, sequence of beats |
| **Milestone** | Boundary between acts — passive **marker** or interactive **gate** (quiz/fill-in) |
| **Main Path** | The default sequence of acts (assuming all-correct answers) |
| **Branch** | Extra acts inserted when a student answers a gate wrong (recap/review), then rejoin |

### Playback Flow

```
┌──────────┐   ┌────────┐          ┌──────────┐   ┌─────────┐
│  Act 1   │──▶│ Marker │──auto──▶│  Act 2   │──▶│  Gate   │
│ (beats)  │   │        │          │ (beats)  │   │ (quiz)  │
└──────────┘   └────────┘          └──────────┘   └────┬────┘
                                                  correct│wrong
                                                       │  ↓
                                                       │ ┌──────────┐
                                                       │ │ Branch   │
                                                       │ │ Act(s)   │
                                                       │ └────┬─────┘
                                                       │      │
                                                       ▼      ▼
                                                  ┌──────────┐
                                                  │  Act 3   │──▶ ...
                                                  └──────────┘
```

- **Within an act**: GSAP timeline + optional audio. Beat cards appear in the notebook as narration progresses. Scrubber seeks within the act.
- **Between acts**: Markers auto-advance. Gates pause for student input.
- **Wrong answers**: Branch acts are spliced into the path, then rejoin the main sequence.
- **Milestone jumping**: Click a dot to jump. Prior acts fast-forward (duration=0) to restore state.
- **Scroll sync**: Timeline auto-scrolls the notebook. Manual scrolling seeks the timeline to match.

---

## EventBus Architecture

v2 modules communicate through a central **EventBus** (pub/sub), not direct function calls:

```
core.js emits:
  tick(time)          — every rAF frame during playback
  act:start(act)      — act begins
  act:end(actId)      — act finishes
  beat:render(beat)    — time to render a beat's card

cards.js listens:
  beat:render → creates DOM from card type factory

gates.js listens:
  gate:enter → shows gate UI, pauses playback
  gate:resolve(correct) → resumes, triggers wrongPath if needed

controls.js listens:
  act:start → updates scrubber range
  tick → updates scrubber position

scroll-sync.js listens:
  tick → scrolls notebook to active beat
  (user scroll → seeks timeline via IntersectionObserver)
```

This decoupling means modules can be developed, tested, and replaced independently.

---

## Writing Lessons (DSL)

```javascript
MX.lesson("Nested Circles — The 2023π Threshold", function(L) {

  L.source("AMC 10A 2023 #15 (Modified)");
  L.meta({ answer: "64" });
  L.problem("What is the least number of circles needed...", {
    highlight: "Find the least number of circles for shaded area ≥ 2023π."
  });

  // Custom SVG dimensions (v2: no longer hardcoded 500×500)
  L.viz({
    plugin: "nested_circles_v3",
    config: { cx: 250, baseY: 450, scale: 32, circleCount: 8 }
  });

  // ── Act: continuous playback segment ──
  L.act("Building the Picture", function(A) {
    A.vizPanel("svg");

    A.say("Let's build this figure from scratch.")
     .do("showGrid")
     .do("showGlow", {}, "+0.5")     // offset: 0.5s after beat start
     .do("showDot", {}, "+1.0");

    A.say("Circle one: radius one.")
     .do("drawCircle", { r: 1 });

    A.say("Radius two. See the shaded band?")
     .do("drawCircle", { r: 2 });

    A.say("Eight circles produce four shaded rings.")
     .do("showAllKLabels")
     .show("$2n$ circles → $n$ shaded rings.");
  });

  L.marker("derivation");   // passive milestone

  // ── Act with inline derivation ──
  L.act("General Ring Formula", function(A) {
    A.say("Ring k area equals outer minus inner.")
     .show("$A_k = \\pi(2k)^2 - \\pi(2k{-}1)^2$");

    A.say("Simplifying...")
     .show("$= \\pi(4k - 1)$");
  });

  // ── Interactive gate (pauses for input) ──
  L.ask({
    question: "Which regions are shaded?",
    options: ["Odd → even: (1→2), (3→4), …", "Even → odd: (2→3), …"],
    correct: 0,
    explain: {
      "correct": "Right — shading goes from odd to even radius.",
      "1": "Look again: the first band starts at radius 1."
    },
    wrongPath: function(B) {
      B.act("Shading Review", function(A) {
        A.say("The pattern alternates: shade, skip, shade, skip.")
         .card("recap", {
           title: "Shading Pattern",
           content: [
             { type: "step", num: 1, value: "Ring 1: radii $1 \\to 2$ — **shaded**" },
             { type: "step", num: 2, value: "Ring 2: radii $2 \\to 3$ — unshaded" },
             { type: "step", num: 3, value: "Ring 3: radii $3 \\to 4$ — **shaded**" }
           ]
         });
      });
    }
  });

  // ── Fill-in gate (3 wrong attempts → auto-triggers wrongPath) ──
  L.askFillIn({
    prompt: "The outer circle has radius $2$. What is $\\pi(2)^2$? [___]",
    blank: { answer: ["4π", "4pi"], width: 70, placeholder: "?π" },
    hint: "Square the radius: 2² = 4. Multiply by π.",
    successMessage: "Right — outer area is 4π.",
    wrongPath: function(B) {
      B.act("Circle Area Refresher", function(A) {
        A.vizPanel("figure");
        A.say("Area of a circle is pi r squared.")
         .card("recap", {
           title: "Circle Area Formula",
           content: [
             { type: "latex", value: "A = \\pi r^2", display: true },
             { type: "example", value: "$r=2 \\Rightarrow 4\\pi$" }
           ]
         });
      });
    }
  });
});
```

### Beat Methods (chainable via `A.say()`)

| Method | Description |
|---|---|
| `.show(content)` | Attach a text/latex card. String → text card; object → typed card |
| `.title(heading, sub)` | Title overlay card |
| `.card(type, data)` | Explicit typed card (derivation, recap, bar-chart, figure, split, etc.) |
| `.do(method, params, offset)` | Trigger a viz plugin action. Offset like `"+1.0"` for sub-beat delay |
| `.vizPanel(mode)` | Set viz panel for this beat (`"svg"`, `"figure"`, `"chart"`, `"hidden"`) |
| `.duration(d)` | Override estimated duration (seconds) |
| `.inline(type)` | At beat end, snapshot the viz panel and embed as an image in the notebook |

### Lesson Methods

| Method | Description |
|---|---|
| `L.source(s)` | Source attribution |
| `L.meta(obj)` | Metadata (e.g. `{ answer: "64" }`) |
| `L.problem(text, opts)` | Pin problem statement to top bar. Opens as hero, collapses on play. |
| `L.viz(config)` | Configure viz plugin and SVG viewBox |
| `L.act(title, fn)` | Create an act (fn receives ActBuilder) |
| `L.marker(label)` | Passive milestone after previous act |
| `L.ask(opts)` | Multiple-choice quiz gate |
| `L.askFillIn(opts)` | Fill-in-the-blank gate (3 wrong → wrongPath) |
| `L.askProof(opts)` | Proof-builder (drag-and-drop) gate |

### Card Types

| Type | Description |
|---|---|
| `text` | Rich text (KaTeX + markdown bold) |
| `latex` | Single display equation. `{ highlight: true }` for emphasis |
| `derivation` | Step-by-step LaTeX equations with optional highlights |
| `title` | Full-screen overlay: heading + subheading |
| `figure` | SVG figure in viz panel + caption |
| `recap` | Expandable review card with steps, examples, figures |
| `bar-chart` | Animated bar chart with labels, values, and pattern text |
| `split` | Combined title + equation + text (for final answers) |
| `plot-2d-interactive` | **v2**: Interactive 2D curve plot with hover, threshold line, annotations |
| `interactive` | **v2**: Slider-driven live computation with real-time display + optional vizSync |

### Gate Types

| Type | Trigger wrongPath | Description |
|---|---|---|
| `quiz` | First wrong answer | Multiple choice with per-option explanations |
| `fill-in` | After 3 wrong attempts | Type answer, validated against accepted values |
| `proof-builder` | On incorrect ordering | Drag-and-drop proof steps into correct order |
| `interactive` | Never (exploratory) | Slider + live computation, no right/wrong |

---

## Card Type Examples

### `plot-2d-interactive` (v2)

Interactive 2D curve with hover tooltips, threshold line, and animated annotations:

```javascript
A.say("Watch how total area grows with the number of circles.")
 .card("plot-2d-interactive", {
   title: "Shaded Area vs. Circle Count",
   xLabel: "Number of circles (2n)",
   yLabel: "Total shaded area (× π)",
   xMax: 80, yMax: 3200,
   threshold: {
     value: 2023,
     label: "2023π target",
     color: "#f59e0b"
   },
   curve: {
     fn: "var n = x/2; return n*(2*n+1);",
     color: "#818cf8",
     label: "S(n) = n(2n+1)"
   },
   annotations: [
     { x: 62, label: "n=31 → 1953π", color: "#f87171", icon: "✗" },
     { x: 64, label: "n=32 → 2080π", color: "#34d399", icon: "✓", highlight: true, pulse: true }
   ],
   hover: { enabled: true, template: "2n = {x} → S = {y}π" },
   animation: { drawCurve: 2.0 }
 });
```

### `interactive` gate (v2)

Slider-driven explorer with real-time visualization sync:

```javascript
L.ask({
  type: "interactive",
  title: "Explore: Vary the Number of Circles",
  slider: { min: 2, max: 100, step: 2, default: 64 },
  vizSync: true,    // calls EXPLAINER_VIZ.drawInteractive(n)
  compute: function(n) {
    var rings = n / 2;
    return {
      n: n, rings: rings,
      area: rings * (2 * rings + 1) + "π",
      met: rings * (2 * rings + 1) >= 2023 ? "Yes ✓" : "Not yet"
    };
  },
  displays: [
    { field: "n", label: "Circles", style: "large" },
    { field: "rings", label: "Shaded rings" },
    { field: "area", label: "Total area", style: "large" },
    { field: "met", label: "≥ 2023π?" }
  ],
  challenge: "**Challenge:** What's the smallest even number where shaded area hits 5000π?"
});
```

---

## Viz Plugin Interface

Content files define a `window.EXPLAINER_VIZ` object with `init()` and `timelineAction()`:

```javascript
window.EXPLAINER_VIZ = (function() {
  var svg, config;

  return {
    name: "my_viz",

    init: function(svgElement, vizConfig) {
      svg = svgElement;
      config = vizConfig;
      // Create SVG elements, set initial state
    },

    timelineAction: function(tl, method, params, t) {
      switch (method) {
        case "showGrid":
          // Schedule GSAP tweens on `tl` at time `t`
          tl.to(gridEl, { opacity: 1, duration: 0.8 }, t);
          break;
        case "drawCircle":
          tl.to(strokes[params.r], { strokeDashoffset: 0, duration: 1.2 }, t);
          break;
      }
    },

    // Optional: for interactive gate's vizSync
    drawInteractive: function(n) {
      // Redraw viz for slider value n
    }
  };
})();
```

The engine calls `timelineAction(tl, method, params, t)` for each `.do()` in the DSL. Schedule all animations onto the provided GSAP timeline at time `t`.

---

## Mobject System (MX)

A 3B1B-style declarative scene graph for SVG visualizations. Used when building viz plugins with the built-in primitives.

### Primitives

```javascript
var c = MX.circle({ radius: 50, fill: MX.C.INDIGO, x: 100, y: 100 });
var r = MX.rect({ width: 120, height: 80, cornerRadius: 8 });
var a = MX.arrow({ from: [0, 0], to: [100, 50], color: MX.C.AMBER });
var t = MX.text("Hello", { fontSize: 24, color: MX.C.WHITE });
var m = MX.tex("x^2 + y^2 = r^2", { fontSize: "1.5em" });
var ax = MX.axes({ xRange: [-5, 5], yRange: [-5, 5] });
var fn = MX.plot(x => Math.sin(x), ax, { color: MX.C.BLUE });
```

All 18 primitives: `circle`, `dot`, `rect`, `line`, `arrow`, `arc`, `polygon`, `ngon`, `star`, `path`, `brace`, `text`, `tex`, `code`, `group`, `numberLine`, `axes`, `plot`, `parametric`

### Animations

```javascript
scene.play(MX.fadeIn(obj));
scene.play(MX.growFromCenter(obj));
scene.play(MX.drawBorder(obj));
scene.play(MX.write(texObj));
scene.play(MX.indicate(obj));
scene.play(MX.morphTo(objA, objB));
scene.play(MX.sequence(MX.fadeIn(a), MX.write(b)));
scene.play(MX.stagger([c1, c2, c3], MX.fadeIn, { lag: 0.2 }));
```

### Camera

```javascript
scene.play(scene.camera.zoomTo({ target: obj, scale: 2 }));
scene.play(scene.camera.panTo({ x: 300, y: 200 }));
scene.play(scene.camera.focusOn(obj, { scale: 1.5 }));
scene.play(scene.camera.reset());
```

---

## Module Load Order

```
MX Modules (scene graph ready):
  mobject.js → anim.js → dsl.js

Content (DSL executes, sets window.LESSON + EXPLAINER_VIZ):
  content/*.js

Engine (boots playback):
  core.js → notebook.js → viz-panel.js → audio.js →
  subtitles.js → cards.js → gates.js → controls.js →
  scroll-sync.js → init.js
```

Each engine module registers EventBus listeners. `init.js` wires everything together and starts playback.

---

## TTS Audio Pipeline

`generate_audio.py` generates per-act narration with beat-level timing:

1. **Extracts** `say` text from every beat in every act (main + branch)
2. **Calls** ElevenLabs `/v1/text-to-speech/{voice_id}/with-timestamps` per act
3. **Aligns** word-level timestamps back to beats by word count
4. **Caches** in `audio_cache/` (skips unchanged acts on re-run)
5. **Outputs** a JS file with:
   - `L.audio` — per-act base64 MP3
   - `L.subtitles` — word-level subtitle cues
   - `L.beatTimings` — per-act beat start/end times

```bash
python3 generate_audio.py content/my_lesson.js              # generate
python3 generate_audio.py content/my_lesson.js --dry-run     # preview
python3 generate_audio.py content/my_lesson.js --no-cache    # force regen
```

### Without Audio

Timing is estimated from word count (~150 WPM / 2.5 words per second). GSAP drives playback directly. Subtitles are auto-generated from beat text.

---

## Build System

```bash
# MX mode (DSL + inline viz plugin in content file)
bash build.sh --mx content/lesson.js dist/lesson.html

# Standard mode (separate viz plugin file)
bash build.sh content/lesson.js content/viz.js dist/lesson.html

# With audio
bash build.sh --mx content/lesson.js dist/lesson.html content/audio.js
```

The build script:
1. Reads `template.html`, inlines CSS as `<style>`
2. Inlines MX modules (mobject, anim, dsl)
3. Inlines content JS, optional viz JS, optional audio JS
4. Inlines all 10 engine modules in dependency order
5. Outputs a single HTML file — zero external dependencies except KaTeX + GSAP CDN

---

## Controls

| Control | Action |
|---|---|
| Click / Space | Start or toggle play/pause |
| Left/Right arrows | Seek -5s / +5s |
| Scrubber bar | Drag to seek within current act |
| Milestone dots | Click to jump to an act boundary |
| Speed button | Cycle: 0.5×, 0.75×, 1×, 1.25×, 1.5×, 2× |
| CC button | Toggle subtitles |
| Speaker button | Toggle narration audio |

---

## Color Palette

Access via `MX.C` or `MX.colors`:

| Name | Hex | Use |
|---|---|---|
| `BLUE` | `#58C4DD` | Primary math objects |
| `TEAL` | `#5CD0B3` | Secondary accents |
| `GREEN` | `#83C167` | Correct / positive |
| `YELLOW` | `#FFFF00` | Attention |
| `GOLD` / `AMBER` | `#F0AC5F` / `#f59e0b` | Highlights, hints |
| `RED` / `CORAL` | `#FC6255` / `#f87171` | Errors, wrong answers |
| `PURPLE` | `#9A72AC` | Special elements |
| `INDIGO` | `#818cf8` | Theme primary |
| `EMERALD` | `#34d399` | Success, verified |
| `WHITE` | `#FFFFFF` | Text, labels |
| `BG` | `#0f0e17` | Dark background |

---

## Dependencies

- **Runtime** (CDN):
  - [KaTeX](https://katex.org/) — LaTeX math rendering
  - [GSAP](https://greensock.com/gsap/) — animation timeline
- **Build time:**
  - Python 3.6+
  - `requests` (for ElevenLabs TTS)



---

## Agentic AI Content Pipeline

A 6-stage agentic pipeline transforms a math problem into a fully interactive HTML lesson. The key architectural insight is a **two-layer planning split**: a first agent reasons about the solution and pedagogy in unconstrained natural language, then a second agent converts that narrative into structured JSONL. This separation lets the planner think deeply about math instead of fighting JSON schemas.

### Pipeline Overview

```
  Problem Statement
        │
        ▼
  ┌─────────────────────────────────────┐
  │  1. Solution Planner  (LLM)         │  Think freely about the math & pedagogy
  │     → natural-language narrative     │  No schema constraints
  └──────────────┬──────────────────────┘
                 ▼
  ┌─────────────────────────────────────┐
  │  2. Structure Agent   (LLM)         │  Convert narrative → lesson_plan.json
  │     → acts, gates, viz_requirements │  Validated against JSON schema
  └──────────────┬──────────────────────┘
                 ▼
  ┌─────────────────────────────────────┐
  │  3. Act & Gate Workers (LLM)        │  One worker per act/gate node
  │     → act_*.json, gate_*.json       │  Beats, narration, viz choreography
  └──────────────┬──────────────────────┘
                 ▼
  ┌─────────────────────────────────────┐
  │  4. Viz Agent          (LLM)        │  SVG plugin + GSAP animations
  │     → viz_spec.json                 │  Implements every viz action used
  └──────────────┬──────────────────────┘
                 ▼
  ┌─────────────────────────────────────┐
  │  5. Assembler    (deterministic)    │  JSON artifacts → JS code
  │     → content.js + viz.js           │  No LLM — same input, same output
  └──────────────┬──────────────────────┘
                 ▼
  ┌─────────────────────────────────────┐
  │  6. Reviewer           (LLM)        │  QA: sync, math, DSL, narrative
  │     → pass / issues + corrected JS  │  7-dimension verification
  └──────────────┬──────────────────────┘
                 ▼
          build.sh → lesson.html
```

### Why Two Planning Layers?

Asking one LLM call to reason about pedagogy *and* produce structured JSON leads to shallow explanations — the model spends capacity satisfying the schema instead of thinking deeply. Splitting into two layers fixes this:

| | Stage 1: Solution Planner | Stage 2: Structure Agent |
|---|---|---|
| **Input** | Problem statement | NL narrative from Stage 1 |
| **Thinking mode** | Free-form, creative | Systematic, schema-driven |
| **Focus** | *What* to teach, *why*, and *when* | *How* to encode it as acts/gates/beats |
| **Output** | Natural-language teaching plan | `lesson_plan.json` |
| **Constraint** | None — think like a tutor | Must satisfy JSON schema |

### Stage 1: Solution Planner

> **Prompt**: `pipeline/prompts/solution_planner.md`

The planner agent receives only the problem statement and thinks freely in natural language — no structured output required. It produces a pedagogical narrative as if briefing a teaching assistant.

**What it does:**
- Works through the full solution, identifying key insights and "aha" moments
- Plans the visual journey: what the student *sees* at each moment
- Designs the emotional arc (setup → complication → insight → payoff)
- Identifies where interactive gates should check understanding
- Specifies which visualizations support each explanation step

**Output**: Natural-language lesson narrative (free-form text)

**Prompt excerpt** — the agent's core identity and quality standard:

> *You are a world-class math education director — think 3Blue1Brown meets Pixar. You design lesson plans where **every visual moment is choreographed to the narration**. The visualization is not decoration; it IS the explanation.*
>
> *Your lessons must meet or exceed the quality bar of 3Blue1Brown:*
> - *Visual-first thinking. Plan the visual journey first, then layer narration on top.*
> - *Synchronized choreography. Specify exactly which viz action fires and WHY.*
> - *Progressive revelation. Never show the full picture up front.*
> - *Emotional arc. Tension, turning point, satisfying payoff.*
> - *Cinematic transitions. Don't jump between disconnected states.*

**Pedagogical principles baked into the prompt:**

1. Show, then tell — the visual lands a fraction before the narration
2. Build intuition before formalism — concrete examples first, then generalize
3. One visual focus per beat — direct attention ruthlessly
4. The viz is the proof — make the visual argument so compelling the algebra feels like a formality
5. Scaffold difficulty — each act slightly harder, each visual slightly more complex
6. Anticipate mistakes visually — show common confusions side-by-side
7. End with visual payoff — a "wow" moment in the final act

---

### Stage 2: Structure Agent

> **Prompt**: `pipeline/prompts/planner.md` (structured output mode)

Reads the natural-language narrative from Stage 1 and converts it into the machine-readable `lesson_plan.json` format.

**What it does:**
- Maps narrative sections to acts (30–90s each, one idea per act)
- Defines beat outlines with `narration_hint`, `card_type`, and `viz_actions`
- Places gates after conceptual leaps, designs wrong-path branch acts
- Specifies `viz_requirements` with all animation methods the lesson needs

**Output**: `lesson_plan.json` validated against `pipeline/schemas/lesson_plan.json`

**Output structure:**

```json
{
  "meta": { "title", "source", "answer", "estimated_duration_minutes" },
  "problem": { "text", "highlight" },
  "viz_requirements": {
    "type": "custom",
    "actions": [{ "method", "description", "params_schema" }]
  },
  "nodes": [
    { "type": "act",  "id": "act_...", "title", "objective", "beat_outline": [...] },
    { "type": "gate", "id": "gate_...", "gate_type": "quiz", "after_act": "act_..." },
    { "type": "marker", "label": "..." }
  ]
}
```

---

### Stage 3: Act & Gate Workers

> **Prompt**: `pipeline/prompts/act_worker.md`

Worker agents flesh out each node in the lesson plan into detailed specs. One LLM call per act or gate.

**What they do:**
- **Act workers**: Write beat-level narration (`say`), choose card types, choreograph `viz_actions` with timing offsets, set `inline_viz` snapshots
- **Gate workers**: Author quiz questions with plausible distractors, fill-in blanks with multiple accepted forms, wrong-path branch acts

**Output**: `act_*.json` and `gate_*.json` per node

**Prompt excerpt** — the visual-narration contract that every beat must satisfy:

> *The golden rule: the student should never hear something without seeing it at the same time.*
>
> | Narrator says... | Student sees... |
> |---|---|
> | "the first circle has radius one" | Circle r=1 draws on screen |
> | "notice the shaded ring between them" | Ring k=1 pulses/highlights |
> | "the area equals 3π" | "3π" label animates onto the ring |
> | "four k squared terms cancel" | Crossed-out terms fade in the derivation card |
>
> *If a beat has narration about a visual element but no matching `viz_actions`, you've broken the contract. Fix it.*

**Choreography patterns from the prompt:**

```
offset: 0       → fires when beat starts (reveal-then-explain)
offset: "+0.5"  → fires 0.5s in (good for "and then..." moments)
offset: "+1.0"  → let the first sentence land, then animate
```

**Narration style rules:**
- Conversational, second-person: "Let's look at...", "Notice how..."
- Build suspense: "Something interesting happens when we expand this..."
- Name what the student sees: "the orange ring between radius 3 and 4" (not "the expression")
- Pacing: ~2.5 words/second (150 WPM). Each beat = 1–3 sentences.

---

### Stage 4: Viz Agent

> **Prompt**: `pipeline/prompts/viz_worker.md`

Creates the SVG visualization plugin from the collected viz actions across all acts and gates.

**What it does:**
- Implements `window.EXPLAINER_VIZ` with `init()` and `timelineAction()` methods
- Builds cinematic GSAP animations for every action referenced in the acts
- Pre-creates all SVG elements in `init()` — `timelineAction()` only animates, never creates

**Output**: `viz_spec.json` with complete JS code for the plugin

**Prompt excerpt** — the design philosophy:

> *You are a visual effects artist for math education — your work should rival 3Blue1Brown in clarity and exceed it in polish.*
>
> *Your viz is not illustration. It IS the explanation. When done right, a student could understand the core idea from the animation alone, even on mute.*
>
> **Cinematic quality standards:**
> 1. *Every animation must have purpose. No gratuitous motion.*
> 2. *Entrance > Static. Objects should ARRIVE — drawn, grown, faded — never just appear.*
> 3. *Attention is a spotlight. When explaining ring k=1, everything else should dim.*
> 4. *Color carries meaning. Shaded = warm (amber, coral). Construction = cool (indigo, teal).*
> 5. *Layered depth. Background grid → objects → annotations → emphasis overlays.*
> 6. *Smooth transitions. Never jump-cut. Morph, cross-fade, or zoom.*
> 7. *Polish details. Subtle glows, letter-spacing, font-weight transitions.*

**Animation recipes included in the prompt:**

| Category | Examples |
|---|---|
| Entrance | Stroke draw-on (`dashoffset`), fade-in with upward drift, scale pop-in |
| Emphasis | Dim-others + color shift, pulse (flash + return), glow intensify |
| Transition | Cross-fade scene change, zoom-out with reposition |

---

### Stage 5: Assembler (Deterministic)

> **Code**: `pipeline/assembler.py` — no LLM, no prompt

Converts all JSON artifacts into executable JavaScript. Same inputs always produce the same output.

**What it does:**
- Reads `lesson_plan.json`, `act_*.json`, `gate_*.json`, `viz_spec.json`
- Generates `MX.lesson()` DSL code with all acts, beats, gates, and markers
- Smart code generation: `_js_str()`, `_js_value()`, `_js_obj()` handle escaping, indentation, line-breaking
- Produces `content.js` (lesson definition) and `viz.js` (visualization plugin)

---

### Stage 6: Reviewer

> **Prompt**: `pipeline/prompts/reviewer.md`

QA agent that verifies the assembled code before it ships. Can auto-correct minor issues.

**Output**: Pass/fail with issues list; optionally corrected `content.js` / `viz.js`

**Prompt excerpt** — the review mandate:

> *You are the final QA reviewer for an animated math lesson pipeline. A lesson where the narrator talks about something the student can't see is a broken lesson.*

**The 7 verification dimensions:**

| # | Dimension | What it checks |
|---|---|---|
| 1 | **Visual-narration sync** | Every `.say()` has matching `.do()` — no ghost references, no orphan animations |
| 2 | **Math correctness** | Formulas, computations, LaTeX expressions are all valid |
| 3 | **DSL correctness** | Matching braces, valid params, no trailing commas |
| 4 | **Narrative flow** | Specific visual language, natural pacing, tension/payoff |
| 5 | **Viz action consistency** | All `.do()` methods exist in the plugin, params match schema |
| 6 | **Gate quality** | Plausible distractors, specific explanations, wrong paths teach prerequisites |
| 7 | **Structural integrity** | No missing acts, no unreachable branches, correct ordering |

**Severity levels**: `error` (must fix) → `warning` (strongly recommend) → `suggestion` (polish)

**Correction policy from the prompt:**

> *When correcting, make **minimal** changes — fix the bug, don't rewrite the lesson. If narration says "watch the ring glow" but there's no glow action, ADD the `.do()` call. If there's a `.do("focusRing")` with no narration context, ADD a connecting phrase to the `.say()`.*

---

### Running the Pipeline

```bash
cd pipeline

# Full pipeline: problem → HTML
python orchestrator.py --problem problem.md --work-dir work/ --output dist/lesson.html

# Stage 1 only: produce narrative for review/editing
python orchestrator.py --problem problem.md --work-dir work/ --stage narrative

# Resume from an edited narrative (skip stage 1)
python orchestrator.py --narrative work/narrative.md --work-dir work/ --output dist/lesson.html

# Stages 1–2 only: produce narrative + structured plan
python orchestrator.py --problem problem.md --work-dir work/ --stage plan

# Resume from an existing plan (skip stages 1–2)
python orchestrator.py --plan work/lesson_plan.json --work-dir work/ --output dist/lesson.html

# Resume from all saved artifacts (skip completed stages)
python orchestrator.py --resume work/ --output dist/lesson.html

# Use a different model
python orchestrator.py --problem problem.md --work-dir work/ --model gemini-2.5-pro

# Skip review for faster iteration
python orchestrator.py --problem problem.md --work-dir work/ --no-review --output dist/lesson.html
```

Artifacts are saved to `--work-dir` after each stage, enabling human-in-the-loop editing at any point. The work directory contains:

```
work/
├── problem.md          # Original problem text
├── narrative.md        # Stage 1 output (editable NL plan)
├── lesson_plan.json    # Stage 2 output (structured plan)
├── acts/               # Stage 3 output
│   └── act_*.json
├── gates/
│   └── gate_*.json
├── viz_spec.json       # Stage 4 output
├── *.js                # Stage 5 output (content + viz JS)
└── review_report.json  # Stage 6 output
```

### LLM Provider Support

| Provider | Models | Structured Output Method |
|---|---|---|
| Gemini | `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash` | `response_schema` |
| Anthropic | `claude-sonnet-4-*`, `claude-opus-4-*` | `tool_use` with forced tool |

---
