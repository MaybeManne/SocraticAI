"""
Tests for validate.py — JSON schema and structural validation.

Testing strategy (6.031 methodology)
======================================
Each test class documents its partition. The key principle from 6.031:
black-box tests are written from the spec, not the implementation.
Every partition boundary gets its own test case.

Run with:  pytest agentic_pipeline/tests/test_validate.py -v
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from validate import (
    validate_plan,
    validate_act_spec,
    validate_gate_spec,
    validate_viz_spec,
    validate_all,
)


# ─────────────────────────────────────────────────────────────────────
# Helpers — minimal valid artifacts
# ─────────────────────────────────────────────────────────────────────

def _act_node(act_id="act_1", title="Act 1"):
    """Minimal act node that satisfies the lesson_plan JSON schema."""
    return {
        "type": "act",
        "id": act_id,
        "title": title,
        "objective": "Teach something.",
        "beat_outline": [],
        "viz_panel": None,   # required by schema, can be null
    }


def _gate_node(gate_id="gate_1", gate_type="quiz", after_act="act_1"):
    """Minimal gate node that satisfies the lesson_plan JSON schema."""
    return {
        "type": "gate",
        "id": gate_id,
        "gate_type": gate_type,
        "after_act": after_act,
    }


def _marker_node(label="Section", after_act="act_1"):
    """Minimal marker node that satisfies the lesson_plan JSON schema (after_act required)."""
    return {"type": "marker", "label": label, "after_act": after_act}


def _valid_plan(nodes=None):
    return {
        "meta": {"title": "Test", "source": "Src"},
        "problem": {"text": "Find x."},
        "viz_requirements": {"type": "none", "description": "", "actions": []},
        "nodes": nodes if nodes is not None else [_act_node()],
    }


def _valid_act_spec(act_id="act_1"):
    return {
        "act_id": act_id,
        "title": "Act 1",
        "viz_panel": None,   # required by act_spec schema
        "beats": [{"say": "Hello."}],
    }


def _valid_quiz_gate(gate_id="gate_1", after_act="act_1"):
    return {
        "gate_id": gate_id,
        "gate_type": "quiz",
        "after_act": after_act,
        "question": "What is 2+2?",
        "options": ["3", "4", "5"],
        "correct": 1,
    }


def _valid_fill_in_gate(gate_id="gate_1", after_act="act_1"):
    return {
        "gate_id": gate_id,
        "gate_type": "fill-in",
        "after_act": after_act,
        "prompt": "Answer is [___].",
        "blank": {"answer": ["42"], "width": 60},  # width is a number per schema
    }


def _valid_viz_spec():
    return {
        "mode": "custom_code",
        "code": "window.EXPLAINER_VIZ = {};",
        "actions_implemented": [],
    }


# ─────────────────────────────────────────────────────────────────────
# validate_plan
# ─────────────────────────────────────────────────────────────────────

class TestValidatePlan:
    """
    Testing strategy
    ----------------
    Partition on plan structure:
      - valid plan → []
      - missing "meta" → error
      - meta present but missing "title" → error
      - missing "problem" → error
      - problem present but missing "text" → error
      - missing "nodes" → error

    Partition on node IDs:
      - all unique (boundary: one node, many nodes)
      - duplicate IDs → error

    Partition on gate after_act references:
      - gate references existing act → no error
      - gate references non-existent act → error

    Partition on marker after_act references:
      - marker with no after_act → no error
      - marker with after_act referencing existing act → no error
      - marker with after_act referencing non-existent act → error

    Boundary: empty nodes list
    """

    def test_valid_plan_returns_no_errors(self):
        assert validate_plan(_valid_plan()) == []

    def test_missing_meta(self):
        plan = _valid_plan()
        del plan["meta"]
        errors = validate_plan(plan)
        assert any("meta" in e.lower() for e in errors)

    def test_meta_missing_title(self):
        plan = _valid_plan()
        del plan["meta"]["title"]
        errors = validate_plan(plan)
        assert any("title" in e.lower() for e in errors)

    def test_missing_problem(self):
        plan = _valid_plan()
        del plan["problem"]
        errors = validate_plan(plan)
        assert any("problem" in e.lower() for e in errors)

    def test_problem_missing_text(self):
        plan = _valid_plan()
        del plan["problem"]["text"]
        errors = validate_plan(plan)
        assert any("text" in e.lower() or "problem" in e.lower() for e in errors)

    def test_missing_nodes(self):
        plan = _valid_plan()
        del plan["nodes"]
        errors = validate_plan(plan)
        assert any("nodes" in e.lower() for e in errors)

    def test_empty_nodes_is_valid(self):
        """Boundary: zero nodes is structurally valid (no ID duplication, no references)."""
        errors = validate_plan(_valid_plan(nodes=[]))
        assert errors == []

    def test_single_act_node_valid(self):
        """Boundary: one node."""
        errors = validate_plan(_valid_plan())
        assert errors == []

    def test_duplicate_node_ids(self):
        nodes = [
            _act_node("act_1", "A"),
            _act_node("act_1", "B"),   # duplicate id
        ]
        errors = validate_plan(_valid_plan(nodes=nodes))
        assert any("duplicate" in e.lower() or "act_1" in e for e in errors)

    def test_gate_after_act_valid_reference(self):
        nodes = [_act_node("act_1"), _gate_node("gate_1", after_act="act_1")]
        errors = validate_plan(_valid_plan(nodes=nodes))
        assert errors == []

    def test_gate_after_act_invalid_reference(self):
        nodes = [_act_node("act_1"), _gate_node("gate_1", after_act="act_does_not_exist")]
        errors = validate_plan(_valid_plan(nodes=nodes))
        assert any("act_does_not_exist" in e or "non-existent" in e.lower() for e in errors)

    def test_marker_valid_after_act(self):
        """Marker schema requires after_act; marker pointing to existing act is valid."""
        nodes = [_act_node("act_1"), _marker_node("S2", after_act="act_1")]
        errors = validate_plan(_valid_plan(nodes=nodes))
        assert errors == []

    def test_marker_invalid_after_act(self):
        """Marker after_act references a nonexistent act → structural error."""
        nodes = [_act_node("act_1"), _marker_node("S2", after_act="act_ghost")]
        errors = validate_plan(_valid_plan(nodes=nodes))
        assert any("act_ghost" in e or "non-existent" in e.lower() for e in errors)

    def test_returns_list(self):
        assert isinstance(validate_plan(_valid_plan()), list)

    def test_no_mutation_of_input(self):
        plan = _valid_plan()
        original_title = plan["meta"]["title"]
        validate_plan(plan)
        assert plan["meta"]["title"] == original_title


# ─────────────────────────────────────────────────────────────────────
# validate_act_spec
# ─────────────────────────────────────────────────────────────────────

class TestValidateActSpec:
    """
    Testing strategy
    ----------------
    Partition on act_spec structure:
      - valid spec → []
      - missing "act_id" → error
      - missing "beats" → error
      - "beats" is empty list (boundary) → error
      - beat missing "say" → error

    Partition on plan cross-check:
      - plan is None → no cross-check (no errors from unknown viz actions)
      - plan with known viz actions, spec uses valid action → no error
      - plan with known viz actions, spec uses unknown action → error

    Boundary: single beat (minimum valid)
    """

    def test_valid_spec_returns_no_errors(self):
        assert validate_act_spec(_valid_act_spec()) == []

    def test_missing_act_id(self):
        spec = _valid_act_spec()
        del spec["act_id"]
        errors = validate_act_spec(spec)
        assert any("act_id" in e.lower() for e in errors)

    def test_missing_beats(self):
        spec = _valid_act_spec()
        del spec["beats"]
        errors = validate_act_spec(spec)
        assert any("beats" in e.lower() for e in errors)

    def test_empty_beats(self):
        """Boundary: beats list exists but is empty — schema says minItems:1."""
        spec = _valid_act_spec()
        spec["beats"] = []
        errors = validate_act_spec(spec)
        # Schema catches minItems:1 violation; structural check also catches empty list.
        assert errors  # at least one error from schema or structural check

    def test_beat_missing_say(self):
        spec = _valid_act_spec()
        spec["beats"] = [{"card": {"type": "text", "content": "hi"}}]  # no "say"
        errors = validate_act_spec(spec)
        assert any("say" in e.lower() for e in errors)

    def test_single_beat_is_valid(self):
        """Boundary: minimum of one beat."""
        spec = _valid_act_spec()
        spec["beats"] = [{"say": "Single beat."}]
        assert validate_act_spec(spec) == []

    def test_no_cross_check_without_plan(self):
        """Unknown viz action is not an error if plan is not provided."""
        spec = _valid_act_spec()
        spec["beats"] = [{"say": "Hi.", "viz_actions": [{"method": "unknownMethod"}]}]
        errors = validate_act_spec(spec, plan=None)
        assert errors == []

    def test_valid_viz_action_with_plan(self):
        plan = _valid_plan()
        plan["viz_requirements"] = {
            "type": "custom",
            "description": "",
            "actions": [{"method": "drawCircle", "description": "Draw", "params_schema": {}}]
        }
        spec = _valid_act_spec()
        spec["beats"] = [{"say": "Draw.", "viz_actions": [{"method": "drawCircle"}]}]
        assert validate_act_spec(spec, plan=plan) == []

    def test_unknown_viz_action_with_plan(self):
        plan = _valid_plan()
        plan["viz_requirements"] = {
            "type": "custom",
            "description": "",
            "actions": [{"method": "drawCircle", "description": "Draw", "params_schema": {}}]
        }
        spec = _valid_act_spec()
        spec["beats"] = [{"say": "Hi.", "viz_actions": [{"method": "ghostMethod"}]}]
        errors = validate_act_spec(spec, plan=plan)
        assert any("ghostMethod" in e for e in errors)

    def test_returns_list(self):
        assert isinstance(validate_act_spec(_valid_act_spec()), list)


# ─────────────────────────────────────────────────────────────────────
# validate_gate_spec
# ─────────────────────────────────────────────────────────────────────

class TestValidateGateSpec:
    """
    Testing strategy
    ----------------
    Partition on gate_type:
      - "quiz"          → requires question, options, correct
      - "fill-in"       → requires prompt, blank
      - "proof-builder" → no additional required field checks beyond structural
      - other / missing → structural errors only

    Partition on required field presence:
      - all required fields present → []
      - each required field absent → error for that field

    Boundary:
      - correct=0 (falsy) must NOT trigger a "missing correct" error
      - correct=None must trigger error
    """

    def test_valid_quiz_gate(self):
        assert validate_gate_spec(_valid_quiz_gate()) == []

    def test_valid_fill_in_gate(self):
        assert validate_gate_spec(_valid_fill_in_gate()) == []

    def test_missing_gate_id_is_now_valid(self):
        """gate_id is no longer required from LLM — pipeline injects it. Missing is OK."""
        spec = _valid_quiz_gate()
        del spec["gate_id"]
        errors = validate_gate_spec(spec)
        assert errors == []

    def test_missing_gate_type(self):
        spec = _valid_quiz_gate()
        del spec["gate_type"]
        errors = validate_gate_spec(spec)
        assert any("gate_type" in e.lower() for e in errors)

    def test_missing_after_act(self):
        spec = _valid_quiz_gate()
        del spec["after_act"]
        errors = validate_gate_spec(spec)
        assert any("after_act" in e.lower() for e in errors)

    def test_fill_in_prompt_missing_blank_marker_rejected(self):
        """
        Regression: the archer lesson shipped with a fill-in gate whose prompt
        had no [___] marker. The engine splits prompts on [___] to render the
        input field, so the checkpoint appeared but was unanswerable.
        validate_gate_spec must reject any fill-in prompt missing the marker.
        """
        spec = _valid_fill_in_gate()
        spec["prompt"] = "What is the horizontal component? (no marker here)"
        errors = validate_gate_spec(spec)
        assert any("[___]" in e for e in errors), \
            f"expected [___] marker error, got: {errors}"

    def test_fill_in_prompt_with_blank_marker_accepted(self):
        spec = _valid_fill_in_gate()
        spec["prompt"] = "The horizontal component is [___] m/s."
        assert validate_gate_spec(spec) == []

    def test_quiz_missing_question(self):
        spec = _valid_quiz_gate()
        del spec["question"]
        errors = validate_gate_spec(spec)
        assert any("question" in e.lower() for e in errors)

    def test_quiz_missing_options(self):
        spec = _valid_quiz_gate()
        del spec["options"]
        errors = validate_gate_spec(spec)
        assert any("options" in e.lower() for e in errors)

    def test_quiz_missing_correct(self):
        spec = _valid_quiz_gate()
        del spec["correct"]
        errors = validate_gate_spec(spec)
        assert any("correct" in e.lower() for e in errors)

    def test_quiz_correct_zero_is_valid(self):
        """
        Boundary: correct=0 is a valid answer index.
        Must NOT be treated as missing (falsy check would be wrong here).
        """
        spec = _valid_quiz_gate()
        spec["correct"] = 0
        errors = validate_gate_spec(spec)
        assert not any("correct" in e.lower() for e in errors)

    def test_quiz_correct_none_is_error(self):
        """correct=None — schema says integer|string so null is invalid."""
        spec = _valid_quiz_gate()
        spec["correct"] = None
        errors = validate_gate_spec(spec)
        # Schema reports a type error (not necessarily containing the word "correct");
        # structural check also fires. Either way, there must be at least one error.
        assert errors

    def test_fill_in_missing_prompt(self):
        spec = _valid_fill_in_gate()
        del spec["prompt"]
        errors = validate_gate_spec(spec)
        assert any("prompt" in e.lower() for e in errors)

    def test_fill_in_missing_blank(self):
        spec = _valid_fill_in_gate()
        del spec["blank"]
        errors = validate_gate_spec(spec)
        assert any("blank" in e.lower() for e in errors)

    def test_proof_builder_no_extra_required_fields(self):
        spec = {
            "gate_id": "gate_1",
            "gate_type": "proof-builder",
            "after_act": "act_1",
        }
        errors = validate_gate_spec(spec)
        assert errors == []

    def test_returns_list(self):
        assert isinstance(validate_gate_spec(_valid_quiz_gate()), list)

    def test_no_mutation_of_input(self):
        spec = _valid_quiz_gate()
        original_question = spec["question"]
        validate_gate_spec(spec)
        assert spec["question"] == original_question


# ─────────────────────────────────────────────────────────────────────
# validate_viz_spec
# ─────────────────────────────────────────────────────────────────────

class TestValidateVizSpec:
    """
    Testing strategy
    ----------------
    Partition on mode:
      - "custom_code" with code present → []
      - "custom_code" with code missing → error
      - "mobject_plugin" with code present → []
      - "mobject_plugin" with code missing → error
      - "preset" with preset name → []
      - "preset" with preset missing → error
      - missing "mode" entirely → error

    Partition on cross-check:
      - all_acts is None → no cross-check
      - act uses method in actions_implemented → no error
      - act uses method NOT in actions_implemented → error
    """

    def test_valid_custom_code(self):
        assert validate_viz_spec(_valid_viz_spec()) == []

    def test_missing_mode(self):
        spec = _valid_viz_spec()
        del spec["mode"]
        errors = validate_viz_spec(spec)
        assert any("mode" in e.lower() for e in errors)

    def test_custom_code_missing_code_field(self):
        spec = {"mode": "custom_code"}
        errors = validate_viz_spec(spec)
        assert any("code" in e.lower() for e in errors)

    def test_mobject_plugin_valid(self):
        spec = {"mode": "mobject_plugin", "mobject_plugin_code": "var x = 1;"}
        assert validate_viz_spec(spec) == []

    def test_mobject_plugin_missing_code(self):
        spec = {"mode": "mobject_plugin"}
        errors = validate_viz_spec(spec)
        assert any("mobject_plugin_code" in e.lower() for e in errors)

    def test_preset_valid(self):
        spec = {"mode": "preset", "preset": "numberLine"}
        assert validate_viz_spec(spec) == []

    def test_preset_missing_preset_name(self):
        spec = {"mode": "preset"}
        errors = validate_viz_spec(spec)
        assert any("preset" in e.lower() for e in errors)

    def test_no_cross_check_when_all_acts_none(self):
        spec = _valid_viz_spec()
        spec["actions_implemented"] = []
        # Even though an act might use methods not in the empty list,
        # if all_acts is None we skip the check.
        errors = validate_viz_spec(spec, all_acts=None)
        assert errors == []

    def test_cross_check_valid_action(self):
        spec = _valid_viz_spec()
        spec["actions_implemented"] = ["drawCircle"]
        all_acts = {
            "act_1": {
                "act_id": "act_1",
                "beats": [{"say": "Hi.", "viz_actions": [{"method": "drawCircle"}]}],
            }
        }
        errors = validate_viz_spec(spec, all_acts=all_acts)
        assert errors == []

    def test_cross_check_unknown_action(self):
        spec = _valid_viz_spec()
        spec["actions_implemented"] = ["drawCircle"]
        all_acts = {
            "act_1": {
                "act_id": "act_1",
                "beats": [{"say": "Hi.", "viz_actions": [{"method": "ghostAction"}]}],
            }
        }
        errors = validate_viz_spec(spec, all_acts=all_acts)
        assert any("ghostAction" in e for e in errors)

    def test_returns_list(self):
        assert isinstance(validate_viz_spec(_valid_viz_spec()), list)


# ─────────────────────────────────────────────────────────────────────
# validate_all
# ─────────────────────────────────────────────────────────────────────

class TestValidateAll:
    """
    Testing strategy
    ----------------
    Partition on result:
      - all valid → empty dict
      - plan invalid → "plan" key in result
      - act invalid → "act:<id>" key in result
      - gate invalid → "gate:<id>" key in result
      - viz invalid → "viz" key in result
      - multiple failures → multiple keys
    """

    def test_all_valid_returns_empty_dict(self):
        plan = _valid_plan(nodes=[_act_node("act_1"), _gate_node("gate_1")])
        result = validate_all(
            plan,
            {"act_1": _valid_act_spec()},
            {"gate_1": _valid_quiz_gate()},
            _valid_viz_spec(),
        )
        assert result == {}

    def test_invalid_plan_key_present(self):
        bad_plan = _valid_plan()
        del bad_plan["meta"]["title"]
        result = validate_all(bad_plan, {}, {}, None)
        assert "plan" in result

    def test_invalid_act_key_present(self):
        bad_act = _valid_act_spec()
        del bad_act["act_id"]
        result = validate_all(
            _valid_plan(),
            {"act_1": bad_act},
            {},
            None,
        )
        assert "act:act_1" in result

    def test_invalid_gate_key_present(self):
        bad_gate = _valid_quiz_gate()
        del bad_gate["question"]
        result = validate_all(
            _valid_plan(),
            {"act_1": _valid_act_spec()},
            {"gate_1": bad_gate},
            None,
        )
        assert "gate:gate_1" in result

    def test_invalid_viz_key_present(self):
        bad_viz = {"mode": "custom_code"}  # missing "code"
        result = validate_all(
            _valid_plan(),
            {"act_1": _valid_act_spec()},
            {},
            bad_viz,
        )
        assert "viz" in result

    def test_none_viz_skipped(self):
        """viz_spec=None → no "viz" key in result."""
        result = validate_all(_valid_plan(), {"act_1": _valid_act_spec()}, {}, None)
        assert "viz" not in result

    def test_multiple_failures_all_reported(self):
        bad_plan = _valid_plan()
        del bad_plan["meta"]["title"]
        bad_act = _valid_act_spec()
        del bad_act["act_id"]
        result = validate_all(bad_plan, {"act_1": bad_act}, {}, None)
        assert "plan" in result
        assert "act:act_1" in result

    def test_returns_dict(self):
        result = validate_all(_valid_plan(), {}, {}, None)
        assert isinstance(result, dict)
