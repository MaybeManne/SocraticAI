# SocraticAI — Automated Interactive Math Lesson Generator

SocraticAI takes a STEM problem (math / physics / CS), runs it through a
6-stage agentic pipeline, and produces a **self-contained interactive HTML
lesson** — narrated with TTS audio, animated (SVG or THREE.js), with Socratic
checkpoint "gates" that quiz the learner mid-lesson. One output file, no
server, opens in any browser.

**Live benchmark results: <https://socraticai-results.vercel.app>** —
leaderboard, per-problem scores, every video, and downloadable data
(combined workbook, CSVs, human scoring sheet).

---

## The 6-stage pipeline

`agentic_pipeline/orchestrator.py` drives one LLM-agent stage after another
(default backbone: Gemini; per-stage prompts in `agentic_pipeline/prompts/`):

| Stage | Agent | Output |
|---|---|---|
| 1 | Solution planner | `narrative.md` — worked solution + pedagogical narrative |
| 2 | Structure planner (`prompts/planner.md` — the promoted **v7** prompt) | `lesson_plan.json` — acts, beats, gates |
| 3a | Act author | beat-by-beat narration + equation cards per act |
| 3b | Gate author | Socratic check-in questions |
| 4 | Viz agent | executable JS visualization (`viz_spec.json`) |
| 5 | Assembler | content + viz + engine → single self-contained HTML |
| 6 | Reviewer | correctness / sync / rendering checks (skip with `--no-review`) |
| (7) | `--audio` | ElevenLabs TTS narration embedded into the HTML |

```bash
cd agentic_pipeline
pip install -r requirements.txt

GOOGLE_API_KEY=... ELEVENLABS_API_KEY=... python orchestrator.py \
  --problem pendulum_problem.md \
  --work-dir work/pendulum_v7 \
  --output "../dist/pendulum/pendulum_v7.html" \
  --audio
```

Useful flags: `--model` (backbone), `--viz-model` (Stage-4 override,
`openrouter:` prefixes supported), `--resume <work-dir>` (skip finished
stages), `--stage <name>` (stop early). The pipeline hard-fails rather than
ship a silent lesson or a viz that violates its declared actions.

The browser runtime that plays lessons lives in `engine/` (timeline graph,
cards, gates, viz panel); `template.html` + `build.sh` assemble it;
`generate_audio.py` does TTS.

---

## The benchmark: 50 problems × 4 methods

Single source of truth: **`agentic_pipeline/benchmark/problems.json`** —
50 problems (17 math / 17 physics / 16 CS, tagged easy/medium/hard), each
with a problem-statement file, canonical answer, and acceptable variants.
Every consumer (judge, dashboards, site builders) reads this manifest.

| Method | What it is | Coverage |
|---|---|---|
| **v7** (SocraticAI) | This pipeline with the promoted v7 planner prompt | 49/50 (doppler failed generation) |
| **Code2Video** | arXiv 2510.01174, Gemini backbone (silent Manim) | 50/50 |
| **Paper2Video** | arXiv 2510.05096; problem+solution wrapped as a LaTeX paper | 8/50 |
| **NotebookLM** | Google NotebookLM video overviews (made manually) | 6/50 |

### Judging

`agentic_pipeline/judge/` — a blind pairwise LLM judge
(`pairwise_evaluator.py`, CLI: `run_judge.py`):

- dense frame sampling (~every 10s, capped ~20 frames per lesson/video)
- Whisper transcripts for narrated external videos; engine transcripts
  (verbalized math, beat timings) for SocraticAI lessons
- 6 dimensions — visual accuracy, interactivity, narration quality, sync,
  concept accuracy, polish — judged in parallel, then aggregated
- videos are anonymized as "Lesson 1/2" in randomized order
- results: `judge/pairwise_results/*.json`; per-video metadata (duration,
  solved, visual count): `judge/video_scores/`

80 pairwise comparisons cover every (problem, method) pair sharing a
problem; `scores.csv` distills them into per-(id, method) 0–100 credit.

---

## Where everything lives

```
agentic_pipeline/          pipeline (orchestrator, prompts, schemas, tests)
  benchmark/problems.json  the 50-problem manifest (single source of truth)
  judge/                   pairwise judge + results + per-video scores
  work/                    per-lesson intermediate artifacts (gitignored)
engine/                    browser lesson runtime
content/                   reference viz plugins (Stage-4 few-shot examples)
mobject/                   SVG animation DSL
dist/                      generated lessons (gitignored; judged v1–v7 + finals)
benchmark_comparison/      external-tool videos + extracted frames (judge input)
benchmark_final/           FINAL deliverable (media gitignored, data tracked):
  v7/ code2video/ paper2video/ notebooklm/   all 113 videos
  benchmark.csv videos.csv scores.csv        the 3 result tables
  benchmark_final.xlsx                       combined 3-tab workbook
  human_scoring_sheet.xlsx                   1–5 rubric sheet for evaluators
  missing.csv SUMMARY.md                     gaps + known limitations
final_site/                builder + deploy dir for the live results site
dashboard/                 local operator dashboard (compare, judge, rank)
benchmark_site/ dashboard_share/   earlier shareable static sites (still live)
docs/                      engine/authoring documentation
demo_bench/ + BENCHMARK.md historical Stage-4 viz-model benchmark (kept as-is)
```

Rebuild + redeploy the results site after data changes:

```bash
python3 final_site/build.py
cd final_site/socraticai-results && vercel deploy --prod
```

---

## Reproducing the benchmark

1. **Generate lessons** — run the orchestrator per problem (above).
   Generation is nondeterministic and the validators reject malformed
   output, so wrap it in retries for hard problems; a lesson must render,
   embed audio, and reach the manifest's canonical answer.
2. **External tools** — drop each tool's video at
   `benchmark_comparison/<problem>/<tool>.mp4`
   (+ optional `<tool>.transcript.txt`; Whisper fills the gap otherwise).
3. **Judge a pair** (`OPENAI_API_KEY` required):
   ```bash
   python judge/run_judge.py --a circles_v7 --b circles_code2video
   ```
   `--force` re-judges an existing pair.
4. **Rebuild data + site** — `final_site/build.py` bakes
   `benchmark_final/`'s CSVs into the deployed site verbatim.

## Env vars

| Var | Used for |
|---|---|
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | Gemini (pipeline backbone) |
| `ELEVENLABS_API_KEY` | TTS narration (`--audio`) |
| `OPENAI_API_KEY` | judge (GPT) + Whisper transcription |
| `ANTHROPIC_API_KEY` | Claude models (optional) |
| `OPENROUTER_API_KEY` | any `openrouter:`-prefixed model (optional) |

Keys are read from the environment only — never commit them.
