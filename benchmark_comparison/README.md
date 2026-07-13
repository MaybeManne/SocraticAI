# External-tool benchmark videos

Drop externally generated lesson videos here for pairwise judging against the
SocraticAI pipeline outputs. Layout is subject-first: adding a new tool later
is one new file per folder; adding a new subject is one new folder.

Expected slots (drop the file, keep the exact name):

```
benchmark_comparison/
  circles/    veo3.mp4   manimator.mp4   notebooklm.mp4
  archer/     veo3.mp4   manimator.mp4   notebooklm.mp4
  binsearch/  veo3.mp4   manimator.mp4   notebooklm.mp4
```

`.webm` / `.mov` also work (same basename, e.g. `circles/veo3.webm`).

## Judging

The judge resolves these as variant ids `<subject>_<tool>`, e.g.:

    python3 agentic_pipeline/judge/run_judge.py --a circles_v7 --b circles_veo3

Screenshots (t=0 + 50% frames, extracted via ffmpeg) are cached next to the
video (`veo3.png`, `veo3_mid.png`) on first judge contact.

## Optional sidecar transcript

External videos have no lesson_plan.json / narration metadata, so
narration_quality, sync, and concept_accuracy work from whatever exists:
the subject's problem statement is always injected, and if you drop a
transcript next to the video it will be used too:

    benchmark_comparison/circles/veo3.transcript.txt

Without a transcript, those dimensions see "(not available)" for the video
side — expect the judge to reflect that honestly rather than guess.
Problems come from the benchmark set manifest
(`agentic_pipeline/benchmark/benchmark_set.md`).
