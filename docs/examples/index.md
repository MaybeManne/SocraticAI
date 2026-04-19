# Examples Gallery

These pages walk through the scripts in `examples/` and `content/`. Each annotates key patterns — what the code does and why it's written that way.

To build any example:

```bash
./build.sh --mx examples/01_cards.js dist/examples/01_cards.html
```

## Examples

| File | What it demonstrates |
|------|---------------------|
| [01_cards.js](./cards.md) | Every card type in one lesson — text, latex, derivation, split, recap, bar-chart, plot-2d |
| [02_gates.js](./gates.md) | All four gate types — quiz, fill-in, proof-builder, interactive |
| [03_viz_svg.js](./viz-svg.md) | A full SVG visualization plugin using the raw `EXPLAINER_VIZ` interface |
| [04_viz_3d.js](./viz-3d.md) | A Three.js 3D visualization plugin |
| [AMC 10A 2023 #15](./full-lesson.md) | The complete nested-circles lesson with interactive gates and a real viz plugin |
