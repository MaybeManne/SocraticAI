"""
v3 benchmark runner — runs Stage 4 (viz) for models with >=64k context.
Tracks token usage/cost, handles json_object incompatibility, falls back on failure.

Usage:
    python run_v3_bench.py
"""
import sys, os, json, shutil, subprocess, tempfile, time
from pathlib import Path

PIPELINE_DIR = Path(__file__).parent
CODE2HTML_DIR = PIPELINE_DIR.parent
FALLBACK_VIZ  = CODE2HTML_DIR / "work" / "bench_claude" / "viz_spec.json"
DEMO_BENCH    = CODE2HTML_DIR / "demo_bench"

OR_KEY = os.environ.get("OPENROUTER_API_KEY", "")

MODELS = [
    {
        "slug": "deepseek/deepseek-chat-v3-0324",
        "name": "deepseek",
        "ctx_k": 163,
        "price_in":  0.20 / 1e6,   # $/token
        "price_out": 0.77 / 1e6,
        "json_object": True,
    },
    {
        "slug": "google/gemma-3-27b-it",
        "name": "gemma",
        "ctx_k": 131,
        "price_in":  0.08 / 1e6,
        "price_out": 0.16 / 1e6,
        "json_object": False,   # Gemma doesn't support response_format=json_object
    },
    {
        "slug": "nvidia/llama-3.1-nemotron-70b-instruct",
        "name": "nemotron",
        "ctx_k": 131,
        "price_in":  1.20 / 1e6,
        "price_out": 1.20 / 1e6,
        "json_object": True,
    },
]


def node_check(code: str) -> list[str]:
    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
        f.write(code); path = f.name
    r = subprocess.run(["node", "--check", path], capture_output=True, text=True)
    os.unlink(path)
    return [r.stderr.strip()] if r.returncode != 0 else []


def is_valid_viz(spec: dict) -> tuple[bool, str]:
    code = spec.get("code", "")
    if not code or len(code.strip()) < 200:
        return False, "empty or placeholder code"
    if "function() {... }" in code or "(function() {... })" in code:
        return False, "placeholder stub"
    errs = node_check(code)
    if errs:
        return False, f"JS syntax error: {errs[0][:120]}"
    ai = spec.get("actions_implemented", [])
    if not ai:
        return False, "actions_implemented empty"
    return True, "ok"


def build_html(work_dir: Path, output_html: str) -> bool:
    """Assemble content + viz → HTML via orchestrator (assemble + build only)."""
    r = subprocess.run(
        [sys.executable, "orchestrator.py",
         "--resume", str(work_dir),
         "--work-dir", str(work_dir),
         "--output", output_html,
         "--no-review",
         "--stage", "all"],
        cwd=str(PIPELINE_DIR),
        capture_output=True, text=True,
        env={**os.environ},
    )
    print(r.stdout[-800:] if r.stdout else "")
    if r.stderr:
        print("[stderr]", r.stderr[-400:])
    return r.returncode == 0


def verify_html(html_path: str) -> dict:
    """Run JS syntax check and basic presence checks on built HTML."""
    html = Path(html_path).read_text()
    import re

    scripts = re.findall(r'<script>([\s\S]+?)</script>', html)
    js_errors = []
    for i, s in enumerate(scripts):
        errs = node_check(s)
        if errs:
            js_errors.append(f"block {i+1}: {errs[0][:80]}")

    return {
        "js_errors":    js_errors,
        "katex_inline": "e.katex=t()" in html,
        "gsap_inline":  "GSAP 3" in html,
        "has_audio":    "b64:" in html,
        "viz_code":     "EXPLAINER_VIZ" in html,
        "size_kb":      round(len(html) / 1024),
        "cdn_blocking": re.findall(r'<script src=["\']https?://(?!.*p5).*?["\']', html),
    }


def run_stage4(model_info: dict, work_dir: Path) -> tuple[dict, str]:
    """
    Call OpenRouter directly for Stage 4 (viz) and return (viz_spec, failure_reason).
    Bypasses orchestrator to capture token usage.
    """
    import openai
    import importlib.util, types

    # Import pipeline modules from the pipeline dir
    sys.path.insert(0, str(PIPELINE_DIR))
    import orchestrator as orch
    import importlib
    orchestrator = importlib.reload(orch)   # re-import to get fresh state

    os.environ["OPENROUTER_API_KEY"] = OR_KEY

    # Load artifacts
    plan      = json.loads((work_dir / "lesson_plan.json").read_text())
    act_specs = {}
    for p in (work_dir / "acts").glob("*.json"):
        spec = json.loads(p.read_text())
        act_specs[spec["act_id"]] = spec
    gate_specs = {}
    for p in (work_dir / "gates").glob("*.json"):
        spec = json.loads(p.read_text())
        gate_specs[spec["gate_id"]] = spec

    # Build the same user message the orchestrator would
    system_prompt = orchestrator.load_prompt("viz_worker")
    timeline      = orchestrator._build_viz_timeline(act_specs, plan)
    problem_text  = plan.get("problem", {}).get("text", "")

    user_msg = f"""## Problem Being Taught
{problem_text}

## Visualization Requirements (from planner)
{json.dumps(plan.get('viz_requirements', {}), indent=2)}

## Ordered Action Timeline (temporal sequence across the full lesson)
{json.dumps(timeline, indent=2)}
"""
    # Include reference plugin (these are 128k+ models — they can handle it)
    import glob as _glob
    _candidates = sorted(_glob.glob(str(CODE2HTML_DIR / "content" / "amc10a_2023_p15_*.js")))
    if _candidates:
        ref_code = Path(_candidates[-1]).read_text()
        user_msg += f"\n## Reference: Complete production viz plugin\n```javascript\n{ref_code}\n```\n"

    schema = orchestrator._schema_for_tool("viz_spec")
    cleaned_schema = orchestrator._clean_schema_for_gemini(schema)
    system_with_schema = (
        f"{system_prompt}\n\n"
        f"## Output Format (REQUIRED)\n"
        f"You MUST respond with a single valid JSON object that conforms to this schema. "
        f"No prose, no markdown fences — just the JSON object.\n\n"
        f"```json\n{json.dumps(cleaned_schema, indent=2)}\n```\n"
    )

    client = openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OR_KEY,
        default_headers={
            "HTTP-Referer": "https://github.com/code2html",
            "X-Title": "code2html agentic pipeline v3",
        },
    )

    kwargs = dict(
        model=model_info["slug"],
        messages=[
            {"role": "system", "content": system_with_schema},
            {"role": "user",   "content": user_msg},
        ],
        temperature=0.7,
        max_tokens=16000,
    )
    if model_info["json_object"]:
        kwargs["response_format"] = {"type": "json_object"}

    print(f"  → Calling {model_info['slug']} (ctx={model_info['ctx_k']}k)...")
    t0 = time.time()
    try:
        resp = client.chat.completions.create(**kwargs)
    except Exception as e:
        return {}, f"API error: {e}"
    elapsed = time.time() - t0
    print(f"     {elapsed:.1f}s")

    # Token counts for cost
    usage = resp.usage
    tok_in  = usage.prompt_tokens if usage else 0
    tok_out = usage.completion_tokens if usage else 0
    cost = tok_in * model_info["price_in"] + tok_out * model_info["price_out"]
    print(f"     tokens in={tok_in} out={tok_out}  cost=${cost:.4f}")

    text = resp.choices[0].message.content or ""

    # Strip fences
    import re
    stripped = text.strip()
    m = re.search(r'```(?:json)?\s*([\s\S]*?)```', stripped)
    if m:
        stripped = m.group(1).strip()
    elif stripped.startswith("```"):
        lines = stripped.splitlines()
        if lines[0].startswith("```"): lines = lines[1:]
        if lines and lines[-1].strip() == "```": lines = lines[:-1]
        stripped = "\n".join(lines).strip()
    if stripped and stripped[0] != '{':
        m2 = re.search(r'\{[\s\S]*\}', stripped)
        if m2: stripped = m2.group(0)

    try:
        spec = json.loads(stripped)
    except Exception as e:
        return {}, f"JSON parse error: {e}. Payload[:200]: {text[:200]!r}"

    # Validate
    ok, reason = is_valid_viz(spec)
    if not ok:
        return spec, f"viz invalid: {reason}"

    # Pipeline assertion check
    try:
        from pipeline_types import assert_viz_implements_plan_actions
        assert_viz_implements_plan_actions(spec, plan)
    except (TypeError, AssertionError) as e:
        return spec, f"assert_viz_implements_plan_actions failed: {e}"

    spec["_meta"] = {"tok_in": tok_in, "tok_out": tok_out, "cost": cost, "elapsed_s": elapsed}
    return spec, ""


def main():
    results = []

    for info in MODELS:
        name = info["name"]
        slug = info["slug"]
        work_dir = CODE2HTML_DIR / "work" / f"amc_{name}_v3"
        output_html = str(DEMO_BENCH / f"{name}_v3.html")

        # Remove stale viz_spec if any
        viz_path = work_dir / "viz_spec.json"
        if viz_path.exists():
            viz_path.unlink()

        print(f"\n{'='*65}")
        print(f"MODEL: {slug}")
        print(f"DIR:   {work_dir}")

        spec, fail_reason = run_stage4(info, work_dir)

        if fail_reason:
            print(f"  ✗ FAILED: {fail_reason}")
            print(f"  → Copying Claude baseline viz")
            shutil.copy(FALLBACK_VIZ, viz_path)
            used_fallback = True
        else:
            print(f"  ✓ PASSED assert_viz_implements_plan_actions")
            meta = spec.pop("_meta", {})
            viz_path.write_text(json.dumps(spec, indent=2))
            used_fallback = False

        # Build HTML
        print(f"  Building HTML → {output_html}")
        html_ok = build_html(work_dir, output_html)

        # Verify
        if Path(output_html).exists():
            v = verify_html(output_html)
        else:
            v = {"js_errors": ["HTML not built"], "katex_inline": False}

        results.append({
            "model": slug,
            "name": name,
            "passed_stage4": not fail_reason,
            "fail_reason": fail_reason,
            "used_fallback": used_fallback,
            "html_ok": html_ok,
            "verify": v,
            "cost": spec.get("_meta", {}).get("cost", 0) if not fail_reason else 0,
        })

        print(f"\n  Verify: js_errors={v.get('js_errors',[])} katex={v.get('katex_inline')} size={v.get('size_kb')}KB")

    # Summary
    print(f"\n{'='*65}")
    print("SUMMARY")
    print(f"{'='*65}")
    for r in results:
        status = "PASSED" if r["passed_stage4"] else f"FAILED — {r['fail_reason']}"
        fallback = " (Claude viz fallback)" if r["used_fallback"] else ""
        cost_str = f"${r['cost']:.4f}" if r["cost"] else "N/A"
        print(f"\n  {r['name']:12s} [{status}]{fallback}")
        print(f"             cost={cost_str}, html_ok={r['html_ok']}, js_errors={r['verify'].get('js_errors',[])}")

    return results


if __name__ == "__main__":
    main()
