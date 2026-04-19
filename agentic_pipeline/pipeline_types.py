"""
Pipeline artifact type definitions.

All TypedDicts mirror the JSON schemas in schemas/. Use these for:
  - mypy static checking across the pipeline
  - documentation of what each stage produces/consumes
  - runtime assertions at stage boundaries

NOTE: gate_id is absent from GateSpec — the orchestrator injects it from the
plan node's "id" field. The LLM never produces gate_id.
"""

from __future__ import annotations
from typing import Any, Dict, List, Literal, Optional, Union
try:
    from typing import TypedDict
except ImportError:
    from typing_extensions import TypedDict


# ─────────────────────────────────────────────────────────────────────
# Primitive building blocks
# ─────────────────────────────────────────────────────────────────────

ActId   = str  # must match ^act_[a-z0-9_]+$
GateId  = str  # must match ^gate_[a-z0-9_]+$
VizMode = Literal["svg", "figure", "chart", None]
GateType = Literal["quiz", "fill-in", "proof-builder", "interactive"]
NodeType = Literal["act", "gate", "marker"]


class VizAction(TypedDict, total=False):
    method: str                          # required
    params: Dict[str, Any]              # optional, defaults to {}
    offset: Union[str, int, float]       # optional, defaults to 0


class Beat(TypedDict, total=False):
    say: str                             # required — narration text
    card: Optional[Dict[str, Any]]       # optional — card definition
    viz_actions: List[VizAction]         # optional, defaults to []
    inline_viz: Optional[Union[str, bool]]  # "svg" | "figure" | "chart" | True
    duration: Optional[float]            # override auto-estimated duration
    viz_panel_override: Optional[str]    # per-beat vizPanel mode override


# ─────────────────────────────────────────────────────────────────────
# Stage 3a output: ActSpec
# ─────────────────────────────────────────────────────────────────────

class ActSpec(TypedDict):
    act_id: ActId
    title: str
    viz_panel: Optional[Literal["svg", "figure", "chart"]]
    beats: List[Beat]


# ─────────────────────────────────────────────────────────────────────
# Stage 3b output: GateSpec
#
# gate_id is NOT part of LLM output. The orchestrator injects it:
#   spec["gate_id"] = node["id"]   # always from the plan, never from LLM
# ─────────────────────────────────────────────────────────────────────

class BlankConfig(TypedDict, total=False):
    answer: List[str]       # required — accepted answers
    width: int              # optional — input width in pixels
    placeholder: str        # optional — placeholder text


class GateSpec(TypedDict, total=False):
    # Injected by pipeline — not LLM output:
    gate_id: GateId          # set by orchestrator from plan node["id"]

    # LLM produces these:
    gate_type: GateType      # required
    after_act: ActId         # required — must match a plan act node id

    # Quiz fields:
    question: str
    options: List[str]
    correct: Union[int, str]
    explanations: Dict[str, str]

    # Fill-in fields:
    prompt: str
    blank: BlankConfig
    hint: str
    successMessage: str

    # Proof-builder fields:
    instruction: str
    availablePieces: List[Dict[str, str]]  # [{id, latex}]
    correctOrder: List[str]
    slots: int

    # Interactive fields:
    title: str
    description: str
    slider: Dict[str, Any]
    compute: str
    displays: List[Dict[str, str]]
    challenge: str

    # Wrong path:
    wrong_path_acts: List[ActId]


# ─────────────────────────────────────────────────────────────────────
# Stage 4 output: VizSpec
# ─────────────────────────────────────────────────────────────────────

class VizSpec(TypedDict, total=False):
    mode: Literal["preset", "custom_code", "mobject_plugin", "three_js"]  # required
    preset: Optional[str]             # if mode == "preset"
    config: Optional[Dict[str, Any]]  # passed to L.viz()
    code: Optional[str]               # if mode == "custom_code"
    mobject_plugin_code: Optional[str]  # if mode == "mobject_plugin"
    three_js_code: Optional[str]      # if mode == "three_js"
    actions_implemented: List[str]    # method names the plugin implements


# ─────────────────────────────────────────────────────────────────────
# Stage 2 output: LessonPlan nodes
# ─────────────────────────────────────────────────────────────────────

class BeatOutline(TypedDict, total=False):
    narration_hint: str           # required
    card_type: Optional[str]
    viz_actions: List[str]        # method names (not yet parameterized)
    inline_at_end: bool


class ActNode(TypedDict, total=False):
    type: Literal["act"]          # required
    id: ActId                     # required — unique, ^act_[a-z0-9_]+$
    title: str                    # required
    objective: str                # required
    viz_panel: Optional[Literal["svg", "figure", "chart"]]  # required (can be null)
    beat_outline: List[BeatOutline]  # required
    context_from_previous: str
    wrong_path_acts: List["ActNode"]  # for branch acts


class GateNode(TypedDict, total=False):
    type: Literal["gate"]         # required
    id: GateId                    # required — unique, ^gate_[a-z0-9_]+$
    gate_type: GateType           # required
    after_act: ActId              # required — must reference an existing act id
    question_hint: str
    wrong_path_hint: str
    wrong_path_acts: List[ActNode]  # branch acts defined inline


class MarkerNode(TypedDict):
    type: Literal["marker"]
    label: str
    after_act: ActId


PlanNode = Union[ActNode, GateNode, MarkerNode]


class VizActionSpec(TypedDict, total=False):
    method: str          # required
    description: str     # required
    params_schema: Dict[str, str]  # param_name -> type string


class VizRequirements(TypedDict, total=False):
    type: Literal["custom", "preset_number_line", "preset_coord_plane",
                  "preset_unit_circle", "none"]  # required
    description: str     # required
    actions: List[VizActionSpec]  # required — the action contract
    config: Dict[str, Any]
    viewBox: str


class PlanMeta(TypedDict, total=False):
    title: str           # required
    source: str          # required
    answer: str
    estimated_duration_minutes: float


class PlanProblem(TypedDict, total=False):
    text: str            # required
    highlight: str


class LessonPlan(TypedDict):
    meta: PlanMeta
    problem: PlanProblem
    viz_requirements: VizRequirements
    nodes: List[PlanNode]


# ─────────────────────────────────────────────────────────────────────
# Pipeline-level types
# ─────────────────────────────────────────────────────────────────────

ActSpecMap  = Dict[ActId, ActSpec]
GateSpecMap = Dict[GateId, GateSpec]


# ─────────────────────────────────────────────────────────────────────
# Runtime structural assertions — called at every stage boundary.
#
# 6.031 "avoiding debugging" applied: fail fast with a precise error that
# names the stage, the field, and the expected shape. These are cheap
# guards that catch contract violations before they silently propagate
# through subsequent stages (the way the gate-drop bug did).
#
# Each asserter raises TypeError with a message that pinpoints the bad
# input. They do NOT mutate their argument.
# ─────────────────────────────────────────────────────────────────────

import re as _re

_ACT_ID_RE  = _re.compile(r"^act_[a-z0-9_]+$")
_GATE_ID_RE = _re.compile(r"^gate_[a-z0-9_]+$")
_VALID_GATE_TYPES = {"quiz", "fill-in", "proof-builder", "interactive"}
_VALID_NODE_TYPES = {"act", "gate", "marker"}
_VALID_VIZ_MODES  = {"preset", "custom_code", "mobject_plugin", "three_js"}


def _require(cond, msg):
    if not cond:
        raise TypeError(f"[pipeline contract] {msg}")


def assert_plan_shape(plan):
    """Raise TypeError unless `plan` matches LessonPlan. Called after stage 2."""
    _require(isinstance(plan, dict), f"plan must be dict, got {type(plan).__name__}")
    _require("meta" in plan and "title" in plan["meta"], "plan.meta.title missing")
    _require("problem" in plan and "text" in plan["problem"], "plan.problem.text missing")
    _require(isinstance(plan.get("nodes"), list), "plan.nodes must be list")

    ids = set()
    for i, n in enumerate(plan["nodes"]):
        _require(isinstance(n, dict), f"plan.nodes[{i}] not a dict")
        t = n.get("type")
        _require(t in _VALID_NODE_TYPES, f"plan.nodes[{i}].type={t!r} invalid")
        if t in ("act", "gate"):
            nid = n.get("id")
            _require(isinstance(nid, str), f"plan.nodes[{i}].id missing")
            if t == "act":
                _require(_ACT_ID_RE.match(nid),
                         f"act id {nid!r} must match ^act_[a-z0-9_]+$")
            else:
                _require(_GATE_ID_RE.match(nid),
                         f"gate id {nid!r} must match ^gate_[a-z0-9_]+$")
                _require(n.get("gate_type") in _VALID_GATE_TYPES,
                         f"gate {nid} has invalid gate_type {n.get('gate_type')!r}")
                _require(isinstance(n.get("after_act"), str),
                         f"gate {nid}.after_act missing")
            _require(nid not in ids, f"duplicate node id: {nid}")
            ids.add(nid)


def assert_act_spec_shape(spec, plan_node=None):
    """Raise unless `spec` matches ActSpec. If plan_node provided, also checks:
       - spec.act_id == plan_node.id
       - len(spec.beats) == len(plan_node.beat_outline)  (no duplicates, no drops)
       - beat 'say' fields are unique (catches the duplicate-beat bug).
    """
    _require(isinstance(spec, dict), f"act spec not a dict: {type(spec).__name__}")
    _require(_ACT_ID_RE.match(spec.get("act_id", "")),
             f"act_id missing/invalid: {spec.get('act_id')!r}")
    beats = spec.get("beats")
    _require(isinstance(beats, list) and len(beats) > 0,
             f"act {spec.get('act_id')}: beats must be non-empty list")
    for i, b in enumerate(beats):
        _require(isinstance(b, dict), f"act {spec['act_id']} beat {i} not dict")
        _require(isinstance(b.get("say"), str) and b["say"].strip(),
                 f"act {spec['act_id']} beat {i} missing/empty 'say'")

    says = [b["say"] for b in beats]
    dup_idx = _find_duplicate(says)
    if dup_idx is not None:
        raise TypeError(
            f"[pipeline contract] act {spec['act_id']}: duplicate beat text at "
            f"positions {dup_idx}. Act worker produced repeated narration. "
            f"Offending text: {says[dup_idx[0]][:100]!r}"
        )

    if plan_node is not None:
        _require(spec["act_id"] == plan_node["id"],
                 f"act_id {spec['act_id']!r} != plan node id {plan_node['id']!r}")
        outline = plan_node.get("beat_outline", [])
        if outline:
            _require(len(beats) == len(outline),
                     f"act {spec['act_id']}: produced {len(beats)} beats, plan "
                     f"beat_outline has {len(outline)}. Act worker dropped or "
                     f"duplicated beats.")


def _find_duplicate(xs):
    seen = {}
    for i, x in enumerate(xs):
        if x in seen:
            return (seen[x], i)
        seen[x] = i
    return None


def assert_gate_spec_shape(spec, plan_node=None):
    """Raise unless `spec` matches GateSpec after orchestrator injection.

    Post-injection the spec MUST contain gate_id (authoritative, from plan),
    after_act, and gate_type. This is what the assembler looks up; mismatches
    here were the critical gate-drop bug.
    """
    _require(isinstance(spec, dict), f"gate spec not a dict: {type(spec).__name__}")
    _require(_GATE_ID_RE.match(spec.get("gate_id", "")),
             f"gate_id missing/invalid (must be injected from plan): {spec.get('gate_id')!r}")
    _require(spec.get("gate_type") in _VALID_GATE_TYPES,
             f"gate {spec.get('gate_id')}: invalid gate_type {spec.get('gate_type')!r}")
    _require(isinstance(spec.get("after_act"), str) and _ACT_ID_RE.match(spec["after_act"]),
             f"gate {spec.get('gate_id')}: after_act missing/invalid")

    if plan_node is not None:
        _require(spec["gate_id"] == plan_node["id"],
                 f"gate_id mismatch: spec={spec['gate_id']!r} plan={plan_node['id']!r}. "
                 f"Assembler lookup would fail.")
        _require(spec["gate_type"] == plan_node["gate_type"],
                 f"gate {spec['gate_id']}: gate_type mismatch with plan")
        _require(spec["after_act"] == plan_node["after_act"],
                 f"gate {spec['gate_id']}: after_act mismatch with plan")


def assert_viz_spec_shape(spec):
    _require(isinstance(spec, dict), "viz spec not dict")
    _require(spec.get("mode") in _VALID_VIZ_MODES,
             f"viz spec mode {spec.get('mode')!r} invalid")
    if spec["mode"] == "custom_code":
        _require(isinstance(spec.get("code"), str) and spec["code"].strip(),
                 "custom_code mode requires non-empty 'code'")
    elif spec["mode"] == "mobject_plugin":
        _require(isinstance(spec.get("mobject_plugin_code"), str) and spec["mobject_plugin_code"].strip(),
                 "mobject_plugin mode requires non-empty 'mobject_plugin_code'")
    elif spec["mode"] == "three_js":
        _require(isinstance(spec.get("three_js_code"), str) and spec["three_js_code"].strip(),
                 "three_js mode requires non-empty 'three_js_code'")
    elif spec["mode"] == "preset":
        _require(isinstance(spec.get("preset"), str) and spec["preset"].strip(),
                 "preset mode requires non-empty 'preset'")


def assert_viz_implements_plan_actions(viz_spec, plan):
    """Every action declared in plan.viz_requirements.actions must appear in
       viz_spec.actions_implemented. Catches silent drops by the viz agent."""
    declared = {a["method"] for a in plan.get("viz_requirements", {}).get("actions", [])}
    implemented = set(viz_spec.get("actions_implemented", []))
    missing = declared - implemented
    if missing:
        raise TypeError(
            f"[pipeline contract] viz_spec is missing {len(missing)} action(s) "
            f"declared in the plan: {sorted(missing)}. Viz agent silently dropped them."
        )
