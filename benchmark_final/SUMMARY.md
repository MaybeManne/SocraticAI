# Benchmark Final — Video Deliverable Summary

Assembled 2026-07-21. All files verified before inclusion (mp4s: ffprobe
playability + duration; v7 lessons: headless-browser render check — boots,
no JS errors, nonzero timeline).

## Counts (verified on disk)

| Method | Videos | Coverage |
|---|---|---|
| SocraticAI v7 (`v7/`) | 49 | 49/50 |
| Code2Video (`code2video/`) | 50 | 50/50 |
| Paper2Video (`paper2video/`) | 8 | 8/50 |
| NotebookLM (`notebooklm/`) | 0 (manual, pending) | 0/50 |

Total: 107 verified videos. `video_index.csv` lists each with duration,
backbone model, and attempt count. `manifest.csv` has the 50 problems
(prompt, domain, difficulty, rough scenes_requested estimate).
`missing.csv` enumerates every gap.

## Known limitations / gaps

1. **doppler has no v7 lesson (the single v7 failure).** Four
   quality-gated generation attempts all failed — the moving-source wave
   visualization (expanding wavefronts, spacing compression) exceeded what
   the code-generation model could implement without tripping the
   pipeline's correctness gates (missing viz actions; narration referencing
   visuals that never render). Deliberately NOT forced through or retried:
   shipping a broken visual would contaminate the benchmark. Options if
   coverage is needed: simplify the problem statement, hand-author the viz,
   or exclude doppler from cross-method comparisons.

2. **Paper2Video covers only 8/50** (circles, archer, binsearch, pendulum,
   cointoss, boxopt, knapsack, dijkstra). The remaining 42 were not
   generated. Note the standing fairness caveat: Paper2Video's input wraps
   the problem *and worked solution* as a LaTeX paper, so it receives more
   information than the other methods.

3. **v7 backbone is mixed** (generation spanned a Gemini model-retirement
   window): 26 lessons on gemini-3.1-pro-preview, 8 on gemini-pro-latest,
   15 on the gemini-2.5 era. Per-lesson model is recorded in
   video_index.csv. A unification regen onto one backbone was started and
   deliberately stopped ("current videos are enough"). Code2Video and
   Paper2Video outputs are uniformly gemini-pro-latest (Colab run).

4. **NotebookLM folder is empty by design** — generated manually
   (17 batches of 3), videos to be dropped in as `{problem_id}.mp4`.

5. `scenes_requested` in manifest.csv is a rough human-judgment estimate of
   distinct visual moments implied by each prompt (2–4 typical), not a
   measured quantity.
