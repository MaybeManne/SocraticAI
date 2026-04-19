# Build Pipeline

`build.sh` compiles your lesson into a single self-contained HTML file. It inlines CSS, the MX library, your content, any visualization plugin, optional audio, and all engine modules — no external dependencies at runtime.

## Usage

```bash
./build.sh [--mx] <content.js> [<viz.js>] <output.html> [<audio.js>]
```

**`--mx` flag** — Use when your content script uses the MX/DSL system. The viz panel is driven by `MX.vizPlugin()` inside your content file; no separate viz file is needed.

**Without `--mx`** — Use when your content script is plain `window.LESSON = {...}` and your visualization is a hand-written `EXPLAINER_VIZ` plugin in a separate file.

## Examples

```bash
# MX mode — single content file
./build.sh --mx content/my-lesson.js dist/my-lesson.html

# MX mode + TTS audio
./build.sh --mx content/my-lesson.js dist/my-lesson.html content/audio_my-lesson.js

# Standard mode — content + separate viz plugin
./build.sh content/my-lesson.js content/viz_my-lesson.js dist/my-lesson.html

# Standard mode + audio
./build.sh content/my-lesson.js content/viz_my-lesson.js dist/my-lesson.html content/audio_my-lesson.js
```

## Inlining order

The build script assembles the output in this exact order:

1. **`template.html`** — HTML shell with `#app`, `#viz-wrap`, `#notebook`, `#controls`, `#title-overlay`
2. **`explainer-lib.css`** — All styles inlined into a `<style>` block
3. **MX modules** (always included):
   - `mobject/mobject.js`
   - `mobject/anim.js`
   - `mobject/dsl.js`
4. **Content JS** — your lesson script (`window.LESSON` gets populated here)
5. **Viz JS** — your `EXPLAINER_VIZ` plugin (standard mode only)
6. **Audio JS** — base64-encoded audio + subtitle cues (optional)
7. **Engine modules** (always last, in load order):
   - `engine/core.js`
   - `engine/notebook.js`
   - `engine/viz-panel.js`
   - `engine/audio.js`
   - `engine/subtitles.js`
   - `engine/cards.js`
   - `engine/graph-card.js`
   - `engine/viz-3d.js`
   - `engine/gates.js`
   - `engine/controls.js`
   - `engine/scroll-sync.js`
   - `engine/init.js`

Engine modules load last so they can reference `window.LESSON` and `window.EXPLAINER_VIZ` that content and viz scripts set up.

## Output size

| Configuration | Typical size |
|---------------|-------------|
| MX + content + engine (no audio) | ~480 KB |
| MX + content + engine + audio | ~1–3 MB depending on lesson length |

## What `dist/` contains

The build creates `dist/` if it doesn't exist. Each compiled HTML is fully standalone — copy it anywhere, email it, host it on S3, or open it directly from disk.

> **Tip:** Add `dist/` to `.gitignore`. The HTML files are build artifacts; the source scripts in `content/` are what you commit.
