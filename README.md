# SocraticAI — Automated Math Lesson Generator

This repo takes a math problem (AMC-style), runs it through a 6-stage agentic pipeline, and spits out a self-contained interactive HTML lesson — narrated, animated, with Socratic gating. The whole thing runs on Gemini by default. No server needed; the output is one file you can open in a browser.

---

## Quick demo

Just open this in your browser:

```
demo_bench/claude_v2.html
```

That's the fully-baked lesson for AMC 10A 2023 P15 (nested circles). Audio narration, step-by-step algebra cards, interactive slider, KaTeX equations — all inline.

---

## Run the pipeline on your own problem

```bash
cd agentic_pipeline
pip install -r requirements.txt

# Run all 6 stages on a problem file
GOOGLE_API_KEY=your_key python orchestrator.py \
  --problem amc10a_2023_p15.md \
  --output ../demo_bench/my_lesson.html

# Resume from saved intermediate artifacts (skip stages you already ran)
python orchestrator.py --resume output/my_run --output ../demo_bench/my_lesson.html

# Run only up to a specific stage (narrative, plan, acts, viz, assemble)
python orchestrator.py --problem amc10a_2023_p15.md --stage viz
```

Default model is `gemini-2.5-flash`. To use a different model for just the viz stage (Stage 4):

```bash
python orchestrator.py --resume output/my_run \
  --viz-model openrouter:anthropic/claude-3-5-haiku \
  --output ../demo_bench/my_lesson.html \
  --no-review
```

OpenRouter models need `OPENROUTER_API_KEY` in your env.

---

## Stages

| Stage | What it does |
|-------|-------------|
| 1 — Solution Planner | Solves the problem, writes a narrative walkthrough |
| 2 — Structure Agent | Converts narrative → structured lesson plan JSON |
| 3a — Act Author | Writes beat-by-beat narration + equation cards per act |
| 3b — Gate Author | Writes Socratic check-in questions |
| 4 — Viz Agent | Generates the SVG animation plugin (JS) |
| 5 — Assembler | Combines everything into self-contained HTML |
| 6 — Reviewer | Catches logic/rendering bugs (optional, skip with `--no-review`) |

Intermediate artifacts saved to `--work-dir` (default: `output/`). Use `--resume <dir>` to skip completed stages.

---

## Model benchmark (Stage 4 viz)

Tested on AMC 10A 2023 P15 using `--viz-model`. Stage 4 needs ≥64K context and reliable JSON output mode.

| Model | Result | Notes |
|-------|--------|-------|
| `anthropic/claude-3-5-haiku` | ✅ Pass | Clean output, 200K ctx |
| `google/gemini-2.0-flash-001` | ✅ Pass | Fast, 1M ctx |
| `deepseek/deepseek-chat-v3-0324` | ✅ Pass | 1 retry needed, 163K ctx |
| `deepseek/deepseek-r1` | ❌ Timeout | Reasoning model too slow (>300s) |
| `deepseek/deepseek-r1-distill-llama-70b` | ❌ Schema error | Returns list instead of dict |
| `cohere/command-r-plus` / `command-a` | ❌ Truncation | Generates >16K tokens of JS, hits output cap |
| `google/gemini-flash-1.5` | ❌ 404 | Slug deprecated on OpenRouter |

Full failure details in `BENCHMARK.md`.

---

## Repo layout

```
agentic_pipeline/   Pipeline code (orchestrator.py, assembler.py, prompts/, schemas/)
content/            Reference viz plugins used as few-shot examples in Stage 4
demo_bench/         Built HTML outputs — open any in browser
dist/               Original hand-crafted lessons (reference only)
engine/             Runtime JS (player, notebook renderer, KaTeX wrapper)
mobject/            SVG animation DSL
explainer-lib.css   Shared stylesheet
build.sh            Bundles engine + content JS → single HTML
generate_audio.py   ElevenLabs TTS for narration (optional)
```

---

## Env vars

| Var | Used for |
|-----|---------|
| `GOOGLE_API_KEY` | Gemini (default model) |
| `ANTHROPIC_API_KEY` | Claude direct API |
| `OPENROUTER_API_KEY` | Any `openrouter:` prefixed model |
| `ELEVENLABS_API_KEY` | Audio generation (optional) |
