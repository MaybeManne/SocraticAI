"""
Tests for pipeline safety guards:
  - _check_viz_layout: heuristic layout audit (zones, overlap, OOB)
  - _reject_if_invalid_dsl: reviewer DSL whitelist (pins the .pause() bug)

These regressions shipped into a real lesson (archer projectile motion) and
broke playback / checkpoints. The guards catch them before assembly.
"""
import sys, os, pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from orchestrator import _check_viz_layout, _reject_if_invalid_dsl


# ─────────────────────────────────────────────────────────────────────
# _check_viz_layout
# ─────────────────────────────────────────────────────────────────────
class TestCheckVizLayout:

    def test_clean_code_with_zones_produces_no_warnings(self):
        code = """
        var Z = { EQN: { x: 260, y: 10, w: 240, h: 70 },
                  CALC: { x: 510, y: 150, w: 280, h: 230 } };
        var slots = {};
        function clearSlot(id) { }
        case "showEquation":
          clearSlot("eqn");
          svgEl("text", { x: Z.EQN.x + 12, y: Z.EQN.y + 22 }, g);
          svgEl("text", { x: Z.EQN.x + 12, y: Z.EQN.y + 50 }, g);
          svgEl("text", { x: Z.CALC.x + 14, y: Z.CALC.y + 22 }, g);
          svgEl("text", { x: Z.CALC.x + 14, y: Z.CALC.y + 50 }, g);
          svgEl("text", { x: Z.CALC.x + 14, y: Z.CALC.y + 78 }, g);
        """
        assert _check_viz_layout(code) == []

    def test_stacked_text_in_loop_without_clearSlot_flagged(self):
        """Regression: archer plugin stacked derivation text at y: 100 + i*25
        with no clearSlot — new calls piled on top of prior text."""
        code = """
        case "animateCalculation":
          params.steps.forEach(function(step, i) {
            svgEl("text", { x: 500, y: 100 + i*25 }, equationG);
          });
        """
        warnings = _check_viz_layout(code)
        assert any("stacked-text" in w for w in warnings), warnings

    def test_out_of_bounds_literal_coordinates_flagged(self):
        """x:950 / y:500 outside viewBox 800x400 → clipped element."""
        code = """
        var Z = { X: {x:10,y:10} };
        svgEl("text", { x: 950, y: 500 }, g);
        svgEl("rect", { x: 10, y: 600 }, g);
        """
        warnings = _check_viz_layout(code)
        assert any("out-of-bounds" in w for w in warnings)
        assert any("950" in w or "500" in w or "600" in w for w in warnings)

    def test_freehand_text_without_zone_references_flagged(self):
        """5+ text elements created with no Z.<NAME> references = freehand layout."""
        code = """
        svgEl("text", {x: 100, y: 50}, g);
        svgEl("text", {x: 200, y: 60}, g);
        svgEl("text", {x: 300, y: 70}, g);
        svgEl("text", {x: 400, y: 80}, g);
        svgEl("text", {x: 100, y: 90}, g);
        """
        warnings = _check_viz_layout(code)
        assert any("zone discipline" in w for w in warnings), warnings

    def test_empty_code_produces_no_warnings(self):
        assert _check_viz_layout("") == []
        assert _check_viz_layout(None) == []


# ─────────────────────────────────────────────────────────────────────
# _reject_if_invalid_dsl  (pins the archer .pause() bug)
# ─────────────────────────────────────────────────────────────────────
class TestRejectInvalidDsl:

    def test_pause_injection_rejected(self):
        """Regression: reviewer added `.pause(0.8)` to space narration. The
        DSL has no .pause() — this crashed the entire lesson build, leaving
        window.LESSON empty and the player stuck at 0:00."""
        original = 'A.say("first");\n  A.say("second");'
        corrupted = 'A.say("first")\n  .pause(0.8)\n  .say("second");'
        result = _reject_if_invalid_dsl(corrupted, original, "content")
        assert result == original, "reviewer's .pause() correction must be rejected"

    def test_wait_and_delay_also_rejected(self):
        original = 'A.say("x");'
        for bad_method in [".wait(1)", ".delay(0.5)", ".timing()", ".setTiming()"]:
            corrupted = f'A.say("x")\n  {bad_method}\n  .say("y");'
            assert _reject_if_invalid_dsl(corrupted, original) == original, \
                f"{bad_method} must be rejected"

    def test_valid_dsl_chain_accepted(self):
        original = 'A.say("old");'
        corrected = (
            'A.say("new narration")\n'
            '  .show("a note")\n'
            '  .do("draw", {})\n'
            '  .card("text", { content: "hi" })\n'
            '  .inline("svg");'
        )
        assert _reject_if_invalid_dsl(corrected, original) == corrected

    def test_identical_correction_is_passthrough(self):
        """No-op: corrected == original should return corrected without checks."""
        src = 'A.say("same");'
        assert _reject_if_invalid_dsl(src, src) == src
