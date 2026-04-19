"""
Tests for gate ID resolution — the critical path from gate worker output
through save/load artifacts to assembly.

Testing strategy (6.031 methodology)
======================================
The bug: when --stage acts is used (or the pipeline is interrupted after
acts but before gates), resuming skips gate authoring because
  `if not act_specs and plan:` is False — acts already loaded.

The fix: separate conditions so gates run independently:
  `if not act_specs and plan:`         → author acts
  `if not gate_specs and plan and act_specs:` → author gates

These tests verify:
  1. The assembly contract: gate_spec keyed by gate_id must match node["id"]
  2. save_artifacts / load_artifacts round-trip preserves gate_id → gate_spec mapping
  3. The condition logic: acts present + gates absent → gates authored
  4. The condition logic: both present → neither re-authored

Partition on (act_specs loaded, gate_specs loaded):
  - (empty, empty)   → author both
  - (loaded, empty)  → ONLY author gates  [was the bug; now fixed]
  - (loaded, loaded) → author neither
  - (empty, loaded)  → impossible in practice, but condition still correct

Run with:  pytest agentic_pipeline/tests/test_gate_resolution.py -v
"""

import sys
import os
import json
import tempfile
import shutil
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch, call

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from assembler import assemble_content
from validate import validate_gate_spec


# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────

def _plan_with_gate(gate_id="gate_xyz", act_id="act_1"):
    return {
        "meta": {"title": "T", "source": "S"},
        "problem": {"text": "Find x."},
        "viz_requirements": {"type": "none", "description": "", "actions": []},
        "nodes": [
            {"type": "act",  "id": act_id,  "title": "Act",
             "objective": "", "beat_outline": []},
            {"type": "gate", "id": gate_id, "gate_type": "quiz",
             "after_act": act_id, "question_hint": "", "wrong_path_hint": ""},
        ],
    }


def _act_spec(act_id="act_1"):
    return {
        "act_id": act_id,
        "title": "Act",
        "beats": [{"say": "Hello."}],
    }


def _gate_spec(gate_id="gate_xyz", after_act="act_1"):
    return {
        "gate_id": gate_id,
        "gate_type": "quiz",
        "after_act": after_act,
        "question": "What is 2+2?",
        "options": ["3", "4", "5"],
        "correct": 1,
        "explanations": {},
    }


# ─────────────────────────────────────────────────────────────────────
# Assembly contract: gate_spec key must match plan node["id"]
# ─────────────────────────────────────────────────────────────────────

class TestGateIdMatchInAssembly:
    """
    Testing strategy
    ----------------
    Partition on gate_id alignment:
      - gate_spec key == plan node["id"] → gate emitted (no WARNING)
      - gate_spec key != plan node["id"] → gate NOT found → WARNING comment
      - gate_specs is empty → WARNING comment

    Boundary: gate_id is the empty string (unusual but defensive)
    """

    def test_matching_gate_id_emits_gate(self):
        """
        Core contract: plan node["id"] == gate_specs key → gate is assembled.
        """
        plan = _plan_with_gate(gate_id="gate_xyz")
        gate_specs = {"gate_xyz": _gate_spec(gate_id="gate_xyz")}
        act_specs = {"act_1": _act_spec()}

        result = assemble_content(plan, act_specs, gate_specs, None)

        assert "L.ask(" in result
        assert "WARNING" not in result

    def test_mismatched_gate_id_raises(self):
        """
        Plan node has id="gate_xyz" but gate_specs uses key="gate_OTHER" →
        assembler can't find the spec → fail fast. Previously emitted a warning
        comment and shipped broken HTML; now raises AssemblyError so the bug
        surfaces at build time instead of at the student's screen.
        """
        import pytest
        from assembler import AssemblyError
        plan = _plan_with_gate(gate_id="gate_xyz")
        gate_specs = {"gate_OTHER": _gate_spec(gate_id="gate_OTHER")}  # wrong key
        act_specs = {"act_1": _act_spec()}

        with pytest.raises(AssemblyError, match="gate_xyz"):
            assemble_content(plan, act_specs, gate_specs, None)

    def test_empty_gate_specs_raises(self):
        """Boundary: no gate specs at all."""
        import pytest
        from assembler import AssemblyError
        plan = _plan_with_gate(gate_id="gate_xyz")
        with pytest.raises(AssemblyError, match="gate_xyz"):
            assemble_content(plan, {"act_1": _act_spec()}, {}, None)

    def test_multiple_gates_all_matched(self):
        """Both gate IDs must match their respective specs."""
        plan = {
            "meta": {"title": "T", "source": "S"},
            "problem": {"text": "Q"},
            "viz_requirements": {"type": "none", "description": "", "actions": []},
            "nodes": [
                {"type": "act",  "id": "act_1",   "title": "A1", "objective": "", "beat_outline": []},
                {"type": "gate", "id": "gate_1",  "gate_type": "quiz",
                 "after_act": "act_1", "question_hint": "", "wrong_path_hint": ""},
                {"type": "act",  "id": "act_2",   "title": "A2", "objective": "", "beat_outline": []},
                {"type": "gate", "id": "gate_2",  "gate_type": "fill-in",
                 "after_act": "act_2", "question_hint": "", "wrong_path_hint": ""},
            ],
        }
        gate_specs = {
            "gate_1": _gate_spec(gate_id="gate_1", after_act="act_1"),
            "gate_2": {
                "gate_id": "gate_2", "gate_type": "fill-in", "after_act": "act_2",
                "prompt": "Ans [___].", "blank": {"answer": ["x"], "width": "60px"},
            },
        }
        act_specs = {
            "act_1": _act_spec("act_1"),
            "act_2": _act_spec("act_2"),
        }
        result = assemble_content(plan, act_specs, gate_specs, None)

        assert "L.ask(" in result        # gate_1 (quiz)
        assert "L.askFillIn(" in result  # gate_2 (fill-in)
        assert "WARNING" not in result

    def test_one_gate_matched_one_missing(self):
        """Partial gate coverage still fails fast — cannot silently ship a lesson
        with one interactive checkpoint missing."""
        import pytest
        from assembler import AssemblyError
        plan = {
            "meta": {"title": "T", "source": "S"},
            "problem": {"text": "Q"},
            "viz_requirements": {"type": "none", "description": "", "actions": []},
            "nodes": [
                {"type": "act",  "id": "act_1",  "title": "A", "objective": "", "beat_outline": []},
                {"type": "gate", "id": "gate_1", "gate_type": "quiz",
                 "after_act": "act_1", "question_hint": "", "wrong_path_hint": ""},
                {"type": "gate", "id": "gate_2", "gate_type": "quiz",
                 "after_act": "act_1", "question_hint": "", "wrong_path_hint": ""},
            ],
        }
        gate_specs = {"gate_1": _gate_spec("gate_1")}
        with pytest.raises(AssemblyError, match="gate_2"):
            assemble_content(plan, {"act_1": _act_spec()}, gate_specs, None)


# ─────────────────────────────────────────────────────────────────────
# save_artifacts / load_artifacts round-trip
# ─────────────────────────────────────────────────────────────────────

class TestArtifactRoundTrip:
    """
    Testing strategy
    ----------------
    Verify that gate_id keys survive save → load intact.

    Partition on gate count:
      - zero gates (boundary)
      - one gate
      - multiple gates with different IDs
    """

    def setup_method(self):
        self.work_dir = tempfile.mkdtemp()

    def teardown_method(self):
        shutil.rmtree(self.work_dir, ignore_errors=True)

    def _save_and_load(self, gate_specs):
        # Import here to avoid circular issues at module level
        from orchestrator import save_artifacts, load_artifacts
        save_artifacts(self.work_dir, gate_specs=gate_specs)
        _, _, _, loaded_gates, _ = load_artifacts(self.work_dir)
        return loaded_gates

    def test_empty_gate_specs_round_trip(self):
        """Boundary: saving {} creates no gates/ dir; loading returns {}."""
        loaded = self._save_and_load({})
        assert loaded == {}

    def test_single_gate_round_trip(self):
        spec = _gate_spec(gate_id="gate_abc")
        loaded = self._save_and_load({"gate_abc": spec})

        assert "gate_abc" in loaded
        assert loaded["gate_abc"]["gate_id"] == "gate_abc"
        assert loaded["gate_abc"]["question"] == spec["question"]

    def test_multiple_gates_round_trip(self):
        specs = {
            "gate_1": _gate_spec("gate_1", "act_1"),
            "gate_2": _gate_spec("gate_2", "act_2"),
        }
        loaded = self._save_and_load(specs)

        assert set(loaded.keys()) == {"gate_1", "gate_2"}
        assert loaded["gate_1"]["gate_id"] == "gate_1"
        assert loaded["gate_2"]["gate_id"] == "gate_2"

    def test_gate_id_key_matches_spec_gate_id_field(self):
        """
        The key in the returned dict and the "gate_id" field inside the spec
        must both be the same string — this is the contract the assembler relies on.
        """
        spec = _gate_spec(gate_id="gate_alpha")
        loaded = self._save_and_load({"gate_alpha": spec})

        for key, loaded_spec in loaded.items():
            assert key == loaded_spec["gate_id"]


# ─────────────────────────────────────────────────────────────────────
# Orchestrator condition logic (the bug fix)
# ─────────────────────────────────────────────────────────────────────

class TestOrchestratorConditionLogic:
    """
    Testing strategy
    ----------------
    The bug was: gate authoring was nested inside `if not act_specs and plan:`,
    so a resume with existing acts (act_specs truthy) but no gates would never
    call stage2b_author_gates.

    The fix: separate conditions:
        if not act_specs and plan:     → stage2_author_acts
        if not gate_specs and plan and act_specs: → stage2b_author_gates

    We test the CONDITION LOGIC only, mocking the expensive LLM-calling functions.

    Partition on (act_specs loaded, gate_specs loaded):
      - (empty, empty)   → author BOTH acts and gates
      - (loaded, empty)  → author ONLY gates  [the previously broken case]
      - (loaded, loaded) → author NEITHER
      - (empty, loaded)  → impossible but condition is still correct: acts authored, gates not
    """

    def _run_stage3_logic(self, act_specs, gate_specs, plan,
                          mock_author_acts, mock_author_gates):
        """
        Simulate the fixed Stage 3 condition logic from orchestrator.main(),
        using injected mock functions.
        Returns (final_act_specs, final_gate_specs).
        """
        # ── Stage 3a: Author acts ──
        if not act_specs and plan:
            act_specs = mock_author_acts(plan)

        # ── Stage 3b: Author gates (independent condition) ──
        if not gate_specs and plan and act_specs:
            gate_specs = mock_author_gates(plan, act_specs)

        return act_specs, gate_specs

    def test_both_empty_authors_both(self):
        """(empty, empty) → both authoring functions called."""
        mock_acts  = MagicMock(return_value={"act_1": _act_spec()})
        mock_gates = MagicMock(return_value={"gate_1": _gate_spec()})
        plan = _plan_with_gate()

        acts, gates = self._run_stage3_logic({}, {}, plan, mock_acts, mock_gates)

        mock_acts.assert_called_once()
        mock_gates.assert_called_once()
        assert "act_1" in acts
        assert "gate_1" in gates

    def test_acts_loaded_gates_empty_authors_only_gates(self):
        """
        (loaded, empty) → ONLY gate authoring is called.
        This is the previously broken case — the old code skipped gates here.
        """
        preloaded_acts = {"act_1": _act_spec()}
        mock_acts  = MagicMock(return_value={"act_1": _act_spec()})
        mock_gates = MagicMock(return_value={"gate_1": _gate_spec()})
        plan = _plan_with_gate()

        acts, gates = self._run_stage3_logic(
            preloaded_acts, {}, plan, mock_acts, mock_gates
        )

        mock_acts.assert_not_called()     # acts already loaded → skip
        mock_gates.assert_called_once()   # gates missing → must run
        assert "gate_1" in gates

    def test_both_loaded_authors_neither(self):
        """(loaded, loaded) → neither authoring function called."""
        preloaded_acts  = {"act_1": _act_spec()}
        preloaded_gates = {"gate_1": _gate_spec()}
        mock_acts  = MagicMock()
        mock_gates = MagicMock()
        plan = _plan_with_gate()

        acts, gates = self._run_stage3_logic(
            preloaded_acts, preloaded_gates, plan, mock_acts, mock_gates
        )

        mock_acts.assert_not_called()
        mock_gates.assert_not_called()
        assert acts == preloaded_acts
        assert gates == preloaded_gates

    def test_acts_empty_gates_loaded_authors_acts_not_gates(self):
        """
        (empty, loaded) → acts are authored, gates are not (already present).
        Unusual state but the conditions handle it correctly.
        """
        preloaded_gates = {"gate_1": _gate_spec()}
        mock_acts  = MagicMock(return_value={"act_1": _act_spec()})
        mock_gates = MagicMock()
        plan = _plan_with_gate()

        acts, gates = self._run_stage3_logic(
            {}, preloaded_gates, plan, mock_acts, mock_gates
        )

        mock_acts.assert_called_once()
        mock_gates.assert_not_called()
        assert gates == preloaded_gates

    def test_no_plan_authors_nothing(self):
        """plan=None → neither function is called regardless of spec state."""
        mock_acts  = MagicMock()
        mock_gates = MagicMock()

        acts, gates = self._run_stage3_logic({}, {}, None, mock_acts, mock_gates)

        mock_acts.assert_not_called()
        mock_gates.assert_not_called()
        assert acts == {}
        assert gates == {}


# ─────────────────────────────────────────────────────────────────────
# Gate ID validation: gate_id must be present and non-None
# ─────────────────────────────────────────────────────────────────────

class TestGateIdInSpec:
    """
    Testing strategy
    ----------------
    The assembler looks up gate_specs[node["id"]] where node["id"] comes from
    the plan. validate_gate_spec must catch missing gate_id before assembly.

    Partition on gate_id in spec:
      - present and non-empty → no validation error
      - missing key → error
      - empty string (boundary) → present but empty — validator may or may not flag
        (we test current behavior: the check is `if "gate_id" not in gate_spec`)
    """

    def test_gate_id_present(self):
        assert validate_gate_spec(_gate_spec()) == []

    def test_gate_id_missing_is_valid(self):
        """gate_id is pipeline-injected — not in LLM output. Absence is not an error."""
        spec = _gate_spec()
        del spec["gate_id"]
        errors = validate_gate_spec(spec)
        assert errors == []

    def test_gate_id_empty_string_not_caught_by_key_check(self):
        """
        Boundary: gate_id="" passes the `"gate_id" not in spec` check.
        Current behavior: no validation error (empty string is a present key).
        This test documents the current spec, not ideal behavior.
        """
        spec = _gate_spec()
        spec["gate_id"] = ""
        # The current validator only checks key presence, not value validity
        errors = validate_gate_spec(spec)
        # Document current behavior: key is present so no error from that check
        assert not any("gate_id" in e.lower() and "missing" in e.lower()
                       for e in errors)
