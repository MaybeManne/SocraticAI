#!/bin/bash
# Build a single self-contained HTML file from template + engine modules + content.
#
# Usage:
#   ./build.sh [--mx] content/lesson.js [viz.js] dist/lesson.html [audio_js]
#
# Flags:
#   --mx  Use MX/DSL mode (no separate viz file needed)
#
# Examples:
#   ./build.sh --mx content/lesson.js dist/lesson.html
set -euo pipefail
cd "$(dirname "$0")"

MX_MODE=false

while true; do
  case "${1:-}" in
    --mx) MX_MODE=true; shift ;;
    *)    break ;;
  esac
done

CONTENT="${1:-content/amc10a_2023_p15.js}"
if [ "$MX_MODE" = true ]; then
  VIZ=""
  OUTPUT="${2:-dist/$(basename "${CONTENT}" .js).html}"
  AUDIO="${3:-}"
else
  VIZ="${2:-content/viz_nested_circles.js}"
  OUTPUT="${3:-dist/amc10a_2023_p15.html}"
  AUDIO="${4:-}"
fi

mkdir -p "$(dirname "$OUTPUT")"

python3 - "$CONTENT" "$VIZ" "$OUTPUT" "$AUDIO" "$MX_MODE" <<'PYEOF'
import sys, os

content_path, viz_path, output_path, audio_path, mx_mode = sys.argv[1:]
mx_mode = mx_mode == "true"

# Read all source files
with open('template.html', 'r') as f: template = f.read()
with open('explainer-lib.css', 'r') as f: css = f.read()
with open(content_path, 'r') as f: content = f.read()

viz = ""
if viz_path and viz_path.strip():
    with open(viz_path, 'r') as f: viz = f.read()

audio = ""
if audio_path and audio_path.strip():
    with open(audio_path, 'r') as f: audio = f.read()

# Read MX modules (mobject system)
mx_modules = ""
mx_files = ['mobject/mobject.js', 'mobject/anim.js', 'mobject/dsl.js']
for mf in mx_files:
    if os.path.exists(mf):
        with open(mf, 'r') as f:
            mx_modules += f.read() + "\n"

# Read engine modules (in correct load order)
engine_modules = ""
engine_files = [
    'engine/core.js',
    'engine/notebook.js',
    'engine/viz-panel.js',
    'engine/audio.js',
    'engine/subtitles.js',
    'engine/cards.js',
    'engine/graph-card.js',   # Stage 1: "graph" and "code-runner" card types
    'engine/viz-3d.js',       # Stage 1: Three.js 3D viz mode
    'engine/gates.js',
    'engine/controls.js',
    'engine/scroll-sync.js',
    'engine/init.js'
]
for ef in engine_files:
    if os.path.exists(ef):
        with open(ef, 'r') as f:
            engine_modules += f.read() + "\n"

# 1. Replace external CSS link with inline <style>
template = template.replace(
    '<link rel="stylesheet" href="explainer-lib.css">',
    '<style>\n' + css + '\n</style>'
)

# 2. Find the block of script tags to replace
# Remove everything from the first MX module script to the last engine script
start_marker = '<!-- MX modules -->'
end_marker = '</script>\n</body>'

start_idx = template.find(start_marker)
if start_idx < 0:
    start_marker = '<script src="mobject/'
    start_idx = template.find(start_marker)

end_idx = template.find(end_marker)
if end_idx < 0:
    end_marker = '</script></body>'
    end_idx = template.find(end_marker)
if end_idx < 0:
    print("ERROR: Cannot find closing script/body tags")
    sys.exit(1)
end_idx += len('</script>')

# Build new script block
new_block = ""

# MX modules (always included)
if mx_modules.strip():
    new_block += '<script>\n' + mx_modules + '</script>\n'

# Content
new_block += '<script>\n' + content + '\n</script>\n'

# Viz (for non-MX mode or if provided)
if viz:
    new_block += '<script>\n' + viz + '\n</script>\n'

# Audio
if audio:
    new_block += '<script>\n' + audio + '\n</script>\n'

# Engine (always last)
new_block += '<script>\n' + engine_modules + '\n</script>'

template = template[:start_idx] + new_block + template[end_idx:]

with open(output_path, 'w') as f:
    f.write(template)

size_kb = len(template) / 1024
parts = "MX + content" if mx_mode else "content + viz"
if audio:
    parts += " + audio"
parts += " + engine"
print(f"Built: {output_path} ({size_kb:.0f} KB) [{parts}]")
PYEOF
