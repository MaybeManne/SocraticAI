"""
Generic state machine + the concrete pipeline that runs on top of it.

StateMachine is modality-agnostic — states/transitions/handlers all come
from the caller, so this same class can drive an active-reader flow later,
not just the AMC pipeline.
"""

import argparse
from pathlib import Path

from orchestrator import (
    stage1_solve, stage2_structure, stage2_author_acts, stage2b_author_gates,
    stage3_author_viz, stage4_assemble, stage5_review,
    build_html, save_artifacts, load_artifacts, _load_problem_text,
)


# ═══════════════════════════════════════════════════════════════════
# Generic base
# ═══════════════════════════════════════════════════════════════════

class StateMachine:
    """Event-driven FSM. states/transitions/initial all passed in by caller.

    transitions = {state: {event: next_state}}

    Handlers are optional entry actions (no-arg callables) run when a state
    is entered. Register after construction, states with no handler just
    do nothing on entry.
    """

    def __init__(self, states, transitions, initial):
        self.states = set(states)
        self.transitions = transitions
        self.state = initial
        self.handlers = {}

    def register(self, state, handler):
        self.handlers[state] = handler

    def can(self, event):
        return event in self.transitions.get(self.state, {})

    def trigger(self, event):
        """Move on `event`, run the new state's handler, return the new state.

        Invalid event = no-op, returns None. If the handler raises, we've
        already move, self.state is the state that failed.
        """
        table = self.transitions.get(self.state, {})
        if event not in table:
            print(f"[StateMachine] Ignored event '{event}' in {self.state}")
            return None
        nxt = table[event]
        print(f"[StateMachine] {self.state} --{event}--> {nxt}")
        self.state = nxt
        handler = self.handlers.get(nxt)
        if handler:
            handler()
        return nxt


# ═══════════════════════════════════════════════════════════════════
# Pipeline states + transition graph
# ══════════════════════════════════════════════════════════════

IDLE        = "IDLE"
PLANNING    = "PLANNING"      # stage1_solve        → narrative
STRUCTURING = "STRUCTURING"   # stage2_structure    → plan
AUTHORING   = "AUTHORING"     # stage2_author_acts  → act_specs
GATING      = "GATING"        # stage2b_author_gates→ gate_specs
VISUALIZING = "VISUALIZING"   # stage3_author_viz   → viz_spec
ASSEMBLING  = "ASSEMBLING"    # stage4_assemble
REVIEWING   = "REVIEWING"     # stage5_review + build_html
DONE        = "DONE"
ERROR       = "ERROR"

# pipeline order — one handler per state, runs on entry
_ORDER = [PLANNING, STRUCTURING, AUTHORING, GATING, VISUALIZING, ASSEMBLING, REVIEWING]


def _linear_transitions(order, initial, done, error):
    """Build the {state: {"next": ..., "fail": error}} chain initial -> ... -> done."""
    chain = [initial, *order, done]
    transitions = {cur: {"next": nxt} for cur, nxt in zip(chain, chain[1:])}
    for state in order:
        transitions[state]["fail"] = error
    transitions[done] = {}
    transitions[error] = {}
    return transitions


# ═════════════════════════════════════════════════════════════════
# Concrete pipeline machine
# ═══════════════════════════════════════════════════════════════════

class PipelineStateMachine(StateMachine):
    """The 6-stage AMC pipeline on top of StateMachine.

    Just fires "next" down the chain. If a handler raises, fire "fail"
    instead (-> ERROR) and remember which stage broke.
    """

    def __init__(self, model="gemini-2.5-flash", review=True):
        states = [IDLE, *_ORDER, DONE, ERROR]
        transitions = _linear_transitions(_ORDER, IDLE, DONE, ERROR)
        super().__init__(states, transitions, IDLE)

        self.model = model
        self.review = review
        self.failed_stage = None   # which stage we were in when ERROR hit
        self.error = None          # exception message
        # set by run()/resume()
        self.work_dir = None
        self.output_path = None
        # artifacts, filled in as stages complete
        self.problem_text = None
        self.narrative = None
        self.plan = None
        self.act_specs = {}
        self.gate_specs = {}
        self.viz_spec = None
        self.content_path = None
        self.viz_path = None

        # IDLE/DONE/ERROR have no handler — nothing to do on entry
        self.register(PLANNING,    self._do_planning)
        self.register(STRUCTURING, self._do_structuring)
        self.register(AUTHORING,   self._do_authoring)
        self.register(GATING,      self._do_gating)
        self.register(VISUALIZING, self._do_visualizing)
        self.register(ASSEMBLING,  self._do_assembling)
        self.register(REVIEWING,   self._do_reviewing)

    # ─────────────────────────────────────────────────────────────────
    # Drivers
    # ─────────────────────────────────────────────────────────────────

    def run(self, problem_path, output_path, work_dir):
        """Fresh run from a problem file, all the way to DONE/ERROR."""
        self.work_dir = Path(work_dir)
        self.output_path = output_path
        self.work_dir.mkdir(parents=True, exist_ok=True)

        problem_path = Path(problem_path)
        self.problem_text = problem_path.read_text() if problem_path.exists() else str(problem_path)
        save_artifacts(self.work_dir, problem_text=self.problem_text)

        self.state = IDLE
        return self._run_to_done()

    def resume(self, work_dir, output_path):
        """Reload saved artifacts and pick up where we left off."""
        self.work_dir = Path(work_dir)
        self.output_path = output_path

        self.narrative, self.plan, self.act_specs, self.gate_specs, self.viz_spec = \
            load_artifacts(self.work_dir)
        self.problem_text = _load_problem_text(self.work_dir)

        self.state = self._resume_state()
        return self._run_to_done()

    def _run_to_done(self):
        """Keep firing "next" until DONE; catch a raise and go to ERROR instead."""
        while self.state not in (DONE, ERROR):
            try:
                self.trigger("next")
            except Exception as e:
                self.failed_stage = self.state
                self.error = str(e)
                self.trigger("fail")
                print(f"[Pipeline] FAILED in {self.failed_stage}: {e}")
                return self.state

        if self.state == DONE:
            print("[Pipeline] Complete.")
        return self.state

    def _resume_state(self):
        """Find the predecessor of the first missing artifact, so "next" lands
        on the stage that still needs to run. JS output isn't tracked, so if
        everything else exists we just redo ASSEMBLING + REVIEWING.
        """
        if not self.narrative:   return IDLE          # → PLANNING
        if not self.plan:        return PLANNING      # → STRUCTURING
        if not self.act_specs:   return STRUCTURING   # → AUTHORING
        if not self.gate_specs:  return AUTHORING     # → GATING
        if not self.viz_spec:    return GATING        # → VISUALIZING
        return VISUALIZING                            # → ASSEMBLING

    # ─────────────────────────────────────────────────────────────────
    # one orchestrator stage fn each, saving output as it goes
    # ─────────────────────────────────────────────────────────────────

    def _do_planning(self):
        self.narrative = stage1_solve(self.problem_text, model=self.model)
        save_artifacts(self.work_dir, narrative=self.narrative)

    def _do_structuring(self):
        self.plan = stage2_structure(self.problem_text, self.narrative, model=self.model)
        save_artifacts(self.work_dir, plan=self.plan)

    def _do_authoring(self):
        self.act_specs = stage2_author_acts(self.plan, model=self.model)
        save_artifacts(self.work_dir, act_specs=self.act_specs)

    def _do_gating(self):
        self.gate_specs = stage2b_author_gates(self.plan, self.act_specs, model=self.model)
        save_artifacts(self.work_dir, gate_specs=self.gate_specs)

    def _do_visualizing(self):
        self.viz_spec = stage3_author_viz(self.plan, self.act_specs, model=self.model)
        save_artifacts(self.work_dir, viz_spec=self.viz_spec)

    def _do_assembling(self):
        self.content_path, self.viz_path = stage4_assemble(
            self.plan, self.act_specs, self.gate_specs, self.viz_spec, self.work_dir
        )

    def _do_reviewing(self):
        # skip review -> assembled output is final, just build it
        if not self.review:
            build_html(self.content_path, self.viz_path, self.output_path)
            return

        with open(self.content_path) as f:
            content_js = f.read()
        viz_js = None
        if self.viz_path:
            with open(self.viz_path) as f:
                viz_js = f.read()

        reviewed_content, reviewed_viz, _issues = stage5_review(
            self.plan, content_js, viz_js, model=self.model
        )

        # write corrected JS back before building (same as orchestrator.main)
        if reviewed_content != content_js:
            with open(self.content_path, "w") as f:
                f.write(reviewed_content)
        if self.viz_path and reviewed_viz and reviewed_viz != viz_js:
            with open(self.viz_path, "w") as f:
                f.write(reviewed_viz)

        build_html(self.content_path, self.viz_path, self.output_path)


# ─────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Run the lesson pipeline as a guarded state machine."
    )
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--problem", help="Path to problem description (markdown/text)")
    src.add_argument("--resume", help="Work dir to resume from (skips completed stages)")

    parser.add_argument("--output", required=True, help="Path for final HTML output")
    parser.add_argument("--work-dir", default="output",
                        help="Directory for intermediate artifacts (ignored with --resume)")
    parser.add_argument("--model", default="gemini-2.5-flash", help="Model to use")
    parser.add_argument("--no-review", action="store_true", help="Skip the review stage")

    args = parser.parse_args()

    m = PipelineStateMachine(model=args.model, review=not args.no_review)
    if args.resume:
        final = m.resume(args.resume, args.output)
    else:
        final = m.run(args.problem, args.output, args.work_dir)

    if final == ERROR:
        raise SystemExit(f"Pipeline failed in {m.failed_stage}: {m.error}")


if __name__ == "__main__":
    main()
