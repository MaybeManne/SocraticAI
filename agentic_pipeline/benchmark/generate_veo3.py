#!/usr/bin/env python3
"""
generate_veo3.py — generate the external-tool benchmark videos with Veo 3.1.

Veo generates at most ~8 seconds per call, which can't cover a full
concept explanation. So each subject is generated as FOUR sequential scenes
(problem setup -> core visual idea -> the working -> answer/payoff), sharing
a style prefix for visual continuity, then concatenated with ffmpeg into one
~32-second explainer saved into the benchmark_comparison intake slot:

    benchmark_comparison/circles/veo3.mp4      (+ veo3_scenes/scene_[1-4].mp4)
    benchmark_comparison/archer/veo3.mp4
    benchmark_comparison/binsearch/veo3.mp4

Prompts are condensed cinematic scene descriptions (Veo responds to visual
direction, not walls of math) with the actual math kept accurate to
benchmark_set.md's worked solutions.

Requires GEMINI_API_KEY in the environment (no fallback, never hardcoded):
    GEMINI_API_KEY=... python3 agentic_pipeline/benchmark/generate_veo3.py [subject ...]

Manimator and vanilla Manim comparisons are intentionally NOT generated
(hosted space down / comparison dropped).
"""

import os
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = REPO_ROOT / "benchmark_comparison"
MODEL = "veo-3.1-generate-preview"

STYLE = {
    "circles": ("Elegant dark-background 2D math explainer animation, "
                "3Blue1Brown style, indigo and amber palette, calm male "
                "narrator voice. "),
    "archer": ("Clean vector-style physics explainer animation on a dark "
               "background, indigo and amber palette, calm male narrator "
               "voice. "),
    "binsearch": ("Crisp dark-theme computer science algorithm animation, "
                  "UI style with glowing boxes, indigo and amber palette, "
                  "calm male narrator voice. "),
}

# Four scenes per subject: setup -> idea -> working -> answer.
SCENES = {
    "circles": [
        "Circles with radii 1, 2, 3, 4 draw on one after another, all tangent "
        "at a single shared point at the bottom, and the ring between radius 1 "
        "and 2 fills with glowing amber. Narrator: 'Circles of radius one, "
        "two, three and so on share a single point, and every other ring "
        "between them is shaded. How many circles until the shaded area "
        "reaches two thousand twenty-three pi?'",

        "Camera focuses on one amber ring between two circles. The ring's area "
        "appears as text: 'ring k = pi(2k)^2 - pi(2k-1)^2 = pi(4k-1)'. "
        "Narrator: 'Each shaded ring is the area of the outer circle minus the "
        "inner one, which simplifies to pi times four k minus one.'",

        "A column of ring areas 3 pi, 7 pi, 11 pi stacks up and collapses into "
        "the formula 'Total = pi n(2n+1)'. Then the inequality 'n(2n+1) >= "
        "2023' appears with n = 31 marked red as too small and n = 32 glowing "
        "green. Narrator: 'Adding n rings gives pi times n times two n plus "
        "one. Thirty-one rings falls short, but thirty-two is enough.'",

        "Zoom out to reveal all sixty-four nested tangent circles with "
        "alternating amber rings, and the text '2n = 64 circles' lands center "
        "screen with a soft glow. Narrator: 'Thirty-two shaded rings means "
        "sixty-four circles in total — and that is the answer.'",
    ],
    "archer": [
        "An archer on the left draws a bow angled 30 degrees above horizontal; "
        "a protractor overlay shows 30 degrees and a label reads 'v0 = 40 "
        "m/s'. Narrator: 'An archer fires an arrow at thirty degrees above "
        "horizontal, at forty meters per second. How far does it fly?'",

        "The arrow's velocity vector splits into two labeled component arrows: "
        "horizontal '34.6 m/s' and vertical '20 m/s', drawn as a right "
        "triangle. Narrator: 'Split the launch velocity into parts: forty "
        "cosine thirty gives thirty-four point six sideways, and forty sine "
        "thirty gives twenty upward.'",

        "The arrow flies a smooth parabolic arc while a timer counts up to 't "
        "= 4.08 s' at landing; the equation 't = 2(20)/9.8' floats above the "
        "arc. Narrator: 'Gravity slows the rise and speeds the fall — twice "
        "twenty over nine point eight gives about four point one seconds in "
        "the air.'",

        "A distance marker sweeps along the ground under the completed arc and "
        "reads 'Range = 34.6 x 4.08 = 141 m'. Narrator: 'The horizontal speed "
        "never changes, so thirty-four point six times four point one seconds "
        "carries the arrow about one hundred forty-one meters.'",
    ],
    "binsearch": [
        "A sorted array of 11 glowing boxes appears: 2, 5, 8, 12, 16, 23, 38, "
        "45, 56, 72, 91 with indices 0 to 10, and a badge reads 'Target: 45'. "
        "Narrator: 'Find forty-five in this sorted array. Instead of checking "
        "every box, binary search checks the middle.'",

        "Pointers labeled low and high sit at the ends; a mid pointer lands on "
        "index 5 value 23; since 45 is greater, the whole left half dims and "
        "slides away. Narrator: 'The middle is twenty-three. Forty-five is "
        "bigger, so the entire left half is discarded in one step.'",

        "The mid pointer lands on 56 and the right side dims; then on 38 and "
        "the left dims; then the box holding 45 at index 7 flashes green with "
        "'Found in 4 steps'. Narrator: 'Fifty-six is too big, thirty-eight too "
        "small — and forty-five is found at index seven, in just four steps.'",

        "A bar labeled n splits in half repeatedly into n/2, n/4, n/8 next to "
        "a glowing 'O(log n)', contrasted with a long gray bar labeled 'O(n) "
        "linear scan'. Narrator: 'Each comparison halves the search space, so "
        "eleven items need at most four steps — that is logarithmic time.'",
    ],
}


def _generate_clip(client, prompt, out_path, tag, attempts=3):
    """Generate one clip; retries on quota/transient errors with backoff.
    Scene calls are independent, so callers may run many of these in parallel."""
    for attempt in range(1, attempts + 1):
        try:
            print(f"[{tag}] submitting (attempt {attempt})...", flush=True)
            operation = client.models.generate_videos(model=MODEL, prompt=prompt)
            waited = 0
            while not operation.done:
                time.sleep(10)
                waited += 10
                operation = client.operations.get(operation)
                if waited > 900:
                    raise TimeoutError(f"{tag}: not done after {waited}s")
            if operation.error:
                raise RuntimeError(f"{tag}: {operation.error}")
            video = operation.response.generated_videos[0].video
            client.files.download(file=video)
            video.save(str(out_path))
            print(f"[{tag}] saved ({out_path.stat().st_size // 1024} KB)", flush=True)
            return
        except Exception as e:
            msg = str(e)
            transient = any(k in msg for k in ("429", "RESOURCE_EXHAUSTED", "quota",
                                               "503", "UNAVAILABLE", "timeout", "Timeout"))
            if attempt < attempts and transient:
                backoff = 30 * attempt
                print(f"[{tag}] transient failure ({msg[:120]}) — retrying in {backoff}s", flush=True)
                time.sleep(backoff)
                continue
            raise


def _concat(scene_paths, out_path):
    """Concatenate scene clips (re-encode: safest across clip boundaries)."""
    list_file = out_path.parent / "veo3_scenes" / "concat.txt"
    list_file.write_text("".join(f"file '{p.resolve()}'\n" for p in scene_paths))
    r = subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
         "-i", str(list_file), "-c:v", "libx264", "-pix_fmt", "yuv420p",
         "-c:a", "aac", str(out_path)],
        capture_output=True, text=True, timeout=300,
    )
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg concat failed: {r.stderr.strip()[:300]}")


def _concat_subject(subject):
    out_path = OUT_DIR / subject / "veo3.mp4"
    scenes_dir = out_path.parent / "veo3_scenes"
    scene_paths = [scenes_dir / f"scene_{i}.mp4" for i in range(1, len(SCENES[subject]) + 1)]
    missing = [p.name for p in scene_paths if not p.exists()]
    if missing:
        raise RuntimeError(f"{subject}: missing scenes {missing} — cannot concat")
    _concat(scene_paths, out_path)
    dur = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(out_path)],
        capture_output=True, text=True).stdout.strip()
    print(f"[{subject}] FINAL {out_path} ({float(dur):.1f}s)", flush=True)


def main(argv=None):
    if not os.environ.get("GEMINI_API_KEY") and not os.environ.get("GOOGLE_API_KEY"):
        raise SystemExit(
            "ERROR: GEMINI_API_KEY is not set. Export it before running:\n"
            "  GEMINI_API_KEY=... python3 agentic_pipeline/benchmark/generate_veo3.py"
        )
    from concurrent.futures import ThreadPoolExecutor
    from google import genai
    client = genai.Client()

    subjects = [s for s in ((argv or sys.argv[1:]) or list(SCENES)) if s in SCENES]

    # All scene clips are independent — generate them CONCURRENTLY (each call
    # still caps at ~8s of video; parallelism is how the wall clock shrinks).
    # Cached scene files are reused, so re-running resumes after failures.
    jobs = []
    for s in subjects:
        scenes_dir = OUT_DIR / s / "veo3_scenes"
        scenes_dir.mkdir(parents=True, exist_ok=True)
        for i, scene in enumerate(SCENES[s], 1):
            clip = scenes_dir / f"scene_{i}.mp4"
            if clip.exists():
                print(f"[{s}/scene{i}] exists — reusing", flush=True)
            else:
                jobs.append((f"{s}/scene{i}", STYLE[s] + scene, clip))

    failures = {}
    if jobs:
        with ThreadPoolExecutor(max_workers=6) as pool:
            futs = {pool.submit(_generate_clip, client, prompt, clip, tag): tag
                    for tag, prompt, clip in jobs}
            for fut, tag in futs.items():
                try:
                    fut.result()
                except Exception as e:
                    failures[tag] = str(e)
                    print(f"[{tag}] FAILED: {e}", flush=True)

    for s in subjects:
        try:
            _concat_subject(s)
        except Exception as e:
            failures[s] = str(e)
            print(f"[{s}] FAILED: {e}", flush=True)

    if failures:
        print("\nFailures:")
        for tag, err in failures.items():
            print(f"  {tag}: {err[:300]}")
        return 1
    print("\nAll requested videos generated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
