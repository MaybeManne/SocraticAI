"""
pairwise_evaluator.py — head-to-head comparison of two generated lessons.

Replicates the architecture of visionbook/figure-platform's
backend/pairwise_evaluator.js, adapted from static 3D figures to narrated
interactive video lessons:

  - 6 parallel dimension agents (one narrow LLM call each), then
  - 1 sequential aggregator call that synthesizes the 6 verdicts.

Position assignment (Lesson 1 vs Lesson 2) is randomized ONCE per comparison,
held fixed across all 6 dimension calls and the aggregator, and resolved back
to the real variant names only after all calls complete. The model never sees
variant names — only "Lesson 1"/"Lesson 2" — to avoid name-based bias.

Per-dimension inputs (each agent receives ONLY what it needs):
  visual_accuracy, polish   -> precomputed screenshots only
  interactivity             -> gate specs + plan JSON only
  narration_quality, sync   -> narration transcript + beat/timing data only
  concept_accuracy          -> lesson_plan.json + content script only

Model: "gpt-5.5" via the OpenAI API (deliberately a different provider than
the Gemini-generated lessons, to avoid self-preference bias). The API key is
read from the OPENAI_API_KEY environment variable — never hardcoded, no
fallback of any kind.
"""

import base64
import json
import os
import random
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

JUDGE_DIR = Path(__file__).resolve().parent
PIPELINE_DIR = JUDGE_DIR.parent          # agentic_pipeline/
REPO_ROOT = PIPELINE_DIR.parent          # repo root (has dist/)
PROMPTS_DIR = JUDGE_DIR / "judge_prompts"

# The narration a listener actually hears is generate_audio.py's
# verbalize_math() output (LaTeX -> spoken words), not the raw `A.say` source.
# Import the exact same function so the judged transcript matches the audio.
sys.path.insert(0, str(REPO_ROOT))
from generate_audio import verbalize_math  # noqa: E402

# Results dir is overridable for tests via JUDGE_RESULTS_DIR.
def results_dir():
    override = os.environ.get("JUDGE_RESULTS_DIR")
    return Path(override) if override else JUDGE_DIR / "pairwise_results"

JUDGE_MODEL = "gpt-5.5"
MAX_OUTPUT_TOKENS = 2048
# Cap large text artifacts so a single dimension call stays a sane size.
MAX_TEXT_CHARS = 30000

DIMENSIONS = [
    "visual_accuracy",
    "interactivity",
    "narration_quality",
    "sync",
    "concept_accuracy",
    "polish",
]


# ── Variant resolution ─────────────────────────────────────────────────────────
#
# Variant ids follow the dist/work naming used by the experiment runs:
#   circles_v3      -> dist/circle problem/circles_v3.html   + work/circles_v3
#   circles_v3.1    -> dist/circle problem/circles_v3.1.html + work/circles_v3_1
#   archer_v4       -> dist/archer/v4.html                   + work/archer_v4
#   binsearch_v2    -> dist/binary search/v2.html            + work/binsearch_v2
#   *_v0original    -> dist html only (no work-dir artifacts)
#
# EXTERNAL videos (Veo3 / Manimator / NotebookLM drops) resolve first:
#   circles_veo3    -> benchmark_comparison/circles/veo3.mp4 (or .webm/.mov)
# They carry no pipeline metadata; the judge uses extracted video frames, an
# optional sidecar transcript (veo3.transcript.txt), and the subject's problem
# statement instead of lesson_plan.json / content JS.

BENCH_DIR_NAME = "benchmark_comparison"
VIDEO_EXTS = (".mp4", ".webm", ".mov")

# Subject -> problem statement source (used as concept context when a lesson
# has no lesson_plan.json, i.e. external videos).
PROBLEM_FILES = {
    "circles": "amc10a_2023_p15.md",
    "archer": "archer_problem.md",
    "binsearch": "tests/binary_search_problem.md",
}


def problem_text_for(subject):
    path = PIPELINE_DIR / PROBLEM_FILES[subject]
    return path.read_text().strip() if path.exists() else None

_SUBJECTS = {
    "circles": {"dist": "circle problem", "html": lambda v: f"{v}.html"},
    "archer": {"dist": "archer", "html": lambda v: v.split("_", 1)[1] + ".html"},
    "binsearch": {"dist": "binary search", "html": lambda v: v.split("_", 1)[1] + ".html"},
}


def subject_of(variant_id):
    """Return the subject prefix ("circles", "archer", "binsearch") of a variant id."""
    prefix = variant_id.split("_", 1)[0]
    if prefix not in _SUBJECTS:
        raise ValueError(
            f"Unknown variant id {variant_id!r} — expected a prefix in {sorted(_SUBJECTS)} "
            f"(e.g. circles_v3, archer_v5, binsearch_v2)"
        )
    return prefix


class LessonAssets:
    """Resolved on-disk artifacts for one lesson variant."""

    def __init__(self, variant_id):
        self.variant_id = variant_id
        subject = subject_of(variant_id)
        spec = _SUBJECTS[subject]
        self.subject = subject
        self.problem_text = problem_text_for(subject)

        # External video drop? (benchmark_comparison/<subject>/<tool>.<ext>)
        tool = variant_id.split("_", 1)[1] if "_" in variant_id else ""
        self.video_path = None
        self.sidecar_transcript = None
        for ext in VIDEO_EXTS:
            cand = REPO_ROOT / BENCH_DIR_NAME / subject / f"{tool}{ext}"
            if cand.exists():
                self.video_path = cand
                break

        if self.video_path:
            # External mode: no pipeline metadata at all.
            self.is_external = True
            self.html_path = None
            self.frames_dir = self.video_path.with_name(self.video_path.stem + "_frames")
            self.work_dir = None
            self.plan_json = None
            self.gates = None
            self.content_js = None
            sidecar = self.video_path.with_name(self.video_path.stem + ".transcript.txt")
            self.sidecar_transcript = self._read_optional(sidecar)
            return

        self.is_external = False
        self.html_path = REPO_ROOT / "dist" / spec["dist"] / spec["html"](variant_id)
        if not self.html_path.exists():
            raise FileNotFoundError(
                f"No lesson found for {variant_id!r}: neither an external video in "
                f"{BENCH_DIR_NAME}/{subject}/ nor {self.html_path}"
            )
        # Precomputed timeline frames live alongside the HTML in
        # <name>_frames/ — one frame every FRAME_INTERVAL_S seconds across the
        # full lesson (capped at MAX_FRAMES), f00_t0s.png .. fNN_t<sec>s.png.
        self.frames_dir = self.html_path.with_name(self.html_path.stem + "_frames")

        # Work-dir artifacts (may be absent, e.g. for *_v0original).
        self.work_dir = PIPELINE_DIR / "work" / variant_id.replace(".", "_")
        self.plan_json = self._read_optional(self.work_dir / "lesson_plan.json")
        self.gates = self._read_gates()
        self.content_js = self._read_content_js()

    def frame_paths(self):
        """Sorted timeline frames (empty list if not yet extracted)."""
        if not self.frames_dir.is_dir():
            return []
        return sorted(self.frames_dir.glob("f*.png"))

    def transcript(self):
        """Best-available narration transcript for this lesson.

        Pipeline lessons: extracted from the content script (with beat/timing
        cues). External videos: the optional sidecar transcript verbatim
        (labeled as timing-free), else None.
        """
        if self.is_external:
            if self.sidecar_transcript:
                return ("(external video — transcript provided without "
                        "beat/timing data)\n" + self.sidecar_transcript)
            return None
        return extract_transcript(self.content_js)

    @staticmethod
    def _read_optional(path):
        return path.read_text() if path.exists() else None

    def _read_gates(self):
        gates_dir = self.work_dir / "gates"
        if not gates_dir.is_dir():
            return None
        texts = [p.read_text() for p in sorted(gates_dir.glob("*.json"))]
        return texts or None

    def _read_content_js(self):
        if not self.work_dir.is_dir():
            return None
        # Content script = the one lesson .js that isn't viz_/audio_.
        candidates = [
            p for p in sorted(self.work_dir.glob("*.js"))
            if not p.name.startswith(("viz_", "audio_"))
        ]
        return candidates[0].read_text() if candidates else None


# ── Transcript extraction (narration + beat/timing data) ──────────────────────

_ACT_RE = re.compile(r'L\.act\(\s*"((?:[^"\\]|\\.)*)"')
_SAY_RE = re.compile(r'A\.say\(\s*"((?:[^"\\]|\\.)*)"')
_DO_RE = re.compile(r'\.do\(\s*"((?:[^"\\]|\\.)*)"\s*(?:,\s*(\{[^)]*?\}))?\s*(?:,\s*"([^"]*)")?\s*\)')
_ASK_RE = re.compile(r'L\.ask\(')


def _js_unescape(s):
    """Resolve JS string-literal escapes (\\\\ -> \\, \\" -> ", \\n -> newline)
    so the text matches the runtime string the TTS pipeline received."""
    return re.sub(r"\\(.)", lambda m: {"n": "\n", "t": "\t"}.get(m.group(1), m.group(1)), s)


def extract_transcript(content_js):
    """
    Extract a readable narration transcript with beat/timing data from a
    lesson content script.

    Output format, per act:
        ACT: <title>
          SAY: <narration text>
            cue: <action> at offset <t>
        [GATE/CHECKPOINT appears here]

    Cue offsets are relative to the start of their say-line ("0" = fires as
    the line begins, "+1.0" = 1 second in).
    """
    if not content_js:
        return None

    lines = []
    # Walk the file token by token so cues stay attached to their say-line.
    events = []
    for m in _ACT_RE.finditer(content_js):
        events.append((m.start(), "act", m.group(1)))
    for m in _SAY_RE.finditer(content_js):
        events.append((m.start(), "say", m.group(1)))
    for m in _DO_RE.finditer(content_js):
        offset = m.group(3) if m.group(3) is not None else "0"
        events.append((m.start(), "do", (m.group(1), offset)))
    for m in _ASK_RE.finditer(content_js):
        events.append((m.start(), "ask", None))
    events.sort(key=lambda e: e[0])

    for _, kind, payload in events:
        if kind == "act":
            lines.append(f"ACT: {_js_unescape(payload)}")
        elif kind == "say":
            # Transcribe what the TTS actually speaks: unescape the JS string
            # literal, then apply the same LaTeX->spoken-words conversion that
            # generate_audio.py applies before synthesis. Judging the raw
            # source would penalize LaTeX the listener never hears.
            spoken = verbalize_math(_js_unescape(payload))
            lines.append(f'  SAY: {spoken}')
        elif kind == "do":
            action, offset = payload
            lines.append(f"    cue: {_js_unescape(action)} at offset {offset}")
        elif kind == "ask":
            lines.append("  [GATE/CHECKPOINT appears here]")
    return "\n".join(lines) if lines else None


# ── Screenshot prep (precomputed, reused across comparisons) ──────────────────

# JS to drive an audio-gated lesson to a mid-timeline point. Passive waiting
# never advances these lessons (the player sits paused at 0:00 until a user
# gesture), so we start playback and seek via the engine's own API:
#   EX.Orchestrator.seekToGlobalTime() snapshot-renders every act before the
#   target, renders passed gates, seeks within the target act, then plays.
# We pause immediately after so the frame is stable when captured.
_DRIVE_TO_MID_JS = """
(fraction) => {
  const EX = window.EX;
  const graph = window._graph;
  const state = window._state;
  if (!EX || !EX.Orchestrator || !graph || !state) {
    return "engine globals missing (EX/_graph/_state)";
  }
  const total = graph.totalDefaultDuration;
  if (!total || total <= 0) return "graph.totalDefaultDuration unavailable";
  // Start via the real play button (user gesture), then seek mid-lesson.
  const btn = document.getElementById("playBtn");
  if (btn) btn.click();
  EX.Orchestrator.seekToGlobalTime(total * fraction, graph, state);
  return "ok:" + (total * fraction).toFixed(1) + "s/" + total.toFixed(1) + "s";
}
"""

_PAUSE_JS = """
() => {
  const EX = window.EX;
  if (EX && EX.ActRunner) EX.ActRunner.pause();
  if (EX && EX.EventBus) EX.EventBus.emit("audio:pause", {});
  return "paused";
}
"""


FRAME_INTERVAL_S = 10   # one frame every N seconds of timeline
MAX_FRAMES = 20         # cap for long videos: switch to even spacing


def _frame_timestamps(duration):
    """Sample times: every FRAME_INTERVAL_S from t=0, capped at MAX_FRAMES.
    Past the cap, spread MAX_FRAMES evenly across the full duration instead
    (so long videos still get end-of-timeline coverage, just coarser)."""
    n_regular = int(duration // FRAME_INTERVAL_S) + 1
    if n_regular <= MAX_FRAMES:
        return [i * FRAME_INTERVAL_S for i in range(n_regular)]
    end = duration * 0.98  # avoid seeking past the final frame
    return [end * i / (MAX_FRAMES - 1) for i in range(MAX_FRAMES)]


def _frame_name(idx, ts):
    return f"f{idx:02d}_t{int(round(ts))}s.png"


def _lesson_frames(html_path, frames_dir, load_wait_ms=4000, settle_ms=1500):
    """
    Dense timeline capture of a pipeline lesson: one browser session, one
    frame every FRAME_INTERVAL_S seconds (capped at MAX_FRAMES). Frame 0 is
    the untouched t=0 title/problem card; later frames are actively driven
    via the engine's own seek API. Requires playwright.
    """
    from playwright.sync_api import sync_playwright

    frames_dir.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(f"file://{Path(html_path).resolve()}")
        page.wait_for_timeout(load_wait_ms)

        # t=0 title/problem card, captured before any playback.
        page.screenshot(path=str(frames_dir / _frame_name(0, 0)), full_page=False)

        total = page.evaluate(
            "() => (window._graph && window._graph.totalDefaultDuration) || 0")
        if not total or total <= 0:
            browser.close()
            raise RuntimeError(f"totalDefaultDuration unavailable for {html_path}")

        stamps = _frame_timestamps(total)
        for idx, ts in enumerate(stamps[1:], start=1):
            status = page.evaluate(_DRIVE_TO_MID_JS, ts / total)
            if not str(status).startswith("ok:"):
                browser.close()
                raise RuntimeError(f"Seek to {ts:.1f}s failed for {html_path}: {status}")
            page.wait_for_timeout(settle_ms)
            page.evaluate(_PAUSE_JS)
            page.wait_for_timeout(300)
            page.screenshot(path=str(frames_dir / _frame_name(idx, ts)), full_page=False)
        browser.close()
    print(f"  Frames (lesson, {len(stamps)} @ ~{FRAME_INTERVAL_S}s): {frames_dir}")
    return frames_dir


def _video_frames(video_path, frames_dir):
    """Dense timeline capture of an external video via ffmpeg: one frame
    every FRAME_INTERVAL_S seconds (capped at MAX_FRAMES)."""
    import shutil
    import subprocess
    if not (shutil.which("ffmpeg") and shutil.which("ffprobe")):
        raise RuntimeError(
            f"ffmpeg/ffprobe required to extract frames from {video_path} "
            "(brew install ffmpeg)"
        )
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(video_path)],
        capture_output=True, text=True, timeout=60,
    )
    try:
        duration = float(probe.stdout.strip())
    except ValueError:
        raise RuntimeError(f"Could not read duration of {video_path}: {probe.stderr.strip()[:200]}")

    frames_dir.mkdir(parents=True, exist_ok=True)
    stamps = _frame_timestamps(duration)
    for idx, ts in enumerate(stamps):
        out = frames_dir / _frame_name(idx, ts)
        r = subprocess.run(
            ["ffmpeg", "-y", "-ss", f"{ts:.2f}", "-i", str(video_path),
             "-frames:v", "1", "-q:v", "2", str(out)],
            capture_output=True, text=True, timeout=120,
        )
        if r.returncode != 0 or not out.exists():
            raise RuntimeError(f"ffmpeg frame extraction failed at {ts:.1f}s: {r.stderr.strip()[:300]}")
    print(f"  Frames (video, {len(stamps)} @ ~{FRAME_INTERVAL_S}s over {duration:.0f}s): {frames_dir}")
    return frames_dir


def ensure_screenshot(assets, force=False):
    """
    One-time frame prep per lesson, cached in <name>_frames/ and reused on
    later runs: one frame every FRAME_INTERVAL_S seconds across the FULL
    timeline (capped at MAX_FRAMES). Pipeline lessons are actively driven
    via the engine seek API (audio-gated lessons never advance on passive
    waits); external videos go through ffmpeg.

    The cache is invalidated when the source html/video is newer than the
    extracted frames — silently judging stale imagery is worse than the
    cost of re-rendering.
    """
    import shutil as _shutil
    source = assets.video_path if assets.is_external else assets.html_path
    frames = assets.frame_paths()
    stale = frames and any(f.stat().st_mtime < source.stat().st_mtime for f in frames)

    if force or stale or not frames:
        if assets.frames_dir.exists():
            _shutil.rmtree(assets.frames_dir)
        if assets.is_external:
            _video_frames(assets.video_path, assets.frames_dir)
        else:
            _lesson_frames(assets.html_path, assets.frames_dir)
        frames = assets.frame_paths()
        if not frames:
            raise RuntimeError(f"Frame extraction produced no frames for {source}")
    return frames


# ── OpenAI call ────────────────────────────────────────────────────────────────

def require_api_key():
    """Fail fast, loudly, if OPENAI_API_KEY is not exported. No fallbacks."""
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise SystemExit(
            "ERROR: OPENAI_API_KEY is not set.\n"
            "Export it before running the judge:  export OPENAI_API_KEY=<your key>\n"
            "The judge will not fall back to any other provider or key."
        )
    return key


def _call_openai(system_prompt, user_content, model=JUDGE_MODEL,
                 max_tokens=MAX_OUTPUT_TOKENS):
    """
    One chat completion. `user_content` is a list of OpenAI content parts
    ({"type":"text",...} / {"type":"image_url",...}). Patched out in tests.

    `max_tokens` counts hidden reasoning tokens too — callers whose tasks
    trigger long reasoning (e.g. video_meta's frame counting) pass a larger
    budget, otherwise the model can burn the whole allowance thinking and
    return an empty visible message (finish_reason=length).
    """
    require_api_key()
    from openai import OpenAI  # lazy import so mocked tests don't need it
    client = OpenAI()
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        max_completion_tokens=max_tokens,
    )
    return resp.choices[0].message.content


def parse_agent_json(raw):
    """Parse an agent reply, tolerating ```json fences."""
    content = raw
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", content, re.IGNORECASE)
    if fenced:
        content = fenced.group(1)
    return json.loads(content.strip())


# ── Prompt / input assembly ────────────────────────────────────────────────────

def load_prompt(name):
    path = PROMPTS_DIR / f"{name}.md"
    if not path.exists():
        raise FileNotFoundError(f"Judge prompt missing: {path}")
    return path.read_text()


def _text(t):
    return {"type": "text", "text": t}


def _image(png_path):
    b64 = base64.b64encode(Path(png_path).read_bytes()).decode()
    return {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}}


def _clip(text, label):
    if text is None:
        return f"({label} not available for this lesson — treat as absent)"
    if len(text) > MAX_TEXT_CHARS:
        return text[:MAX_TEXT_CHARS] + "\n...[truncated]"
    return text


def build_dimension_content(dimension, lesson1, lesson2):
    """
    Build the user content for one dimension agent. `lesson1`/`lesson2` are
    LessonAssets already in randomized positional order — this function must
    never reference variant names.
    """
    parts = []
    if dimension in ("visual_accuracy", "polish"):
        # Dense timeline sample per lesson: one frame every ~FRAME_INTERVAL_S
        # seconds across the FULL duration (capped at MAX_FRAMES), in
        # chronological order, so the judge sees the whole lesson play out —
        # not just the intro and midpoint.
        for label, lesson in (("Lesson 1", lesson1), ("Lesson 2", lesson2)):
            frames = lesson.frame_paths()
            parts.append(_text(
                f"{label} — {len(frames)} frames sampled every ~{FRAME_INTERVAL_S}s "
                f"across the full timeline, in chronological order:"))
            for f in frames:
                # filename f07_t70s.png -> "t=70s"
                ts = f.stem.split("_", 1)[1] if "_" in f.stem else f.stem
                parts.append(_text(f"{label} frame at {ts.replace('t', 't=')}:"))
                parts.append(_image(f))
    elif dimension == "interactivity":
        for label, lesson in (("Lesson 1", lesson1), ("Lesson 2", lesson2)):
            gates = "\n\n".join(lesson.gates) if lesson.gates else None
            parts.append(_text(f"{label} gate specs:\n{_clip(gates, 'gate specs')}"))
            parts.append(_text(f"{label} plan JSON:\n{_clip(lesson.plan_json, 'plan JSON')}"))
    elif dimension in ("narration_quality", "sync"):
        for label, lesson in (("Lesson 1", lesson1), ("Lesson 2", lesson2)):
            transcript = lesson.transcript()
            parts.append(_text(
                f"{label} narration transcript with beat/timing data:\n"
                f"{_clip(transcript, 'transcript')}"
            ))
    elif dimension == "concept_accuracy":
        # Both lessons teach the same problem; give the judge the actual
        # problem statement so lessons without pipeline metadata (external
        # videos) can still be assessed against what SHOULD be taught.
        problem = lesson1.problem_text or lesson2.problem_text
        if problem:
            parts.append(_text(f"The problem both lessons teach:\n{problem}"))
        for label, lesson in (("Lesson 1", lesson1), ("Lesson 2", lesson2)):
            if lesson.is_external:
                transcript = lesson.transcript()
                parts.append(_text(
                    f"{label} is an externally generated video (no lesson plan / "
                    f"script available). Narration transcript:\n"
                    f"{_clip(transcript, 'transcript')}"
                ))
            else:
                parts.append(_text(f"{label} lesson plan JSON:\n{_clip(lesson.plan_json, 'lesson plan')}"))
                parts.append(_text(f"{label} content script:\n{_clip(lesson.content_js, 'content script')}"))
    else:
        raise ValueError(f"Unknown dimension: {dimension}")

    parts.append(_text("Output ONLY the JSON object."))
    return parts


def build_aggregator_content(dimension_results):
    """Text summary of the 6 verdicts — never the raw screenshots/code/audio."""
    summary = "\n".join(
        f'{dim}: winner={r["winner"]}, confidence={r["confidence"]}, rationale="{r["rationale"]}"'
        for dim, r in dimension_results.items()
    )
    return [_text(f"Dimension agent results:\n{summary}\n\nOutput ONLY the JSON object.")]


# ── Winner resolution ──────────────────────────────────────────────────────────

def resolve_winner(llm_winner, lesson1_id, lesson2_id):
    if llm_winner == "1":
        return lesson1_id
    if llm_winner == "2":
        return lesson2_id
    return "tie"


# ── Main entrypoint ────────────────────────────────────────────────────────────

def pair_key(a, b):
    s1, s2 = sorted([a, b])
    return f"{s1}__{s2}"


def result_path(a, b):
    return results_dir() / f"{pair_key(a, b)}.json"


def run_pairwise(variant_a, variant_b, model=JUDGE_MODEL):
    """
    Compare two lesson variants across 6 dimensions plus an aggregator.
    Returns the full result dict (winners resolved to real variant names).
    """
    if subject_of(variant_a) != subject_of(variant_b):
        raise ValueError(
            f"Cross-subject comparison ({variant_a} vs {variant_b}) — "
            "pairwise judging only makes sense between lessons of the same problem."
        )

    assets_a = LessonAssets(variant_a)
    assets_b = LessonAssets(variant_b)

    # Precomputed screenshots: prep once if missing, then reuse.
    ensure_screenshot(assets_a)
    ensure_screenshot(assets_b)

    # Randomize position ONCE; hold fixed for all 6 dimensions + aggregator.
    if random.random() < 0.5:
        lesson1, lesson2 = assets_a, assets_b
    else:
        lesson1, lesson2 = assets_b, assets_a

    def run_dimension(dim):
        content = build_dimension_content(dim, lesson1, lesson2)
        last_err = None
        # Occasional truncated/empty replies — retry the single flaky call
        # instead of failing the whole 7-call comparison.
        for _ in range(3):
            raw = _call_openai(load_prompt(dim), content, model=model)
            try:
                return parse_agent_json(raw)
            except json.JSONDecodeError as e:
                last_err = e
        raise RuntimeError(f"{dim} agent returned unparseable JSON after 3 attempts: {last_err}")

    # 6 parallel dimension agents.
    with ThreadPoolExecutor(max_workers=len(DIMENSIONS)) as pool:
        raw_results = dict(zip(DIMENSIONS, pool.map(run_dimension, DIMENSIONS)))

    # Aggregator — sequential, sees only the text summary (raw 1/2 labels).
    agg_raw = parse_agent_json(
        _call_openai(load_prompt("aggregator"), build_aggregator_content(raw_results), model=model)
    )

    # Resolve 1/2 -> variant names only now, after all calls completed.
    dimensions = {
        dim: {
            "winner": resolve_winner(r.get("winner"), lesson1.variant_id, lesson2.variant_id),
            "confidence": r.get("confidence"),
            "rationale": r.get("rationale"),
        }
        for dim, r in raw_results.items()
    }

    return {
        "setupA": variant_a,
        "setupB": variant_b,
        "subject": assets_a.subject,
        "lesson1Setup": lesson1.variant_id,
        "lesson2Setup": lesson2.variant_id,
        "dimensions": dimensions,
        "aggregator": {
            "winner": resolve_winner(agg_raw.get("winner"), lesson1.variant_id, lesson2.variant_id),
            "confidence": agg_raw.get("confidence"),
            "explanation": agg_raw.get("explanation"),
        },
        "evalModel": model,
        "evaluatedAt": datetime.now(timezone.utc).isoformat(),
        # Additive, read-only join: per-video metadata (duration, solved,
        # explained, visualCount) from video_scores/ if already computed by
        # video_meta.py. Never computed here; absent -> {}. Has no effect on
        # the pairwise verdicts above.
        "videoMeta": {
            v: _cached_video_meta(v) for v in (variant_a, variant_b)
        },
    }


def _cached_video_meta(variant_id):
    p = JUDGE_DIR / "video_scores" / f"{variant_id}.json"
    if p.exists():
        try:
            m = json.loads(p.read_text())
            return {k: m.get(k) for k in
                    ("durationSeconds", "solved", "explained", "visualCount")}
        except json.JSONDecodeError:
            pass
    return {}


def save_result(result):
    out = result_path(result["setupA"], result["setupB"])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2))
    return out


def load_all_results(subject=None):
    """Load every stored pair result, optionally filtered by subject prefix."""
    rdir = results_dir()
    if not rdir.is_dir():
        return []
    results = []
    for path in sorted(rdir.glob("*.json")):
        try:
            r = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        if subject and r.get("subject") != subject:
            continue
        results.append(r)
    return results
