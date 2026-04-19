# Changelog

## [unreleased] — agentic pipeline hardening

### Added
- **Stage 4b — Viz visual self-revision** (`--viz-screenshot-feedback`, Anthropic models only).
  After Stage 4 authors the viz plugin, the pipeline assembles a preview HTML,
  builds it, screenshots it with Playwright, and shows the screenshot back to
  the viz worker with instructions to fix visual bugs (overlap, clipping,
  empty groups). The revised spec is syntax-checked and validated; failures
  fall back to the original.
- **Layout validator** (`_check_viz_layout` in `orchestrator.py`, fed into the
  Stage 4 retry loop). Catches the "jumbled diagram" anti-pattern:
    - `svgEl("text", { y: ...i*... })` inside a loop with no `clearSlot`
      anywhere → stacked-text overlap
    - literal x/y coordinates outside the viewBox (800×400 default)
    - 5+ text elements with zero `Z.<ZONE>` references → freehand layout
- **Zone/slot/panelBg layout pattern** documented in `viz_worker.md` prompt
  and `docs/guides/viz-plugins.md`. Every persistent overlay lives in one named
  zone (`BADGE / EQN / SLIDER / CALC`); `clearSlot(id)` removes prior occupants
  before redraw; `panelBg()` provides a readable rounded backing rect.
- **Fill-in `[___]` marker validator** in `validate_gate_spec`. The engine
  splits prompts on `[___]` to render the input field; without the marker, no
  input is drawn and the checkpoint is unanswerable. The archer lesson shipped
  with this bug; it is now pinned by regression tests and enforced as a hard
  rule in `gate_worker.md`.
- **Reviewer DSL whitelist** (`_reject_if_invalid_dsl` in `orchestrator.py`).
  Rejects reviewer "corrections" that introduce non-existent DSL methods
  (`.pause()`, `.wait()`, `.delay()`, etc.). These corrections crashed the
  lesson build, leaving `window.LESSON` empty and the player stuck at 0:00.
- **Stage 1 retry** (`_validate_narrative` — length bounds 200..20k chars).
- **Stage 6 retry** — if the reviewer's correction fails `node --check`, the
  reviewer is re-prompted once with the syntax error.
- **Gemini guard for `--viz-screenshot-feedback`**: prints a loud `⚠️` warning
  with model-switch instructions and explicitly skips Stage 4b. No silent
  no-op.
- **Seek regression test** in `test/playback.test.js`: verifies `seek()`
  marks past beats as rendered and locks past GSAP children to end state
  (pins the scroll-replay "3-second intro flash" bug).
- **`requirements.txt`** declaring `pytest`, `playwright`, `anthropic`,
  `google-genai`, `jsonschema`.

### New test files
- `agentic_pipeline/tests/test_orchestrator_guards.py` — 9 tests pinning
  `_check_viz_layout` and `_reject_if_invalid_dsl` behavior.
- `agentic_pipeline/tests/test_e2e_mocked.py` — 2 tests running the full
  stage1→stage5 pipeline with mocked LLM calls.
- 2 new tests in `test_validate.py` for the `[___]` marker check.

### Test count
- JS (vitest): 189 passing
- Python (pytest): 222 passing
- **Total: 411 tests, 0 failures.**

### Docs
- `docs/guides/agentic-pipeline.md` — Feedback loops & guards section,
  Stage 4b in the flow diagram, retry annotations per stage, CLI example.
- `docs/guides/viz-plugins.md` — full Zone/slot/panelBg section with
  validator rules.
- `README.md` — agentic-pipeline quick start, guard summary, test counts.

### Fixed
- Archer projectile lesson:
    - `.pause(0.8)` removed (not a valid DSL method; was crashing lesson build)
    - first checkpoint prompt now has `[___]` marker (was unanswerable)
    - intro title card dropped
    - cleaned-up viz layout (zones, slots, backing panels, non-overlapping
      equation/calc/slider/graph overlays)
    - interactive angle slider + parametric flight animation in act 1
