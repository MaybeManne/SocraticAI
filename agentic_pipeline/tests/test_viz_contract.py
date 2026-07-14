"""
Tests for the viz action/params contract and assembler JS-integrity gates —
the bug class behind binsearch_v7's "undefined + undefined = NaN" mid-calc
box and circles_v7's fully blank panel (regex literal corrupted by the
single-line normalizer). All of these must fail FAST and LOUD, never render
broken output silently.
"""

import shutil
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from assembler import AssemblyError, _normalize_viz_code, assemble_viz
from pipeline_types import (
    assert_beat_visual_contract,
    assert_viz_action_contract,
    viz_action_contract_errors,
)
from validate import validate_plan


PLUGIN = """window.EXPLAINER_VIZ = (function() {
  return {
    name: "t",
    init: function(svg, config) {},
    timelineAction: function(tl, method, params, t) {
      switch (method) {
        case 'drawArray':
          tl.to({}, {duration: 1}, t);
          break;
        case 'showMidCalculation':
          var label = params.low + ' + ' + params.high + ' = ' + params.mid;
          tl.to({}, {duration: 1}, t);
          break;
        case 'focusRing':
          var k = params.k || 1;   /* guarded read — {} is fine */
          break;
      }
    }
  };
})();"""


def _act(beats):
    return {"act_1": {"act_id": "act_1", "title": "t", "viz_panel": "svg", "beats": beats}}


def _beat(method, params=None, say="plain narration"):
    return {"say": say, "card": None,
            "viz_actions": [{"method": method, "params": params or {}, "offset": "0"}]}


# ── 1. empty params on a declared action whose case reads them unguarded ──────

def test_empty_params_on_param_reading_case_fails():
    acts = _act([_beat("showMidCalculation", {})])
    with pytest.raises(TypeError, match=r"missing \['high', 'low', 'mid'\]"):
        assert_viz_action_contract({"mode": "custom_code", "code": PLUGIN}, acts)


def test_populated_params_pass():
    acts = _act([_beat("showMidCalculation", {"low": 0, "high": 10, "mid": 5})])
    assert_viz_action_contract({"mode": "custom_code", "code": PLUGIN}, acts)


def test_guarded_reads_tolerate_empty_params():
    acts = _act([_beat("focusRing", {})])
    assert_viz_action_contract({"mode": "custom_code", "code": PLUGIN}, acts)


# ── 2. beat method with no matching switch case ────────────────────────────────

def test_method_without_case_fails():
    acts = _act([_beat("nonexistentAction", {})])
    with pytest.raises(TypeError, match="no case for it"):
        assert_viz_action_contract({"mode": "custom_code", "code": PLUGIN}, acts)


def test_soft_validator_reports_same_errors():
    acts = _act([_beat("nonexistentAction", {}), _beat("showMidCalculation", {})])
    errs = viz_action_contract_errors({"mode": "custom_code", "code": PLUGIN}, acts)
    assert len(errs) == 2
    assert any("no case" in e for e in errs)
    assert any("undefined" in e for e in errs)


# ── 3. empty viz_actions on a beat that narrates a visual ─────────────────────

def test_narrated_visual_with_no_action_fails():
    acts = _act([{"say": "Watch the ring between radius one and two light up.",
                  "card": None, "viz_actions": []}])
    with pytest.raises(TypeError, match="narrated visual with no viz action"):
        assert_beat_visual_contract(acts)


def test_pure_narration_beat_passes():
    acts = _act([{"say": "So we need at least two thousand twenty three pi.",
                  "card": None, "viz_actions": []}])
    assert_beat_visual_contract(acts)  # no visual cue words — fine


# ── 4. pacing rule: beat exceeding 2 viz_actions flagged at plan time ──────────

def _plan_with_beat(viz_actions, hint="explain the idea"):
    return {
        "meta": {"title": "T", "source": "s", "answer": "1",
                 "estimated_duration_minutes": 2},
        "problem": {"text": "p", "highlight": "h"},
        "viz_requirements": {"type": "custom", "description": "d", "config": {},
                             "actions": [{"method": m, "description": "d",
                                          "params_schema": {}} for m in set(viz_actions) or {"x"}]},
        "nodes": [{"type": "act", "id": "act_a", "title": "A", "objective": "o",
                   "context_from_previous": "c", "viz_panel": "svg",
                   "beat_outline": [{"narration_hint": hint, "card_type": "none",
                                     "viz_actions": viz_actions}]}],
    }


def test_pacing_rule_flags_three_plus_actions():
    errors = validate_plan(_plan_with_beat(["a", "b", "c"]))
    assert any("pacing rule caps a beat at 2" in e for e in errors)


def test_two_actions_pass_pacing():
    errors = validate_plan(_plan_with_beat(["a", "b"]))
    assert not any("pacing" in e for e in errors)


def test_visual_hint_with_empty_actions_flagged_at_plan_time():
    errors = validate_plan(_plan_with_beat([], hint="highlight ring k=1 via focusRing"))
    assert any("viz_actions is empty" in e for e in errors)


# ── 5. regex literals survive single-line normalization (circles_v7) ──────────

def test_normalize_preserves_regex_literal():
    single_line = ("var f = function(line) { return line.replace(/\\cancel{([^}]+)}/g, "
                   "'<tspan>$1</tspan>'); };")
    out = _normalize_viz_code(single_line)
    # The braces inside the regex literal must NOT be split onto new lines.
    assert "/\\cancel{([^}]+)}/g" in out
    # Sanity: normalization still splits real statements.
    assert out.count("\n") >= 1


def test_normalize_still_splits_statements_outside_regex():
    out = _normalize_viz_code("var a = 1; var b = 2;")
    assert "var a = 1;\n" in out


# ── 6. assembled viz must parse (node --check gate) ────────────────────────────

@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_assemble_viz_rejects_unparseable_code():
    broken = "window.EXPLAINER_VIZ = (function() { return { x: /\\cancel{\n([^\n}]+)\n}/g };"
    with pytest.raises(AssemblyError, match="does not parse"):
        assemble_viz({"mode": "custom_code", "code": broken})


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_assemble_viz_accepts_valid_code():
    assert assemble_viz({"mode": "custom_code", "code": PLUGIN}) is not None


# ── 7. Gemini schema cleaner must resolve oneOf unions, not drop them ─────────

def test_gemini_cleaner_resolves_nullable_card_union():
    from orchestrator import _clean_schema_for_gemini
    card = {
        "oneOf": [
            {"type": "null"},
            {"type": "object", "required": ["type"],
             "properties": {"type": {"type": "string"},
                            "content": {"type": "string"},
                            "steps": {"type": "array",
                                      "items": {"type": "object",
                                                "properties": {"latex": {"type": "string"}}}}}},
        ]
    }
    c = _clean_schema_for_gemini(card)
    # Dropping the union used to leave a bare {} -> Gemini emitted card:{} for
    # every beat -> notebook cards never existed (the dead-right-panel bug).
    assert c.get("nullable") is True
    assert c.get("type") == "object"
    assert set(c["properties"]) >= {"type", "content", "steps"}


# ── 8. silent-lesson guard: --audio must hard-fail without a key ──────────────

def test_audio_stage_hard_fails_without_key(monkeypatch, tmp_path):
    from orchestrator import stage_audio_and_rebuild
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    with pytest.raises(SystemExit, match="silent lesson"):
        stage_audio_and_rebuild(tmp_path / "c.js", None, tmp_path / "o.html", tmp_path)
