"""
Orchestrator: Drives the 6-stage lesson authoring pipeline.

Stage 1: Solution Planner — produces narrative.md (natural language)        [BLIND]
Stage 2: Structure Agent  — produces lesson_plan.json                       [BLIND]
Stage 3: Act/Gate workers — produces act_*.json and gate_*.json             [BLIND]
Stage 4: Viz agent        — produces viz_spec.json                          [BLIND]
Stage 5: Assembler        — produces content JS + viz JS (deterministic)    [BLIND, no LLM]
Stage 6: Reviewer         — verifies correctness, fixes minor bugs          [SIGHTED if --screenshot]

Agent visibility:
  BLIND agents work only from text/JSON specs. They never see rendered output.
  The SIGHTED reviewer optionally receives a PNG screenshot of the built HTML
  (via --screenshot) so it can catch visual-only bugs (layout, overlap, missing
  animations) that JSON inspection cannot reveal.

Contract between stages (enforced by pipeline_types assertions — illegal states fail
at the stage boundary, not silently downstream):
  - After stage 2: assert_plan_shape(plan)
  - After stage 3a: assert_act_spec_shape(spec, plan_node) per act — catches dup beats
  - After stage 3b: assert_gate_spec_shape(spec, plan_node) per gate — gate_id MUST
    equal plan_node["id"] (the authoritative key the assembler looks up). Injection
    at line ~589 makes this structurally impossible to violate.
  - After stage 4: assert_viz_implements_plan_actions(viz, plan) — catches silent drops.

Usage:
    python orchestrator.py --problem problem.md --output dist/lesson.html
    python orchestrator.py --narrative work/narrative.md --output dist/lesson.html  # skip stage 1
    python orchestrator.py --plan existing_plan.json --output dist/lesson.html      # skip stages 1-2
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from assembler import assemble_content, assemble_viz, AssemblyError
from validate import validate_plan, validate_act_spec, validate_gate_spec, validate_viz_spec
# types.py is imported for runtime structural assertions at stage boundaries.
# These dataclasses/TypedDicts make illegal states unrepresentable (6.031: fail fast).
from pipeline_types import (
    assert_plan_shape, assert_act_spec_shape, assert_gate_spec_shape, assert_viz_spec_shape,
    assert_viz_implements_plan_actions,
)

try:
    import anthropic
except ImportError:
    anthropic = None

try:
    from google import genai
    from google.genai import types as genai_types
except ImportError:
    genai = None

try:
    import openai
except ImportError:
    openai = None

PIPELINE_DIR = Path(__file__).parent
PROMPTS_DIR = PIPELINE_DIR / "prompts"
CODE2HTML_DIR = PIPELINE_DIR.parent

# ─────────────────────────────────────────────────────────────────────
# LLM provider dispatch
# ─────────────────────────────────────────────────────────────────────

GEMINI_MODELS = {"gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"}
ANTHROPIC_MODELS = {
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
    "claude-opus-4-7",
}


OPENROUTER_PREFIX = "openrouter:"


def _is_openrouter(model):
    """Return True if `model` is routed via OpenRouter (prefix `openrouter:`).

    Use this BEFORE _is_gemini in dispatchers — OpenRouter is its own backend.
    """
    return isinstance(model, str) and model.startswith(OPENROUTER_PREFIX)


def _strip_openrouter(model):
    """Strip the `openrouter:` prefix to recover the underlying provider/model slug."""
    return model[len(OPENROUTER_PREFIX):] if _is_openrouter(model) else model


def _is_gemini(model):
    """Return True if `model` identifies a Gemini model, else False (treated as Anthropic).

    @param model: model id string supplied by the caller / CLI.
    @returns: bool — routes `call_llm` between Gemini and Anthropic backends.
    """
    if _is_openrouter(model):
        return False
    return model.startswith("gemini-") or model in GEMINI_MODELS


def load_prompt(name, override_path=None):
    """Load a system prompt from the prompts directory, or from an explicit path.

    @param name: base prompt name; resolved to PROMPTS_DIR/{name}.md when no override.
    @param override_path: optional path to an alternate prompt file (e.g. a variant
        under prompts/variants/). When given, `name` is ignored and this file is
        loaded instead — used for side-by-side prompt experiments without touching
        the canonical prompt.
    @returns: str — the prompt file contents.
    """
    path = Path(override_path) if override_path else PROMPTS_DIR / f"{name}.md"
    with open(path) as f:
        return f.read()


def call_llm(system_prompt, user_message, output_schema, model="gemini-2.5-flash"):
    """
    Call an LLM with structured JSON output. Dispatches to OpenRouter, Gemini,
    or Anthropic based on the model name.

    Returns parsed JSON dict.
    """
    if _is_openrouter(model):
        return _call_openrouter(system_prompt, user_message, output_schema, model)
    if _is_gemini(model):
        return _call_gemini(system_prompt, user_message, output_schema, model)
    return _call_anthropic(system_prompt, user_message, output_schema, model)


def call_llm_text(system_prompt, user_message, model="gemini-2.5-flash"):
    """
    Call an LLM for plain-text (non-JSON) output. Dispatches to OpenRouter,
    Gemini, or Anthropic based on the model name.

    Returns a string.
    """
    if _is_openrouter(model):
        return _call_openrouter_text(system_prompt, user_message, model)
    if _is_gemini(model):
        return _call_gemini_text(system_prompt, user_message, model)
    return _call_anthropic_text(system_prompt, user_message, model)


def _call_anthropic(system_prompt, user_message, output_schema, model):
    """Call Claude API with structured output via tool_use."""
    if anthropic is None:
        raise RuntimeError("anthropic package not installed. Run: pip install anthropic")

    client = anthropic.Anthropic()
    response = client.messages.create(
        model=model,
        max_tokens=16000,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
        tools=[{
            "name": "output",
            "description": "Return structured output",
            "input_schema": output_schema
        }],
        tool_choice={"type": "tool", "name": "output"}
    )

    for block in response.content:
        if block.type == "tool_use":
            return block.input

    raise ValueError("No structured output returned from Claude API")


def _call_gemini(system_prompt, user_message, output_schema, model):
    """Call Gemini API with structured JSON output."""
    if genai is None:
        raise RuntimeError("google-genai package not installed. Run: pip install google-genai")

    client = genai.Client()

    # Always clean the schema to satisfy Gemini API restrictions
    output_schema = _clean_schema_for_gemini(output_schema)

    # Build the full prompt with system instructions + user message
    # and request JSON output matching the schema
    response = client.models.generate_content(
        model=model,
        contents=user_message,
        config=genai_types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=output_schema,
            temperature=0.7,
            max_output_tokens=65536,
            thinking_config=genai_types.ThinkingConfig(
                thinking_budget=8192,
            ),
        ),
    )

    text = response.text
    if not text:
        raise ValueError("Empty response from Gemini API")

    return json.loads(text)


def _call_anthropic_text(system_prompt, user_message, model):
    """Call Claude API for plain-text output (no tool_use)."""
    if anthropic is None:
        raise RuntimeError("anthropic package not installed. Run: pip install anthropic")

    client = anthropic.Anthropic()
    response = client.messages.create(
        model=model,
        max_tokens=16000,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    for block in response.content:
        if block.type == "text":
            return block.text

    raise ValueError("No text response returned from Claude API")


def _call_gemini_text(system_prompt, user_message, model):
    """Call Gemini API for plain-text output (no JSON schema)."""
    if genai is None:
        raise RuntimeError("google-genai package not installed. Run: pip install google-genai")

    client = genai.Client()

    response = client.models.generate_content(
        model=model,
        contents=user_message,
        config=genai_types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="text/plain",
            temperature=0.7,
            max_output_tokens=65536,
            thinking_config=genai_types.ThinkingConfig(
                thinking_budget=8192,
            ),
        ),
    )

    text = response.text
    if not text:
        raise ValueError("Empty response from Gemini API")

    return text


def _openrouter_client():
    """Construct an OpenAI-compatible client pointed at OpenRouter."""
    if openai is None:
        raise RuntimeError("openai package not installed. Run: pip install openai")
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY not set. Export it before running OpenRouter models."
        )
    return openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        default_headers={
            "HTTP-Referer": "https://github.com/code2html",
            "X-Title": "code2html agentic pipeline",
        },
    )


def _call_openrouter(system_prompt, user_message, output_schema, model):
    """
    Call OpenRouter (any underlying model) with json_object response format and
    the cleaned schema injected into the system prompt.

    Deliberately uses json_object (not json_schema strict) so that the comparison
    measures the model's own schema-following fidelity rather than API-side
    enforcement. This matches the Anthropic tool_use path conceptually: the
    schema is presented to the model as a constraint, not a hard barrier.
    """
    client = _openrouter_client()
    real_model = _strip_openrouter(model)

    cleaned_schema = _clean_schema_for_gemini(output_schema)
    system_with_schema = (
        f"{system_prompt}\n\n"
        f"## Output Format (REQUIRED)\n"
        f"You MUST respond with a single valid JSON object that conforms to this schema. "
        f"No prose, no markdown fences — just the JSON object.\n\n"
        f"```json\n{json.dumps(cleaned_schema, indent=2)}\n```\n"
    )

    # Use smaller output budget for models with limited context windows
    _small_ctx = {"qwen/qwen-2.5-coder-32b-instruct", "mistralai/mistral-small-3.1-24b-instruct"}
    _out_tokens = 8000 if real_model in _small_ctx else 16000

    response = client.chat.completions.create(
        model=real_model,
        messages=[
            {"role": "system", "content": system_with_schema},
            {"role": "user", "content": user_message},
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
        max_tokens=_out_tokens,
    )
    text = response.choices[0].message.content
    if not text:
        raise ValueError(f"Empty response from OpenRouter ({real_model})")
    # Strip markdown fences if present — many providers leak ```json ... ```
    import re as _re
    stripped = text.strip()
    # Handle ```json { ... } ``` or ``` { ... } ``` (multi-line or single-line)
    _fence_match = _re.search(r'```(?:json)?\s*([\s\S]*?)```', stripped)
    if _fence_match:
        stripped = _fence_match.group(1).strip()
    elif stripped.startswith("```"):
        # Fallback: strip opening and closing fence lines
        lines = stripped.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        stripped = "\n".join(lines).strip()
    # If still not parseable JSON, try to find the first { ... } block
    if stripped and stripped[0] != '{':
        _obj_match = _re.search(r'\{[\s\S]*\}', stripped)
        if _obj_match:
            stripped = _obj_match.group(0)
    try:
        return json.loads(stripped)
    except json.JSONDecodeError as e:
        snippet = text[:500].replace("\n", " ")
        raise ValueError(
            f"OpenRouter ({real_model}) returned non-JSON: {e}. "
            f"Payload start: {snippet!r}"
        ) from e


def _call_openrouter_text(system_prompt, user_message, model):
    """Call OpenRouter for plain-text output."""
    client = _openrouter_client()
    real_model = _strip_openrouter(model)

    response = client.chat.completions.create(
        model=real_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=0.7,
        max_tokens=8000,
    )
    text = response.choices[0].message.content
    if not text:
        raise ValueError(f"Empty text response from OpenRouter ({real_model})")
    return text


def _check_js_syntax(code):
    """Run node --check on JS code. Returns list of syntax error strings, empty if clean."""
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
        f.write(code)
        path = f.name
    try:
        result = subprocess.run(
            ["node", "--check", path],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return [result.stderr.strip()]
        return []
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []  # node not available, skip silently
    finally:
        os.unlink(path)


def _check_viz_layout(code, viewbox_w=800, viewbox_h=400):
    """
    Heuristic layout audit of a viz plugin. Catches the MIT-grade polish bugs:
      1. svgEl("text", {x: N, y: M + i*K}) inside a loop with no clearSlot()
         before it — stacked-text overlap.
      2. Explicit x/y coordinates outside viewBox bounds.
      3. Multiple <text> creations with no named zone (Z.X) reference — means
         the agent went freehand instead of using the layout map.
    Returns a list of human-readable warnings (empty = clean).
    """
    import re as _re
    warnings = []
    if not code: return warnings

    # Stacked text pattern: svgEl("text", { ... y: EXPR + i*K ... }) inside
    # a forEach/for-loop with no clearSlot earlier in the same function body.
    stacked = _re.findall(
        r'svgEl\(\s*["\']text["\'][^)]*?y\s*:\s*[^,}]*\bi\s*\*',
        code
    )
    if stacked and "clearSlot" not in code:
        warnings.append(
            "stacked-text risk: found `y: ...i*...` inside svgEl(\"text\", ...) "
            "but no clearSlot() helper — repeated calls will overlap. "
            "Add a slot map + clearSlot() before loops that draw text."
        )

    # Out-of-bounds coordinates. Only flag literals (not arithmetic) to avoid
    # noise from `origin[0] + x * scale` type expressions.
    for m in _re.finditer(r'["\']?([xy])["\']?\s*:\s*["\']?(-?\d{3,5})["\']?', code):
        axis, val = m.group(1), int(m.group(2))
        bound = viewbox_w if axis == "x" else viewbox_h
        if val < -50 or val > bound + 50:
            warnings.append(f"out-of-bounds: {axis}={val} outside viewBox "
                            f"0..{bound}")
            if len(warnings) > 8: break  # don't drown in noise

    # Zone discipline: count text creations vs Z.<NAME> references.
    text_count = len(_re.findall(r'svgEl\(\s*["\']text["\']', code))
    zone_refs  = len(_re.findall(r'\bZ\.[A-Z_]+\b', code))
    if text_count >= 5 and zone_refs == 0:
        warnings.append(
            f"zone discipline: {text_count} text elements created but no "
            f"Z.<ZONE> references — layout is freehand. Define `var Z = {{...}}` "
            f"and place every overlay inside a named zone."
        )

    # (a) Geometry that scales past the viewBox by a wide margin (the v5 bug:
    #     `r: r*20` in a loop up to 64 → radius 1280 in a 500-wide box). Pair each
    #     `<attr>: <ident> * <K>` scale with the largest loop bound and flag when the
    #     product blows well past the box.
    _bound_max = max(viewbox_w, viewbox_h)
    loop_bounds = [int(m) for m in _re.findall(r'<=\s*(\d{2,4})', code)]
    hi_bound = max(loop_bounds) if loop_bounds else 0
    if hi_bound:
        for m in _re.finditer(r'\b(?:r|cx|cy|ca|radius)\s*:\s*[A-Za-z_]\w*\s*\*\s*(\d{1,4})', code):
            scale = int(m.group(1))
            if hi_bound * scale > 2 * _bound_max:
                warnings.append(
                    f"geometry overflow: a radius/coord scales as index*{scale} with a "
                    f"loop up to {hi_bound} → max ~{hi_bound*scale}px, far outside the "
                    f"~{_bound_max}px viewBox. Choose scale = (maxRadius / N) so the "
                    f"largest element fits, or draw only the few indices you animate."
                )
                break

    # (b) timelineAction that CREATES an element and tweens its own opacity toward 0
    #     (the v6 bug: `tl.to(svgEl(...), { ... opacity: 0 ... }, t)`), which hides the
    #     freshly-made element instead of revealing a pre-created one.
    for m in _re.finditer(r'tl\.(?:to|fromTo)\(\s*svgEl\(', code):
        tail = code[m.end(): m.end() + 400]
        if _re.search(r'opacity\s*:\s*0(?!\.\d*[1-9])(?![\.\d])', tail):
            warnings.append(
                "reveal inverted: a timelineAction tween creates an element inline via "
                "svgEl(...) and animates it toward opacity:0 — this hides a brand-new "
                "element every call, so nothing shows. Create elements in init() at "
                "opacity:0 and tween the looked-up element TO opacity:1 here."
            )
            break

    return warnings


# Known LaTeX command names that legitimately appear in on-screen math strings.
# The reviewer LLM often re-emits these with a lone backslash (\pi), which JS
# parses as an invalid escape and silently drops the backslash — so KaTeX then
# renders "pi" as three italic letters instead of the π symbol. We re-double the
# backslash in the JS *source* so the runtime string keeps its single backslash.
_LATEX_CMDS = [
    "pi", "theta", "alpha", "beta", "gamma", "delta", "lambda", "mu", "phi",
    "cdot", "cdots", "times", "div", "pm", "mp", "frac", "sqrt", "sum", "prod",
    "int", "geq", "leq", "neq", "approx", "equiv", "ldots", "dots", "infty",
    "cancel", "left", "right", "quad", "qquad", "text", "mathbb", "mathrm",
    "begin", "end", "cos", "sin", "tan", "log", "ln",
]


def _fix_latex_escapes(js_source):
    """Re-double lone backslashes before known LaTeX commands in JS source text.

    Operates on the JS *source string*: turns a single `\\pi` (which JS would parse
    as invalid-escape → `pi`, losing the backslash and breaking KaTeX) into `\\\\pi`
    (which parses to a real `\\pi` at runtime). Idempotent — already-doubled `\\\\pi`
    is skipped via a negative lookbehind, and non-LaTeX escapes (`\\n`, `\\t`, `\\"`)
    are untouched because they are not in the whitelist.

    @param js_source: assembled/reviewed content JS as a str.
    @returns: the same source with lone LaTeX-command backslashes doubled.
    """
    import re as _re
    out = js_source
    for cmd in _LATEX_CMDS:
        # lone backslash (not preceded by another backslash) + command + word boundary
        out = _re.sub(r'(?<!\\)\\' + cmd + r'\b', r'\\\\' + cmd, out)
    return out


ALLOWED_DSL = {"say","show","do","card","inline","title","duration",
               "vizPanel","marker"}

def _reject_if_invalid_dsl(corrected, original, label="content"):
    """
    Reject a reviewer "correction" that introduces non-existent DSL methods
    (e.g. `.pause()`, `.wait()`) or has syntax errors. Returns `corrected`
    when safe, otherwise returns `original`. Extracted to module scope so
    unit tests can pin the behavior that caused the archer .pause() bug.
    """
    if corrected == original: return corrected
    import re as _re
    bad = set()
    for m in _re.finditer(r'\n\s*\.([a-zA-Z_]\w*)\(', corrected):
        if m.group(1) not in ALLOWED_DSL:
            bad.add(m.group(1))
    if bad:
        print(f"  WARNING: reviewer {label} used invalid DSL methods "
              f"{sorted(bad)} — rejecting correction.")
        return original
    if _check_js_syntax(corrected):
        print(f"  WARNING: reviewer {label} has syntax errors — rejecting.")
        return original
    return corrected


def _retry_with_errors(system_prompt, user_msg, schema, errors, model):
    """Retry a structured LLM call with validation errors injected as feedback."""
    error_lines = "\n".join(f"  - {e}" for e in errors)
    retry_msg = (
        f"{user_msg}\n\n"
        f"## Validation Errors — Please Fix\n\n"
        f"Your previous output had these issues that must be corrected:\n"
        f"{error_lines}\n\n"
        f"Return a corrected version that addresses all of the above."
    )
    return call_llm(system_prompt, retry_msg, schema, model=model)


def _clean_schema_for_gemini(schema):
    """
    Recursively prepare a JSON Schema for the Gemini API, which requires:
    - No additionalProperties
    - No $ref / $defs / oneOf / anyOf / allOf / const
    - type must be a single string (not an array); nullable types use nullable: true
    - No null in enum arrays
    - Only allowed keys: type, properties, required, items, enum, description,
                        format, nullable, minimum, maximum, minItems, maxItems
    """
    if not isinstance(schema, dict):
        return schema

    # Resolve oneOf/anyOf unions instead of silently dropping them. The common
    # pipeline pattern is `oneOf: [null, X]` (e.g. a beat's `card`): take the
    # first non-null branch and mark it nullable. Dropping the union presented
    # Gemini with a bare `{}` — so it emitted `card: {}` for every beat and no
    # lesson ever produced notebook cards (the empty-right-panel bug).
    for union_key in ("oneOf", "anyOf"):
        branches = schema.get(union_key)
        if isinstance(branches, list) and branches:
            non_null = [b for b in branches
                        if not (isinstance(b, dict) and b.get("type") == "null")]
            has_null = len(non_null) < len(branches)
            base = dict(non_null[0]) if non_null else {"type": "string"}
            merged = {k: v for k, v in schema.items() if k not in ("oneOf", "anyOf")}
            merged.update(base)
            cleaned_union = _clean_schema_for_gemini(merged)
            if has_null:
                cleaned_union["nullable"] = True
            return cleaned_union

    allowed = {"type", "properties", "required", "items", "enum", "description",
               "format", "nullable", "minimum", "maximum", "minItems", "maxItems"}

    cleaned = {}

    # Resolve array type like ["string", "null"] → type="string", nullable=true
    raw_type = schema.get("type")
    if isinstance(raw_type, list):
        non_null = [t for t in raw_type if t != "null"]
        has_null = "null" in raw_type
        cleaned["type"] = non_null[0] if non_null else "string"
        if has_null:
            cleaned["nullable"] = True
    elif raw_type:
        cleaned["type"] = raw_type

    for k, v in schema.items():
        if k == "type":
            continue  # already handled above
        if k not in allowed:
            continue
        if k == "properties" and isinstance(v, dict):
            cleaned[k] = {pk: _clean_schema_for_gemini(pv) for pk, pv in v.items()}
        elif k == "items":
            cleaned[k] = _clean_schema_for_gemini(v)
        elif k == "enum":
            # Remove null from enum values; Gemini doesn't allow null in enums
            clean_enum = [e for e in v if e is not None]
            if clean_enum:
                cleaned[k] = clean_enum
            # If all values were null, skip the enum entirely
        else:
            cleaned[k] = v

    # Default to object if type was never set
    if "type" not in cleaned:
        cleaned["type"] = "object"

    # Arrays must have items defined
    if cleaned.get("type") == "array" and "items" not in cleaned:
        cleaned["items"] = {"type": "string"}

    return cleaned


def _schema_for_tool(schema_name):
    """
    Load a JSON schema and prepare it for LLM tool_use / structured output.
    Flattens $defs/$refs and strips Gemini-incompatible keywords recursively.
    """
    path = PIPELINE_DIR / "schemas" / f"{schema_name}.json"
    with open(path) as f:
        schema = json.load(f)

    # Flatten nodes: replace oneOf/$ref items with an inline union schema
    # covering all fields from act_node, gate_node, and marker_node
    if "properties" in schema and "nodes" in schema.get("properties", {}):
        schema["properties"]["nodes"] = {
            "type": "array",
            "description": "Ordered sequence of act, gate, and marker nodes",
            "items": {
                "type": "object",
                "properties": {
                    # common
                    "type": {"type": "string", "enum": ["act", "gate", "marker"],
                             "description": "Node discriminator"},
                    "id":   {"type": "string"},
                    # act fields
                    "title":     {"type": "string"},
                    "objective": {"type": "string"},
                    "context_from_previous": {"type": "string"},
                    "viz_panel": {"type": "string"},
                    "beat_outline": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "narration_hint": {"type": "string"},
                                "card_type":      {"type": "string"},
                                "viz_actions":    {"type": "array", "items": {"type": "string"}},
                                "inline_at_end":  {"type": "boolean"}
                            },
                            "required": ["narration_hint"]
                        }
                    },
                    "wrong_path_acts": {
                        "type": "array",
                        "description": "Branch act nodes (same structure as top-level act nodes)",
                        "items": {"type": "object"}
                    },
                    # gate fields
                    "gate_type":       {"type": "string",
                                        "enum": ["quiz", "fill-in", "proof-builder", "interactive"]},
                    "after_act":       {"type": "string"},
                    "question_hint":   {"type": "string"},
                    "wrong_path_hint": {"type": "string"},
                    # marker field
                    "label": {"type": "string"}
                },
                "required": ["type"]
            }
        }

    return _clean_schema_for_gemini(schema)


# ─────────────────────────────────────────────────────────────────────
# Stage 1: Solution Planner (natural language)
# ─────────────────────────────────────────────────────────────────────

def stage1_solve(problem_text, objectives=None, model="gemini-2.5-flash"):
    """Stage 1: Call the solution planner to produce a natural-language narrative."""
    print("\n=== Stage 1: Solution planning (narrative) ===")

    system_prompt = load_prompt("solution_planner")
    user_msg = f"## Math Problem\n\n{problem_text}\n"
    if objectives:
        user_msg += f"\n## Learning Objectives\n\n{objectives}\n"

    narrative = call_llm_text(system_prompt, user_msg, model=model)
    errors = _validate_narrative(narrative)
    if errors:
        print(f"  WARNING: Narrative has issues, retrying:")
        for e in errors: print(f"    - {e}")
        retry_msg = user_msg + (
            "\n\n## Previous attempt had issues — please fix:\n"
            + "\n".join(f"- {e}" for e in errors)
        )
        narrative = call_llm_text(system_prompt, retry_msg, model=model)
    return narrative


def _validate_narrative(narrative):
    """Basic sanity checks on stage-1 narrative output."""
    errs = []
    if not narrative or len(narrative.strip()) < 200:
        errs.append("narrative is empty or too short (< 200 chars)")
    if narrative and len(narrative) > 20000:
        errs.append(f"narrative is too long ({len(narrative)} chars > 20k)")
    return errs


# ─────────────────────────────────────────────────────────────────────
# Stage 2: Structure Agent (narrative → lesson_plan.json)
# ─────────────────────────────────────────────────────────────────────

def stage2_structure(problem_text, narrative, objectives=None, model="gemini-2.5-flash",
                     planner_prompt_path=None, timing_sink=None):
    """Stage 2: Convert natural-language narrative into structured lesson_plan.json.

    @param planner_prompt_path: optional path to an alternate planner prompt. When
        given, it replaces prompts/planner.md for this run so planner variants can
        be A/B-tested without editing the canonical prompt.
    @param timing_sink: optional dict; if given, populated with
        timing_sink["planner_llm_seconds"] = elapsed wall-clock time of the main
        planner LLM call (excludes retries), for cross-variant comparison.
    """
    print("\n=== Stage 2: Structuring lesson plan ===")

    system_prompt = load_prompt("planner", override_path=planner_prompt_path)

    user_msg = f"## Solution & Pedagogical Narrative\n\n{narrative}\n\n---\n\n"
    user_msg += f"## Math Problem\n\n{problem_text}\n"
    if objectives:
        user_msg += f"\n## Learning Objectives\n\n{objectives}\n"

    schema = _schema_for_tool("lesson_plan")
    _t0 = time.time()
    plan = call_llm(system_prompt, user_msg, schema, model=model)
    _elapsed = time.time() - _t0
    print(f"  [timing] planner LLM call: {_elapsed:.2f}s")
    if timing_sink is not None:
        timing_sink["planner_llm_seconds"] = _elapsed

    errors = validate_plan(plan)
    if errors:
        print(f"  WARNING: Plan has validation errors, retrying:")
        for e in errors:
            print(f"    - {e}")
        plan = _retry_with_errors(system_prompt, user_msg, schema, errors, model)
        errors = validate_plan(plan)
        if errors:
            print(f"  WARNING: Plan still has validation errors after retry:")
            for e in errors:
                print(f"    - {e}")

    # Structural assertion — catches shape violations that escaped validate_plan.
    # Any raise here is a bug in the planner prompt or schema, not a soft issue.
    assert_plan_shape(plan)
    return plan


# ─────────────────────────────────────────────────────────────────────
# Stage 2: Author acts and gates
# ─────────────────────────────────────────────────────────────────────

def _act_context(plan, node, node_index):
    """Build context string for an act worker."""
    viz_actions = plan.get("viz_requirements", {}).get("actions", [])
    actions_ref = "\n".join(
        f"  - {a['method']}({', '.join(a.get('params_schema', {}).keys())}): {a['description']}"
        for a in viz_actions
    )

    # Find next act for forward context
    nodes = plan["nodes"]
    next_act = None
    for j in range(node_index + 1, len(nodes)):
        if nodes[j].get("type") == "act":
            next_act = nodes[j]
            break

    # Build lesson arc with current position marked
    arc_lines = []
    for n in nodes:
        nid = n.get("id", "")
        t = n["type"]
        if t == "act":
            marker = "  ← YOU ARE HERE" if nid == node["id"] else ""
            arc_lines.append(f"  [act]   {nid}: {n['title']}{marker}")
        elif t == "gate":
            arc_lines.append(f"  [gate]  {nid} ({n.get('gate_type', '?')}): {n.get('question_hint', '')[:60]}")
        elif t == "marker":
            arc_lines.append(f"  [—]     {n.get('label', '')}")

    problem_text = plan.get("problem", {}).get("text", "")

    ctx = f"""## Problem Being Taught
{problem_text}

## Lesson Arc (your position marked)
{chr(10).join(arc_lines)}

## Your Act
Title: {node['title']}
ID: {node['id']}
Objective: {node['objective']}
Viz panel: {node.get('viz_panel', 'none')}

## Context from previous acts
{node.get('context_from_previous', 'None')}

## Beat outline (from the planner)
{json.dumps(node['beat_outline'], indent=2)}

## Available viz actions
{actions_ref}
"""
    if next_act:
        ctx += f"\n## What comes next\nTitle: {next_act['title']}\nObjective: {next_act['objective']}\n"

    return ctx


def _normalize_act_spec(spec):
    """Coerce empty/typeless beat `card` objects to null in-place.

    Gemini's restricted schema dialect can't express the card field's
    `oneOf: [null, {type,...}]`, so `_clean_schema_for_gemini` presents it as a
    bare object and Gemini emits `card: {}` for beats with no card. An empty (or
    type-less) card means "no card" — normalize it to None so it passes
    validate_act_spec's original oneOf schema and assembles correctly.

    @param spec: an act_spec dict (mutated in place).
    @returns: the same spec.
    """
    if not isinstance(spec, dict):
        return spec
    for beat in spec.get("beats", []) or []:
        if not isinstance(beat, dict):
            continue
        card = beat.get("card")
        if isinstance(card, dict) and not card.get("type"):
            beat["card"] = None
    return spec


def stage2_author_acts(plan, model="gemini-2.5-flash"):
    """Call worker agents to produce act specs for every act in the plan."""
    print("\n=== Stage 3: Authoring acts ===")

    system_prompt = load_prompt("act_worker")
    schema = _schema_for_tool("act_spec")
    act_specs = {}

    # Collect all act nodes (main path + branch)
    act_nodes = []
    for i, node in enumerate(plan["nodes"]):
        if node["type"] == "act":
            act_nodes.append((node, i))
        elif node["type"] == "gate":
            for wp in node.get("wrong_path_acts", []):
                if isinstance(wp, dict) and wp.get("type") == "act":
                    act_nodes.append((wp, i))

    failures = []
    for node, idx in act_nodes:
        act_id = node["id"]
        print(f"  Authoring: {act_id} ({node['title']})")

        user_msg = _act_context(plan, node, idx)
        try:
            spec = call_llm(system_prompt, user_msg, schema, model=model)
            spec["act_id"] = act_id
            spec["title"] = node["title"]
            _normalize_act_spec(spec)  # empty card:{} -> null (Gemini schema quirk)

            errors = validate_act_spec(spec, plan, plan_node=node)
            if errors:
                print(f"    Retrying: {len(errors)} validation error(s)... ({errors})")
                spec = _retry_with_errors(system_prompt, user_msg, schema, errors, model)
                spec["act_id"] = act_id
                spec["title"] = node["title"]
                _normalize_act_spec(spec)
                errors = validate_act_spec(spec, plan, plan_node=node)
                if errors:
                    failures.append((act_id, f"validation after retry: {errors}"))
                    continue

            # Structural assertion — catches dup beats, beat-count drift, bad IDs.
            assert_act_spec_shape(spec, plan_node=node)
            act_specs[act_id] = spec
        except Exception as e:
            print(f"    ERROR: {act_id} failed: {e}")
            failures.append((act_id, str(e)))

    if failures:
        lines = [f"  - {aid}: {reason}" for aid, reason in failures]
        raise RuntimeError(
            f"stage2_author_acts: {len(failures)}/{len(act_nodes)} act(s) failed:\n"
            + "\n".join(lines)
        )

    return act_specs


def _gate_context(plan, node, act_specs):
    """Build context string for a gate worker."""
    after_act_id = node["after_act"]
    after_act_spec = act_specs.get(after_act_id, {})

    # Find the next act after this gate
    nodes = plan["nodes"]
    gate_idx = next((i for i, n in enumerate(nodes) if n.get("id") == node["id"]), -1)
    next_act = None
    for j in range(gate_idx + 1, len(nodes)):
        if nodes[j].get("type") == "act":
            next_act = nodes[j]
            break

    # Build lesson arc with this gate marked
    arc_lines = []
    for n in nodes:
        nid = n.get("id", "")
        t = n["type"]
        if t == "act":
            arc_lines.append(f"  [act]   {nid}: {n['title']}")
        elif t == "gate":
            marker = "  ← THIS GATE" if nid == node["id"] else ""
            arc_lines.append(f"  [gate]  {nid} ({n.get('gate_type', '?')}){marker}")
        elif t == "marker":
            arc_lines.append(f"  [—]     {n.get('label', '')}")

    # Summarize concepts learned up to and including the preceding act
    prior_concepts = []
    for n in nodes:
        if n.get("type") == "act":
            prior_concepts.append(f"  - {n['title']}: {n.get('objective', '')}")
            if n["id"] == after_act_id:
                break

    problem_text = plan.get("problem", {}).get("text", "")

    ctx = f"""## Problem Being Taught
{problem_text}

## Lesson Arc (this gate marked)
{chr(10).join(arc_lines)}

## Concepts taught so far (up to the preceding act)
{chr(10).join(prior_concepts)}

## Gate to Author
ID: {node['id']}
Type: {node['gate_type']}
After act: {after_act_id}
Question hint: {node.get('question_hint', 'N/A')}
Wrong path hint: {node.get('wrong_path_hint', 'N/A')}

## Preceding act (full spec — the content the student just saw)
{json.dumps(after_act_spec, indent=2) if after_act_spec else 'Not available'}
"""
    if next_act:
        ctx += f"\n## Next act (where student goes if correct)\nTitle: {next_act['title']}\nObjective: {next_act['objective']}\n"
    if node.get("wrong_path_acts"):
        ctx += f"\n## Wrong path act IDs to remediate\n{json.dumps([a.get('id') for a in node['wrong_path_acts'] if isinstance(a, dict)], indent=2)}\n"

    return ctx


def stage2b_author_gates(plan, act_specs, model="gemini-2.5-flash"):
    """Call worker agents to produce gate specs.

    Contract: returns a dict mapping EVERY plan gate node id → GateSpec. If any
    gate fails (LLM error, validation error after retry, structural assertion),
    this function raises RuntimeError at stage end with the full failure list.
    Previously one gate failure silently yielded an empty dict and the assembler
    emitted placeholder warnings — that path is now impossible.
    """
    print("\n=== Stage 3b: Authoring gates ===")

    system_prompt = load_prompt("gate_worker")
    schema = _schema_for_tool("gate_spec")
    gate_specs = {}
    failures = []  # list[(gate_id, reason)]

    gate_nodes = [n for n in plan["nodes"] if n["type"] == "gate"]
    print(f"  Plan declares {len(gate_nodes)} gate(s): {[n['id'] for n in gate_nodes]}")

    for node in gate_nodes:
        gate_id = node["id"]
        print(f"  Authoring: {gate_id}")
        user_msg = _gate_context(plan, node, act_specs)

        def _inject(spec):
            """Overwrite plan-authoritative fields on a gate_spec.

            @param spec: mutable gate_spec dict produced by the gate worker.
            @effects: forces gate_id, after_act, gate_type, wrong_path_acts to match the
                plan (LLM values for these fields are discarded — the plan is the source
                of truth for graph topology).
            @returns: the same `spec` (mutated in place) for caller convenience.
            """
            # Authoritative fields overwritten from plan — LLM output discarded.
            spec["gate_id"]   = gate_id
            spec["after_act"] = node["after_act"]
            spec["gate_type"] = node["gate_type"]
            if node.get("wrong_path_acts"):
                spec["wrong_path_acts"] = [
                    a["id"] for a in node["wrong_path_acts"] if isinstance(a, dict)
                ]
            return spec

        try:
            spec = call_llm(system_prompt, user_msg, schema, model=model)
            spec = _inject(spec)
            errors = validate_gate_spec(spec, plan)
            if errors:
                print(f"    Retrying: {len(errors)} validation error(s)...")
                spec = _retry_with_errors(system_prompt, user_msg, schema, errors, model)
                spec = _inject(spec)
                errors = validate_gate_spec(spec, plan)
                if errors:
                    failures.append((gate_id, f"validation after retry: {errors}"))
                    continue

            # Structural assertion — catches contract violations before they
            # reach the assembler. Enforces gate_id == plan_node.id.
            assert_gate_spec_shape(spec, plan_node=node)
            gate_specs[gate_id] = spec

        except Exception as e:
            # Don't let one gate nuke the whole stage — collect failures and
            # report them all at the end so partial progress is visible.
            print(f"    ERROR: {gate_id} failed: {e}")
            failures.append((gate_id, str(e)))

    if failures:
        lines = [f"  - {gid}: {reason}" for gid, reason in failures]
        raise RuntimeError(
            f"stage2b_author_gates: {len(failures)}/{len(gate_nodes)} gate(s) failed:\n"
            + "\n".join(lines)
            + "\n(Partial gate_specs were not returned. Fix inputs or rerun.)"
        )

    return gate_specs


# ─────────────────────────────────────────────────────────────────────
# Stage 3: Author visualization
# ─────────────────────────────────────────────────────────────────────

def _build_viz_timeline(act_specs, plan):
    """
    Build an ordered timeline of viz actions across all acts, following plan node
    order so the viz agent sees the temporal sequence of the full lesson.

    Returns a list of dicts: {act_id, act_title, beat_idx, say_snippet, method, params, offset}
    """
    timeline = []
    for node in plan["nodes"]:
        if node["type"] != "act":
            continue
        act_id = node["id"]
        spec = act_specs.get(act_id)
        if not spec:
            continue
        for beat_idx, beat in enumerate(spec.get("beats", [])):
            for va in beat.get("viz_actions", []):
                timeline.append({
                    "act_id": act_id,
                    "act_title": node["title"],
                    "beat_idx": beat_idx,
                    "say_snippet": beat.get("say", "")[:80],
                    "method": va["method"],
                    "params": va.get("params", {}),
                    "offset": va.get("offset", 0),
                })
    return timeline


def stage3_author_viz(plan, act_specs, model="gemini-2.5-flash"):
    """Call the viz agent to produce a viz spec."""
    print("\n=== Stage 4: Authoring visualization ===")

    viz_req = plan.get("viz_requirements", {})
    if viz_req.get("type") == "none":
        print("  No visualization needed.")
        return {"mode": "preset", "preset": "numberLine", "config": None, "actions_implemented": []}

    system_prompt = load_prompt("viz_worker")
    timeline = _build_viz_timeline(act_specs, plan)
    problem_text = plan.get("problem", {}).get("text", "")

    user_msg = f"""## Problem Being Taught
{problem_text}

## Visualization Requirements (from planner)
{json.dumps(viz_req, indent=2)}

## Ordered Action Timeline (temporal sequence across the full lesson)
{json.dumps(timeline, indent=2)}
"""

    # Read full reference viz plugin — skip for models that fail on large prompts.
    # Nemotron returns empty choices when the prompt exceeds ~15k tokens despite
    # advertising 131k context, so skip the reference for it too.
    _small_ctx_models = {
        "qwen/qwen-2.5-coder-32b-instruct",
        "mistralai/mistral-small-3.1-24b-instruct",
        "meta-llama/llama-3.3-70b-instruct",
        "nvidia/llama-3.1-nemotron-70b-instruct",
    }
    _real_model = _strip_openrouter(model) if _is_openrouter(model) else model
    _include_reference = _real_model not in _small_ctx_models

    if _include_reference:
        import glob as _glob
        _candidates = sorted(_glob.glob(str(CODE2HTML_DIR / "content" / "amc10a_2023_p15_*.js")))
        example_path = Path(_candidates[-1]) if _candidates else None
        if example_path and example_path.is_file():
            with open(example_path) as f:
                viz_section = f.read()
            user_msg += f"\n## Reference: Complete production viz plugin\n```javascript\n{viz_section}\n```\n"

    schema = _schema_for_tool("viz_spec")
    spec = call_llm(system_prompt, user_msg, schema, model=model)

    # Syntax-check generated JS before validation
    if spec.get("code"):
        syntax_errors = _check_js_syntax(spec["code"])
        if syntax_errors:
            print(f"  JS syntax error(s) detected — retrying...")
            spec = _retry_with_errors(
                system_prompt, user_msg, schema,
                [f"JS syntax error: {e}" for e in syntax_errors],
                model
            )

    errors = validate_viz_spec(spec, plan, act_specs)
    layout_warnings = _check_viz_layout(spec.get("code", ""))
    if layout_warnings:
        print(f"  Layout audit found {len(layout_warnings)} issue(s) — retrying:")
        for w in layout_warnings: print(f"    - {w}")
        errors = errors + [f"Layout: {w}" for w in layout_warnings]
    if errors:
        print(f"  Retrying: {len(errors)} validation error(s)...")
        spec = _retry_with_errors(system_prompt, user_msg, schema, errors, model)
        # Re-check syntax after retry
        if spec.get("code"):
            syntax_errors = _check_js_syntax(spec["code"])
            if syntax_errors:
                print(f"  WARNING: JS syntax errors remain after retry:")
                for e in syntax_errors:
                    print(f"    - {e}")
        errors = validate_viz_spec(spec, plan, act_specs)
        if errors:
            print(f"  Retrying again: {len(errors)} validation error(s)...")
            spec = _retry_with_errors(system_prompt, user_msg, schema, errors, model)
            errors = validate_viz_spec(spec, plan, act_specs)
            if errors:
                print(f"  WARNING: Viz spec still has errors after 2 retries:")
                for e in errors:
                    print(f"    - {e}")

    # Structural assertions: shape + plan-declared-action coverage.
    # If the viz agent silently dropped an action, this raises here rather than
    # letting the assembled HTML go live with missing animations.
    assert_viz_spec_shape(spec)
    from pipeline_types import assert_viz_implements_plan_actions, assert_viz_action_contract
    assert_viz_implements_plan_actions(spec, plan)
    # Case/params contract against the act specs that will call this plugin —
    # a call missing an unguarded params read renders literal "undefined".
    assert_viz_action_contract(spec, act_specs)
    return spec


def stage3b_viz_visual_revision(
    plan, act_specs, gate_specs, viz_spec, work_dir, model
):
    """
    Sighted self-revision pass for the viz worker.

    Assembles content+viz, builds a throwaway HTML, screenshots it, and
    shows the screenshot back to the viz worker with instructions to fix
    visual bugs (overlap, clipped elements, empty canvas, etc). Returns
    the revised viz_spec (or the original if revision fails / no changes).

    Requires Anthropic model + playwright. Silently falls back to the
    original spec otherwise.
    """
    print("\n=== Stage 4b: Viz visual self-revision ===")
    if _is_gemini(model):
        print("  Skipped — Gemini model; use an Anthropic model for sighted feedback.")
        return viz_spec
    if not viz_spec or not viz_spec.get("code"):
        print("  Skipped — no viz code to revise.")
        return viz_spec

    tmp_dir = Path(work_dir) / "_viz_preview"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    content_js = assemble_content(plan, act_specs, gate_specs, viz_spec)
    viz_js = assemble_viz(viz_spec)
    content_path = tmp_dir / "preview_content.js"
    viz_path = tmp_dir / "preview_viz.js"
    html_path = tmp_dir / "preview.html"
    shot_path = tmp_dir / "preview.png"
    content_path.write_text(content_js)
    viz_path.write_text(viz_js)

    if not build_html(str(content_path), str(viz_path), str(html_path)):
        print("  Skipped — preview build failed.")
        return viz_spec
    if not take_screenshot(str(html_path), str(shot_path)):
        print("  Skipped — screenshot failed.")
        return viz_spec

    screenshot_block = _encode_screenshot_for_llm(str(shot_path))
    if not screenshot_block:
        return viz_spec

    system_prompt = load_prompt("viz_worker")
    user_msg = (
        "## Self-revision pass\n"
        "You previously authored the viz plugin below. A screenshot of the "
        "rendered lesson is attached. Look for visual bugs: elements off-screen, "
        "overlapping text, empty groups, wrong colors, missing animations. "
        "Return a revised viz_spec implementing the SAME actions but with visual "
        "fixes. If the screenshot looks correct, return the existing code unchanged.\n\n"
        f"## Current viz code\n```javascript\n{viz_spec['code']}\n```\n"
    )
    schema = _schema_for_tool("viz_spec")

    if anthropic is None:
        print("  Skipped — anthropic package not installed.")
        return viz_spec
    try:
        client = anthropic.Anthropic()
        response = client.messages.create(
            model=model, max_tokens=16000, system=system_prompt,
            messages=[{"role": "user", "content": [
                {"type": "text", "text": user_msg},
                screenshot_block,
            ]}],
            tools=[{"name": "output", "description": "Return revised viz_spec",
                    "input_schema": schema}],
            tool_choice={"type": "tool", "name": "output"},
        )
        revised = None
        for block in response.content:
            if block.type == "tool_use":
                revised = block.input
                break
    except Exception as e:
        print(f"  Revision failed: {e}")
        return viz_spec

    if not revised or not revised.get("code"):
        return viz_spec
    if _check_js_syntax(revised["code"]):
        print("  Revised code has syntax errors — keeping original.")
        return viz_spec
    errs = validate_viz_spec(revised, plan, act_specs)
    if errs:
        print(f"  Revised code failed validation ({len(errs)} errs) — keeping original.")
        return viz_spec
    if revised["code"] == viz_spec["code"]:
        print("  No visual changes needed.")
    else:
        print("  Applied visual revision from sighted viz_worker.")
    return revised


# ─────────────────────────────────────────────────────────────────────
# Single-agent mega stage (experiment): replaces stage2_structure +
# stage2_author_acts + stage2b_author_gates + stage3_author_viz with one
# LLM call. Used for the single-vs-multi-agent prompt comparison — see
# prompts/variants/v6_single_agent_mega.md and --single-agent-prompt.
# ─────────────────────────────────────────────────────────────────────

def _build_single_agent_schema():
    """
    Build the combined output schema for the single-agent mega stage by
    merging the existing per-stage schemas (lesson_plan, act_spec, gate_spec,
    viz_spec) rather than hand-duplicating field lists that could drift out
    of sync with schemas/*.json.

    Node shape differs from the normal LessonPlan: act nodes carry full
    "beats" (ActSpec shape) instead of "beat_outline", and gate nodes carry
    the full GateSpec fields inline instead of just gate_type/after_act —
    because this single call produces fully-authored content, not an outline.

    @returns: dict — flat JSON schema (no $ref/$defs/oneOf) safe to pass
        directly to call_llm() for any provider.
    """
    lesson_plan_schema = json.loads((PIPELINE_DIR / "schemas" / "lesson_plan.json").read_text())
    act_spec_schema = json.loads((PIPELINE_DIR / "schemas" / "act_spec.json").read_text())
    gate_spec_schema = json.loads((PIPELINE_DIR / "schemas" / "gate_spec.json").read_text())
    viz_spec_schema = json.loads((PIPELINE_DIR / "schemas" / "viz_spec.json").read_text())

    act_node_def = lesson_plan_schema["$defs"]["act_node"]
    gate_node_def = lesson_plan_schema["$defs"]["gate_node"]
    marker_node_def = lesson_plan_schema["$defs"]["marker_node"]

    node_properties = {
        "type": {"type": "string", "enum": ["act", "gate", "marker"]},
        "id": {"type": "string"},
        # act fields (beat_outline replaced by full "beats")
        "title": act_node_def["properties"]["title"],
        "objective": act_node_def["properties"]["objective"],
        "viz_panel": act_node_def["properties"]["viz_panel"],
        "beats": act_spec_schema["properties"]["beats"],
        # gate fields — full GateSpec content inline (gate_id is injected later,
        # never produced by the LLM, same contract as the normal gate worker)
        "gate_type": gate_node_def["properties"]["gate_type"],
        "after_act": gate_node_def["properties"]["after_act"],
        **{k: v for k, v in gate_spec_schema["properties"].items()
           if k not in ("gate_type", "after_act")},
        # marker field
        "label": marker_node_def["properties"]["label"],
    }

    return {
        "type": "object",
        "required": ["meta", "problem", "viz_requirements", "nodes", "viz_spec"],
        "properties": {
            "meta": lesson_plan_schema["properties"]["meta"],
            "problem": lesson_plan_schema["properties"]["problem"],
            "viz_requirements": lesson_plan_schema["properties"]["viz_requirements"],
            "nodes": {
                "type": "array",
                "description": "Ordered act/gate/marker nodes, fully authored (beats + gate content inline).",
                "items": {"type": "object", "required": ["type"], "properties": node_properties},
            },
            "viz_spec": {
                "type": "object",
                "required": ["mode"],
                "properties": viz_spec_schema["properties"],
            },
        },
    }


def _split_single_agent_output(mega, model="gemini-2.5-flash"):
    """
    Split the single-agent mega response into the normal pipeline shapes
    (plan, act_specs, gate_specs, viz_spec) so it can flow through the same
    assert_*_shape guards and assemble_content()/assemble_viz() as the
    multi-agent path — no separate, unguarded code path.

    @param mega: dict — raw output of the single-agent LLM call (see
        _build_single_agent_schema for shape).
    @returns: (plan, act_specs, gate_specs, viz_spec)
    """
    nodes = mega.get("nodes", [])
    act_specs, gate_specs = {}, {}
    plan_nodes = []

    for node in nodes:
        ntype = node.get("type")
        if ntype == "act":
            act_id = node["id"]
            act_specs[act_id] = {
                "act_id": act_id,
                "title": node.get("title", ""),
                "viz_panel": node.get("viz_panel"),
                "beats": node.get("beats", []),
            }
            plan_nodes.append({
                "type": "act", "id": act_id, "title": node.get("title", ""),
                "objective": node.get("objective", ""), "viz_panel": node.get("viz_panel"),
                "beat_outline": [],  # not produced in single-agent mode; beats are authoritative
            })
        elif ntype == "gate":
            gate_id = node["id"]
            gate_spec = {k: v for k, v in node.items() if k not in ("type", "id")}
            gate_spec["gate_id"] = gate_id  # injected, same contract as stage2b_author_gates
            gate_specs[gate_id] = gate_spec
            plan_nodes.append({
                "type": "gate", "id": gate_id, "gate_type": node.get("gate_type"),
                "after_act": node.get("after_act"),
                "wrong_path_acts": node.get("wrong_path_acts", []),
            })
        elif ntype == "marker":
            plan_nodes.append({
                "type": "marker", "label": node.get("label", ""), "after_act": node.get("after_act"),
            })

    plan = {
        "meta": mega["meta"],
        "problem": mega["problem"],
        "viz_requirements": mega.get("viz_requirements", {}),
        "nodes": plan_nodes,
    }
    viz_spec = mega.get("viz_spec")
    return plan, act_specs, gate_specs, viz_spec


def stage_single_agent_mega(problem_text, narrative, model="gemini-2.5-flash",
                            single_agent_prompt_path=None, timing_sink=None):
    """
    Single-agent experiment stage: one LLM call replaces stage2_structure +
    stage2_author_acts + stage2b_author_gates + stage3_author_viz, producing
    a fully-authored lesson (plan + beats + gate content + viz code) in one
    JSON response — no multi-stage handoff.

    Runs the SAME structural assertions as the multi-agent path
    (assert_plan_shape / assert_act_spec_shape / assert_gate_spec_shape /
    assert_viz_spec_shape / assert_viz_implements_plan_actions) so this
    experimental path gets identical enforcement, not a weaker one.

    @param single_agent_prompt_path: path to the mega prompt (e.g.
        prompts/variants/v6_single_agent_mega.md). Required — there is no
        canonical single-agent prompt to default to.
    @param timing_sink: optional dict; if given, populated with
        timing_sink["single_agent_llm_seconds"] = elapsed wall-clock time of
        the mega LLM call, for cross-variant comparison with stage2_structure.
    @returns: (plan, act_specs, gate_specs, viz_spec)
    """
    print("\n=== Single-agent mega stage (Stage 2+3a+3b+4 combined) ===")

    system_prompt = load_prompt("planner", override_path=single_agent_prompt_path)
    user_msg = f"## Solution & Pedagogical Narrative\n\n{narrative}\n\n---\n\n"
    user_msg += f"## Math Problem\n\n{problem_text}\n"

    schema = _build_single_agent_schema()

    _t0 = time.time()
    mega = call_llm(system_prompt, user_msg, schema, model=model)
    _elapsed = time.time() - _t0
    print(f"  [timing] single-agent mega LLM call: {_elapsed:.2f}s")
    if timing_sink is not None:
        timing_sink["single_agent_llm_seconds"] = _elapsed

    plan, act_specs, gate_specs, viz_spec = _split_single_agent_output(mega, model=model)

    # Same fail-fast contract as the multi-agent path — no weaker guard for
    # the experimental single-call path.
    assert_plan_shape(plan)
    node_index = _plan_node_index(plan)
    for act_id, spec in act_specs.items():
        assert_act_spec_shape(spec, plan_node=node_index.get(act_id))
    for gate_id, spec in gate_specs.items():
        assert_gate_spec_shape(spec, plan_node=node_index.get(gate_id))
    if viz_spec:
        assert_viz_spec_shape(viz_spec)
        assert_viz_implements_plan_actions(viz_spec, plan)

    return plan, act_specs, gate_specs, viz_spec


# ─────────────────────────────────────────────────────────────────────
# Stage 4: Assemble
# ─────────────────────────────────────────────────────────────────────

def stage4_assemble(plan, act_specs, gate_specs, viz_spec, output_dir):
    """Assemble all artifacts into JS files."""
    print("\n=== Stage 5: Assembling ===")

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    import re as _re

    # Final contract gates before emitting anything: every viz action call must
    # hit a real case with its required params, and narrated visuals must fire
    # an action. Same checks run on the --resume path via assert_loaded_artifacts.
    from pipeline_types import assert_viz_action_contract, assert_beat_visual_contract
    if viz_spec:
        assert_viz_action_contract(viz_spec, act_specs)
    assert_beat_visual_contract(act_specs)

    content_js = assemble_content(plan, act_specs, gate_specs, viz_spec)
    lesson_id = plan["meta"].get("title", "lesson").lower()
    lesson_id = _re.sub(r'[^a-z0-9]+', '_', lesson_id).strip('_')

    content_path = output_dir / f"{lesson_id}.js"
    with open(content_path, "w") as f:
        f.write(content_js)
    print(f"  Content: {content_path} ({len(content_js)} bytes)")

    viz_js = assemble_viz(viz_spec) if viz_spec else None
    viz_path = None
    if viz_js:
        viz_path = output_dir / f"viz_{lesson_id}.js"
        with open(viz_path, "w") as f:
            f.write(viz_js)
        print(f"  Viz:     {viz_path} ({len(viz_js)} bytes)")

    return str(content_path), str(viz_path) if viz_path else None


# ─────────────────────────────────────────────────────────────────────
# Stage 5: Review and fix
# ─────────────────────────────────────────────────────────────────────

REVIEW_OUTPUT_SCHEMA = {
    "type": "object",
    "required": ["status", "issues"],
    "properties": {
        "status": {"type": "string", "enum": ["pass", "issues_found"]},
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["severity", "location", "description"],
                "properties": {
                    "severity": {"type": "string", "enum": ["error", "warning", "suggestion"]},
                    "location": {"type": "string"},
                    "description": {"type": "string"},
                    "fix": {"type": "string"}
                }
            }
        },
        "corrected_content_js": {"type": ["string", "null"]},
        "corrected_viz_js": {"type": ["string", "null"]}
    }
}


def stage5_review(plan, content_js, viz_js=None, screenshot_path=None, model="gemini-2.5-flash"):
    """
    Call the reviewer agent to verify assembled output and fix minor bugs.

    The reviewer is the ONLY "sighted" agent — all others (solution_planner,
    planner, act_worker, gate_worker, viz_worker) work from text/JSON only.

    @param screenshot_path: optional path to a PNG screenshot of the rendered lesson.
                            Enables visual bug detection (layout breaks, empty SVG,
                            contrast issues) that code review cannot catch.
                            Requires Anthropic model (Gemini cannot handle images here).

    Returns:
        (reviewed_content_js, reviewed_viz_js, issues_list)
    """
    print("\n=== Stage 6: Reviewing ===")
    if screenshot_path and Path(screenshot_path).exists():
        print(f"  (sighted mode — screenshot provided)")

    system_prompt = load_prompt("reviewer")

    user_msg = f"""## Lesson Plan
```json
{json.dumps(plan, indent=2, ensure_ascii=False)}
```

## Assembled Content JS
```javascript
{content_js}
```
"""
    if viz_js:
        user_msg += f"""
## Viz Plugin JS
```javascript
{viz_js}
```
"""

    # Build message content — multimodal if screenshot provided and using Anthropic
    screenshot_block = None
    if screenshot_path and _is_gemini(model):
        # Loud warning: requesting sighted review with a model we don't send images to
        # would silently degrade to blind review. Surface it so the user isn't confused
        # by a review_report that contains no visual findings.
        print(f"  WARNING: --screenshot requested but model is Gemini; "
              f"falling back to BLIND review. Use --model claude-... for sighted.")
    if screenshot_path and not _is_gemini(model):
        screenshot_block = _encode_screenshot_for_llm(screenshot_path)
        if screenshot_block:
            user_msg += "\n## Screenshot of rendered lesson\n(See attached image — analyze for visual bugs.)\n"

    # For Anthropic with screenshot: use raw client call with image block
    if screenshot_block and not _is_gemini(model):
        if anthropic is None:
            raise RuntimeError("anthropic package not installed")
        client = anthropic.Anthropic()
        response = client.messages.create(
            model=model,
            max_tokens=16000,
            system=system_prompt,
            messages=[{"role": "user", "content": [
                {"type": "text", "text": user_msg},
                screenshot_block,
            ]}],
            tools=[{
                "name": "output",
                "description": "Return structured review output",
                "input_schema": REVIEW_OUTPUT_SCHEMA
            }],
            tool_choice={"type": "tool", "name": "output"}
        )
        result = None
        for block in response.content:
            if block.type == "tool_use":
                result = block.input
                break
        if result is None:
            raise ValueError("No structured output from reviewer")
    else:
        result = call_llm(system_prompt, user_msg, REVIEW_OUTPUT_SCHEMA, model=model)

    issues = result.get("issues", [])
    errors = [i for i in issues if i["severity"] == "error"]
    warnings = [i for i in issues if i["severity"] == "warning"]
    suggestions = [i for i in issues if i["severity"] == "suggestion"]

    if result["status"] == "pass":
        print("  Review: PASS (no issues)")
    else:
        print(f"  Review: {len(errors)} error(s), {len(warnings)} warning(s), {len(suggestions)} suggestion(s)")
        for issue in issues:
            icon = {"error": "X", "warning": "!", "suggestion": "~"}[issue["severity"]]
            print(f"    [{icon}] {issue['location']}: {issue['description']}")
            if issue.get("fix"):
                print(f"        Fix: {issue['fix']}")

    reviewed_content = result.get("corrected_content_js") or content_js
    reviewed_viz = result.get("corrected_viz_js") or viz_js

    # Retry once if the reviewer's correction fails basic syntax — give it the
    # node error and ask for a clean re-emit before falling back.
    if reviewed_content != content_js and _check_js_syntax(reviewed_content):
        syn_errs = _check_js_syntax(reviewed_content)
        print(f"  Reviewer correction has syntax errors — retrying once:")
        for e in syn_errs: print(f"    - {e}")
        retry_user = user_msg + (
            "\n\n## Your previous corrected_content_js had syntax errors:\n"
            + "\n".join(f"- {e}" for e in syn_errs)
            + "\nRe-emit a corrected_content_js that passes `node --check`.\n"
        )
        try:
            if screenshot_block and not _is_gemini(model):
                response = client.messages.create(
                    model=model, max_tokens=16000, system=system_prompt,
                    messages=[{"role": "user", "content": [
                        {"type": "text", "text": retry_user}, screenshot_block,
                    ]}],
                    tools=[{"name":"output","description":"re-emit review",
                            "input_schema": REVIEW_OUTPUT_SCHEMA}],
                    tool_choice={"type":"tool","name":"output"})
                for block in response.content:
                    if block.type == "tool_use":
                        result = block.input; break
            else:
                result = call_llm(system_prompt, retry_user,
                                  REVIEW_OUTPUT_SCHEMA, model=model)
            reviewed_content = result.get("corrected_content_js") or content_js
            reviewed_viz = result.get("corrected_viz_js") or viz_js
        except Exception as e:
            print(f"  Retry failed: {e} — keeping original.")
            reviewed_content = content_js
            reviewed_viz = viz_js

    reviewed_content = _reject_if_invalid_dsl(reviewed_content, content_js, "content")
    if viz_js:
        reviewed_viz = _reject_if_invalid_dsl(reviewed_viz, viz_js, "viz")

    # Repair lone LaTeX backslashes the reviewer may have introduced (\pi -> \\pi
    # in source) so on-screen KaTeX renders symbols, not italic letters.
    reviewed_content = _fix_latex_escapes(reviewed_content)

    return reviewed_content, reviewed_viz, issues


# ─────────────────────────────────────────────────────────────────────
# Build HTML (optional)
# ─────────────────────────────────────────────────────────────────────

def build_html(content_js_path, viz_js_path, output_html_path, audio_js_path=None):
    """Call the existing build.sh to produce a self-contained HTML file."""
    print("\n=== Building HTML ===")
    # Resolve all paths to absolute so build.sh works regardless of cwd
    content_abs = str(Path(content_js_path).resolve())
    viz_abs = str(Path(viz_js_path).resolve()) if viz_js_path else None
    output_abs = str(Path(output_html_path).resolve())
    audio_abs = str(Path(audio_js_path).resolve()) if audio_js_path else None

    cmd = [str(CODE2HTML_DIR / "build.sh")]
    if viz_abs:
        cmd += [content_abs, viz_abs, output_abs]
        if audio_abs:
            cmd += [audio_abs]
    else:
        cmd += ["--mx", content_abs, output_abs]
        if audio_abs:
            cmd += [audio_abs]

    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(CODE2HTML_DIR))
    if result.returncode != 0:
        print(f"  Build failed: {result.stderr}")
        return False
    else:
        print(f"  {result.stdout.strip()}")
        return True


def stage_audio_and_rebuild(content_path, viz_path, output_path, work_dir):
    """Generate TTS narration for the assembled lesson and rebuild the final
    HTML with audio embedded. HARD-FAILS on any problem — a lesson must never
    silently ship without narration (the circles_v7/archer_v7 silent-lesson
    incident: the manual audio step was skipped and nobody noticed).

    @raises SystemExit: when the key is missing, TTS fails, no audio JS is
        produced, or the final HTML embeds zero audio clips.
    """
    print("\n=== Stage 7: Audio narration ===")
    if not os.environ.get("ELEVENLABS_API_KEY"):
        raise SystemExit(
            "ERROR: --audio requires ELEVENLABS_API_KEY in the environment. "
            "Refusing to ship a silent lesson — export the key or drop --audio."
        )

    result = subprocess.run(
        [sys.executable, str(CODE2HTML_DIR / "generate_audio.py"),
         str(Path(content_path).resolve())],
        capture_output=True, text=True, cwd=str(CODE2HTML_DIR),
    )
    tail = (result.stdout or "") + (result.stderr or "")
    if result.returncode != 0:
        raise SystemExit(f"ERROR: audio generation failed (lesson NOT built):\n{tail[-800:]}")
    print("  " + (result.stdout or "").strip().splitlines()[-1] if result.stdout else "")

    audio_files = sorted(Path(work_dir).glob("audio_*.js"))
    if not audio_files or audio_files[-1].stat().st_size < 10000:
        raise SystemExit(
            f"ERROR: audio generation produced no usable audio JS in {work_dir} "
            f"(found: {[f.name for f in audio_files]}). Lesson NOT built."
        )

    if not build_html(content_path, viz_path, output_path, audio_js_path=audio_files[-1]):
        raise SystemExit("ERROR: final audio build failed.")

    with open(output_path) as f:
        clips = f.read().count("b64:")
    if clips == 0:
        raise SystemExit(
            f"ERROR: built {output_path} contains ZERO embedded audio clips — "
            "refusing to ship a silent lesson."
        )
    print(f"  Audio OK: {clips} clip(s) embedded in {output_path}")


# ─────────────────────────────────────────────────────────────────────
# Screenshot (optional — requires playwright)
# Install: pip install playwright && playwright install chromium
# ─────────────────────────────────────────────────────────────────────

def take_screenshot(html_path, screenshot_path, wait_ms=2000):
    """
    Render the compiled HTML in a headless browser and save a screenshot.

    The reviewer (Stage 6) is the only "sighted" agent — it receives this
    screenshot to catch visual bugs that code review cannot catch.

    Requires playwright: pip install playwright && playwright install chromium
    Returns True on success, False if playwright is unavailable or fails.

    @param html_path: path to the compiled HTML file
    @param screenshot_path: where to save the PNG
    @param wait_ms: milliseconds to wait after load (lets GSAP settle)
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  [screenshot] playwright not installed — skipping.")
        print("  To enable: pip install playwright && playwright install chromium")
        return False

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.goto(f"file://{Path(html_path).resolve()}")
            page.wait_for_timeout(wait_ms)
            page.screenshot(path=str(screenshot_path), full_page=False)
            browser.close()
        print(f"  Screenshot: {screenshot_path}")
        return True
    except Exception as e:
        print(f"  [screenshot] failed: {e}")
        return False


def _encode_screenshot_for_llm(screenshot_path):
    """
    Return base64-encoded PNG data URI for inclusion in a multimodal LLM message.

    @param screenshot_path: path to PNG file
    @returns: dict with type="image" suitable for Anthropic messages API,
              or None if file does not exist
    """
    import base64
    path = Path(screenshot_path)
    if not path.exists():
        return None
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": "image/png", "data": b64}
    }


# ─────────────────────────────────────────────────────────────────────
# Save/load intermediate artifacts
# ─────────────────────────────────────────────────────────────────────

def save_artifacts(work_dir, problem_text=None, narrative=None, plan=None,
                   act_specs=None, gate_specs=None, viz_spec=None):
    """Save pipeline artifacts to a working directory for inspection/editing."""
    work_dir = Path(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    if problem_text is not None:
        with open(work_dir / "problem.md", "w") as f:
            f.write(problem_text)

    if narrative is not None:
        with open(work_dir / "narrative.md", "w") as f:
            f.write(narrative)

    if plan:
        with open(work_dir / "lesson_plan.json", "w") as f:
            json.dump(plan, f, indent=2, ensure_ascii=False)

    if act_specs:
        acts_dir = work_dir / "acts"
        acts_dir.mkdir(exist_ok=True)
        for act_id, spec in act_specs.items():
            with open(acts_dir / f"{act_id}.json", "w") as f:
                json.dump(spec, f, indent=2, ensure_ascii=False)

    if gate_specs:
        gates_dir = work_dir / "gates"
        gates_dir.mkdir(exist_ok=True)
        for gate_id, spec in gate_specs.items():
            with open(gates_dir / f"{gate_id}.json", "w") as f:
                json.dump(spec, f, indent=2, ensure_ascii=False)

    if viz_spec:
        with open(work_dir / "viz_spec.json", "w") as f:
            json.dump(viz_spec, f, indent=2, ensure_ascii=False)


def _load_problem_text(work_dir):
    """Load saved problem text from work directory."""
    path = Path(work_dir) / "problem.md"
    if path.exists():
        with open(path) as f:
            return f.read()
    return ""


def load_artifacts(work_dir):
    """Load previously saved artifacts from a working directory."""
    work_dir = Path(work_dir)

    narrative = None
    narrative_path = work_dir / "narrative.md"
    if narrative_path.exists():
        with open(narrative_path) as f:
            narrative = f.read()

    plan = None
    plan_path = work_dir / "lesson_plan.json"
    if plan_path.exists():
        with open(plan_path) as f:
            plan = json.load(f)

    act_specs = {}
    acts_dir = work_dir / "acts"
    if acts_dir.exists():
        for p in sorted(acts_dir.glob("*.json")):
            with open(p) as f:
                spec = json.load(f)
            act_specs[spec["act_id"]] = spec

    gate_specs = {}
    gates_dir = work_dir / "gates"
    if gates_dir.exists():
        for p in sorted(gates_dir.glob("*.json")):
            with open(p) as f:
                spec = json.load(f)
            gate_specs[spec["gate_id"]] = spec

    viz_spec = None
    viz_path = work_dir / "viz_spec.json"
    if viz_path.exists():
        with open(viz_path) as f:
            viz_spec = json.load(f)

    return narrative, plan, act_specs, gate_specs, viz_spec


def _plan_node_index(plan):
    """Map every act/gate id in `plan` (including nested wrong_path_acts) to its node.

    @param plan: dict — a lesson plan (must have "nodes"); may be None/empty.
    @returns: dict[str, dict] mapping node id → node dict. Used to key loaded
        act/gate specs against their authoritative plan node so that artifacts
        loaded from disk get the same structural checks as freshly-generated ones.
    """
    index = {}
    for node in (plan or {}).get("nodes", []):
        nid = node.get("id")
        if nid:
            index[nid] = node
        # Branch acts are defined inline under a gate's wrong_path_acts.
        for wp in node.get("wrong_path_acts", []):
            if isinstance(wp, dict) and wp.get("id"):
                index[wp["id"]] = wp
    return index


def assert_loaded_artifacts(plan=None, act_specs=None, gate_specs=None, viz_spec=None):
    """Run the same stage-boundary structural assertions on artifacts loaded from disk.

    The fresh-generate path validates each artifact via assert_*_shape inside the
    stage functions. Artifacts supplied via --resume/--plan skip those stages, so
    without this they would reach the assembler unchecked. This closes that gap:
    loaded and generated artifacts go through identical validation.

    @raises TypeError: on the first structural contract violation (same failure mode
        as the generate path).
    """
    if plan is not None:
        assert_plan_shape(plan)

    node_index = _plan_node_index(plan) if plan is not None else {}

    for act_id, spec in (act_specs or {}).items():
        assert_act_spec_shape(spec, plan_node=node_index.get(act_id))

    for gate_id, spec in (gate_specs or {}).items():
        assert_gate_spec_shape(spec, plan_node=node_index.get(gate_id))

    if viz_spec is not None:
        assert_viz_spec_shape(viz_spec)
        if plan is not None:
            assert_viz_implements_plan_actions(viz_spec, plan)
        if act_specs:
            # Case/params contract — loaded artifacts get the same gate as
            # freshly generated ones (binsearch_v7 "undefined" class).
            from pipeline_types import assert_viz_action_contract
            assert_viz_action_contract(viz_spec, act_specs)

    if act_specs:
        from pipeline_types import assert_beat_visual_contract
        assert_beat_visual_contract(act_specs)


# ─────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────

def main():
    """CLI entrypoint — parse args and dispatch one or more pipeline stages.

    @effects: reads problem / intermediate artifacts from --work-dir, writes stage outputs
        back to the same directory (plan.json, act_specs/, gate_specs/, viz_spec.json,
        content.js, viz.js, review.json) and optionally builds the final HTML and
        screenshot. See --help for the full flag surface.
    @raises SystemExit: on CLI misuse (argparse) or on unrecoverable stage errors that
        propagate out of the stage functions.
    """
    parser = argparse.ArgumentParser(
        description="6-stage agentic lesson authoring pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full pipeline from a problem description
  python orchestrator.py --problem problem.md --work-dir work/ --output dist/lesson.html

  # Run only stage 1 (solution planning), produce narrative for review
  python orchestrator.py --problem problem.md --work-dir work/ --stage narrative

  # Resume from an edited narrative (skip stage 1)
  python orchestrator.py --narrative work/narrative.md --work-dir work/ --output dist/lesson.html

  # Run stages 1-2 only (narrative + structured plan)
  python orchestrator.py --problem problem.md --work-dir work/ --stage plan

  # Resume from an existing plan (skip stages 1-2)
  python orchestrator.py --plan work/lesson_plan.json --work-dir work/ --output dist/lesson.html

  # Resume from saved artifacts (skip completed stages)
  python orchestrator.py --resume work/ --output dist/lesson.html

  # Skip the review stage (faster, no extra API call)
  python orchestrator.py --problem problem.md --work-dir work/ --output dist/lesson.html --no-review
        """
    )

    # Input options
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--problem", help="Path to problem description (markdown/text)")
    input_group.add_argument("--narrative", help="Path to existing narrative.md (skip stage 1)")
    input_group.add_argument("--plan", help="Path to existing lesson_plan.json (skip stages 1-2)")
    input_group.add_argument("--resume", help="Path to work directory with saved artifacts")

    parser.add_argument("--objectives", help="Learning objectives (text or file path)")
    parser.add_argument("--work-dir", default="output", help="Directory for intermediate artifacts")
    parser.add_argument("--output", help="Path for final HTML output (triggers build)")
    parser.add_argument("--stage",
                        choices=["narrative", "plan", "acts", "viz", "assemble", "review", "all"],
                        default="all", help="Run only up to this stage")
    parser.add_argument("--no-review", action="store_true", help="Skip the review stage")
    parser.add_argument("--audio", action="store_true",
                        help="After the final build, generate TTS narration (ELEVENLABS_API_KEY "
                             "required) and rebuild the HTML with audio embedded. HARD-FAILS if "
                             "audio cannot be produced — never ships a silent lesson.")
    parser.add_argument("--screenshot", action="store_true",
                        help="Take a screenshot of the rendered HTML and feed it to the reviewer. "
                             "Requires: pip install playwright && playwright install chromium. "
                             "Only works with Anthropic models (not Gemini).")
    parser.add_argument("--viz-screenshot-feedback", action="store_true",
                        help="After stage 4, build+screenshot the lesson and let the viz_worker "
                             "self-correct visual bugs before assembly. Anthropic models only.")
    parser.add_argument("--model", default="gemini-2.5-flash",
                        help="Model to use (gemini-2.5-flash, gemini-2.5-pro, claude-sonnet-4-20250514, etc.)")
    parser.add_argument("--viz-model", default=None,
                        help="Override model for Stage 4 (viz generation) only. "
                             "Accepts same formats as --model, including openrouter: prefix. "
                             "If omitted, Stage 4 uses --model. "
                             "Example: --viz-model openrouter:meta-llama/llama-3.3-70b-instruct")
    parser.add_argument("--planner-prompt", default=None,
                        help="Path to an alternate planner prompt to use for Stage 2 "
                             "instead of prompts/planner.md. Enables side-by-side "
                             "planner prompt experiments (see scripts/run_planner_variants.sh). "
                             "Example: --planner-prompt prompts/variants/planner_v2.md")
    parser.add_argument("--single-agent-prompt", default=None,
                        help="Path to a single-agent mega prompt (e.g. "
                             "prompts/variants/v6_single_agent_mega.md). When given, ONE LLM "
                             "call replaces the normal Stage 2/3a/3b/4 sequence, producing the "
                             "full plan + beats + gate content + viz code at once. Assembly and "
                             "HTML build proceed exactly as in the normal flow afterward.")

    args = parser.parse_args()
    # --viz-model defaults to --model when not explicitly specified
    args.viz_model = args.viz_model or args.model

    work_dir = Path(args.work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    narrative = None
    plan = None
    act_specs = {}
    gate_specs = {}
    viz_spec = None

    # ── Load or generate artifacts ──
    if args.resume:
        print(f"Resuming from: {args.resume}")
        narrative, plan, act_specs, gate_specs, viz_spec = load_artifacts(args.resume)
        work_dir = Path(args.resume)
        # Loaded artifacts skip the generate-path stage functions (and their
        # assert_*_shape guards). Validate here so --resume gets identical checks.
        assert_loaded_artifacts(plan, act_specs, gate_specs, viz_spec)

    elif args.plan:
        # Skip stages 1-2: load existing structured plan
        with open(args.plan) as f:
            plan = json.load(f)
        # --plan bypasses stage2_structure's assert_plan_shape — enforce it here.
        assert_loaded_artifacts(plan=plan)
        save_artifacts(work_dir, plan=plan)

    elif args.narrative:
        # Skip stage 1: load existing narrative, will run stage 2
        narrative_path = Path(args.narrative)
        narrative = narrative_path.read_text() if narrative_path.exists() else args.narrative

    elif args.problem:
        # Read problem text
        problem_path = Path(args.problem)
        problem_text = problem_path.read_text() if problem_path.exists() else args.problem

        objectives = None
        if args.objectives:
            obj_path = Path(args.objectives)
            objectives = obj_path.read_text() if obj_path.exists() else args.objectives

        # Stage 1: Solution Planner (natural language)
        narrative = stage1_solve(problem_text, objectives, model=args.model)
        save_artifacts(work_dir, problem_text=problem_text, narrative=narrative)
        print(f"  Saved narrative to: {work_dir / 'narrative.md'}")

    if args.stage == "narrative":
        print("\nDone (stage: narrative). Edit the narrative, then re-run with --narrative.")
        return

    # ── Single-agent mega stage (experiment): replaces stage2_structure +
    # stage2_author_acts + stage2b_author_gates + stage3_author_viz with one
    # LLM call. Populating plan/act_specs/gate_specs/viz_spec here makes the
    # normal "if not X:" stage guards below no-op for stages this call covers,
    # so assembly + build proceed exactly as in the normal flow.
    if args.single_agent_prompt and not plan:
        if args.problem:
            problem_path = Path(args.problem)
            problem_text = problem_path.read_text() if problem_path.exists() else args.problem
        else:
            problem_text = _load_problem_text(work_dir)

        timing = {}
        plan, act_specs, gate_specs, viz_spec = stage_single_agent_mega(
            problem_text, narrative, model=args.model,
            single_agent_prompt_path=args.single_agent_prompt, timing_sink=timing,
        )
        save_artifacts(work_dir, plan=plan, act_specs=act_specs, gate_specs=gate_specs,
                       viz_spec=viz_spec)
        if timing:
            with open(work_dir / "timing.json", "w") as f:
                json.dump(timing, f, indent=2)
        print(f"  Saved plan+acts+gates+viz to: {work_dir}")

    # ── Stage 2: Structure Agent (narrative → lesson_plan.json) ──
    if not plan and narrative:
        # Recover problem text for stage 2
        if args.problem:
            problem_path = Path(args.problem)
            problem_text = problem_path.read_text() if problem_path.exists() else args.problem
        else:
            problem_text = _load_problem_text(work_dir)

        objectives = None
        if args.objectives:
            obj_path = Path(args.objectives)
            objectives = obj_path.read_text() if obj_path.exists() else args.objectives

        timing = {}
        plan = stage2_structure(problem_text, narrative, objectives, model=args.model,
                                planner_prompt_path=args.planner_prompt, timing_sink=timing)
        save_artifacts(work_dir, plan=plan)
        if timing:
            with open(work_dir / "timing.json", "w") as f:
                json.dump(timing, f, indent=2)
        print(f"  Saved plan to: {work_dir / 'lesson_plan.json'}")

    if args.stage == "plan":
        print("\nDone (stage: plan). Edit the plan, then re-run with --plan.")
        return

    # ── Stage 3a: Author acts ──
    # Gate authoring is a separate condition so that resuming with existing acts
    # but missing gates (e.g. after --stage acts) still runs the gate worker.
    if not act_specs and plan:
        act_specs = stage2_author_acts(plan, model=args.model)
        save_artifacts(work_dir, act_specs=act_specs)

    # ── Stage 3b: Author gates (independent of whether acts were fresh or loaded) ──
    if not gate_specs and plan and act_specs:
        gate_specs = stage2b_author_gates(plan, act_specs, model=args.model)
        save_artifacts(work_dir, gate_specs=gate_specs)

    if args.stage == "acts":
        print("\nDone (stage: acts). Edit act/gate specs, then re-run with --resume.")
        return

    # ── Stage 4: Author visualization ──
    if not viz_spec and plan:
        viz_spec = stage3_author_viz(plan, act_specs, model=args.viz_model)
        if args.viz_screenshot_feedback and viz_spec:
            if _is_gemini(args.viz_model):
                print("\n  ⚠️  WARNING: --viz-screenshot-feedback requires an "
                      "Anthropic model (multimodal tool-use).")
                print(f"     Current model: {args.model} (Gemini). "
                      "Stage 4b will be SKIPPED — your viz agent will not see "
                      "its render. Pass --model claude-sonnet-4-20250514 (or "
                      "similar) to enable sighted self-revision.")
            else:
                viz_spec = stage3b_viz_visual_revision(
                    plan, act_specs, gate_specs, viz_spec, work_dir, args.model
                )
        save_artifacts(work_dir, viz_spec=viz_spec)

    if args.stage == "viz":
        print("\nDone (stage: viz). Edit viz spec, then re-run with --resume.")
        return

    # ── Stage 5: Assemble ──
    content_path = None
    viz_path = None
    if plan and act_specs:
        content_path, viz_path = stage4_assemble(plan, act_specs, gate_specs, viz_spec, work_dir)

    if args.stage == "assemble":
        print("\nDone (stage: assemble). Review the JS, then re-run with --resume.")
        return

    # ── Stage 6: Review ──
    # Flow:
    #   default:    assemble → review (corrects JS) → build (uses corrected JS)
    #   --screenshot: assemble → build → screenshot → review (sighted) → rebuild
    if content_path and not args.no_review:
        # For --screenshot flow: pre-build + screenshot BEFORE review so the
        # reviewer actually receives the rendered image.
        _screenshot = None
        if args.screenshot and args.output:
            if build_html(content_path, viz_path, args.output):
                shot_path = work_dir / "screenshot.png"
                if take_screenshot(args.output, str(shot_path)):
                    _screenshot = str(shot_path)

        with open(content_path) as f:
            content_js = f.read()
        viz_js = None
        if viz_path:
            with open(viz_path) as f:
                viz_js = f.read()

        reviewed_content, reviewed_viz, issues = stage5_review(
            plan, content_js, viz_js,
            screenshot_path=_screenshot,
            model=args.model
        )

        # Write corrected files if reviewer made changes
        if reviewed_content != content_js:
            with open(content_path, "w") as f:
                f.write(reviewed_content)
            print(f"  Updated: {content_path}")
        if viz_path and reviewed_viz and reviewed_viz != viz_js:
            with open(viz_path, "w") as f:
                f.write(reviewed_viz)
            print(f"  Updated: {viz_path}")

        # Save review report
        report_path = work_dir / "review_report.json"
        with open(report_path, "w") as f:
            json.dump(issues, f, indent=2, ensure_ascii=False)
        print(f"  Report:  {report_path}")

    if args.stage == "review":
        print("\nDone (stage: review).")
        return

    # ── Build HTML (final — uses reviewed JS if the reviewer corrected anything) ──
    if content_path and args.output:
        build_html(content_path, viz_path, args.output)
        if args.audio:
            stage_audio_and_rebuild(content_path, viz_path, args.output, work_dir)
        else:
            print("  NOTE: built WITHOUT audio narration (pass --audio for the narrated build).")

    print("\nPipeline complete.")


if __name__ == "__main__":
    main()
