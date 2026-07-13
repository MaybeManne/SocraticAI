#!/usr/bin/env python3
"""
generate_veo3.py — generate the external-tool benchmark videos with Veo 3.1.

One video per benchmark subject (see benchmark_set.md), saved into the
benchmark_comparison intake slots:

    benchmark_comparison/circles/veo3.mp4
    benchmark_comparison/archer/veo3.mp4
    benchmark_comparison/binsearch/veo3.mp4

Prompts are condensed cinematic scene descriptions of each problem+solution
(Veo responds to visual direction, not walls of math text) — but the math
shown/spoken is kept accurate to the manifest's worked solutions.

Requires GEMINI_API_KEY in the environment (no fallback, never hardcoded):
    GEMINI_API_KEY=... python3 agentic_pipeline/benchmark/generate_veo3.py [subject ...]

Manimator and vanilla Manim comparisons are intentionally NOT generated
(hosted space down / comparison dropped).
"""

import os
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = REPO_ROOT / "benchmark_comparison"
MODEL = "veo-3.1-generate-preview"

# Condensed visual prompts — accurate math, cinematic framing.
PROMPTS = {
    "circles": (
        "Elegant dark-background math explainer animation, 3Blue1Brown style. "
        "A family of circles with radii 1, 2, 3, up to 2n grows outward, all "
        "tangent at a single shared point at the bottom. The ring between "
        "radius 1 and 2 fills with glowing amber, then every other ring "
        "alternates shaded amber. A clean formula appears: total shaded area "
        "equals pi times n times (2n+1). The inequality n(2n+1) >= 2023 "
        "appears, n = 32 highlights, and the final answer '64 circles' lands "
        "center screen with a satisfying zoom-out showing all 64 nested "
        "circles. Calm narrator voice explains the alternating rings need at "
        "least 2023 pi total area, so sixty-four circles are required."
    ),
    "archer": (
        "Physics explainer animation, clean vector style on a dark background. "
        "An archer at the left fires an arrow at 30 degrees above horizontal "
        "at 40 meters per second. The arrow flies in a smooth parabolic arc. "
        "The launch velocity splits into a horizontal component 34.6 m/s and "
        "a vertical component 20 m/s, drawn as labeled arrows. A timer shows "
        "flight time t = 4.08 seconds as the arrow rises and falls. When the "
        "arrow lands, a distance marker sweeps along the ground reading "
        "'Range = 141 meters'. Narrator explains the vertical motion sets the "
        "time of flight and the horizontal speed carries the arrow about one "
        "hundred forty-one meters."
    ),
    "binsearch": (
        "Computer science algorithm animation, dark theme, crisp UI style. A "
        "sorted array of 11 boxes appears: 2, 5, 8, 12, 16, 23, 38, 45, 56, "
        "72, 91 with indices 0 to 10, searching for target 45. Pointers "
        "labeled low, mid, high hop along the array: mid lands on 23, the "
        "left half dims and discards; mid lands on 56, the right half dims; "
        "mid lands on 38, discard left; finally the box holding 45 at index "
        "7 flashes green — found in 4 steps. A bar labeled n halves "
        "repeatedly into n/2, n/4, n/8 while 'O(log n)' glows on screen. "
        "Narrator explains each comparison discards half the array, so "
        "eleven elements need at most four steps."
    ),
}


def generate(subject, client):
    from google.genai import errors  # noqa: F401  (import check)
    out_path = OUT_DIR / subject / "veo3.mp4"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"[{subject}] submitting to {MODEL}...", flush=True)
    operation = client.models.generate_videos(model=MODEL, prompt=PROMPTS[subject])
    waited = 0
    while not operation.done:
        time.sleep(10)
        waited += 10
        operation = client.operations.get(operation)
        print(f"[{subject}] waiting... {waited}s", flush=True)
        if waited > 900:
            raise TimeoutError(f"{subject}: generation still not done after {waited}s")
    if operation.error:
        raise RuntimeError(f"{subject}: generation failed: {operation.error}")
    generated_video = operation.response.generated_videos[0]
    client.files.download(file=generated_video.video)
    generated_video.video.save(str(out_path))
    size_kb = out_path.stat().st_size // 1024
    print(f"[{subject}] SAVED {out_path} ({size_kb} KB)", flush=True)


def main(argv=None):
    if not os.environ.get("GEMINI_API_KEY") and not os.environ.get("GOOGLE_API_KEY"):
        raise SystemExit(
            "ERROR: GEMINI_API_KEY is not set. Export it before running:\n"
            "  GEMINI_API_KEY=... python3 agentic_pipeline/benchmark/generate_veo3.py"
        )
    from google import genai
    client = genai.Client()

    subjects = (argv or sys.argv[1:]) or list(PROMPTS)
    failures = {}
    for s in subjects:
        if s not in PROMPTS:
            print(f"[{s}] unknown subject — skipping (valid: {sorted(PROMPTS)})")
            continue
        try:
            generate(s, client)
        except Exception as e:  # keep going; report at the end
            failures[s] = str(e)
            print(f"[{s}] FAILED: {e}", flush=True)
    if failures:
        print("\nFailures:")
        for s, err in failures.items():
            print(f"  {s}: {err[:300]}")
        return 1
    print("\nAll requested videos generated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
