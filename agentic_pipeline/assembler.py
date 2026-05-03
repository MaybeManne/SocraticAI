"""
Assembler: Converts JSON artifacts (plan, act specs, gate specs, viz spec)
into valid MX.lesson() JavaScript code.

BLIND STAGE: this module is purely deterministic — no LLM calls, no rendered output.
It fails fast via AssemblyError when artifacts violate the assembly contract
(e.g. plan declares a gate but no spec exists).

Contract:
  - Every plan node with type=="gate" MUST have gate_specs[node["id"]] populated.
  - Every plan node with type=="act" MUST have act_specs[node["id"]] populated
    (otherwise a warning comment is emitted — acts degrade gracefully because
    a missing act is visible to the reviewer while a missing gate silently
    breaks the interactive flow).
  - gate_id in gate_specs is the authoritative key used for lookup here; it
    is injected by the orchestrator from the plan and never trusted from LLM.
"""

import json
import re
import textwrap
from pathlib import Path


class AssemblyError(Exception):
    """Raised when the assembler cannot honor its contract with upstream stages."""
    pass


def _js_str(s):
    """
    Escape a Python string for safe embedding in a JavaScript double-quoted string literal.

    @param s: the string to escape; must be a str (not None)
    @returns: a JS string literal including surrounding double quotes, with the
              following substitutions applied in order:
                backslash → \\\\
                double-quote → \\"
                newline (\\n) → the two-character sequence \\n
                carriage-return (\\r) → removed entirely
              Empty string input produces '""'.
    @raises: AttributeError if s is not a str
    """
    s = s.replace("\\", "\\\\")
    s = s.replace('"', '\\"')
    s = s.replace("\n", "\\n")
    s = s.replace("\r", "")
    return f'"{s}"'


def _js_value(v, indent=0):
    """
    Convert a Python value to its JavaScript literal representation.

    @param v: any Python value; supported types are:
                None, bool, int, float, str, list, dict.
              Values of other types are stringified with str().
    @param indent: non-negative int; the current indentation level in spaces,
                   used to align multiline output. Default 0.
    @returns: a string containing a valid JS literal:
                None       → "null"
                True       → "true"
                False      → "false"
                int/float  → str(v)
                str        → _js_str(v)  (double-quoted, escaped)
                []         → "[]"
                non-empty list → inline "[a, b, c]" if total char length < 60,
                                 otherwise multiline with indent+2 padding
                dict       → _js_obj(v, indent)
    @requires: indent >= 0
    """
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, str):
        return _js_str(v)
    if isinstance(v, list):
        if not v:
            return "[]"
        items = [_js_value(item, indent + 2) for item in v]
        if sum(len(i) for i in items) < 60:
            return "[" + ", ".join(items) + "]"
        pad = " " * (indent + 2)
        inner = (",\n" + pad).join(items)
        return "[\n" + pad + inner + "\n" + " " * indent + "]"
    if isinstance(v, dict):
        return _js_obj(v, indent)
    return str(v)


def _js_obj(obj, indent=0):
    """
    Convert a Python dict to a JavaScript object literal string.

    @param obj: a dict mapping string keys to any values supported by _js_value.
                Keys that are valid JS identifiers (match /^[a-zA-Z_$][a-zA-Z0-9_$]*$/)
                are emitted unquoted; all other keys are double-quoted via _js_str.
    @param indent: non-negative int; current indentation level in spaces. Default 0.
    @returns: a string containing a valid JS object literal:
                {}               → "{}"
                short entries    → "{ k: v, k2: v2 }" (inline, total pairs < 80 chars)
                long entries     → multiline with indent+2 padding per entry
    @requires: indent >= 0; all keys in obj must be strings
    """
    if not obj:
        return "{}"
    pad = " " * (indent + 2)
    pairs = []
    for k, v in obj.items():
        # Use bare key if it's a valid JS identifier, otherwise quote it
        if re.match(r'^[a-zA-Z_$][a-zA-Z0-9_$]*$', k):
            key_str = k
        else:
            key_str = _js_str(k)
        val_str = _js_value(v, indent + 2)
        pairs.append(f"{key_str}: {val_str}")
    if sum(len(p) for p in pairs) < 80:
        return "{ " + ", ".join(pairs) + " }"
    inner = (",\n" + pad).join(pairs)
    return "{\n" + pad + inner + "\n" + " " * indent + "}"


def _js_fn_body(code_str):
    """
    Wrap a JavaScript code string into a function(k) body for interactive compute fields.

    @param code_str: a string containing JS code (the function body, not including
                     the outer function wrapper)
    @returns: a string of the form 'function(k) {\\n    <code_str>\\n  }'
    @requires: code_str is a str
    """
    return f"function(k) {{\n    {code_str}\n  }}"


def emit_beat(beat, indent=4):
    """
    Emit a single lesson beat as a chained A.say() JavaScript statement.

    @param beat: a dict with the following fields:
                   "say"  (str, required) — narration text
                   "card" (dict|None, optional) — card definition with at least a "type" key.
                          type "text" with only "content" → .show(string)
                          type "latex" with "content"     → .show(string) or .show({...})
                          type "title" with "heading"     → .title(heading, subheading?)
                          any other type                  → .card(type, {...})
                   "viz_panel_override" (str|None, optional) — inserts .vizPanel(...) call
                   "viz_actions" (list[dict], optional) — each dict has:
                          "method" (str), "params" (dict, optional), "offset" (str|num, optional)
                   "inline_viz" (str|bool|None, optional) — if truthy, appends .inline(...)
                   "duration" (num|None, optional) — if set, appends .duration(n)
    @param indent: non-negative int; spaces of leading indentation. Default 4.
    @returns: a single JavaScript statement string (ending with semicolon) representing
              the full A.say() chain for this beat, indented by `indent` spaces.
    @requires: beat["say"] exists and is a str; indent >= 0
    """
    pad = " " * indent
    chain_pad = " " * (indent + 1)

    say_text = beat["say"]
    lines = [f'{pad}A.say({_js_str(say_text)})']

    # .vizPanel() override (must come before other chained calls for readability)
    if beat.get("viz_panel_override"):
        lines.append(f'{chain_pad}.vizPanel({_js_str(beat["viz_panel_override"])})')

    # .show() / .title() / .card()
    card = beat.get("card")
    if card:
        card_type = card.get("type")
        if card_type == "text" and "content" in card and len(card) <= 2:
            # Simple text card -> .show(string)
            lines.append(f'{chain_pad}.show({_js_str(card["content"])})')
        elif card_type == "latex" and "content" in card:
            card_data = {k: v for k, v in card.items() if k != "type"}
            content = card_data.pop("content")
            if card_data:
                lines.append(f'{chain_pad}.show({_js_obj({"type": "latex", "content": content, **card_data}, indent + 3)})')
            else:
                lines.append(f'{chain_pad}.show({_js_str(content)})')
        elif card_type == "title":
            heading = card.get("heading", "")
            subheading = card.get("subheading", "")
            if subheading:
                lines.append(f'{chain_pad}.title({_js_str(heading)}, {_js_str(subheading)})')
            else:
                lines.append(f'{chain_pad}.title({_js_str(heading)})')
        else:
            # General card: .card(type, {...})
            card_data = {k: v for k, v in card.items() if k != "type"}
            lines.append(f'{chain_pad}.card({_js_str(card_type)}, {_js_obj(card_data, indent + 3)})')

    # .do() calls
    for va in beat.get("viz_actions", []):
        method = va["method"]
        params = va.get("params", {})
        offset = va.get("offset", 0)

        args = [_js_str(method)]
        if params or offset:
            args.append(_js_obj(params, indent + 3) if params else "{}")
        if offset and offset != 0:
            args.append(_js_str(str(offset)) if isinstance(offset, str) else str(offset))

        lines.append(f'{chain_pad}.do({", ".join(args)})')

    # .inline()
    inline = beat.get("inline_viz")
    if inline:
        if isinstance(inline, str):
            lines.append(f'{chain_pad}.inline({_js_str(inline)})')
        else:
            lines.append(f'{chain_pad}.inline()')

    # .duration()
    if beat.get("duration"):
        lines.append(f'{chain_pad}.duration({beat["duration"]})')

    # Join with continuation (the DSL uses chaining)
    return "\n".join(lines) + ";"


def emit_act(act_spec, indent=0):
    """
    Emit an L.act() block from an ActSpec dict.

    @param act_spec: a dict with the following fields:
                       "title"     (str, required) — act title passed to L.act()
                       "beats"     (list[dict], required) — non-empty list of beat dicts;
                                   each beat is passed to emit_beat()
                       "viz_panel" (str|None, optional) — if present and non-empty,
                                   emits A.vizPanel(...) as the first statement
    @param indent: non-negative int; leading indentation in spaces. Default 0.
    @returns: a string containing a complete L.act(..., function(A) { ... }); block,
              with each beat emitted by emit_beat() and separated by blank lines.
    @requires: act_spec["title"] is a str; act_spec["beats"] is a non-empty list;
               indent >= 0
    """
    pad = " " * indent
    lines = []
    lines.append(f'{pad}L.act({_js_str(act_spec["title"])}, function(A) {{')

    if act_spec.get("viz_panel"):
        lines.append(f'{pad}  A.vizPanel({_js_str(act_spec["viz_panel"])});')
        lines.append("")

    for beat in act_spec["beats"]:
        lines.append(emit_beat(beat, indent + 2))
        lines.append("")

    lines.append(f'{pad}}});')
    return "\n".join(lines)


def emit_gate(gate_spec, branch_act_specs=None, indent=0):
    """
    Emit an L.ask() / L.askFillIn() / L.askProof() call from a GateSpec dict.

    DSL method dispatch by gate_type:
        "quiz"          → L.ask({ question, options, correct, explain })
        "fill-in"       → L.askFillIn({ prompt, blank, hint?, successMessage? })
        "proof-builder" → L.askProof({ instruction?, availablePieces?, correctOrder?, slots? })
        "interactive"   → L.ask({ type:"interactive", title?, slider?, displays?, challenge? })

    @param gate_spec: a dict with at minimum:
                        "gate_type" (str, required) — one of the four types above
                        type-specific required fields (see gate_worker.md)
                        "wrong_path_acts" (list[str], optional) — act IDs of branch acts
    @param branch_act_specs: dict mapping act_id (str) → act_spec dict, or None.
                             Only act IDs present in this dict are included in wrongPath.
                             If None or empty, no wrongPath is emitted even if
                             wrong_path_acts is non-empty.
    @param indent: non-negative int; leading indentation in spaces. Default 0.
    @returns: a string containing a complete L.<method>({...}); call.
              If wrong_path_acts is non-empty AND branch_act_specs provides at least
              one matching act, a wrongPath: function(B) { B.act(...) } property is
              included inside the options object.
    @requires: gate_spec["gate_type"] is one of the four recognized strings;
               indent >= 0
    """
    pad = " " * indent
    gt = gate_spec["gate_type"]

    # Build the options object
    opts = {}

    if gt == "quiz":
        opts["question"] = gate_spec["question"]
        opts["options"] = gate_spec["options"]
        opts["correct"] = gate_spec["correct"]
        opts["explain"] = gate_spec.get("explanations", {})
    elif gt == "fill-in":
        if gate_spec.get("label"):
            opts["label"] = gate_spec["label"]
        opts["prompt"] = gate_spec["prompt"]
        opts["blank"] = gate_spec["blank"]
        if gate_spec.get("hint"):
            opts["hint"] = gate_spec["hint"]
        if gate_spec.get("successMessage"):
            opts["successMessage"] = gate_spec["successMessage"]
    elif gt == "proof-builder":
        if gate_spec.get("label"):
            opts["label"] = gate_spec["label"]
        if gate_spec.get("instruction"):
            opts["instruction"] = gate_spec["instruction"]
        if gate_spec.get("availablePieces"):
            opts["availablePieces"] = gate_spec["availablePieces"]
        if gate_spec.get("correctOrder"):
            opts["correctOrder"] = gate_spec["correctOrder"]
        if gate_spec.get("slots"):
            opts["slots"] = gate_spec["slots"]
    elif gt == "interactive":
        opts["type"] = "interactive"
        if gate_spec.get("label"):
            opts["label"] = gate_spec["label"]
        if gate_spec.get("title"):
            opts["title"] = gate_spec["title"]
        if gate_spec.get("slider"):
            opts["slider"] = gate_spec["slider"]
        if gate_spec.get("displays"):
            opts["displays"] = gate_spec["displays"]
        if gate_spec.get("challenge"):
            opts["challenge"] = gate_spec["challenge"]

    # Determine the DSL method
    method_map = {
        "quiz": "ask",
        "fill-in": "askFillIn",
        "proof-builder": "askProof",
        "interactive": "ask"
    }
    method = method_map[gt]

    # Check for wrong path
    wrong_acts = gate_spec.get("wrong_path_acts", [])
    has_wrong_path = bool(wrong_acts) and branch_act_specs

    if not has_wrong_path:
        return f'{pad}L.{method}({_js_obj(opts, indent + 2)});'

    # With wrong path: need to emit wrongPath: function(B) { B.act(...) }
    lines = [f'{pad}L.{method}({{']
    inner_pad = pad + "  "

    # Emit all opts fields
    for k, v in opts.items():
        lines.append(f'{inner_pad}{k}: {_js_value(v, len(inner_pad))},')

    # Emit wrongPath function
    lines.append(f'{inner_pad}wrongPath: function(B) {{')
    for act_id in wrong_acts:
        if act_id in branch_act_specs:
            branch_act = branch_act_specs[act_id]
            # Emit using B instead of L
            act_js = emit_act(branch_act, indent=len(inner_pad) + 2)
            act_js = act_js.replace("L.act(", "B.act(", 1)
            lines.append(act_js)
    lines.append(f'{inner_pad}}}')

    lines.append(f'{pad}}});')
    return "\n".join(lines)


def emit_marker(label, indent=0):
    """
    Emit an L.marker() call.

    @param label: str — the marker label text
    @param indent: non-negative int; leading indentation in spaces. Default 0.
    @returns: a string of the form '<indent>L.marker("label");'
    @requires: label is a str; indent >= 0
    """
    pad = " " * indent
    return f'{pad}L.marker({_js_str(label)});'


def assemble_content(plan, act_specs, gate_specs, viz_spec):
    """
    Assemble the full MX.lesson() JavaScript content file from pipeline artifacts.

    Iterates plan["nodes"] in order and emits:
        act nodes   → emit_act() if act_id is in act_specs,
                       otherwise a JS comment warning of the missing spec
        gate nodes  → emit_gate() if gate_id is in gate_specs,
                       otherwise a JS comment warning of the missing spec
        marker nodes → emit_marker()

    Branch acts referenced by gate wrong_path_acts are collected from act_specs
    and passed to emit_gate() so they appear inside wrongPath functions.

    @param plan: dict — parsed lesson_plan.json; must contain:
                   "meta"    with "title" (str) and "source" (str)
                   "problem" with "text" (str) and optional "highlight" (str)
                   "nodes"   (list[dict]) — ordered list of act/gate/marker node dicts
    @param act_specs: dict mapping act_id (str) → act_spec dict.
                      May be empty or missing entries; missing entries produce
                      a JS comment rather than raising an error.
    @param gate_specs: dict mapping gate_id (str) → gate_spec dict.
                       Same missing-entry behavior as act_specs.
    @param viz_spec: dict|None — parsed viz_spec.json. If present and contains
                     "config", emits an L.viz(...) call. May be None.
    @returns: a string containing a complete MX.lesson(..., function(L) { ... });
              JavaScript file ready to be passed to build.sh.
    @requires: plan["meta"]["title"] and plan["meta"]["source"] are strings;
               plan["nodes"] is a list; no mutation of input dicts
    """
    lines = []
    meta = plan["meta"]
    problem = plan["problem"]

    lines.append(f'MX.lesson({_js_str(meta["title"])}, function(L) {{')
    lines.append("")

    # Source and meta
    lines.append(f'L.source({_js_str(meta["source"])});')
    meta_obj = {k: v for k, v in meta.items() if k not in ("title", "source")}
    if meta_obj:
        lines.append(f'L.meta({_js_obj(meta_obj)});')
    lines.append("")

    # Problem
    problem_opts = {}
    if problem.get("highlight"):
        problem_opts["highlight"] = problem["highlight"]
    if problem_opts:
        lines.append(f'L.problem({_js_str(problem["text"])}, {_js_obj(problem_opts)});')
    else:
        lines.append(f'L.problem({_js_str(problem["text"])});')
    lines.append("")

    # Viz config
    if viz_spec:
        viz_config = viz_spec.get("config")
        if viz_config:
            lines.append(f'L.viz({_js_obj(viz_config)});')
            lines.append("")

    # Nodes
    # Collect branch act specs from gate wrong paths
    branch_act_specs = {}
    for gid, gspec in gate_specs.items():
        for act_id in gspec.get("wrong_path_acts", []):
            if act_id in act_specs:
                branch_act_specs[act_id] = act_specs[act_id]

    # Track which acts are emitted from the main node sequence
    # so we know which are branch-only
    for node in plan["nodes"]:
        ntype = node["type"]

        if ntype == "act":
            act_id = node["id"]
            if act_id in act_specs:
                lines.append("")
                lines.append(emit_act(act_specs[act_id], indent=0))
                lines.append("")
            else:
                lines.append(f'// WARNING: No act spec found for {act_id}')

        elif ntype == "gate":
            gate_id = node["id"]
            if gate_id not in gate_specs:
                raise AssemblyError(
                    f"Gate '{gate_id}' declared in plan but no spec in gate_specs. "
                    f"Available gate IDs: {sorted(gate_specs.keys())}. "
                    f"Gate worker stage likely failed silently."
                )
            lines.append("")
            lines.append(emit_gate(gate_specs[gate_id], branch_act_specs, indent=0))
            lines.append("")

        elif ntype == "marker":
            lines.append("")
            lines.append(emit_marker(node["label"]))
            lines.append("")

    lines.append("});")
    return "\n".join(lines)


def _normalize_viz_code(code):
    """Normalize viz code that may have been returned as a single-line JSON string.

    LLMs called via json_object response_format often return the entire plugin
    as one long line with spaces instead of newlines. In that form, any
    // single-line comment consumes everything until end-of-string, breaking
    the whole plugin with a silent parse error.

    Fix: insert real newlines after statement terminators (;) and after block
    openers/closers ({, }) when they appear outside string literals. This
    converts single-line compact JS back to a form where // comments terminate
    at the inserted newline rather than eating the rest of the file.

    Safe for already-multiline code (guard: returns early if newlines present).
    """
    if '\n' in code:
        return code  # already has newlines -- nothing to do

    result = []
    i = 0
    n = len(code)
    in_string = None  # None | '"' | "'" | '`'

    while i < n:
        c = code[i]
        if in_string:
            result.append(c)
            if c == '\\' and i + 1 < n:
                i += 1
                result.append(code[i])
            elif c == in_string:
                in_string = None
        elif c in ('"', "'", '`'):
            in_string = c
            result.append(c)
        elif c == ';':
            result.append(c)
            result.append('\n')  # terminate statement so // comments end here
        elif c == '{':
            result.append(c)
            result.append('\n')
        elif c == '}':
            result.append('\n')
            result.append(c)
        else:
            result.append(c)
        i += 1

    return ''.join(result)
def assemble_viz(viz_spec):
    """
    Extract the visualization plugin JavaScript from a VizSpec dict.

    Maps viz_spec["mode"] to the appropriate code field:
        "custom_code"    → viz_spec["code"]          (raw EXPLAINER_VIZ plugin)
        "mobject_plugin" → viz_spec["mobject_plugin_code"]
        "three_js"       → viz_spec["three_js_code"]  (EXPLAINER_VIZ_3D plugin)
        "preset"         → None  (presets are inlined into the content file via L.viz())
        anything else    → None

    @param viz_spec: dict with at minimum a "mode" key (str). Required subsidiary keys
                     depend on mode (see above).
    @returns: str containing JavaScript code ready to be written to a .js file and
              passed to build.sh, or None if the viz is handled inline (preset mode)
              or the mode is unrecognized.
    @requires: viz_spec["mode"] is a str; if mode is "custom_code" then viz_spec["code"]
               must exist; if "mobject_plugin" then viz_spec["mobject_plugin_code"] must
               exist; if "three_js" then viz_spec["three_js_code"] must exist
    """
    mode = viz_spec["mode"]

    if mode == "custom_code":
        code = viz_spec.get("code") or None
        return _normalize_viz_code(code) if code else None
    elif mode == "mobject_plugin":
        code = viz_spec.get("mobject_plugin_code") or None
        return _normalize_viz_code(code) if code else None
    elif mode == "three_js":
        code = viz_spec.get("three_js_code") or None
        return _normalize_viz_code(code) if code else None
    elif mode == "preset":
        # Presets are inlined into the content file via L.viz()
        return None
    return None


def assemble(plan_path, acts_dir, gates_dir, viz_spec_path, output_dir):
    """
    Full assembly pipeline: load JSONs, validate, emit JS files.

    Args:
        plan_path: path to lesson_plan.json
        acts_dir: directory containing act_*.json files
        gates_dir: directory containing gate_*.json files
        viz_spec_path: path to viz_spec.json
        output_dir: directory to write output JS files

    Returns:
        (content_js_path, viz_js_path_or_none)
    """
    plan_path = Path(plan_path)
    acts_dir = Path(acts_dir)
    gates_dir = Path(gates_dir)
    viz_spec_path = Path(viz_spec_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load plan
    with open(plan_path) as f:
        plan = json.load(f)

    # Load act specs
    act_specs = {}
    for p in sorted(acts_dir.glob("act_*.json")):
        with open(p) as f:
            spec = json.load(f)
        act_specs[spec["act_id"]] = spec

    # Load gate specs
    gate_specs = {}
    for p in sorted(gates_dir.glob("gate_*.json")):
        with open(p) as f:
            spec = json.load(f)
        gate_specs[spec["gate_id"]] = spec

    # Load viz spec
    viz_spec = None
    if viz_spec_path.exists():
        with open(viz_spec_path) as f:
            viz_spec = json.load(f)

    # Assemble content JS
    content_js = assemble_content(plan, act_specs, gate_specs, viz_spec)
    lesson_id = plan["meta"].get("title", "lesson").lower()
    lesson_id = re.sub(r'[^a-z0-9]+', '_', lesson_id).strip('_')

    content_path = output_dir / f"{lesson_id}.js"
    with open(content_path, "w") as f:
        f.write(content_js)
    print(f"Content: {content_path} ({len(content_js)} bytes)")

    # Assemble viz JS (if custom)
    viz_js = assemble_viz(viz_spec) if viz_spec else None
    viz_path = None
    if viz_js:
        viz_path = output_dir / f"viz_{lesson_id}.js"
        with open(viz_path, "w") as f:
            f.write(viz_js)
        print(f"Viz:     {viz_path} ({len(viz_js)} bytes)")

    return str(content_path), str(viz_path) if viz_path else None


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Assemble lesson JSON artifacts into MX.lesson() JS")
    parser.add_argument("--plan", required=True, help="Path to lesson_plan.json")
    parser.add_argument("--acts", required=True, help="Directory with act_*.json files")
    parser.add_argument("--gates", required=True, help="Directory with gate_*.json files")
    parser.add_argument("--viz", required=True, help="Path to viz_spec.json")
    parser.add_argument("--output", required=True, help="Output directory for JS files")
    args = parser.parse_args()

    content_path, viz_path = assemble(args.plan, args.acts, args.gates, args.viz, args.output)
    print(f"\nAssembly complete.")
    if viz_path:
        print(f"  Content: {content_path}")
        print(f"  Viz:     {viz_path}")
    else:
        print(f"  Content: {content_path}")
