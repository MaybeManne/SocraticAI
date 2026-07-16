#!/usr/bin/env python3
"""
video_meta.py — per-VIDEO metadata & scores, separate from the pairwise judge.

Computes, per lesson/external video, and caches to video_scores/<id>.json:

  durationSeconds  lesson: engine totalDefaultDuration via playwright
                   external: ffprobe
  solved           did it reach AND state the correct final answer?
                   (binary; distinct from concept_accuracy = explanation quality)
  explained        did it walk through reasoning/steps, or just present the
                   answer? (distinct from both solved and concept_accuracy)
  visualCount      distinct visuals shown. Definition of ONE countable visual:
                   one diagram/animation scene = 1, one data/derivation table
                   = 1, one chart/plot = 1. Repeated mutations of the same
                   diagram do NOT count again; decorative backgrounds, title
                   cards, plain-text/formula-only cards, and presenter
                   overlays do not count.
                     - SocraticAI lessons: derived from lesson_plan.json —
                       1 for the persistent custom viz (if any) + 1 per beat
                       card of a visual type (derivation, bar-chart, figure,
                       plot-2d, split).
                     - external videos: one vision LLM call over the dense
                       timeline frames (see --help of the pairwise judge for
                       how frames are extracted/cached).

solved/explained come from ONE LLM call over the transcript + the canonical
answer from benchmark/answers.json. Everything is cached and only recomputed
with --force. This module never touches pairwise_results/.

    python3 judge/video_meta.py --id circles_v7
    python3 judge/video_meta.py --all            # every benchmark video
    python3 judge/video_meta.py --all --force
"""
import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

JUDGE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(JUDGE_DIR))
from pairwise_evaluator import (  # noqa: E402
    JUDGE_MODEL, LessonAssets, REPO_ROOT, PIPELINE_DIR,
    _call_openai, _image, _text, ensure_screenshot, parse_agent_json,
)

SCORES_DIR = JUDGE_DIR / "video_scores"
ANSWERS_PATH = PIPELINE_DIR / "benchmark" / "answers.json"
VISUAL_CARD_TYPES = {"derivation", "bar-chart", "figure", "plot-2d", "split"}

VISUAL_DEFINITION = (
    "ONE countable visual = one distinct diagram or animation scene (1), one "
    "data or derivation table (1), or one chart/plot (1). Progressive "
    "mutations/highlights of the SAME diagram count once. Do NOT count: title "
    "cards, plain text or a lone formula, decorative backgrounds, watermarks, "
    "presenter/avatar overlays, or browser/player chrome."
)

SOLVED_PROMPT = """You are auditing a single lesson video's transcript against \
the problem it teaches. Answer two independent yes/no questions:

1. "solved" — does the narration reach AND explicitly state the correct final \
answer (per the canonical answer given)? Stating an equivalent form counts; \
never stating a final answer, or stating a wrong one, is false.
2. "explained" — does the narration walk through the reasoning/steps that lead \
to the answer (derivation, worked example, argument), as opposed to only \
presenting the answer or only describing the problem?

These are about presence, not quality. Respond ONLY with valid JSON:
{"solved": true|false, "explained": true|false, "rationale": "<one sentence each>"}"""

VISION_COUNT_PROMPT = f"""You are counting distinct visuals in a lesson video, \
shown to you as frames sampled every ~10 seconds in chronological order.

{VISUAL_DEFINITION}

Count each distinct visual ONCE across the whole video (a diagram appearing in \
many frames is still 1). Respond ONLY with valid JSON:
{{"visualCount": <int>, "breakdown": "<short comma-separated list of what you counted>"}}"""


def _duration_lesson(html_path):
    """Read the engine's total default-path duration via playwright."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(f"file://{Path(html_path).resolve()}")
        page.wait_for_timeout(4000)
        total = page.evaluate(
            "() => (window._graph && window._graph.totalDefaultDuration) || 0")
        browser.close()
    if not total:
        raise RuntimeError(f"totalDefaultDuration unavailable for {html_path}")
    return round(float(total), 1)


def _duration_video(video_path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(video_path)],
        capture_output=True, text=True, timeout=60)
    return round(float(r.stdout.strip()), 1)


def _visuals_from_plan(plan_json):
    """Lesson visual count derived from the plan (deterministic, no LLM)."""
    plan = json.loads(plan_json)
    count = 0
    breakdown = []
    viz_type = (plan.get("viz_requirements") or {}).get("type")
    if viz_type and viz_type != "none":
        count += 1
        breakdown.append(f"main {viz_type} viz")
    for node in plan.get("nodes", []):
        if node.get("type") != "act":
            continue
        for beat in node.get("beat_outline", []):
            ct = beat.get("card_type")
            if ct in VISUAL_CARD_TYPES:
                count += 1
                breakdown.append(f"{node['id']}:{ct}")
    return count, ", ".join(breakdown)


def _visuals_from_frames(assets):
    """External video visual count via one vision call over timeline frames."""
    frames = ensure_screenshot(assets)
    parts = [_text(f"{len(frames)} frames, chronological:")]
    for f in frames:
        ts = f.stem.split("_", 1)[1] if "_" in f.stem else f.stem
        parts.append(_text(f"frame at {ts.replace('t', 't=')}:"))
        parts.append(_image(f))
    raw = _call_openai(VISION_COUNT_PROMPT, parts, model=JUDGE_MODEL, max_tokens=8192)
    out = parse_agent_json(raw)
    return int(out["visualCount"]), str(out.get("breakdown", ""))


def _solved_explained(assets, answer):
    transcript = assets.transcript()
    if not transcript:
        return None, None, "no transcript available"
    content = [_text(
        f"The problem:\n{assets.problem_text}\n\n"
        f"Canonical correct answer:\n{answer}\n\n"
        f"Transcript:\n{transcript[:30000]}")]
    out = parse_agent_json(_call_openai(SOLVED_PROMPT, content, model=JUDGE_MODEL, max_tokens=8192))
    return bool(out["solved"]), bool(out["explained"]), str(out.get("rationale", ""))


def score_video(variant_id, force=False):
    SCORES_DIR.mkdir(exist_ok=True)
    out_path = SCORES_DIR / f"{variant_id}.json"
    if out_path.exists() and not force:
        return json.loads(out_path.read_text())

    assets = LessonAssets(variant_id)
    answers = json.loads(ANSWERS_PATH.read_text())
    answer = (answers.get(assets.subject) or {}).get("answer", "(no canonical answer recorded)")

    if assets.is_external:
        duration = _duration_video(assets.video_path)
        visual_count, visual_breakdown = _visuals_from_frames(assets)
        visual_source = "vision-llm"
    else:
        duration = _duration_lesson(assets.html_path)
        visual_count, visual_breakdown = _visuals_from_plan(assets.plan_json)
        visual_source = "lesson_plan"

    solved, explained, rationale = _solved_explained(assets, answer)

    record = {
        "id": variant_id,
        "subject": assets.subject,
        "durationSeconds": duration,
        "durationSource": "ffprobe" if assets.is_external else "engine",
        "solved": solved,
        "explained": explained,
        "solvedExplainedRationale": rationale,
        "visualCount": visual_count,
        "visualCountSource": visual_source,
        "visualBreakdown": visual_breakdown,
        "visualDefinition": VISUAL_DEFINITION,
        "model": JUDGE_MODEL,
        "scoredAt": datetime.now(timezone.utc).isoformat(),
    }
    out_path.write_text(json.dumps(record, indent=2))
    print(f"  {variant_id}: {duration}s  solved={solved} explained={explained} "
          f"visuals={visual_count} ({visual_source})")
    return record


def benchmark_ids():
    """Every benchmark item: v1-v7 lessons + external videos, all subjects."""
    from pairwise_evaluator import _SUBJECTS, VIDEO_EXTS
    ids = []
    for subject, spec in _SUBJECTS.items():
        for n in range(1, 8):
            vid = f"{subject}_v{n}"
            if (REPO_ROOT / "dist" / spec["dist"] / spec["html"](vid)).exists():
                ids.append(vid)
        bdir = REPO_ROOT / "benchmark_comparison" / subject
        if bdir.is_dir():
            for f in sorted(bdir.iterdir()):
                if (f.suffix in VIDEO_EXTS and "_" not in f.stem):
                    ids.append(f"{subject}_{f.stem}")
    return ids


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--id", help="one variant/video id (e.g. circles_v7)")
    ap.add_argument("--all", action="store_true", help="score every benchmark video")
    ap.add_argument("--force", action="store_true", help="recompute even if cached")
    args = ap.parse_args()
    if not (args.id or args.all):
        ap.error("pass --id or --all")
    targets = [args.id] if args.id else benchmark_ids()
    print(f"Scoring {len(targets)} video(s)...")
    for vid in targets:
        try:
            score_video(vid, force=args.force)
        except Exception as e:
            print(f"  FAIL {vid}: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
