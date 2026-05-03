"""
Run Stage 4 (viz) for one model; fall back to bench_claude viz on failure.
Usage: python run_viz_with_fallback.py <model_slug> <work_dir> <output_html>
"""
import sys, os, json, shutil, subprocess
from pathlib import Path

PIPELINE_DIR = Path(__file__).parent
CODE2HTML_DIR = PIPELINE_DIR.parent
FALLBACK_VIZ = CODE2HTML_DIR / "work/bench_claude/viz_spec.json"

def is_valid_viz(spec):
    code = spec.get("code", "")
    if not code or code.strip() == "window.EXPLAINER_VIZ = (function() {... });":
        return False, "placeholder code"
    # Check JS syntax
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
        f.write(code); path = f.name
    r = subprocess.run(["node", "--check", path], capture_output=True, text=True)
    os.unlink(path)
    if r.returncode != 0:
        return False, f"JS syntax error: {r.stderr[:100]}"
    return True, "ok"

def main():
    model_slug, work_dir, output_html = sys.argv[1], sys.argv[2], sys.argv[3]
    work_dir = Path(work_dir)
    viz_spec_path = work_dir / "viz_spec.json"

    # Remove any stale viz spec so orchestrator re-runs stage 4
    if viz_spec_path.exists():
        viz_spec_path.unlink()

    model = f"openrouter:{model_slug}"
    print(f"\n{'='*60}")
    print(f"Running viz stage for: {model_slug}")
    print(f"Work dir: {work_dir}")

    failure_reason = None
    try:
        result = subprocess.run(
            [sys.executable, "orchestrator.py",
             "--resume", str(work_dir),
             "--work-dir", str(work_dir),
             "--viz-model", model,
             "--output", output_html,
             "--no-review",
             "--stage", "all"],
            cwd=str(PIPELINE_DIR),
            capture_output=False,
            timeout=300,
            env={**os.environ, "OPENROUTER_API_KEY": os.environ.get("OPENROUTER_API_KEY", "")},
        )
        if result.returncode != 0:
            failure_reason = f"orchestrator exited with code {result.returncode}"
    except subprocess.TimeoutExpired:
        failure_reason = "timeout (300s)"
    except Exception as e:
        failure_reason = str(e)

    # Validate generated viz
    if not failure_reason and viz_spec_path.exists():
        with open(viz_spec_path) as f:
            spec = json.load(f)
        ok, reason = is_valid_viz(spec)
        if not ok:
            failure_reason = f"viz validation failed: {reason}"

    if failure_reason:
        print(f"\n  ⚠  {model_slug} viz FAILED: {failure_reason}")
        print(f"  → Using Claude baseline viz as fallback")
        shutil.copy(FALLBACK_VIZ, viz_spec_path)
        # Rebuild with fallback viz
        result2 = subprocess.run(
            [sys.executable, "orchestrator.py",
             "--resume", str(work_dir),
             "--work-dir", str(work_dir),
             "--output", output_html,
             "--no-review",
             "--stage", "all"],
            cwd=str(PIPELINE_DIR),
            capture_output=False,
            env={**os.environ},
        )
        status = "FALLBACK (Claude viz)"
    else:
        status = "PASSED"
        print(f"\n  ✓  {model_slug} viz passed validation")

    print(f"\nResult: {model_slug} → {status}")
    print(f"Output: {output_html}")
    return 0 if status == "PASSED" else 1

if __name__ == "__main__":
    sys.exit(main())
