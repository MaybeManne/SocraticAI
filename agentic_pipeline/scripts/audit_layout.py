#!/usr/bin/env python3
"""
audit_layout.py — runtime layout audit of a built lesson HTML.

Static heuristics (_check_viz_layout) can't see what the composed frame
actually looks like, so this drives the real player headless to several
timeline positions and measures the rendered SVG:

  1. OVERLAP  — pairs of visible text/panel elements whose bounding boxes
                collide (the "two scenes stacked on each other" jumble).
  2. CLIPPING — visible elements extending outside the viz panel bounds
                (arrays wider than the viewBox, off-screen labels).
  3. CLUTTER  — too many simultaneously visible text elements (walls of
                SVG algebra that belong in the notebook cards).

Usage:
    python3 scripts/audit_layout.py "path/to/lesson.html" [--fractions 0.25,0.5,0.75]

Exit code 1 if any position reports severe problems (so callers can gate on it).
"""

import argparse
import json
import sys
from pathlib import Path

SEEK_JS = """(fraction) => {
  const btn = document.getElementById("playBtn"); if (btn) btn.click();
  const g = window._graph, s = window._state;
  if (!g || !s || !window.EX) return "engine missing";
  window.EX.Orchestrator.seekToGlobalTime(g.totalDefaultDuration * fraction, g, s);
  return "ok";
}"""

PAUSE_JS = """() => {
  if (window.EX && window.EX.ActRunner) window.EX.ActRunner.pause();
  if (window.EX && window.EX.EventBus) window.EX.EventBus.emit("audio:pause", {});
}"""

MEASURE_JS = """() => {
  const svg = document.querySelector('svg#viz') || document.querySelector('#viz svg');
  if (!svg) return { error: 'no viz svg' };
  const panel = svg.getBoundingClientRect();
  const els = [...svg.querySelectorAll('text, rect, circle, path, line, g')];

  const visible = [];
  for (const el of els) {
    if (el.tagName === 'g') continue;               // measure leaves only
    const style = getComputedStyle(el);
    let op = 1, node = el;                          // effective opacity up the tree
    while (node && node !== svg) {
      op *= parseFloat(getComputedStyle(node).opacity || 1);
      node = node.parentElement;
    }
    if (op < 0.15 || style.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    visible.push({ tag: el.tagName, text: (el.textContent || '').slice(0, 40),
                   x: r.x, y: r.y, w: r.width, h: r.height });
  }

  // Text-vs-text overlaps (ignore rect backing panels behind their own text).
  const texts = visible.filter(v => v.tag === 'text');
  const overlaps = [];
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      const inter = ix * iy, minArea = Math.min(a.w * a.h, b.w * b.h);
      if (minArea > 0 && inter / minArea > 0.30) {
        overlaps.push({ a: a.text, b: b.text, frac: +(inter / minArea).toFixed(2) });
      }
    }
  }

  // Clipping: visible elements poking outside the panel by more than 8px.
  const clipped = visible.filter(v =>
    v.x < panel.x - 8 || v.y < panel.y - 8 ||
    v.x + v.w > panel.x + panel.width + 8 ||
    v.y + v.h > panel.y + panel.height + 8
  ).map(v => ({ tag: v.tag, text: v.text }));

  return { visibleTexts: texts.length, overlaps, clipped,
           totalVisible: visible.length };
}"""


def audit(html_path, fractions):
    from playwright.sync_api import sync_playwright
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for frac in fractions:
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.goto(f"file://{Path(html_path).resolve()}")
            page.wait_for_timeout(2500)
            status = page.evaluate(SEEK_JS, frac)
            if status != "ok":
                results.append({"fraction": frac, "error": status})
                page.close()
                continue
            page.wait_for_timeout(2000)
            page.evaluate(PAUSE_JS)
            page.wait_for_timeout(300)
            m = page.evaluate(MEASURE_JS)
            m["fraction"] = frac
            results.append(m)
            page.close()
        browser.close()
    return results


def main(argv=None):
    ap = argparse.ArgumentParser(description="Runtime layout audit of a built lesson.")
    ap.add_argument("html", help="path to built lesson HTML")
    ap.add_argument("--fractions", default="0.25,0.5,0.75",
                    help="comma-separated timeline fractions to audit")
    ap.add_argument("--json", action="store_true", help="raw JSON output")
    args = ap.parse_args(argv)

    fractions = [float(f) for f in args.fractions.split(",")]
    results = audit(args.html, fractions)

    if args.json:
        print(json.dumps(results, indent=1))

    severe = False
    for r in results:
        frac = r.get("fraction")
        if "error" in r:
            print(f"[{frac:.0%}] ERROR: {r['error']}")
            severe = True
            continue
        problems = []
        if r["overlaps"]:
            problems.append(f"{len(r['overlaps'])} text overlap(s): "
                            + "; ".join(f"{o['a']!r}~{o['b']!r}" for o in r["overlaps"][:3]))
        if r["clipped"]:
            problems.append(f"{len(r['clipped'])} clipped element(s)")
        if r["visibleTexts"] > 14:
            problems.append(f"clutter: {r['visibleTexts']} visible text elements (>14)")
        if problems:
            print(f"[{frac:.0%}] PROBLEMS — " + " | ".join(problems))
            if r["overlaps"] or len(r["clipped"]) > 2:
                severe = True
        else:
            print(f"[{frac:.0%}] clean ({r['visibleTexts']} texts, {r['totalVisible']} visible elements)")

    return 1 if severe else 0


if __name__ == "__main__":
    raise SystemExit(main())
