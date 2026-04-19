# Agentic Pipeline

The agentic pipeline generates a complete lesson from a problem statement using a sequence of LLM calls. It lives in `agentic_pipeline/` and supports both Gemini and Claude.

## Overview

```
Problem statement (Markdown)
    │
    ▼ Stage 1 — Solution Planner             [retries on empty/oversized output]
Narrative (free-form teaching plan)
    │
    ▼ Stage 2 — Structure Agent              [retries on schema validation errors]
lesson_plan.json (acts, gates, beat outlines)
    │
    ├─▶ Stage 3a — Act Workers               [retries per-act]
    └─▶ Stage 3b — Gate Workers              [retries; fill-in requires [___] marker]
               │
               ▼ Stage 4 — Viz Agent          [retries on validation + layout audit]
          viz_spec.json (GSAP plugin code)
               │
               ▼ Stage 4b — Viz Visual Self-Revision (optional, --viz-screenshot-feedback)
          Preview HTML + screenshot → sighted viz_worker → revised spec
               │
               ▼ Stage 5 — Assembler (deterministic, no LLM)
          content.js + viz.js
               │
               ▼ Stage 6 — Reviewer          [sighted if --screenshot; retries on bad syntax]
          Reviewed JS (DSL-whitelist guarded)
               │
               ▼
          build.sh → lesson.html
```

## Feedback loops & guards

Every LLM stage has a retry loop feeding validation errors back into the next attempt. Additional guards:

- **`--viz-screenshot-feedback`** (Anthropic models only): after Stage 4, assemble+build+screenshot the lesson, then show the screenshot to the viz agent with instructions to fix visual bugs (overlap, clipping, empty groups). The revised spec is syntax-checked and validated; if it fails, the original is kept. Using this flag with a Gemini model prints a loud warning and skips Stage 4b.
- **Layout validator** (`_check_viz_layout` in `orchestrator.py`): heuristic audit before accepting viz code. Catches stacked text in loops without `clearSlot`, out-of-bounds coordinates, and freehand text creation with no `Z.<ZONE>` references. Warnings feed back as validation errors and trigger a retry.
- **Zone/slot pattern** (enforced by `viz_worker.md`): every plugin must declare a layout map (`var Z = { BADGE, EQN, SLIDER, CALC }`) with non-overlapping rectangles and a `clearSlot(id)` helper. Every persistent overlay lives in exactly one named zone. See `docs/guides/viz-plugins.md` for the full spec.
- **Fill-in `[___]` marker**: `validate_gate_spec` rejects any `fill-in` gate whose prompt lacks the `[___]` token — without it, no input field renders and the student cannot answer.
- **Reviewer DSL whitelist**: corrections that introduce non-existent DSL methods (`.pause()`, `.wait()`, …) are rejected and the original is kept; if a correction is chosen but fails `node --check`, the reviewer is re-prompted once with the syntax error.

## Running with feedback on

```bash
python3 agentic_pipeline/orchestrator.py \
  --problem problem.md \
  --output dist/lesson.html \
  --screenshot \
  --viz-screenshot-feedback \
  --model claude-sonnet-4-20250514
```

Requires `pip install -r agentic_pipeline/requirements.txt && playwright install chromium`.

## Setup

Install Python dependencies:

```bash
pip install anthropic google-generativeai jsonschema
```

Set your API key in your environment:

```bash
export ANTHROPIC_API_KEY="..."
# or
export GOOGLE_API_KEY="..."
```

## Running the full pipeline

```bash
python agentic_pipeline/orchestrator.py \
  --problem path/to/problem.md \
  --work-dir work/my-lesson/ \
  --output dist/my-lesson.html
```

The work directory stores all intermediate artifacts so you can inspect or edit them before continuing.

## CLI flags

| Flag | Description |
|------|-------------|
| `--problem <file.md>` | Problem statement to teach (required unless resuming) |
| `--work-dir <dir>` | Where to store intermediate artifacts |
| `--output <file.html>` | Final compiled HTML |
| `--model <id>` | LLM to use (default: `gemini-2.5-flash`) |
| `--narrative <file.md>` | Resume from an existing narrative (skip Stage 1) |
| `--plan <file.json>` | Resume from an existing plan (skip Stages 1–2) |
| `--resume <dir>` | Resume from all existing artifacts in a work dir |
| `--no-review` | Skip Stage 6 QA review |
| `--stage <name>` | Run only up to this stage: `narrative`, `plan`, `acts`, `viz`, `assemble`, `review` |

## Resuming

Every stage writes its output to the work directory. If a later stage fails, you can resume without re-running earlier stages:

```bash
# Edit work/my-lesson/narrative.md, then resume from Stage 2 onward:
python agentic_pipeline/orchestrator.py \
  --narrative work/my-lesson/narrative.md \
  --work-dir work/my-lesson/ \
  --output dist/my-lesson.html
```

## Editing artifacts before assembly

The most powerful workflow is to run up to plan, inspect and edit the JSON, then resume:

```bash
# Run through Stage 2 only
python agentic_pipeline/orchestrator.py \
  --problem problem.md \
  --work-dir work/ \
  --stage plan

# Edit work/lesson_plan.json manually

# Resume from Stage 3 onward
python agentic_pipeline/orchestrator.py \
  --plan work/lesson_plan.json \
  --work-dir work/ \
  --output dist/lesson.html
```

## Supported models

Any Anthropic or Gemini model ID works. The pipeline auto-detects by checking if the model string contains "gemini":

| Model | Notes |
|-------|-------|
| `gemini-2.5-flash` | Default — fast, cheap, good at structured output |
| `gemini-2.5-pro` | Better reasoning for complex proofs |
| `claude-opus-4-20250514` | Highest quality, slower |
| `claude-sonnet-4-6` | Good balance of quality and speed |

## Stage 6: QA Review

The reviewer checks seven dimensions:

1. **Visual-narration sync** — Every narration that references a visual must have a `.do()` call; every `.do()` must have narration context. This is the most important dimension.
2. **Math correctness** — Equations, derivations, and answer choices are mathematically sound.
3. **DSL correctness** — `L.act`, `A.say`, `.card`, `.do`, `L.ask` are used correctly.
4. **Narrative flow** — Acts build logically; no abrupt jumps.
5. **Viz action consistency** — `.do()` method names match methods the plugin implements.
6. **Gate quality** — Questions are clear; wrong-path branches are educationally sound.
7. **Structural issues** — No empty acts, duplicate IDs, or missing required fields.

When issues are found, the reviewer outputs corrected JavaScript. Set `--no-review` to skip this if you want to iterate manually.

## Intermediate artifacts

All artifacts are written to the work directory:

| File | Stage | Description |
|------|-------|-------------|
| `narrative.md` | 1 | Free-form teaching plan |
| `lesson_plan.json` | 2 | Structured act/gate/beat outline |
| `act_<id>.json` | 3 | Per-act detailed beats |
| `gate_<id>.json` | 3 | Per-gate question data |
| `viz_spec.json` | 4 | Viz plugin specification |
| `content.js` | 5 | Assembled lesson script |
| `viz.js` | 5 | Assembled viz plugin |
| `content_reviewed.js` | 6 | QA-corrected lesson script |
| `viz_reviewed.js` | 6 | QA-corrected viz plugin |
