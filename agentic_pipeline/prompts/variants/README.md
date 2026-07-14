# Planner prompt variants

> **Status:** `v7_combined.md` is the currently promoted planner (copied to
> `../planner.md`, commit 587e13d) — validated 17W-1T-0L in pairwise judging.


Drop alternate planner prompts here to A/B test them without touching the
canonical `prompts/planner.md`.

Each `*.md` file in this directory is treated as one variant by
`scripts/run_planner_variants.sh`. The script generates the stage-1 narrative
once and feeds that same narrative to every variant, so differences in the
resulting `lesson_plan.json` are attributable to the planner prompt alone
(not stage-1 sampling noise).

## Adding a variant

```bash
cp ../planner.md planner_v2.md      # start from the current prompt
$EDITOR planner_v2.md               # make your changes
```

## Running

```bash
# from the agentic_pipeline/ directory
scripts/run_planner_variants.sh [PROBLEM_FILE] [MODEL]
# defaults: PROBLEM_FILE=amc10a_2023_p15.md  MODEL=gemini-2.5-flash
```

Outputs land in `work/variant_<name>/lesson_plan.json`. Compare with e.g.:

```bash
diff work/variant_planner_v2/lesson_plan.json work/variant_planner_v3/lesson_plan.json
```

You can also run a single variant directly:

```bash
python orchestrator.py \
  --narrative work/base/narrative.md \
  --work-dir  work/variant_planner_v2/ \
  --planner-prompt prompts/variants/planner_v2.md \
  --stage plan
```
