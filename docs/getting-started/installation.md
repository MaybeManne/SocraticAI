# Installation

## Clone the repository

```bash
git clone <repo-url> code2html
cd code2html
```

## Verify the structure

After cloning you should see:

```
code2html/
  build.sh              # Build script
  template.html         # HTML shell
  explainer-lib.css     # Styles
  mobject/              # MX animation library
    mobject.js
    anim.js
    dsl.js
  engine/               # Playback engine
    core.js
    notebook.js
    viz-panel.js
    audio.js
    subtitles.js
    cards.js
    gates.js
    controls.js
    scroll-sync.js
    init.js
  content/              # Your lesson scripts go here
  examples/             # DSL demos
  agentic_pipeline/     # AI-powered content generation
  dist/                 # Compiled output (created by build.sh)
```

## Run the smoke test

Build the included AMC example to confirm everything works:

```bash
./build.sh --mx content/amc10a_2023_p15_v5.js dist/test.html
```

You should see:

```
Built: dist/test.html (480 KB) [MX + content + engine]
```

Open `dist/test.html` in a browser. Click anywhere on the problem bar to start playback.

## Build modes

The build script supports two modes:

| Mode | When to use |
|------|-------------|
| `--mx` | Your lesson uses the MX/DSL authoring system (recommended) |
| _(no flag)_ | Your lesson uses a hand-written `EXPLAINER_VIZ` plugin in a separate file |

See [Build Pipeline](../guides/build-pipeline.md) for full details.
