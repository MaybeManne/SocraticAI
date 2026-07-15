#!/usr/bin/env python3
"""
Build the static benchmark-browsing site into benchmark_site/socraticai-benchmark/.

Fully static and read-only: copies the self-contained SocraticAI lesson HTMLs
(v1-v7 per subject), re-encodes the external tool videos to 720p (originals
untouched), and bakes the current judge win-rate leaderboard into data.js at
build time. No API keys, no server code — deployable as plain static files.

    python3 benchmark_site/build.py            # writes socraticai-benchmark/
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SITE = Path(__file__).resolve().parent
OUT = SITE / "socraticai-benchmark"
MEDIA = OUT / "media"

SUBJECT_DIRS = {"circles": "circle problem", "archer": "archer", "binsearch": "binary search"}
SUBJECT_TITLES = {
    "circles": "Nested Circles (AMC 10A 2023 P15)",
    "archer": "Archer / Projectile Range",
    "binsearch": "Binary Search",
}
TOOLS = ["veo3", "mathgpt", "notebooklm", "videotutor"]
TOOL_LABELS = {"veo3": "Google Veo 3", "mathgpt": "MathGPT (Mathos AI)",
               "notebooklm": "NotebookLM", "videotutor": "VideoTutor"}
VIDEO_EXTS = (".mp4", ".mov", ".webm")


def win_rate_rows(subject):
    """Per-setup W-L-T + win rate for one subject, from the judge results."""
    rec = {}
    results_dir = REPO / "agentic_pipeline" / "judge" / "pairwise_results"
    for p in sorted(results_dir.glob("*.json")):
        r = json.loads(p.read_text())
        if r.get("subject") != subject:
            continue
        w = (r.get("aggregator") or {}).get("winner")
        for s in (r["setupA"], r["setupB"]):
            rec.setdefault(s, [0, 0, 0])
            rec[s][2 if w == "tie" else 0 if w == s else 1] += 1
    rows = []
    for s, (w, l, t) in rec.items():
        n = w + l + t
        rows.append({"id": s, "wins": w, "losses": l, "ties": t, "matches": n,
                     "winRate": round((w + 0.5 * t) / n * 100) if n else 0})
    rows.sort(key=lambda r: (-r["winRate"], -r["matches"]))
    return rows


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    MEDIA.mkdir(parents=True)

    data = {"subjects": []}
    for subject, dirname in SUBJECT_DIRS.items():
        items = []

        # SocraticAI lessons v1-v7 (self-contained HTML, copied verbatim)
        ddir = REPO / "dist" / dirname
        for n in range(1, 8):
            src = ddir / f"{subject}_v{n}.html"
            if not src.exists():
                src = ddir / f"v{n}.html"
            if not src.exists():
                continue
            dest = MEDIA / f"{subject}_v{n}.html"
            shutil.copy2(src, dest)
            items.append({"id": f"{subject}_v{n}", "label": f"v{n}",
                          "kind": "lesson", "src": f"media/{dest.name}"})

        # External tool videos, re-encoded to 720p for web delivery
        bdir = REPO / "benchmark_comparison" / subject
        for tool in TOOLS:
            src = next((bdir / f"{tool}{ext}" for ext in VIDEO_EXTS
                        if (bdir / f"{tool}{ext}").exists()), None)
            if src is None:
                print(f"  WARNING: missing {subject}/{tool}", file=sys.stderr)
                continue
            dest = MEDIA / f"{subject}_{tool}.mp4"
            print(f"  encoding {subject}/{tool} -> 720p ...")
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
                 "-vf", "scale=-2:720", "-c:v", "libx264", "-crf", "26",
                 "-preset", "fast", "-pix_fmt", "yuv420p",
                 "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
                 str(dest)],
                check=True)
            items.append({"id": f"{subject}_{tool}", "label": TOOL_LABELS[tool],
                          "kind": "video", "src": f"media/{dest.name}"})

        data["subjects"].append({
            "id": subject, "title": SUBJECT_TITLES[subject],
            "items": items, "leaderboard": win_rate_rows(subject),
        })

    (OUT / "data.js").write_text("window.BENCH = " + json.dumps(data, indent=1) + ";\n")
    shutil.copy2(SITE / "index.html", OUT / "index.html")

    total = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"\nBuilt {OUT}")
    print(f"Total site size: {total / 1e6:.1f} MB "
          f"({sum(1 for _ in MEDIA.iterdir())} media files)")


if __name__ == "__main__":
    main()
