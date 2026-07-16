#!/usr/bin/env python3
"""
Build a static, read-only results explorer from judge/pairwise_results/.

Bakes every pairwise verdict (win/loss/tie + confidence + rationale) into
data.js at build time, so the deployed site needs no server, no API key, and
no live data — just browse leaderboards, per-variant AI-judge scores, and
head-to-head verdicts. Deployable to Vercel as plain static files.

    python3 results_site/build.py        # writes results_site/site/
"""
import json
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SITE = Path(__file__).resolve().parent
OUT = SITE / "socraticai-results"
RES = REPO / "agentic_pipeline" / "judge" / "pairwise_results"

DIMS = ["visual_accuracy", "interactivity", "narration_quality", "sync",
        "concept_accuracy", "polish"]
# Problem set from the single manifest (benchmark/problems.json).
_problems = json.loads(
    (REPO / "agentic_pipeline" / "benchmark" / "problems.json").read_text())["problems"]
SUBJECT_ORDER = [p["id"] for p in _problems]
SUBJECT_TITLES = {p["id"]: p.get("title", p["id"]) for p in _problems}
TOOLS = ("veo3", "mathgpt", "notebooklm", "videotutor")


def subject_of(vid):
    return vid.split("_", 1)[0]


def kind_of(vid):
    return "external" if any(vid.endswith("_" + t) for t in TOOLS) else "socratic"


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    results = []
    for p in sorted(RES.glob("*.json")):
        r = json.loads(p.read_text())
        # Deblind "Lesson 1/2" -> real setup ids everywhere for readability.
        l1, l2 = r.get("lesson1Setup"), r.get("lesson2Setup")
        def deblind(t):
            if t and l1 and l2:
                return t.replace("Lesson 1", l1).replace("Lesson 2", l2)
            return t
        results.append({
            "a": r["setupA"], "b": r["setupB"], "subject": r.get("subject"),
            "overall": {"winner": r["aggregator"]["winner"],
                        "confidence": r["aggregator"].get("confidence"),
                        "explanation": deblind(r["aggregator"].get("explanation", ""))},
            "dimensions": {d: {"winner": r["dimensions"][d]["winner"],
                               "confidence": r["dimensions"][d].get("confidence"),
                               "rationale": deblind(r["dimensions"][d].get("rationale"))}
                           for d in DIMS},
        })

    # Universe of setups actually judged, grouped by subject.
    setups = defaultdict(set)
    for r in results:
        setups[r["subject"]].add(r["a"])
        setups[r["subject"]].add(r["b"])

    data = {
        "dims": DIMS,
        "results": results,
        "subjects": [
            {"id": s, "title": SUBJECT_TITLES.get(s, s),
             "setups": sorted(setups[s],
                              key=lambda v: (kind_of(v) == "external", v))}
            for s in SUBJECT_ORDER if s in setups
        ],
        "kinds": {v: kind_of(v) for s in setups for v in setups[s]},
        "videoSite": "https://socraticai-benchmark.vercel.app",
        "builtFrom": len(results),
    }

    (OUT / "data.js").write_text("window.DATA = " + json.dumps(data) + ";\n")
    (OUT / "index.html").write_text((SITE / "index.html").read_text())
    print(f"Built {OUT} from {len(results)} judged pairs, "
          f"{sum(len(s) for s in setups.values())} setups.")


if __name__ == "__main__":
    main()
