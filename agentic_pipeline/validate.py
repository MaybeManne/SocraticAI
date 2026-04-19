"""
Validation utilities for the lesson authoring pipeline.

Validates JSON artifacts against schemas and cross-checks references.
Uses jsonschema if available, falls back to structural checks.
"""

import json
from pathlib import Path

SCHEMA_DIR = Path(__file__).parent / "schemas"


def _load_schema(name):
    with open(SCHEMA_DIR / f"{name}.json") as f:
        return json.load(f)


def _try_jsonschema(data, schema):
    """Attempt jsonschema validation. Returns errors list or None if unavailable."""
    try:
        import jsonschema
        v = jsonschema.Draft202012Validator(schema)
        return [e.message for e in v.iter_errors(data)]
    except ImportError:
        return None


def validate_plan(plan):
    """
    Validate a lesson plan dict against structural requirements.

    Checks (in order):
      1. JSON schema validation if jsonschema is installed.
      2. Presence of "meta" with "title".
      3. Presence of "problem" with "text".
      4. Presence of "nodes" list.
      5. Uniqueness of node IDs (including branch act IDs).
      6. All gate "after_act" values reference a known act ID.
      7. All marker "after_act" values (if set) reference a known act ID.

    @param plan: dict — the lesson plan to validate
    @returns: list[str] — error messages; empty list means the plan is valid.
              Returns on first schema error batch rather than accumulating with
              structural errors, to avoid redundant reporting.
    @effects: no mutation of plan
    """
    errors = []

    schema = _load_schema("lesson_plan")
    schema_errors = _try_jsonschema(plan, schema)
    if schema_errors is not None:
        errors.extend(schema_errors)
        if errors:
            return errors

    # Structural checks
    if "meta" not in plan:
        errors.append("Missing 'meta' field")
    elif "title" not in plan.get("meta", {}):
        errors.append("Missing 'meta.title'")

    if "problem" not in plan:
        errors.append("Missing 'problem' field")
    elif "text" not in plan.get("problem", {}):
        errors.append("Missing 'problem.text'")

    if "nodes" not in plan:
        errors.append("Missing 'nodes' field")
        return errors

    # Check node IDs are unique
    ids = set()
    act_ids = set()
    for node in plan["nodes"]:
        nid = node.get("id")
        ntype = node.get("type")
        if nid:
            if nid in ids:
                errors.append(f"Duplicate node ID: {nid}")
            ids.add(nid)
        if ntype == "act":
            act_ids.add(nid)
            # Collect branch act IDs too
            for wp in node.get("wrong_path_acts", []):
                if isinstance(wp, dict):
                    act_ids.add(wp.get("id"))

    # Check gate after_act references
    for node in plan["nodes"]:
        if node.get("type") == "gate":
            after = node.get("after_act")
            if after and after not in act_ids:
                errors.append(f"Gate {node.get('id')} references non-existent act: {after}")

    # Check marker after_act references
    for node in plan["nodes"]:
        if node.get("type") == "marker":
            after = node.get("after_act")
            if after and after not in act_ids:
                errors.append(f"Marker '{node.get('label')}' references non-existent act: {after}")

    return errors


def validate_act_spec(act_spec, plan=None, plan_node=None):
    """
    Validate an act spec dict against structural and cross-reference requirements.

    Checks:
      1. JSON schema validation if jsonschema is installed.
      2. Presence of "act_id".
      3. Presence and non-emptiness of "beats".
      4. Each beat has a "say" field.
      5. If plan is provided and plan["viz_requirements"]["actions"] is non-empty,
         every viz_action method in every beat must appear in the plan's declared
         action set.

    @param act_spec: dict — the act spec to validate
    @param plan: dict|None — the lesson plan, used for viz action cross-checking.
                 If None, cross-checking is skipped.
    @returns: list[str] — error messages; empty list means the spec is valid.
    @effects: no mutation of act_spec or plan
    """
    errors = []

    schema = _load_schema("act_spec")
    schema_errors = _try_jsonschema(act_spec, schema)
    if schema_errors is not None:
        errors.extend(schema_errors)
        if errors:
            return errors

    if "act_id" not in act_spec:
        errors.append("Missing 'act_id'")
    if "beats" not in act_spec:
        errors.append("Missing 'beats'")
        return errors
    if not act_spec["beats"]:
        errors.append("Act has no beats")

    for i, beat in enumerate(act_spec["beats"]):
        if "say" not in beat:
            errors.append(f"Beat {i} missing 'say' field")
        elif not isinstance(beat["say"], str) or not beat["say"].strip():
            errors.append(f"Beat {i} 'say' must be non-empty string")

    # Duplicate beat detection — catches the act_worker producing repeated narration.
    seen = {}
    for i, beat in enumerate(act_spec.get("beats", [])):
        say = beat.get("say", "")
        if say and say in seen:
            errors.append(f"Beat {i} has duplicate 'say' text of beat {seen[say]} (act_worker must produce unique narration)")
        else:
            seen[say] = i

    # Cross-check viz actions against plan if available
    if plan and plan.get("viz_requirements", {}).get("actions"):
        known = {a["method"] for a in plan["viz_requirements"]["actions"]}
        for i, beat in enumerate(act_spec.get("beats", [])):
            for va in beat.get("viz_actions", []):
                if va.get("method") and va["method"] not in known:
                    errors.append(f"Beat {i} uses unknown viz action: {va['method']}")

    # Plan-node-specific checks: beat count + per-beat viz_action presence.
    # The planner's beat_outline is the structural source of truth — the act
    # worker must produce one beat per outline entry, no more, no fewer.
    if plan_node is not None:
        outline = plan_node.get("beat_outline", []) or []
        beats = act_spec.get("beats", [])
        if outline and len(beats) != len(outline):
            errors.append(
                f"Beat count mismatch: produced {len(beats)}, plan outline has "
                f"{len(outline)}. Act worker must emit exactly one beat per outline entry."
            )
        # If the outline declares viz_actions for a beat, the spec MUST include them.
        for i, out in enumerate(outline):
            required_methods = out.get("viz_actions") or []
            if not required_methods or i >= len(beats):
                continue
            beat = beats[i]
            got_methods = [va.get("method") for va in beat.get("viz_actions", []) if va.get("method")]
            missing = [m for m in required_methods if m not in got_methods]
            if missing:
                errors.append(
                    f"Beat {i} missing required viz_actions from plan: {missing}. "
                    f"Got: {got_methods or '[]'}."
                )

    return errors


def validate_gate_spec(gate_spec, plan=None):
    """
    Validate a gate spec dict against structural requirements.

    Checks:
      1. JSON schema validation if jsonschema is installed.
      2. Presence of "gate_type".
      3. Presence of "after_act".
      4. Type-specific required fields:
           quiz:    "question", "options", "correct" (correct=0 is valid)
           fill-in: "prompt", "blank"

    NOTE: "gate_id" is intentionally NOT validated here — it is injected by the
    orchestrator from the lesson plan node's "id" field and never comes from the LLM.
    Checking for it here would validate pipeline-injected data, not LLM output.

    @param gate_spec: dict — the gate spec to validate
    @param plan: dict|None — reserved for future cross-reference checks; currently unused.
    @returns: list[str] — error messages; empty list means the spec is valid.
    @effects: no mutation of gate_spec or plan
    """
    errors = []

    schema = _load_schema("gate_spec")
    schema_errors = _try_jsonschema(gate_spec, schema)
    if schema_errors is not None:
        errors.extend(schema_errors)
        if errors:
            return errors

    if "gate_type" not in gate_spec:
        errors.append("Missing 'gate_type'")
    if "after_act" not in gate_spec:
        errors.append("Missing 'after_act'")
    # gate_id is pipeline-injected — never check it here

    gt = gate_spec.get("gate_type")
    if gt == "quiz":
        if not gate_spec.get("question"):
            errors.append("Quiz gate missing 'question'")
        if not gate_spec.get("options"):
            errors.append("Quiz gate missing 'options'")
        if gate_spec.get("correct") is None:
            errors.append("Quiz gate missing 'correct'")
    elif gt == "fill-in":
        prompt = gate_spec.get("prompt")
        if not prompt:
            errors.append("Fill-in gate missing 'prompt'")
        elif "[___]" not in prompt:
            errors.append(
                "Fill-in gate 'prompt' missing [___] blank marker — the engine "
                "splits on [___] to render the input field; without it no input "
                "is drawn and the student cannot answer."
            )
        if not gate_spec.get("blank"):
            errors.append("Fill-in gate missing 'blank'")

    return errors


def validate_viz_spec(viz_spec, plan=None, all_acts=None):
    """
    Validate a viz spec dict against structural and cross-reference requirements.

    Checks:
      1. JSON schema validation if jsonschema is installed.
      2. Presence of "mode".
      3. Mode-specific required fields:
           "custom_code":    "code" must be present and non-empty
           "mobject_plugin": "mobject_plugin_code" must be present and non-empty
           "preset":         "preset" must be present and non-empty
      4. If all_acts is provided and viz_spec["actions_implemented"] is present,
         every viz_action method used in any beat of any act must appear in
         actions_implemented.

    @param viz_spec: dict — the viz spec to validate
    @param plan: dict|None — reserved; currently unused.
    @param all_acts: dict|None — mapping act_id → act_spec dict, used for
                     cross-checking viz action method names. If None, skipped.
    @returns: list[str] — error messages; empty list means the spec is valid.
    @effects: no mutation of viz_spec, plan, or all_acts
    """
    errors = []

    schema = _load_schema("viz_spec")
    schema_errors = _try_jsonschema(viz_spec, schema)
    if schema_errors is not None:
        errors.extend(schema_errors)
        if errors:
            return errors

    mode = viz_spec.get("mode")
    if not mode:
        errors.append("Missing 'mode'")
        return errors

    if mode == "custom_code" and not viz_spec.get("code"):
        errors.append("custom_code mode requires 'code' field")
    if mode == "mobject_plugin" and not viz_spec.get("mobject_plugin_code"):
        errors.append("mobject_plugin mode requires 'mobject_plugin_code' field")
    if mode == "preset" and not viz_spec.get("preset"):
        errors.append("preset mode requires 'preset' field")

    # Cross-check: all viz actions used in acts should be implemented
    if all_acts and viz_spec.get("actions_implemented"):
        implemented = set(viz_spec["actions_implemented"])
        for act_id, act in all_acts.items():
            for beat in act.get("beats", []):
                for va in beat.get("viz_actions", []):
                    method = va.get("method")
                    if method and method not in implemented:
                        errors.append(f"Act {act_id} uses viz action '{method}' not in actions_implemented")

    return errors


def validate_all(plan, act_specs, gate_specs, viz_spec):
    """
    Run all validators on a complete set of pipeline artifacts.

    @param plan: dict — parsed lesson_plan.json
    @param act_specs: dict mapping act_id (str) → act_spec dict
    @param gate_specs: dict mapping gate_id (str) → gate_spec dict
    @param viz_spec: dict|None — parsed viz_spec.json, or None to skip viz validation
    @returns: dict mapping category str → list[str] of error messages.
              Categories are: "plan", "act:<act_id>", "gate:<gate_id>", "viz".
              Only categories with at least one error appear in the returned dict.
              Empty dict means all artifacts are valid.
    @effects: no mutation of any input dict
    """
    results = {}

    plan_errors = validate_plan(plan)
    if plan_errors:
        results["plan"] = plan_errors

    for act_id, spec in act_specs.items():
        errs = validate_act_spec(spec, plan)
        if errs:
            results[f"act:{act_id}"] = errs

    for gate_id, spec in gate_specs.items():
        errs = validate_gate_spec(spec, plan)
        if errs:
            results[f"gate:{gate_id}"] = errs

    if viz_spec:
        errs = validate_viz_spec(viz_spec, plan, act_specs)
        if errs:
            results["viz"] = errs

    return results


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Validate pipeline JSON artifacts")
    parser.add_argument("--plan", help="Path to lesson_plan.json")
    parser.add_argument("--act", action="append", help="Path to an act_spec.json (repeatable)")
    parser.add_argument("--gate", action="append", help="Path to a gate_spec.json (repeatable)")
    parser.add_argument("--viz", help="Path to viz_spec.json")
    args = parser.parse_args()

    plan = None
    if args.plan:
        with open(args.plan) as f:
            plan = json.load(f)
        errors = validate_plan(plan)
        if errors:
            print(f"PLAN errors:")
            for e in errors:
                print(f"  - {e}")
        else:
            print(f"PLAN: OK")

    for path in (args.act or []):
        with open(path) as f:
            spec = json.load(f)
        errors = validate_act_spec(spec, plan)
        label = spec.get("act_id", path)
        if errors:
            print(f"ACT {label} errors:")
            for e in errors:
                print(f"  - {e}")
        else:
            print(f"ACT {label}: OK")

    for path in (args.gate or []):
        with open(path) as f:
            spec = json.load(f)
        errors = validate_gate_spec(spec, plan)
        label = spec.get("gate_id", path)
        if errors:
            print(f"GATE {label} errors:")
            for e in errors:
                print(f"  - {e}")
        else:
            print(f"GATE {label}: OK")

    if args.viz:
        with open(args.viz) as f:
            spec = json.load(f)
        errors = validate_viz_spec(spec, plan)
        if errors:
            print(f"VIZ errors:")
            for e in errors:
                print(f"  - {e}")
        else:
            print(f"VIZ: OK")
