"""
Mocked end-to-end verification for the pairwise judge.

No real API calls, no real lessons, no credits: the OpenAI call is patched to
return synthetic valid JSON, and lesson assets are synthetic files in tmp_path.
Verifies:
  1. Full pairwise flow — 6 parallel dimension calls with correct per-dimension
     inputs, aggregator receives the summarized text format, results saved to
     the canonicalized pair file, winners resolved to real variant names.
  2. bradley_terry converges to a sensible ranking on synthetic matchups.
  3. run_judge CLI: --a/--b runs, skip-if-exists, --force re-runs, --rank prints.
"""

import json
import sys
from pathlib import Path

import pytest

JUDGE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(JUDGE_DIR))

import bradley_terry
import pairwise_evaluator
import run_judge


# ── Synthetic lesson fixtures ──────────────────────────────────────────────────

FAKE_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)

CONTENT_JS = '''MX.lesson("Fake", function(L) {
L.act("Act One", function(A) {
  A.say("First narration line about the circle.").do("draw_circle", {}, "0");
  A.say("Now watch the ring highlight.").do("highlight_ring", {}, "+1.0");
});
L.ask({ question: "Q?" });
L.act("Act Two", function(A) {
  A.say("Closing narration.");
});
});'''

PLAN_JSON = json.dumps({"meta": {"title": "Fake"}, "nodes": [{"id": "act_1", "type": "act"}]})
GATE_JSON = json.dumps({"gate_id": "g1", "gate_type": "quiz", "question": "Q?"})


@pytest.fixture
def fake_lessons(tmp_path, monkeypatch):
    """Two synthetic circles variants with all artifacts + precomputed PNGs."""
    monkeypatch.setattr(pairwise_evaluator, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(pairwise_evaluator, "PIPELINE_DIR", tmp_path / "agentic_pipeline")
    monkeypatch.setenv("JUDGE_RESULTS_DIR", str(tmp_path / "pairwise_results"))

    for v in ("circles_v98", "circles_v99"):
        dist = tmp_path / "dist" / "circle problem"
        dist.mkdir(parents=True, exist_ok=True)
        (dist / f"{v}.html").write_text("<html>fake lesson</html>")
        (dist / f"{v}.png").write_bytes(FAKE_PNG)      # precomputed t=0 shot
        (dist / f"{v}_mid.png").write_bytes(FAKE_PNG)  # precomputed mid-lesson shot

        work = tmp_path / "agentic_pipeline" / "work" / v
        (work / "gates").mkdir(parents=True)
        (work / "lesson_plan.json").write_text(PLAN_JSON)
        (work / "gates" / "g1.json").write_text(GATE_JSON)
        (work / f"{v}_content.js").write_text(CONTENT_JS)
    return ("circles_v98", "circles_v99")


class CallRecorder:
    """Stands in for _call_openai; returns schema-valid JSON per prompt type."""

    def __init__(self, dim_winner="1", agg_winner="1"):
        self.calls = []  # list of (system_prompt, user_content)
        self.dim_winner = dim_winner
        self.agg_winner = agg_winner

    def __call__(self, system_prompt, user_content, model=None):
        self.calls.append((system_prompt, user_content))
        if system_prompt.startswith("You receive pairwise preferences"):
            return json.dumps({"winner": self.agg_winner, "confidence": 0.8,
                               "explanation": "synthetic aggregate"})
        return json.dumps({"winner": self.dim_winner, "confidence": 0.7,
                           "rationale": "synthetic comparison"})


def _parts_text(content):
    return " ".join(p["text"] for p in content if p["type"] == "text")


def _n_images(content):
    return sum(1 for p in content if p["type"] == "image_url")


# ── 1. Mocked end-to-end pairwise flow ─────────────────────────────────────────

def test_pairwise_end_to_end_mocked(fake_lessons, monkeypatch):
    a, b = fake_lessons
    recorder = CallRecorder()
    monkeypatch.setattr(pairwise_evaluator, "_call_openai", recorder)
    # Fix randomization deterministically: lesson1 = B (0.9 >= 0.5 branch).
    monkeypatch.setattr(pairwise_evaluator.random, "random", lambda: 0.9)

    result = pairwise_evaluator.run_pairwise(a, b)

    # 6 dimension calls + 1 aggregator, aggregator strictly last.
    assert len(recorder.calls) == 7
    agg_sys = recorder.calls[-1][0]
    assert agg_sys.startswith("You receive pairwise preferences")

    by_dim = {}
    for sys_prompt, content in recorder.calls[:6]:
        for dim in pairwise_evaluator.DIMENSIONS:
            if f"DIMENSION: {dim}" in sys_prompt:
                by_dim[dim] = content
    assert set(by_dim) == set(pairwise_evaluator.DIMENSIONS)

    # Input routing: each dimension gets ONLY what it needs.
    for dim in ("visual_accuracy", "polish"):
        assert _n_images(by_dim[dim]) == 4, f"{dim} must get 2 screenshots per lesson (t=0 + mid)"
        txt = _parts_text(by_dim[dim])
        assert "title/problem screen (t=0)" in txt and "mid-lesson frame" in txt
        assert "gate specs" not in txt
    for dim in ("interactivity", "narration_quality", "sync", "concept_accuracy"):
        assert _n_images(by_dim[dim]) == 0, f"{dim} must get no images"
    assert "gate specs" in _parts_text(by_dim["interactivity"])
    assert "plan JSON" in _parts_text(by_dim["interactivity"])
    for dim in ("narration_quality", "sync"):
        txt = _parts_text(by_dim[dim])
        assert "narration transcript" in txt
        assert "SAY: First narration line about the circle." in txt
        assert "cue: highlight_ring at offset +1.0" in txt
        assert "[GATE/CHECKPOINT appears here]" in txt
    concept_txt = _parts_text(by_dim["concept_accuracy"])
    assert "lesson plan JSON" in concept_txt and "content script" in concept_txt

    # Variant names must never appear in any model-visible content.
    for sys_prompt, content in recorder.calls:
        assert a not in _parts_text(content) and b not in _parts_text(content)
        assert a not in sys_prompt and b not in sys_prompt

    # Aggregator gets ONLY the text summary, all 6 lines, no images.
    agg_content = recorder.calls[-1][1]
    assert _n_images(agg_content) == 0
    agg_txt = _parts_text(agg_content)
    for dim in pairwise_evaluator.DIMENSIONS:
        assert f"{dim}: winner=1, confidence=0.7" in agg_txt

    # Position: random()=0.9 → lesson1 = B; dim winner "1" resolves to b.
    assert result["lesson1Setup"] == b and result["lesson2Setup"] == a
    for dim in pairwise_evaluator.DIMENSIONS:
        assert result["dimensions"][dim]["winner"] == b
    assert result["aggregator"]["winner"] == b
    assert result["setupA"] == a and result["setupB"] == b

    # Saved under the canonicalized (sorted) pair name.
    saved = pairwise_evaluator.save_result(result)
    assert saved.name == "circles_v98__circles_v99.json"
    assert json.loads(saved.read_text())["aggregator"]["winner"] == b


def test_tie_resolution(fake_lessons, monkeypatch):
    a, b = fake_lessons
    monkeypatch.setattr(pairwise_evaluator, "_call_openai",
                        CallRecorder(dim_winner="tie", agg_winner="tie"))
    result = pairwise_evaluator.run_pairwise(a, b)
    assert result["aggregator"]["winner"] == "tie"
    assert all(d["winner"] == "tie" for d in result["dimensions"].values())


def test_cross_subject_rejected(fake_lessons):
    with pytest.raises(ValueError, match="Cross-subject"):
        pairwise_evaluator.run_pairwise("circles_v98", "archer_v1")


def test_missing_api_key_fails_loudly(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(SystemExit, match="OPENAI_API_KEY is not set"):
        pairwise_evaluator.require_api_key()


# ── 2. Bradley-Terry on synthetic matchups ─────────────────────────────────────

def test_bradley_terry_sane_ranking():
    # 4 setups: A beats everyone, B beats C and D, C ties D.
    matchups = [
        {"a": "A", "b": "B", "aWins": 1},
        {"a": "A", "b": "C", "aWins": 1},
        {"a": "A", "b": "D", "aWins": 1},
        {"a": "B", "b": "C", "aWins": 1},
        {"a": "B", "b": "D", "aWins": 1},
        {"a": "C", "b": "D", "aWins": 0.5},
    ]
    ranking = bradley_terry.compute_bradley_terry(matchups)
    ids = [r["id"] for r in ranking]
    assert ids[0] == "A" and ids[1] == "B"
    assert set(ids[2:]) == {"C", "D"}
    scores = [r["score"] for r in ranking]
    assert scores == sorted(scores, reverse=True)
    assert abs(sum(scores) - 1.0) < 1e-6          # normalized
    assert ranking[0]["wins"] == 3 and ranking[0]["losses"] == 0
    tie_rows = [r for r in ranking if r["id"] in ("C", "D")]
    assert all(r["ties"] == 1 for r in tie_rows)
    assert all(r["comparisons"] == 3 for r in ranking)


def test_rank_all_seven_rankings():
    def fake_result(a, b, overall, per_dim):
        return {
            "setupA": a, "setupB": b,
            "aggregator": {"winner": overall},
            "dimensions": {d: {"winner": per_dim} for d in bradley_terry.DIMENSIONS},
        }
    results = [
        fake_result("X", "Y", overall="X", per_dim="Y"),
        fake_result("X", "Z", overall="X", per_dim="tie"),
        fake_result("Y", "Z", overall="Y", per_dim="Z"),
    ]
    rankings = bradley_terry.rank_all(results)
    assert rankings["overall"][0]["id"] == "X"          # X won both overall
    assert set(rankings["dimensions"]) == set(bradley_terry.DIMENSIONS)
    for dim in bradley_terry.DIMENSIONS:                # dims bypass aggregator
        assert rankings["dimensions"][dim][0]["id"] in ("Y", "Z")


# ── 3. CLI flags ───────────────────────────────────────────────────────────────

def test_cli_compare_skip_force_and_rank(fake_lessons, monkeypatch, capsys):
    a, b = fake_lessons
    monkeypatch.setenv("OPENAI_API_KEY", "test-dummy-not-real")
    recorder = CallRecorder()
    monkeypatch.setattr(pairwise_evaluator, "_call_openai", recorder)

    # --a/--b runs a comparison and saves it.
    assert run_judge.main(["--a", a, "--b", b]) == 0
    assert pairwise_evaluator.result_path(a, b).exists()
    assert len(recorder.calls) == 7

    # Re-run without --force → skipped, no new calls.
    assert run_judge.main(["--a", a, "--b", b]) == 0
    assert len(recorder.calls) == 7
    assert "Skipping" in capsys.readouterr().out

    # --force → re-runs (7 more calls).
    assert run_judge.main(["--a", a, "--b", b, "--force"]) == 0
    assert len(recorder.calls) == 14

    # --rank prints all 7 ranking tables.
    assert run_judge.main(["--rank"]) == 0
    out = capsys.readouterr().out
    assert "OVERALL (aggregator winners)" in out
    for dim in bradley_terry.DIMENSIONS:
        assert dim in out

    # --rank --subject filters.
    assert run_judge.main(["--rank", "--subject", "circles"]) == 0
    assert run_judge.main(["--rank", "--subject", "archer"]) == 1  # nothing stored
