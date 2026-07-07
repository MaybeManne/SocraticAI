#!/usr/bin/env bash
#
# run_planner_variants.sh — A/B test planner.md prompt variants in isolation.
#
# Why this exists:
#   Stage 1 (solution_planner) is stochastic (temperature 0.7), so regenerating
#   the narrative for every planner variant would confound prompt-variant effects
#   with stage-1 sampling noise. This script runs stage 1 ONCE, pins the resulting
#   narrative.md, and feeds that same narrative to every planner variant. The only
#   thing that differs between runs is the planner prompt, so diffs in
#   lesson_plan.json are attributable to the prompt change alone.
#
# What it does:
#   1. Runs stage 1 once against $PROBLEM   -> work/base/narrative.md (+ problem.md)
#   2. For each prompts/variants/*.md:
#        orchestrator.py --narrative work/base/narrative.md \
#                        --work-dir  work/variant_<name>/ \
#                        --planner-prompt <that file> \
#                        --stage plan
#      producing work/variant_<name>/lesson_plan.json for side-by-side comparison.
#
# Usage:
#   scripts/run_planner_variants.sh [PROBLEM_FILE] [MODEL]
#
#   PROBLEM_FILE  path to the problem markdown (default: amc10a_2023_p15.md)
#   MODEL         model id passed to --model    (default: gemini-2.5-flash)
#
# Add variants by dropping prompt files into prompts/variants/ (e.g. planner_v2.md).

set -euo pipefail

# Resolve to the pipeline dir (this script lives in agentic_pipeline/scripts/).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPELINE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PIPELINE_DIR"

PROBLEM="${1:-amc10a_2023_p15.md}"
MODEL="${2:-gemini-2.5-flash}"
VARIANTS_DIR="prompts/variants"
BASE_DIR="work/base"

if [[ ! -f "$PROBLEM" ]]; then
  echo "ERROR: problem file not found: $PROBLEM" >&2
  exit 1
fi

if [[ ! -d "$VARIANTS_DIR" ]] || ! ls "$VARIANTS_DIR"/*.md >/dev/null 2>&1; then
  echo "ERROR: no variant prompts found in $VARIANTS_DIR/*.md" >&2
  echo "       Add planner variants there (e.g. $VARIANTS_DIR/planner_v2.md)." >&2
  exit 1
fi

# ── Step 1: generate the shared narrative once ──────────────────────────────
echo "=============================================================="
echo "Stage 1 (once): $PROBLEM  ->  $BASE_DIR/narrative.md   [model: $MODEL]"
echo "=============================================================="
mkdir -p "$BASE_DIR"
python orchestrator.py \
  --problem "$PROBLEM" \
  --work-dir "$BASE_DIR" \
  --stage narrative \
  --model "$MODEL"

if [[ ! -f "$BASE_DIR/narrative.md" ]]; then
  echo "ERROR: stage 1 did not produce $BASE_DIR/narrative.md" >&2
  exit 1
fi

# ── Step 2: run each planner variant against the pinned narrative ───────────
for variant in "$VARIANTS_DIR"/*.md; do
  name="$(basename "$variant" .md)"
  vdir="work/variant_${name}"
  echo
  echo "=============================================================="
  echo "Variant: $name"
  echo "  prompt:   $variant"
  echo "  work-dir: $vdir"
  echo "=============================================================="
  mkdir -p "$vdir"
  # --narrative recovers problem text from <work-dir>/problem.md, so seed it
  # from the base run to keep every variant on identical inputs.
  cp "$BASE_DIR/problem.md" "$vdir/problem.md"
  python orchestrator.py \
    --narrative "$BASE_DIR/narrative.md" \
    --work-dir "$vdir" \
    --planner-prompt "$variant" \
    --stage plan \
    --model "$MODEL"
done

echo
echo "=============================================================="
echo "Done. Compare plans across variants:"
for variant in "$VARIANTS_DIR"/*.md; do
  name="$(basename "$variant" .md)"
  echo "  work/variant_${name}/lesson_plan.json"
done
echo "e.g.:  diff work/variant_planner/lesson_plan.json work/variant_planner_v2/lesson_plan.json"
echo "=============================================================="
