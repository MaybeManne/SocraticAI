"""
End-to-end pipeline smoke test with mocked LLM calls.

Runs stage1 → stage2 → stage3 (acts+gates) → stage4 (viz) → stage5 (assemble)
against scripted LLM responses, verifying:
  - every stage produces its expected artifact shape
  - validators don't reject the canned "good" outputs
  - the final assembled JS contains expected DSL calls
  - the pipeline survives wiring changes between stages

This is a structural / integration test — it does not test content quality,
only that the agents plug together correctly. Full LLM calls are NOT made.
"""
import sys, os, json, pytest
from unittest.mock import patch
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from orchestrator import (
    stage1_solve, stage2_structure, stage2_author_acts,
    stage2b_author_gates, stage3_author_viz, stage4_assemble,
)


NARRATIVE = (
    "We solve the archer problem by decomposing the initial velocity into "
    "horizontal and vertical components. The horizontal motion is uniform, "
    "the vertical motion is uniform acceleration. We solve for flight time "
    "when y returns to zero, then multiply by horizontal velocity to get the "
    "range. The answer is approximately 141 meters. This pedagogy builds from "
    "decomposition to independent motions to combination.\n"
) * 2


PLAN = {
    "meta": {"title": "Test Projectile", "source": "Unit test",
             "estimated_duration_minutes": 3.0},
    "problem": {"text": "Test problem", "answer": "141 m"},
    "nodes": [
        {"id": "act_intro", "type": "act", "title": "Setup",
         "objective": "Introduce problem",
         "beat_outline": [{"description": "intro", "viz_actions": ["draw"]}]},
        {"id": "gate_check", "type": "gate",
         "gate_type": "fill-in", "after_act": "act_intro",
         "wrong_path_acts": []},
        {"id": "act_solve", "type": "act", "title": "Solve",
         "objective": "Compute final answer",
         "beat_outline": [{"description": "combine", "viz_actions": ["show"]}]},
    ],
    "viz_requirements": {
        "type": "svg",
        "description": "trajectory",
        "actions": [
            {"method": "draw", "description": "draw arrow", "params_schema": {}},
            {"method": "show", "description": "show range", "params_schema": {}},
        ],
    },
}

ACT_SPECS = {
    "act_intro": {"act_id": "act_intro", "title": "Setup", "viz_panel": "svg",
        "beats": [{"say": "Watch the arrow launch.",
                   "viz_actions": [{"method": "draw", "params": {}, "offset": 0}]}]},
    "act_solve": {"act_id": "act_solve", "title": "Solve", "viz_panel": "svg",
        "beats": [{"say": "Range equals 141 meters.",
                   "viz_actions": [{"method": "show", "params": {}, "offset": 0}]}]},
}

GATE_SPEC = {
    "gate_type": "fill-in", "after_act": "act_intro",
    "prompt": "The range is [___] m.",
    "blank": {"answer": ["141"], "width": 60},
    "hint": "Use R = v0² sin(2θ)/g",
    "successMessage": "Correct!",
}

VIZ_SPEC = {
    "mode": "custom_code",
    "plugin_name": "test_projectile",
    "config": {"viewBox": "0 0 800 400"},
    "actions_implemented": ["draw", "show"],
    "code": (
        'window.EXPLAINER_VIZ = (function() {\n'
        '  var Z = { EQN: { x: 10, y: 10, w: 200, h: 60 } };\n'
        '  return { name: "test_projectile",\n'
        '    init: function(svg, cfg) {},\n'
        '    timelineAction: function(tl, method, params, t) {\n'
        '      if (method === "draw") { tl.to({}, {duration: 0.5}, t); }\n'
        '      if (method === "show") { tl.to({}, {duration: 0.5}, t); }\n'
        '    }};\n'
        '})();\n'
    ),
}


@pytest.fixture
def tmp_work(tmp_path):
    return tmp_path


def test_e2e_pipeline_with_mocked_llm(tmp_work):
    """
    Full pipeline: stage1 text call + stage2..4 structured calls, all mocked.
    Verifies each stage consumes the previous stage's output correctly and
    the final assembly produces content+viz JS with expected structure.
    """
    # stage1 = text call; stages 2, 3a (per-act), 3b (per-gate), 4 = structured.
    structured_outputs = [PLAN, ACT_SPECS["act_intro"], ACT_SPECS["act_solve"],
                          GATE_SPEC, VIZ_SPEC]
    structured_iter = iter(structured_outputs)

    with patch("orchestrator.call_llm_text", return_value=NARRATIVE), \
         patch("orchestrator.call_llm",
               side_effect=lambda *a, **kw: next(structured_iter)):

        narrative = stage1_solve("Test problem")
        assert "decomposing" in narrative

        plan = stage2_structure("Test problem", narrative)
        assert plan["meta"]["title"] == "Test Projectile"
        assert len(plan["nodes"]) == 3

        act_specs = stage2_author_acts(plan)
        assert "act_intro" in act_specs and "act_solve" in act_specs
        assert len(act_specs["act_intro"]["beats"]) == 1

        gate_specs = stage2b_author_gates(plan, act_specs)
        assert "gate_check" in gate_specs
        assert "[___]" in gate_specs["gate_check"]["prompt"]

        viz_spec = stage3_author_viz(plan, act_specs)
        assert viz_spec["mode"] == "custom_code"
        assert "draw" in viz_spec["actions_implemented"]

    content_path, viz_path = stage4_assemble(
        plan, act_specs, gate_specs, viz_spec, tmp_work
    )

    content_js = open(content_path).read()
    assert "MX.lesson(" in content_js
    assert "Watch the arrow launch" in content_js
    assert "Range equals 141" in content_js
    assert "L.askFillIn" in content_js or "L.ask" in content_js
    assert "[___]" in content_js, "fill-in prompt must preserve [___] marker"

    assert viz_path is not None
    viz_js = open(viz_path).read()
    assert "EXPLAINER_VIZ" in viz_js
    assert "timelineAction" in viz_js


def test_e2e_gate_without_blank_marker_is_rejected_upstream():
    """A fill-in gate missing [___] must fail validate_gate_spec so the
    pipeline never assembles a broken checkpoint."""
    from validate import validate_gate_spec
    bad = dict(GATE_SPEC)
    bad["prompt"] = "No marker here."
    errors = validate_gate_spec(bad)
    assert any("[___]" in e for e in errors)
