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

        self.html_path = REPO_ROOT / "dist" / spec["dist"] / spec["html"](variant_id)
        if not self.html_path.exists():
            raise FileNotFoundError(f"Lesson HTML not found for {variant_id!r}: {self.html_path}")
        # Precomputed screenshots live alongside the HTML:
        #   <name>.png     — t=0 title/problem card (catches text-render bugs)
        #   <name>_mid.png — lesson actively driven to ~50% of its timeline
        self.screenshot_path = self.html_path.with_suffix(".png")
        self.mid_screenshot_path = self.html_path.with_name(self.html_path.stem + "_mid.png")

        # Work-dir artifacts (may be absent, e.g. for *_v0original).
        self.work_dir = PIPELINE_DIR / "work" / variant_id.replace(".", "_")
        self.plan_json = self._read_optional(self.work_dir / "lesson_plan.json")
        self.gates = self._read_gates()
        self.content_js = self._read_content_js()

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
            lines.append(f"ACT: {payload}")
        elif kind == "say":
            lines.append(f'  SAY: {payload}')
        elif kind == "do":
            action, offset = payload
            lines.append(f"    cue: {action} at offset {offset}")
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


def _screenshot_mid(html_path, out_path, fraction=0.5, load_wait_ms=4000, settle_ms=2500):
    """
    Capture the lesson actively driven to `fraction` of its default-path
    timeline (default 50% — the mid-derivation point, where the viz is
    richest). Requires playwright.
    """
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(f"file://{Path(html_path).resolve()}")
        page.wait_for_timeout(load_wait_ms)
        status = page.evaluate(_DRIVE_TO_MID_JS, fraction)
        if not str(status).startswith("ok:"):
            browser.close()
            raise RuntimeError(f"Mid-lesson drive failed for {html_path}: {status}")
        # Let the snapshot renders + seek-target GSAP calls settle, then freeze.
        page.wait_for_timeout(settle_ms)
        page.evaluate(_PAUSE_JS)
        page.wait_for_timeout(300)
        page.screenshot(path=str(out_path), full_page=False)
        browser.close()
    print(f"  Screenshot (mid-lesson, {status}): {out_path}")
    return out_path


def ensure_screenshot(assets, force=False):
    """
    One-time prep, two shots per lesson (reused on later runs, never
    re-rendered per comparison):
      1. t=0 title/problem card — orchestrator.take_screenshot (passive).
      2. mid-lesson (~50% of the timeline) — active drive via the engine API,
         since audio-gated lessons never advance on passive waits.
    """
    if not (assets.screenshot_path.exists() and not force):
        sys.path.insert(0, str(PIPELINE_DIR))
        from orchestrator import take_screenshot  # lazy: playwright optional elsewhere
        ok = take_screenshot(assets.html_path, assets.screenshot_path, wait_ms=4000)
        if not ok or not assets.screenshot_path.exists():
            raise RuntimeError(
                f"Failed to screenshot {assets.html_path} — is playwright installed? "
                "(pip install playwright && playwright install chromium)"
            )
    if not (assets.mid_screenshot_path.exists() and not force):
        _screenshot_mid(assets.html_path, assets.mid_screenshot_path)
    return assets.screenshot_path


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


def _call_openai(system_prompt, user_content, model=JUDGE_MODEL):
    """
    One chat completion. `user_content` is a list of OpenAI content parts
    ({"type":"text",...} / {"type":"image_url",...}). Patched out in tests.
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
        max_completion_tokens=MAX_OUTPUT_TOKENS,
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
        # Two frames per lesson: the t=0 title/problem card AND a mid-lesson
        # frame (actively driven to ~50% of the timeline) so the judge sees
        # the actual diagrams/animation state, not just the paused intro.
        for label, lesson in (("Lesson 1", lesson1), ("Lesson 2", lesson2)):
            parts.append(_text(f"{label} — title/problem screen (t=0):"))
            parts.append(_image(lesson.screenshot_path))
            parts.append(_text(f"{label} — mid-lesson frame (~50% through the timeline):"))
            parts.append(_image(lesson.mid_screenshot_path))
    elif dimension == "interactivity":
        for label, lesson in (("Lesson 1", lesson1), ("Lesson 2", lesson2)):
            gates = "\n\n".join(lesson.gates) if lesson.gates else None
            parts.append(_text(f"{label} gate specs:\n{_clip(gates, 'gate specs')}"))
            parts.append(_text(f"{label} plan JSON:\n{_clip(lesson.plan_json, 'plan JSON')}"))
    elif dimension in ("narration_quality", "sync"):
        for label, lesson in (("Lesson 1", lesson1), ("Lesson 2", lesson2)):
            transcript = extract_transcript(lesson.content_js)
            parts.append(_text(
                f"{label} narration transcript with beat/timing data:\n"
                f"{_clip(transcript, 'transcript')}"
            ))
    elif dimension == "concept_accuracy":
        for label, lesson in (("Lesson 1", lesson1), ("Lesson 2", lesson2)):
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
        raw = _call_openai(load_prompt(dim), content, model=model)
        return parse_agent_json(raw)

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
    }


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
