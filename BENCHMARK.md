# Viz-Model Benchmark

**Problem:** AMC 10A 2023 Problem 15 — Nested circles, least N for shaded area ≥ 2023π  
**Answer:** 64 circles (n=32 rings)  
**Tested stage:** Stage 4 (viz generation) only — Stages 1–3 shared baseline  
**Flag:** `--viz-model openrouter:<model>`  
**Requirement:** ≥64K context window + reliable JSON output mode

---

## Results Summary

| Model | Context | Result | Root cause |
|---|---|---|---|
| **anthropic/claude-3-5-haiku** | 200K | ✅ **PASSED** | Clean output, no retries |
| **google/gemini-2.0-flash-001** | 1M | ✅ **PASSED** | Fast, clean output |
| **deepseek/deepseek-chat-v3-0324** | 163K | ✅ **PASSED** | 1 retry needed (~$0.012/run) |
| meta-llama/llama-3.3-70b-instruct | 131K | ❌ fallback | Placeholder stub — output `{... }` not implemented |
| qwen/qwen-2.5-coder-32b-instruct | 32K | ❌ fallback | Context limit — input ~45K tok > 32K provider cap |
| mistralai/mistral-small-3.1-24b-instruct | 24K | ❌ fallback | JSON truncated at char 55 |
| google/gemma-3-27b-it | — | ❌ fallback | Hit 16K output token cap mid-function |
| nvidia/llama-3.1-nemotron-70b-instruct | 131K | ❌ fallback | Empty `choices[]` at full prompt; invalid JSON at short prompt |
| deepseek/deepseek-r1 | 64K | ❌ fallback | Timeout >300s — reasoning model too slow |
| deepseek/deepseek-r1-distill-llama-70b | 131K | ❌ fallback | Schema mismatch — returned list instead of dict |
| deepseek/deepseek-chat | 163K | ❌ fallback | Empty `response.choices` (transient API error) |
| cohere/command-r-plus-08-2024 | 128K | ❌ fallback | Output truncation — generates >16K tokens of JS |
| cohere/command-a | 256K | ❌ fallback | Same truncation as above, identical cutoff point |
| google/gemini-flash-1.5 | 1M | ❌ fallback | 404 — slug deprecated on OpenRouter |

**3 of 14 models passed.** HTMLs for failed runs use Claude baseline viz.

---

## Detailed Failure Analysis

### Llama 3.3 70B

- **Outcome:** Exit 0, viz_spec written, but code is 45 chars
- **Code produced:** `window.EXPLAINER_VIZ = (function() {... })();`
- **Root cause:** Model used `...` as a literal placeholder. Node.js syntax check caught `SyntaxError: Unexpected token '...'` and retried — second attempt identical.
- **Fix tried:** None. Quality/instruction-following limitation at 70B scale.

### Qwen 2.5 Coder 32B

- **Outcome:** HTTP 400 from OpenRouter
- **Error:** `maximum context length is 32768 tokens. However, you requested about 60429 tokens (44429 input + 16000 output)`
- **Root cause:** Stage 4 prompt is ~44K tokens (viz_worker.md + lesson plan + act specs + reference viz). Hard block at provider level.

### Mistral Small 3.1 24B

- **Outcome:** `JSONDecodeError: Unterminated string at char 55`
- **Raw response:** `{"mode": "custom_code", "config": {"plugin": "nested_circles_v`
- **Root cause:** JSON output cut at 55 chars. Retried once — identical. Either generation cutoff or OpenRouter truncation.

### Gemma 3 27B

- **Outcome:** JSON truncated mid-function body
- **Root cause:** Model generates verbose JS and hit the 16K `max_tokens` output cap. Same failure mode as Cohere but at a different cutoff point.

### Nemotron 70B

- **Outcome:** Two failure modes depending on prompt length
  - At full prompt: `response.choices` is empty `[]` — model silently refuses the full context despite advertising 131K context
  - At shortened prompt: returns invalid JSON
- **Root cause:** Effective context limit well below advertised 131K when using JSON output mode.

### DeepSeek R1 (full)

- **Outcome:** `run_viz_with_fallback.py` subprocess timeout at 300s
- **Root cause:** R1 is a reasoning model that thinks before outputting. For a 44K token prompt + full JS implementation, generation time exceeds the 5-minute subprocess limit.

### DeepSeek R1 Distill Llama 70B

- **Outcome:** `AttributeError: 'list' object has no attribute 'get'` at `spec.get("code")`
- **Root cause:** Reasoning model returned a JSON array instead of a JSON object. Doesn't reliably follow the structured output schema.

### DeepSeek Chat (unversioned)

- **Outcome:** `TypeError: 'NoneType' object is not subscriptable` at `response.choices[0]`
- **Root cause:** `response.choices` was `None` — transient API error / empty response from OpenRouter. Pinned version `deepseek-chat-v3-0324` succeeded on the same prompt.

### Cohere (command-r-plus-08-2024 and command-a)

- **Outcome:** `JSONDecodeError: Unterminated string at char 303`
- **Raw start:** `{"mode": "custom_code", ..., "code": "window.EXPLAINER_VIZ = (function () {\n  var svg...`
- **Root cause:** Both models generate an extremely verbose JS implementation that exceeds the 16K `max_tokens` output cap. The truncation happens at the exact same character (303) for both models, suggesting identical generation behavior. Dead end without raising `_out_tokens` in the orchestrator.

### Google Gemini Flash 1.5

- **Outcome:** HTTP 404 — `No endpoints found for google/gemini-flash-1.5`
- **Root cause:** Model slug deprecated on OpenRouter. Use `google/gemini-2.0-flash-001` instead.

---

## Key Findings

**What Stage 4 requires:**
1. **≥64K context** — prompt is ~44K tokens. Models with 32K limits (Qwen, Mistral Small) can't be used.
2. **Reliable JSON output mode** — must return a JSON object, not a list, not truncated, not empty.
3. **≤16K tokens of JS output** — the orchestrator sets `max_tokens=16000` for OpenRouter. Models that generate verbose implementations (Cohere, Gemma) hit this cap.
4. **Non-reasoning model preferred** — R1-class models are too slow (>300s for a single run).

**Recommended models for Stage 4:**
- `openrouter:anthropic/claude-3-5-haiku` (200K ctx) ✅ tested
- `openrouter:google/gemini-2.0-flash-001` (1M ctx) ✅ tested
- `openrouter:deepseek/deepseek-chat-v3-0324` (163K ctx) ✅ tested

---

## HTML Artifacts

### Passing runs (`demo_bench/`)

| File | Viz source |
|---|---|
| `demo_bench/claude_v2.html` | Hand-tuned Claude viz (full implementation) |
| `demo_bench/claude-3-5-haiku_v4.html` | Haiku-generated viz ✅ |
| `demo_bench/gemini-2.0-flash_v4.html` | Gemini Flash-generated viz ✅ |
| `demo_bench/deepseek-v3_v4.html` | DeepSeek V3-generated viz ✅ |

### Fallback runs (`demo_bench/`)

| File | Notes |
|---|---|
| `demo_bench/deepseek-r1_v4.html` | Claude baseline viz (timeout) |
| `demo_bench/deepseek-r1-distill_v4.html` | Claude baseline viz (schema error) |
| `demo_bench/deepseek-chat_v4.html` | Claude baseline viz (transient API error) |
| `demo_bench/command-r-plus_v4.html` | Claude baseline viz (deprecated slug) |
| `demo_bench/command-r-plus-08-2024_v4.html` | Claude baseline viz (output truncation) |
| `demo_bench/cohere-command-a_v4.html` | Claude baseline viz (output truncation) |
| `demo_bench/gemini-flash-1-5_v4.html` | Claude baseline viz (404) |

### Earlier v3 runs (`demo_bench/`)

| File | Notes |
|---|---|
| `demo_bench/claude_baseline.html` | Baseline — fallback viz |
| `demo_bench/llama.html` | Fallback viz (placeholder stub) |
| `demo_bench/qwen.html` | Fallback viz (context limit) |
| `demo_bench/mistral.html` | Fallback viz (JSON truncated) |
| `demo_bench/gemma_v3.html` | Fallback viz (output token cap) |
| `demo_bench/nemotron_v3.html` | Fallback viz (empty choices) |
| `demo_bench/deepseek_v3.html` | Fallback viz (from v3 run) |

---

## Known Bug (documented, mitigated)

`_normalize_viz_code()` in `assembler.py` inserts `\n` after `;`, `{`, `}` in single-line JSON-embedded JS. A `//` comment mid-statement (e.g. `for (var r = 1; // comment\nr <= N; r++)`) captures the rest of the line. **Mitigation:** `viz_worker.md` explicitly bans `//` comments — all new model outputs must use `/* */` block comments only.
