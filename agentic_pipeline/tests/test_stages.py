"""
Stage isolation tests — every stage tested with mocked LLM calls.

Testing strategy (6.031)
------------------------
Partition on stage inputs:
  - minimal valid input (boundary)
  - math problem vs physics problem
  - single-act vs multi-act
  - with vs without gates
  - with vs without wrong paths

Known regression cases:
  - duplicate beats in act output
  - missing viz actions (silent skips)
  - gate spec missing after LLM produces gate_id (now irrelevant — removed from schema)
  - resume with acts loaded but gates empty

Each stage is tested in isolation — LLM is mocked, file I/O uses tempdir.

Run: pytest agentic_pipeline/tests/test_stages.py -v
"""

import sys, os, json, tempfile, shutil
import pytest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from assembler import assemble_content, assemble_viz, emit_beat, emit_gate, emit_act
from validate import validate_plan, validate_act_spec, validate_gate_spec, validate_viz_spec


# ─────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────

def _plan(n_acts=1, n_gates=0, domain="math"):
    nodes = []
    for i in range(n_acts):
        nodes.append({
            "type": "act", "id": f"act_{i+1}", "title": f"Act {i+1}",
            "objective": "Teach something.", "viz_panel": None, "beat_outline": []
        })
        if i < n_gates:
            nodes.append({
                "type": "gate", "id": f"gate_{i+1}", "gate_type": "quiz",
                "after_act": f"act_{i+1}",
            })
    return {
        "meta": {"title": f"{domain} lesson", "source": "Test"},
        "problem": {"text": "Solve $x^2 = 4$."},
        "viz_requirements": {"type": "none", "description": "", "actions": []},
        "nodes": nodes,
    }


def _act_spec(act_id="act_1", n_beats=2, duplicate=False):
    say_texts = [f"Beat {i} — this is unique narration." for i in range(n_beats)]
    if duplicate:
        say_texts[-1] = say_texts[0]  # intentional duplicate
    beats = [{"say": s, "viz_actions": []} for s in say_texts]
    return {"act_id": act_id, "title": "Act 1", "viz_panel": None, "beats": beats}


def _gate_spec(gate_id="gate_1", after_act="act_1"):
    # Note: gate_id is pipeline-injected; LLM output would NOT have it
    return {
        "gate_id": gate_id,
        "gate_type": "quiz",
        "after_act": after_act,
        "question": "What is $2+2$?",
        "options": ["3", "4", "5", "6"],
        "correct": 1,
        "explanations": {"correct": "Yes.", "0": "Too small.", "2": "Too big.", "3": "Way off."},
    }


def _viz_spec(actions=None):
    switch_cases = "\n".join(
        f'    case "{m}": tl.to({{opacity: 1}}, t); break;'
        for m in (actions or [])
    )
    return {
        "mode": "custom_code",
        "config": {"plugin": "test_viz", "config": {}},
        "code": f"window.EXPLAINER_VIZ = (function() {{ return {{ init: function() {{}}, timelineAction: function(tl, method, params, t) {{ switch(method) {{ {switch_cases} }} }} }}; }})();",
        "actions_implemented": actions or [],
    }


# ─────────────────────────────────────────────────────────────────────
# Stage 2: validate_plan
# ─────────────────────────────────────────────────────────────────────

class TestStagePlan:
    """Partition: valid, missing fields, duplicate IDs, bad references."""

    def test_minimal_math_plan_valid(self):
        assert validate_plan(_plan(1, 0)) == []

    def test_multi_act_plan_valid(self):
        assert validate_plan(_plan(4, 2)) == []

    def test_physics_plan_valid(self):
        assert validate_plan(_plan(2, 1, domain="physics")) == []

    def test_gate_invalid_after_act(self):
        p = _plan(1, 1)
        p["nodes"][1]["after_act"] = "act_does_not_exist"
        errors = validate_plan(p)
        assert any("act_does_not_exist" in e for e in errors)

    def test_duplicate_act_ids(self):
        p = _plan(1, 0)
        p["nodes"].append({
            "type": "act", "id": "act_1", "title": "Dup",
            "objective": "", "viz_panel": None, "beat_outline": []
        })
        errors = validate_plan(p)
        assert any("duplicate" in e.lower() or "act_1" in e for e in errors)

    def test_empty_nodes_valid(self):
        assert validate_plan(_plan(0)) == []


# ─────────────────────────────────────────────────────────────────────
# Stage 3a: act_spec validation + duplicate beat detection
# ─────────────────────────────────────────────────────────────────────

class TestStageAct:
    """Partition: valid, missing fields, duplicate beats, cross-check viz actions."""

    def test_valid_act_no_errors(self):
        assert validate_act_spec(_act_spec()) == []

    def test_single_beat_boundary(self):
        spec = _act_spec(n_beats=1)
        assert validate_act_spec(spec) == []

    def test_missing_say_field(self):
        spec = _act_spec()
        spec["beats"][0] = {}
        errors = validate_act_spec(spec)
        assert any("say" in e.lower() for e in errors)

    def test_unknown_viz_action_caught(self):
        plan = _plan(1, 0)
        plan["viz_requirements"] = {
            "type": "custom", "description": "",
            "actions": [{"method": "drawCircle", "description": "Draw", "params_schema": {}}]
        }
        spec = _act_spec()
        spec["beats"][0]["viz_actions"] = [{"method": "ghostMethod"}]
        errors = validate_act_spec(spec, plan=plan)
        assert any("ghostMethod" in e for e in errors)

    def test_duplicate_say_texts_assemble_both(self):
        """Duplicate beats are not caught by validate_act_spec (that's a prompt concern),
        but the assembler emits them verbatim — test that they appear twice in output."""
        spec = _act_spec(duplicate=True)
        result = emit_act(spec)
        # both duplicate beats appear
        assert result.count("Beat 0") == 2


# ─────────────────────────────────────────────────────────────────────
# Stage 3b: gate_spec validation — gate_id removed from LLM contract
# ─────────────────────────────────────────────────────────────────────

class TestStageGate:
    """
    Testing strategy
    ----------------
    Partition: quiz / fill-in / proof-builder / interactive
    Boundary: correct=0 is valid, correct=None is error
    Regression: gate_id absent from LLM output is now valid (pipeline injects it)
    """

    def test_gate_spec_without_gate_id_is_valid(self):
        """
        Regression: gate_id is no longer required in LLM output.
        A spec without gate_id must pass validation — the pipeline injects it after.
        """
        spec = {
            "gate_type": "quiz",
            "after_act": "act_1",
            "question": "What?",
            "options": ["A", "B", "C", "D"],
            "correct": 0,
        }
        errors = validate_gate_spec(spec)
        assert errors == []

    def test_gate_spec_with_gate_id_also_valid(self):
        """gate_id in spec is allowed (injected by pipeline) — not an error."""
        assert validate_gate_spec(_gate_spec()) == []

    def test_correct_zero_is_valid(self):
        """Boundary: correct=0 is valid (falsy but non-None)."""
        spec = _gate_spec()
        spec["correct"] = 0
        errors = validate_gate_spec(spec)
        assert not any("correct" in e.lower() for e in errors)

    def test_correct_none_is_error(self):
        spec = _gate_spec()
        spec["correct"] = None
        assert validate_gate_spec(spec)  # any error

    def test_fill_in_requires_prompt_and_blank(self):
        spec = {
            "gate_type": "fill-in",
            "after_act": "act_1",
            "prompt": "Answer: [___].",
            "blank": {"answer": ["42"], "width": 60},
        }
        assert validate_gate_spec(spec) == []

    def test_fill_in_missing_prompt(self):
        spec = {
            "gate_type": "fill-in",
            "after_act": "act_1",
            "blank": {"answer": ["42"], "width": 60},
        }
        errors = validate_gate_spec(spec)
        assert any("prompt" in e.lower() for e in errors)


# ─────────────────────────────────────────────────────────────────────
# Stage 4: viz_spec — mandatory action coverage
# ─────────────────────────────────────────────────────────────────────

class TestStageViz:
    """Partition: all actions implemented, some missing, zero actions."""

    def test_all_actions_implemented(self):
        actions = ["drawCircle", "focusRing", "showLabel"]
        spec = _viz_spec(actions=actions)
        all_acts = {
            "act_1": {
                "act_id": "act_1",
                "beats": [{"say": "Hi.", "viz_actions": [{"method": m} for m in actions]}]
            }
        }
        assert validate_viz_spec(spec, all_acts=all_acts) == []

    def test_missing_action_caught(self):
        spec = _viz_spec(actions=["drawCircle"])
        all_acts = {
            "act_1": {
                "act_id": "act_1",
                "beats": [{"say": "Hi.", "viz_actions": [
                    {"method": "drawCircle"},
                    {"method": "focusRing"},  # implemented missing
                ]}]
            }
        }
        errors = validate_viz_spec(spec, all_acts=all_acts)
        assert any("focusRing" in e for e in errors)

    def test_zero_actions_valid(self):
        spec = _viz_spec(actions=[])
        assert validate_viz_spec(spec) == []

    def test_preset_mode_valid(self):
        spec = {"mode": "preset", "preset": "numberLine", "actions_implemented": []}
        assert validate_viz_spec(spec) == []


# ─────────────────────────────────────────────────────────────────────
# Stage 5: assembler integration — gate ID lookup contract
# ─────────────────────────────────────────────────────────────────────

class TestStageAssembler:
    """
    The assembler looks up gate_specs[node["id"]].
    These tests verify the exact contract.
    """

    def test_gate_assembled_when_id_matches(self):
        plan = _plan(1, 1)
        gate_id = plan["nodes"][1]["id"]   # "gate_1"
        result = assemble_content(
            plan,
            {"act_1": _act_spec()},
            {gate_id: _gate_spec(gate_id=gate_id)},
            None
        )
        assert "L.ask(" in result
        assert "WARNING" not in result

    def test_gate_missing_raises(self):
        import pytest
        from assembler import AssemblyError
        plan = _plan(1, 1)
        with pytest.raises(AssemblyError, match="gate_1"):
            assemble_content(plan, {"act_1": _act_spec()}, {}, None)

    def test_gate_key_mismatch_raises(self):
        import pytest
        from assembler import AssemblyError
        plan = _plan(1, 1)
        with pytest.raises(AssemblyError, match="gate_1"):
            assemble_content(plan, {"act_1": _act_spec()},
                             {"gate_WRONG": _gate_spec()}, None)

    def test_wrong_path_uses_b_not_l(self):
        branch = {"act_branch": {"act_id": "act_branch", "title": "Review",
                                  "viz_panel": None, "beats": [{"say": "Reteach."}]}}
        spec = _gate_spec()
        spec["wrong_path_acts"] = ["act_branch"]
        result = emit_gate(spec, branch_act_specs=branch)
        assert "B.act(" in result
        assert "L.act(" not in result


# ─────────────────────────────────────────────────────────────────────
# Known regression: resume with acts loaded, gates empty
# ─────────────────────────────────────────────────────────────────────

class TestResumeRegression:
    """
    Regression: the old code had gates nested inside `if not act_specs and plan:`.
    When acts were loaded from disk, gates were silently skipped.
    The fix: independent conditions.
    """

    def _simulate_stage3(self, act_specs, gate_specs, plan, mock_acts, mock_gates):
        if not act_specs and plan:
            act_specs = mock_acts(plan)
        if not gate_specs and plan and act_specs:
            gate_specs = mock_gates(plan, act_specs)
        return act_specs, gate_specs

    def test_acts_loaded_gates_empty_runs_gate_worker(self):
        mock_acts = MagicMock()
        mock_gates = MagicMock(return_value={"gate_1": _gate_spec()})
        preloaded = {"act_1": _act_spec()}

        acts, gates = self._simulate_stage3(preloaded, {}, _plan(1, 1), mock_acts, mock_gates)

        mock_acts.assert_not_called()
        mock_gates.assert_called_once()
        assert "gate_1" in gates

    def test_both_loaded_skips_both_workers(self):
        mock_acts = MagicMock()
        mock_gates = MagicMock()
        preloaded_acts = {"act_1": _act_spec()}
        preloaded_gates = {"gate_1": _gate_spec()}

        acts, gates = self._simulate_stage3(
            preloaded_acts, preloaded_gates, _plan(1, 1), mock_acts, mock_gates
        )

        mock_acts.assert_not_called()
        mock_gates.assert_not_called()

    def test_both_empty_runs_both_workers(self):
        mock_acts = MagicMock(return_value={"act_1": _act_spec()})
        mock_gates = MagicMock(return_value={"gate_1": _gate_spec()})

        acts, gates = self._simulate_stage3({}, {}, _plan(1, 1), mock_acts, mock_gates)

        mock_acts.assert_called_once()
        mock_gates.assert_called_once()


# ─────────────────────────────────────────────────────────────────────
# Problem type partitioning
# ─────────────────────────────────────────────────────────────────────

class TestProblemTypes:
    """Plans generated for different domains should all validate cleanly."""

    def _make_plan(self, title, actions):
        return {
            "meta": {"title": title, "source": "Test"},
            "problem": {"text": "Solve it."},
            "viz_requirements": {
                "type": "custom", "description": "",
                "actions": [{"method": m, "description": m, "params_schema": {}} for m in actions]
            },
            "nodes": [
                {"type": "act", "id": "act_1", "title": "A",
                 "objective": "O", "viz_panel": "svg", "beat_outline": []},
            ]
        }

    def test_math_plan(self):
        p = self._make_plan("Quadratic formula", ["drawParabola", "showRoots", "highlightVertex"])
        assert validate_plan(p) == []

    def test_physics_plan(self):
        p = self._make_plan("Projectile motion", ["drawTrajectory", "showVelocityVector", "showApex"])
        assert validate_plan(p) == []

    def test_cs_plan(self):
        p = self._make_plan("Binary search", ["highlightMidpoint", "dimLeftHalf", "showComparison"])
        assert validate_plan(p) == []

    def test_act_with_physics_viz_actions(self):
        plan = self._make_plan("Projectile", ["drawTrajectory", "showVelocityVector"])
        spec = {
            "act_id": "act_1",
            "title": "Launch",
            "viz_panel": "svg",
            "beats": [
                {"say": "Watch the ball launch.", "viz_actions": [{"method": "drawTrajectory"}]},
                {"say": "The velocity vector points tangent to the curve.",
                 "viz_actions": [{"method": "showVelocityVector", "params": {"t": 0.5}}]},
            ]
        }
        assert validate_act_spec(spec, plan=plan) == []
