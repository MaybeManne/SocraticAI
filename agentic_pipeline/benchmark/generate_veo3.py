#!/usr/bin/env python3
"""
generate_veo3.py — generate the external-tool benchmark videos with Veo 3.1.

Veo generates at most ~8 seconds per call, which can't cover a full
concept explanation. So each subject is generated as FOUR sequential scenes
(problem setup -> core visual idea -> the working -> answer/payoff), sharing
a style prefix for visual continuity, then concatenated with ffmpeg into one
~88-second explainer saved into the benchmark_comparison intake slot:

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

# Eleven beats per subject (~88s at Veo's 8s/clip cap): full narrative arc.
SCENES = {
    "circles": [
        "A title card fades in over faint nested circles: 'How many circles until the shaded area reaches 2023 pi?'. Narrator: 'Here is a beautiful competition problem about circles, rings, and a race to two thousand twenty-three pi.'",
        "Circles of radius 1, 2, 3, 4 draw on one at a time, all tangent at a single shared point at the bottom edge. Narrator: 'Draw circles of radius one, two, three and onward, every one of them touching the same single point.'",
        "The ring between circles 1 and 2 fills glowing amber, then ring 3-4 fills, alternating outward. Narrator: 'Now shade every other ring: first the ring between radius one and two, then between three and four, and so on.'",
        "Camera zooms to one amber ring; its inner and outer circle edges pulse with labels '2k-1' and '2k'. Narrator: 'Focus on a single shaded ring, sitting between radius two k minus one and radius two k.'",
        "Text builds: 'ring area = pi(2k)^2 - pi(2k-1)^2' with the outer disk minus inner disk animating as shapes. Narrator: 'Its area is the outer circle minus the inner one: pi two k squared minus pi two k minus one squared.'",
        "The expression simplifies on screen to 'pi(4k - 1)' with terms canceling in a satisfying collapse. Narrator: 'Expand and cancel, and each ring is simply pi times four k minus one.'",
        "A column stacks up: '3 pi, 7 pi, 11 pi, ...' as rings light up one by one. Narrator: 'So the rings have areas three pi, seven pi, eleven pi — growing by four pi each time.'",
        "The stack collapses into the formula 'Total = pi n(2n+1)'. Narrator: 'Add n rings and the total collapses to pi times n times two n plus one.'",
        "The inequality 'n(2n+1) >= 2023' appears centered with a target line. Narrator: 'We need this to reach two thousand twenty-three, so n times two n plus one must be at least two thousand twenty-three.'",
        "Two candidates appear: 'n = 31 -> 1953' marked red, 'n = 32 -> 2080' glowing green. Narrator: 'Thirty-one rings gives only nineteen fifty-three. Thirty-two gives two thousand eighty — enough.'",
        "Zoom out to all sixty-four nested tangent circles with alternating amber rings; text '2n = 64 circles' lands center. Narrator: 'Thirty-two shaded rings means sixty-four circles in total — and that is the answer.'",
    ],
    "archer": [
        "Title card over a silhouetted archer at dusk: 'How far does the arrow fly?'. Narrator: 'An archer, a thirty degree launch, forty meters per second. How far does the arrow travel?'",
        "The archer draws and fires; a protractor overlay shows the 30 degree angle and a label 'v0 = 40 m/s'. Narrator: 'The arrow leaves the bow at forty meters per second, angled thirty degrees above the ground.'",
        "The arrow's arc freezes mid-flight; the velocity arrow splits into a right triangle of two arrows. Narrator: 'The trick of projectile motion: split the velocity into a sideways part and an upward part.'",
        "The triangle labels appear: horizontal '40 cos 30 = 34.6 m/s', vertical '40 sin 30 = 20 m/s'. Narrator: 'Forty cosine thirty gives thirty-four point six sideways; forty sine thirty gives twenty straight up.'",
        "The vertical component alone animates: the arrow rises, slowing, with a small speed meter draining from 20 to 0. Narrator: 'Gravity eats the upward speed, one nine point eight every second, until the arrow tops out.'",
        "At the apex the vertical meter reads zero; a symmetric dashed path shows the fall mirroring the rise. Narrator: 'At the top the vertical speed is zero — and the way down is a mirror image of the way up.'",
        "Equation appears: 't = 2 x 20 / 9.8' with rise and fall halves each labeled ~2.04 s. Narrator: 'Time in the air is twice twenty divided by nine point eight.'",
        "A stopwatch counts to 't = 4.08 s' as the arc completes. Narrator: 'About four point one seconds of flight, start to landing.'",
        "The horizontal component animates alone: constant-speed dots slide along the ground at even spacing. Narrator: 'Meanwhile the sideways speed never changes — thirty-four point six meters every single second.'",
        "Equation builds: 'Range = 34.6 x 4.08' over the full arc. Narrator: 'So the range is simply sideways speed times time in the air.'",
        "A distance marker sweeps under the arc to read 'Range = 141 m' with a landing thud. Narrator: 'One hundred forty-one meters. That is where the arrow lands.'",
    ],
    "binsearch": [
        "Title card: 'Find 45 — without checking every box.' over a faint row of glowing boxes. Narrator: 'Eleven sorted numbers, one target: forty-five. How fast can we find it?'",
        "A sorted array of 11 glowing boxes appears: 2, 5, 8, 12, 16, 23, 38, 45, 56, 72, 91 with indices 0 to 10, badge 'Target: 45'. Narrator: 'Here is the array — already sorted, and that is the key.'",
        "A gray cursor plods box by box from the left, checking 2, then 5, then 8, a counter ticking up. Narrator: 'A naive scan checks every box, one by one. Up to eleven steps. We can do far better.'",
        "The linear cursor vanishes; the word 'SORTED' shines along the array. Narrator: 'Because the numbers are sorted, one comparison can eliminate half the array at once.'",
        "Pointers labeled 'low' and 'high' drop onto index 0 and index 10; a 'mid' pointer lands on index 5, value 23. Narrator: 'Point low at the start, high at the end. The middle lands on twenty-three.'",
        "'45 > 23' flashes; the entire left half dims and slides away, low jumps to index 6. Narrator: 'Forty-five is bigger than twenty-three, so the whole left half is gone in a single step.'",
        "Mid lands on index 8, value 56; '45 < 56' flashes; the right side dims, high moves to index 7. Narrator: 'The new middle is fifty-six. Too big — discard the right side.'",
        "Mid lands on index 6, value 38; '45 > 38' flashes; it dims, low moves to index 7. Narrator: 'Thirty-eight is too small. Throw it out. Only one box remains.'",
        "The box at index 7 flashes green: '45 FOUND at index 7 - 4 steps'. Narrator: 'And there it is: forty-five, index seven, found in just four comparisons.'",
        "A long bar labeled 'n' splits in half repeatedly: n/2, n/4, n/8, each half fading. Narrator: 'Every comparison halves the search space: n, then half, then a quarter, then an eighth.'",
        "Side-by-side bars: a long gray 'O(n) - 11 steps' versus a short glowing 'O(log n) - 4 steps'. Narrator: 'That is logarithmic time: eleven items, four steps. A million items? Just twenty.'",
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
