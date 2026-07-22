#!/usr/bin/env python3
"""
Build the FINAL benchmark results site directly from the three deliverable
CSVs in benchmark_final/ — so the deployed site is provably the same data
the user opens in Sheets (no separate/stale copy, no legacy comparisons).

    python3 final_site/build.py            # -> final_site/socraticai-results/

Data source of truth (read verbatim, nothing recomputed):
    benchmark_final/benchmark.csv   (id, prompt, category, scenes_requested)
    benchmark_final/videos.csv      (id, method, video_link, duration)
    benchmark_final/scores.csv      (id, method, 6 dimensions)

Media (v7 .html lessons, tool .mp4s) is copied into media/; the large
NotebookLM screen recordings are re-encoded to 720p to keep the deploy light.
"""
import csv
import json
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BF = REPO / "benchmark_final"
OUT = Path(__file__).resolve().parent / "socraticai-results"
MEDIA = OUT / "media"
DIMS = ["visual_accuracy", "interactivity", "narration_quality",
        "sync", "concept_accuracy", "polish"]
REENCODE_OVER_MB = 8  # re-encode any mp4 bigger than this to 720p


def read_csv(name):
    with (BF / name).open() as f:
        return list(csv.DictReader(f))


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    MEDIA.mkdir(parents=True)

    problems = read_csv("benchmark.csv")
    videos = read_csv("videos.csv")
    scores = read_csv("scores.csv")

    # ---- copy media, rewriting each video_link to media/<file> ----
    method_dir = {"v7": "v7", "Code2Video": "code2video",
                  "Paper2Video": "paper2video", "NotebookLM": "notebooklm"}
    for v in videos:
        src = BF / v["video_link"]
        if not src.exists():
            print(f"  WARN missing media {src}", file=sys.stderr)
            v["media"] = ""
            continue
        # Namespace by method — the same {id}.mp4 exists under code2video,
        # paper2video AND notebooklm, so a flat media/ dir would collide.
        sub = method_dir[v["method"]]
        (MEDIA / sub).mkdir(exist_ok=True)
        dest = MEDIA / sub / src.name
        if src.suffix == ".mp4" and src.stat().st_size > REENCODE_OVER_MB * 1e6:
            print(f"  re-encoding {sub}/{src.name} -> 720p ...")
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
                 "-vf", "scale=-2:720", "-c:v", "libx264", "-crf", "28",
                 "-preset", "fast", "-pix_fmt", "yuv420p",
                 "-c:a", "aac", "-b:a", "112k", "-movflags", "+faststart",
                 str(dest)], check=True)
        else:
            shutil.copy2(src, dest)
        v["media"] = f"media/{sub}/{src.name}"

    # ---- bake data.js verbatim from the CSV rows ----
    def num(x):
        try:
            return float(x)
        except (TypeError, ValueError):
            return None

    data = {
        "dims": DIMS,
        "problems": [{"id": p["id"], "prompt": p["prompt"],
                      "category": p["category"],
                      "scenes": p.get("scenes_requested", "")}
                     for p in problems],
        "videos": [{"id": v["id"], "method": v["method"],
                    "media": v.get("media", ""),
                    "duration": num(v["duration"])} for v in videos],
        "scores": [{"id": s["id"], "method": s["method"],
                    **{d: num(s[d]) for d in DIMS}} for s in scores],
    }
    (OUT / "data.js").write_text("window.DATA = " + json.dumps(data) + ";\n")
    shutil.copy2(Path(__file__).resolve().parent / "index.html", OUT / "index.html")

    # ---- downloadable source data (the same files the CSVs/xlsx are built from) ----
    dl = OUT / "downloads"
    dl.mkdir(exist_ok=True)
    for name in ("benchmark_final.xlsx", "benchmark.csv", "videos.csv", "scores.csv",
                 "missing.csv", "human_scoring_sheet.xlsx"):
        src = BF / name
        if src.exists():
            shutil.copy2(src, dl / name)
        else:
            print(f"  WARN no {name} to publish", file=sys.stderr)

    total = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"\nBuilt {OUT}")
    print(f"  {len(problems)} problems, {len(videos)} videos, {len(scores)} score rows")
    print(f"  total {total/1e6:.0f} MB")


if __name__ == "__main__":
    main()
