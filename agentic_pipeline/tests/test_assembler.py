"""
Tests for assembler.py — deterministic JSON → JavaScript code generation.

Testing strategy (6.031 methodology)
======================================
Each test class documents its partition and covers:
  - Each subdomain with at least one test case
  - All boundary values as single-element subdomains

Run with:  pytest agentic_pipeline/tests/test_assembler.py -v
"""

import sys
import os
import re
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from assembler import (
    _js_str,
    _js_value,
    _js_obj,
    emit_beat,
    emit_act,
    emit_gate,
    emit_marker,
    assemble_content,
    assemble_viz,
)


# ─────────────────────────────────────────────────────────────────────
# _js_str
# ─────────────────────────────────────────────────────────────────────

class TestJsStr:
    """
    Testing strategy
    ----------------
    Partition on s (the string to escape):
      - empty string
      - no special characters
      - contains double quote "
      - contains backslash \\
      - contains newline \\n
      - contains carriage return \\r
      - multiple special characters together

    Boundary: empty string (length 0)
    """

    def test_empty_string(self):
        """Boundary: empty → just surrounding quotes."""
        assert _js_str("") == '""'

    def test_no_special_chars(self):
        assert _js_str("hello") == '"hello"'

    def test_double_quote_escaped(self):
        assert _js_str('say "hello"') == '"say \\"hello\\""'

    def test_backslash_escaped(self):
        # single backslash → double backslash inside the JS string
        assert _js_str("a\\b") == '"a\\\\b"'

    def test_newline_escaped(self):
        assert _js_str("line1\nline2") == '"line1\\nline2"'

    def test_carriage_return_removed(self):
        assert _js_str("line\r\n") == '"line\\n"'

    def test_multiple_specials(self):
        result = _js_str('he said "hi"\nbye')
        assert result == '"he said \\"hi\\"\\nbye"'

    def test_result_is_always_double_quoted(self):
        """The output always starts and ends with a double quote character."""
        result = _js_str("anything")
        assert result[0] == '"'
        assert result[-1] == '"'

    def test_backslash_before_quote(self):
        """Backslash followed by a double-quote: both chars must be independently escaped."""
        # Input: two characters — backslash, then double-quote
        # After escape: backslash → \\, double-quote → \"
        # Interior of the JS string: \\\"  (4 chars)
        result = _js_str('\\"')
        interior = result[1:-1]  # strip surrounding JS double-quotes
        assert interior == '\\\\\\"'  # two backslashes then escaped quote


# ─────────────────────────────────────────────────────────────────────
# _js_value
# ─────────────────────────────────────────────────────────────────────

class TestJsValue:
    """
    Testing strategy
    ----------------
    Partition on type(v):
      - None
      - bool: True, False
      - int: 0 (boundary), positive, negative
      - float: 0.0 (boundary), positive, negative
      - str: non-empty, empty (boundary)
      - list: empty (boundary), single element, short (inline), long (multiline)
      - dict: empty (boundary), delegates to _js_obj

    Partition on indent:
      - 0 (default/boundary)
      - positive (affects multiline padding)
    """

    def test_none(self):
        assert _js_value(None) == "null"

    def test_true(self):
        assert _js_value(True) == "true"

    def test_false(self):
        assert _js_value(False) == "false"

    def test_zero_int(self):
        """Boundary: 0 must produce "0", not "false" (bool check is before int)."""
        assert _js_value(0) == "0"

    def test_positive_int(self):
        assert _js_value(42) == "42"

    def test_negative_int(self):
        assert _js_value(-7) == "-7"

    def test_float(self):
        assert _js_value(3.14) == "3.14"

    def test_zero_float(self):
        assert _js_value(0.0) == "0.0"

    def test_string_delegates_to_js_str(self):
        assert _js_value("hello") == '"hello"'

    def test_empty_string(self):
        """Boundary: empty string → '""'."""
        assert _js_value("") == '""'

    def test_empty_list(self):
        """Boundary: empty list → '[]'."""
        assert _js_value([]) == "[]"

    def test_single_element_list(self):
        result = _js_value([1])
        assert result == "[1]"

    def test_short_list_inline(self):
        """Short total length → inline format."""
        result = _js_value([1, 2, 3])
        assert result == "[1, 2, 3]"
        assert "\n" not in result

    def test_long_list_multiline(self):
        """Total chars >= 60 → multiline format."""
        long_list = ["a_very_long_key_name_" + str(i) for i in range(5)]
        result = _js_value(long_list)
        assert "\n" in result

    def test_dict_delegates_to_js_obj(self):
        result = _js_value({})
        assert result == "{}"

    def test_list_contains_none(self):
        assert _js_value([None]) == "[null]"

    def test_list_contains_bool(self):
        assert _js_value([True, False]) == "[true, false]"

    def test_indent_affects_multiline_list(self):
        """Non-zero indent shifts the padding of multiline output."""
        long_list = ["key_" + str(i) * 10 for i in range(4)]
        result_0 = _js_value(long_list, indent=0)
        result_4 = _js_value(long_list, indent=4)
        # Both are multiline; padding in indent=4 version is wider
        assert "      " in result_4  # indent+2 = 6 spaces
        assert result_0 != result_4


# ─────────────────────────────────────────────────────────────────────
# _js_obj
# ─────────────────────────────────────────────────────────────────────

class TestJsObj:
    """
    Testing strategy
    ----------------
    Partition on obj:
      - empty dict (boundary)
      - single-entry dict (boundary)
      - all keys are valid JS identifiers
      - some keys are NOT valid JS identifiers (hyphen, starts with digit)
      - short total pairs length → inline
      - long total pairs length → multiline

    Partition on indent:
      - 0 (boundary)
      - positive
    """

    def test_empty_dict(self):
        """Boundary: empty → '{}'."""
        assert _js_obj({}) == "{}"

    def test_single_identifier_key(self):
        """Boundary: one entry with valid JS identifier key."""
        result = _js_obj({"x": 1})
        assert result == "{ x: 1 }"

    def test_all_identifier_keys_inline(self):
        result = _js_obj({"a": 1, "b": 2})
        assert "a: 1" in result
        assert "b: 2" in result
        assert "\n" not in result

    def test_non_identifier_key_is_quoted(self):
        """Keys with hyphens or starting with digits must be quoted."""
        result = _js_obj({"my-key": 1})
        assert '"my-key"' in result

    def test_key_starting_with_digit_is_quoted(self):
        result = _js_obj({"2fast": "yes"})
        assert '"2fast"' in result

    def test_dollar_and_underscore_valid_identifiers(self):
        """$ and _ are valid JS identifier starts."""
        result = _js_obj({"_x": 1, "$y": 2})
        assert "_x: 1" in result
        assert "$y: 2" in result
        assert '"_x"' not in result

    def test_long_dict_multiline(self):
        """When total pair chars >= 80, output is multiline."""
        obj = {f"key_{i}": "a_long_value_string_here" for i in range(5)}
        result = _js_obj(obj)
        assert "\n" in result

    def test_nested_dict(self):
        result = _js_obj({"outer": {"inner": 1}})
        assert "outer" in result
        assert "inner: 1" in result

    def test_indent_used_in_multiline(self):
        obj = {f"k_{i}": "value_padding_long_string_here" for i in range(4)}
        result_0 = _js_obj(obj, indent=0)
        result_4 = _js_obj(obj, indent=4)
        assert result_0 != result_4
        # indent=4 adds 6-space padding (4+2)
        assert "      " in result_4


# ─────────────────────────────────────────────────────────────────────
# emit_beat
# ─────────────────────────────────────────────────────────────────────

class TestEmitBeat:
    """
    Testing strategy
    ----------------
    Partition on card:
      - None (no card)
      - type "text" with only "content" key → .show(string)
      - type "text" with extra keys → .card("text", {...})
      - type "latex" with only "content" → .show(string)
      - type "latex" with extra keys (highlight, note) → .show({...})
      - type "title" with subheading → .title(h, s)
      - type "title" without subheading → .title(h)
      - other type → .card(type, {...})

    Partition on viz_actions:
      - empty list (boundary)
      - one action, no params, no offset
      - one action with params
      - one action with string offset "+0.5"
      - multiple actions

    Partition on inline_viz:
      - None (no inline)
      - True → .inline()
      - string "svg" → .inline("svg")

    Partition on duration:
      - None (no duration)
      - number → .duration(n)

    Boundary: indent=0
    """

    def _beat(self, **kwargs):
        """Minimal valid beat dict."""
        b = {"say": "The formula is $E = mc^2$."}
        b.update(kwargs)
        return b

    def test_minimal_beat_no_card(self):
        result = emit_beat(self._beat())
        assert 'A.say(' in result
        assert '.show(' not in result
        assert '.card(' not in result
        assert result.strip().endswith(";")

    def test_simple_text_card_uses_show(self):
        """text card with only 'content' → .show(string)."""
        beat = self._beat(card={"type": "text", "content": "Hello **world**"})
        result = emit_beat(beat)
        assert ".show(" in result
        assert ".card(" not in result

    def test_text_card_with_extra_keys_uses_card(self):
        """text card with extra keys → .card('text', {...})."""
        beat = self._beat(card={"type": "text", "content": "hi", "extra": True})
        result = emit_beat(beat)
        assert '.card(' in result

    def test_latex_card_simple_uses_show(self):
        """latex card with only 'content' → .show(string)."""
        beat = self._beat(card={"type": "latex", "content": "x^2"})
        result = emit_beat(beat)
        assert ".show(" in result
        assert ".card(" not in result

    def test_latex_card_with_highlight_uses_show_obj(self):
        """latex card with extra fields → .show({type:..., content:..., ...})."""
        beat = self._beat(card={"type": "latex", "content": "x^2", "highlight": True})
        result = emit_beat(beat)
        assert ".show(" in result

    def test_title_card_with_subheading(self):
        beat = self._beat(card={"type": "title", "heading": "Chapter 1", "subheading": "Intro"})
        result = emit_beat(beat)
        assert ".title(" in result
        assert "Chapter 1" in result
        assert "Intro" in result

    def test_title_card_without_subheading(self):
        beat = self._beat(card={"type": "title", "heading": "Chapter 1"})
        result = emit_beat(beat)
        assert ".title(" in result
        assert "Intro" not in result

    def test_other_card_type_uses_card(self):
        beat = self._beat(card={"type": "derivation", "title": "Steps", "steps": []})
        result = emit_beat(beat)
        assert '.card(' in result
        assert '"derivation"' in result

    def test_no_viz_actions(self):
        """Boundary: empty viz_actions → no .do() calls."""
        beat = self._beat(viz_actions=[])
        result = emit_beat(beat)
        assert ".do(" not in result

    def test_single_viz_action_no_params_no_offset(self):
        beat = self._beat(viz_actions=[{"method": "drawCircle"}])
        result = emit_beat(beat)
        assert '.do("drawCircle")' in result

    def test_viz_action_with_params(self):
        beat = self._beat(viz_actions=[{"method": "drawCircle", "params": {"r": 5}}])
        result = emit_beat(beat)
        assert '.do("drawCircle"' in result
        assert "r: 5" in result

    def test_viz_action_with_string_offset(self):
        beat = self._beat(viz_actions=[{"method": "showLabel", "params": {}, "offset": "+0.5"}])
        result = emit_beat(beat)
        assert '"+0.5"' in result

    def test_multiple_viz_actions(self):
        beat = self._beat(viz_actions=[
            {"method": "drawA"},
            {"method": "drawB", "offset": "+1.0"},
        ])
        result = emit_beat(beat)
        assert result.count(".do(") == 2

    def test_inline_none(self):
        beat = self._beat(inline_viz=None)
        result = emit_beat(beat)
        assert ".inline(" not in result

    def test_inline_true(self):
        beat = self._beat(inline_viz=True)
        result = emit_beat(beat)
        assert ".inline()" in result

    def test_inline_string(self):
        beat = self._beat(inline_viz="svg")
        result = emit_beat(beat)
        assert '.inline("svg")' in result

    def test_duration_none(self):
        beat = self._beat(duration=None)
        result = emit_beat(beat)
        assert ".duration(" not in result

    def test_duration_number(self):
        beat = self._beat(duration=5.5)
        result = emit_beat(beat)
        assert ".duration(5.5)" in result

    def test_indent_zero(self):
        """Boundary: indent=0 — first line starts at column 0."""
        result = emit_beat(self._beat(), indent=0)
        assert result.startswith("A.say(")

    def test_indent_nonzero(self):
        result = emit_beat(self._beat(), indent=4)
        assert result.startswith("    A.say(")


# ─────────────────────────────────────────────────────────────────────
# emit_act
# ─────────────────────────────────────────────────────────────────────

class TestEmitAct:
    """
    Testing strategy
    ----------------
    Partition on act_spec:
      - viz_panel absent (boundary)
      - viz_panel present → A.vizPanel(...) emitted
      - one beat (boundary)
      - multiple beats

    Partition on indent: 0 (boundary), non-zero
    """

    def _act(self, title="My Act", viz_panel=None, beats=None):
        spec = {"title": title, "act_id": "act_1", "beats": beats or [
            {"say": "Hello world."}
        ]}
        if viz_panel:
            spec["viz_panel"] = viz_panel
        return spec

    def test_emits_l_act_wrapper(self):
        result = emit_act(self._act())
        assert "L.act(" in result
        assert "function(A)" in result
        assert result.strip().endswith("});")

    def test_title_in_output(self):
        result = emit_act(self._act(title="Test Title"))
        assert "Test Title" in result

    def test_no_viz_panel_no_vizpanel_call(self):
        result = emit_act(self._act(viz_panel=None))
        assert "A.vizPanel(" not in result

    def test_viz_panel_emits_call(self):
        result = emit_act(self._act(viz_panel="svg"))
        assert 'A.vizPanel("svg")' in result

    def test_single_beat(self):
        result = emit_act(self._act())
        assert result.count("A.say(") == 1

    def test_multiple_beats(self):
        beats = [{"say": f"Beat {i}."} for i in range(3)]
        result = emit_act(self._act(beats=beats))
        assert result.count("A.say(") == 3

    def test_indent_zero(self):
        result = emit_act(self._act(), indent=0)
        assert result.startswith("L.act(")

    def test_indent_nonzero(self):
        result = emit_act(self._act(), indent=4)
        assert result.startswith("    L.act(")


# ─────────────────────────────────────────────────────────────────────
# emit_gate
# ─────────────────────────────────────────────────────────────────────

class TestEmitGate:
    """
    Testing strategy
    ----------------
    Partition on gate_type:
      - "quiz"          → L.ask(...)
      - "fill-in"       → L.askFillIn(...)
      - "proof-builder" → L.askProof(...)
      - "interactive"   → L.ask(...)

    Partition on wrong_path:
      - wrong_path_acts absent/empty (boundary) → no wrongPath function
      - wrong_path_acts present but branch_act_specs is None → no wrongPath function
      - wrong_path_acts present, branch_act_specs has matching act → wrongPath emitted
      - wrong_path_acts present, branch_act_specs does NOT have matching act → wrongPath empty

    Partition on indent: 0 (boundary), non-zero
    """

    def _quiz(self, **kwargs):
        spec = {
            "gate_id": "gate_1",
            "gate_type": "quiz",
            "after_act": "act_1",
            "question": "What is 2+2?",
            "options": ["3", "4", "5", "6"],
            "correct": 1,
            "explanations": {"correct": "Yes, 4.", "0": "Too small."},
        }
        spec.update(kwargs)
        return spec

    def _fill_in(self, **kwargs):
        spec = {
            "gate_id": "gate_2",
            "gate_type": "fill-in",
            "after_act": "act_1",
            "prompt": "The answer is [___].",
            "blank": {"answer": ["42"], "width": "60px"},
            "hint": "Think harder.",
        }
        spec.update(kwargs)
        return spec

    def _branch_act(self, act_id="act_branch_1"):
        return {
            "act_id": act_id,
            "title": "Review",
            "beats": [{"say": "Let's review."}],
        }

    def test_quiz_emits_ask(self):
        result = emit_gate(self._quiz())
        assert "L.ask(" in result

    def test_quiz_has_question_options_correct(self):
        result = emit_gate(self._quiz())
        assert "question" in result
        assert "options" in result
        assert "correct" in result

    def test_fill_in_emits_askfillin(self):
        result = emit_gate(self._fill_in())
        assert "L.askFillIn(" in result

    def test_fill_in_has_prompt_and_blank(self):
        result = emit_gate(self._fill_in())
        assert "prompt" in result
        assert "blank" in result

    def test_fill_in_hint_included_when_present(self):
        result = emit_gate(self._fill_in(hint="Think harder."))
        assert "hint" in result

    def test_proof_builder_emits_askproof(self):
        spec = {
            "gate_id": "gate_3",
            "gate_type": "proof-builder",
            "after_act": "act_1",
            "instruction": "Order these steps.",
            "availablePieces": [{"id": "p1", "latex": "a^2"}],
            "correctOrder": ["p1"],
            "slots": 1,
        }
        result = emit_gate(spec)
        assert "L.askProof(" in result

    def test_interactive_emits_ask_with_type_field(self):
        spec = {
            "gate_id": "gate_4",
            "gate_type": "interactive",
            "after_act": "act_1",
            "title": "Explore",
            "slider": {"min": 1, "max": 10, "step": 1, "default": 5},
            "displays": [{"field": "val", "label": "Value"}],
        }
        result = emit_gate(spec)
        assert "L.ask(" in result
        assert '"interactive"' in result

    def test_no_wrong_path_acts(self):
        """Boundary: empty wrong_path_acts → no wrongPath function."""
        result = emit_gate(self._quiz(wrong_path_acts=[]))
        assert "wrongPath" not in result

    def test_wrong_path_acts_but_no_branch_specs(self):
        """wrong_path_acts set but branch_act_specs is None → no wrongPath."""
        result = emit_gate(self._quiz(wrong_path_acts=["act_branch_1"]), branch_act_specs=None)
        assert "wrongPath" not in result

    def test_wrong_path_acts_with_matching_branch(self):
        """wrong_path_acts + matching branch_act_specs → wrongPath emitted."""
        branch = {"act_branch_1": self._branch_act("act_branch_1")}
        result = emit_gate(
            self._quiz(wrong_path_acts=["act_branch_1"]),
            branch_act_specs=branch
        )
        assert "wrongPath" in result
        assert "B.act(" in result

    def test_wrong_path_uses_b_not_l(self):
        """Branch acts inside wrongPath must use B.act(), not L.act()."""
        branch = {"act_branch_1": self._branch_act("act_branch_1")}
        result = emit_gate(
            self._quiz(wrong_path_acts=["act_branch_1"]),
            branch_act_specs=branch
        )
        # Count occurrences: only B.act() inside wrongPath, not L.act()
        assert "B.act(" in result
        # L.ask() wrapper is still L — but NOT L.act()
        assert "L.act(" not in result

    def test_wrong_path_act_missing_from_branch_specs(self):
        """act ID referenced but not in branch_act_specs → wrongPath body is empty."""
        branch = {}  # no matching act
        result = emit_gate(
            self._quiz(wrong_path_acts=["act_branch_1"]),
            branch_act_specs=branch
        )
        # has_wrong_path = bool(wrong_acts) and branch_act_specs
        # branch_act_specs is {} which is falsy → no wrongPath at all
        assert "wrongPath" not in result

    def test_indent_zero(self):
        result = emit_gate(self._quiz(), indent=0)
        assert result.startswith("L.ask(")

    def test_indent_nonzero(self):
        result = emit_gate(self._quiz(), indent=4)
        assert result.startswith("    L.ask(")

    def test_ends_with_semicolon(self):
        result = emit_gate(self._quiz())
        assert result.strip().endswith(");")


# ─────────────────────────────────────────────────────────────────────
# emit_marker
# ─────────────────────────────────────────────────────────────────────

class TestEmitMarker:
    """
    Testing strategy
    ----------------
    Partition on label: non-empty str, empty str (boundary)
    Partition on indent: 0 (boundary), non-zero
    """

    def test_basic_marker(self):
        result = emit_marker("Section 1")
        assert result == 'L.marker("Section 1");'

    def test_empty_label(self):
        """Boundary: empty label → L.marker(""); still valid JS."""
        result = emit_marker("")
        assert result == 'L.marker("");'

    def test_indent_zero(self):
        result = emit_marker("X", indent=0)
        assert result.startswith("L.marker(")

    def test_indent_nonzero(self):
        result = emit_marker("X", indent=4)
        assert result.startswith("    L.marker(")

    def test_label_with_special_chars(self):
        result = emit_marker('Say "hi"')
        assert '\\"hi\\"' in result


# ─────────────────────────────────────────────────────────────────────
# assemble_content
# ─────────────────────────────────────────────────────────────────────

class TestAssembleContent:
    """
    Testing strategy
    ----------------
    Partition on plan nodes:
      - acts only
      - acts + gates (gate spec present)
      - acts + gates (gate spec MISSING → WARNING comment)
      - markers

    Partition on viz_spec: None, dict with "config"

    Boundary: single act, no gates
    """

    def _minimal_plan(self, nodes=None):
        return {
            "meta": {"title": "Test Lesson", "source": "Testing"},
            "problem": {"text": "Find x."},
            "nodes": nodes or [
                {"type": "act", "id": "act_1", "title": "Act One"}
            ]
        }

    def _act_spec(self, act_id="act_1", title="Act One"):
        return {
            "act_id": act_id,
            "title": title,
            "beats": [{"say": "Hello."}],
        }

    def _quiz_gate_spec(self, gate_id="gate_1", after_act="act_1"):
        return {
            "gate_id": gate_id,
            "gate_type": "quiz",
            "after_act": after_act,
            "question": "What?",
            "options": ["A", "B"],
            "correct": 0,
            "explanations": {},
        }

    def test_wraps_in_mx_lesson(self):
        result = assemble_content(self._minimal_plan(), {"act_1": self._act_spec()}, {}, None)
        assert result.startswith("MX.lesson(")
        assert result.strip().endswith("});")

    def test_includes_title_and_source(self):
        result = assemble_content(self._minimal_plan(), {"act_1": self._act_spec()}, {}, None)
        assert "Test Lesson" in result
        assert "Testing" in result

    def test_includes_problem_text(self):
        result = assemble_content(self._minimal_plan(), {"act_1": self._act_spec()}, {}, None)
        assert "Find x." in result

    def test_problem_highlight_included(self):
        plan = self._minimal_plan()
        plan["problem"]["highlight"] = "x"
        result = assemble_content(plan, {"act_1": self._act_spec()}, {}, None)
        assert "highlight" in result

    def test_act_emitted(self):
        result = assemble_content(self._minimal_plan(), {"act_1": self._act_spec()}, {}, None)
        assert "L.act(" in result

    def test_missing_act_spec_emits_warning_comment(self):
        """act in plan nodes but no entry in act_specs → JS comment."""
        result = assemble_content(self._minimal_plan(), {}, {}, None)
        assert "WARNING" in result
        assert "act_1" in result

    def test_gate_emitted_when_spec_present(self):
        plan = self._minimal_plan(nodes=[
            {"type": "act", "id": "act_1", "title": "Act One"},
            {"type": "gate", "id": "gate_1"},
        ])
        gate_specs = {"gate_1": self._quiz_gate_spec()}
        result = assemble_content(plan, {"act_1": self._act_spec()}, gate_specs, None)
        assert "L.ask(" in result

    def test_missing_gate_spec_raises_assembly_error(self):
        """gate in plan nodes but no entry in gate_specs → fail fast, not warn."""
        import pytest
        from assembler import AssemblyError
        plan = self._minimal_plan(nodes=[
            {"type": "act", "id": "act_1", "title": "Act One"},
            {"type": "gate", "id": "gate_1"},
        ])
        with pytest.raises(AssemblyError, match="gate_1"):
            assemble_content(plan, {"act_1": self._act_spec()}, {}, None)

    def test_marker_emitted(self):
        plan = self._minimal_plan(nodes=[
            {"type": "act", "id": "act_1", "title": "Act One"},
            {"type": "marker", "label": "Phase Two"},
        ])
        result = assemble_content(plan, {"act_1": self._act_spec()}, {}, None)
        assert 'L.marker("Phase Two")' in result

    def test_viz_spec_none_no_viz_call(self):
        result = assemble_content(self._minimal_plan(), {"act_1": self._act_spec()}, {}, None)
        assert "L.viz(" not in result

    def test_viz_spec_with_config_emits_viz_call(self):
        viz = {"mode": "custom_code", "config": {"plugin": "my_viz", "config": {}}, "code": "..."}
        result = assemble_content(self._minimal_plan(), {"act_1": self._act_spec()}, {}, viz)
        assert "L.viz(" in result

    def test_gate_lookup_by_plan_node_id(self):
        """
        Critical: gate spec is keyed by gate_id; plan node["id"] is used to look it up.
        They must match for the gate to be emitted (not a WARNING comment).
        """
        plan = self._minimal_plan(nodes=[
            {"type": "act", "id": "act_1", "title": "Act One"},
            {"type": "gate", "id": "gate_xyz"},  # id = gate_xyz
        ])
        gate_specs = {"gate_xyz": self._quiz_gate_spec(gate_id="gate_xyz")}
        result = assemble_content(plan, {"act_1": self._act_spec()}, gate_specs, None)
        assert "L.ask(" in result
        assert "WARNING" not in result


# ─────────────────────────────────────────────────────────────────────
# assemble_viz
# ─────────────────────────────────────────────────────────────────────

class TestAssembleViz:
    """
    Testing strategy
    ----------------
    Partition on viz_spec["mode"]:
      - "custom_code"    → returns viz_spec["code"]
      - "mobject_plugin" → returns viz_spec["mobject_plugin_code"]
      - "three_js"       → returns viz_spec["three_js_code"]
      - "preset"         → returns None
      - unrecognized     → returns None
    """

    def test_custom_code_returns_code(self):
        spec = {"mode": "custom_code", "code": "window.EXPLAINER_VIZ = {};"}
        assert assemble_viz(spec) == "window.EXPLAINER_VIZ = {};"

    def test_mobject_plugin_returns_plugin_code(self):
        spec = {"mode": "mobject_plugin", "mobject_plugin_code": "var plugin = {};"}
        assert assemble_viz(spec) == "var plugin = {};"

    def test_three_js_returns_three_code(self):
        spec = {"mode": "three_js", "three_js_code": "window.EXPLAINER_VIZ_3D = {};"}
        assert assemble_viz(spec) == "window.EXPLAINER_VIZ_3D = {};"

    def test_preset_returns_none(self):
        spec = {"mode": "preset", "preset": "numberLine"}
        assert assemble_viz(spec) is None

    def test_unknown_mode_returns_none(self):
        spec = {"mode": "something_else"}
        assert assemble_viz(spec) is None
