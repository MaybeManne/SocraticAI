#!/usr/bin/env python3
"""
Local pairwise-comparison dashboard for SocraticAI lessons vs external tools.

Primary screen: side-by-side comparison of any two same-subject videos with a
human verdict panel (per-dimension A/Tie/B + notes) saved to
human_pairwise_results/ in the same JSON shape as the machine judge's results.
Secondary screen: per-subject Bradley-Terry leaderboards from
agentic_pipeline/judge/pairwise_results/.

Zero dependencies (stdlib only). Run:

    python3 dashboard/app.py            # http://localhost:8765

Reads pipeline/judge data strictly read-only.
"""

import json
import mimetypes
import os
import random
import re
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "agentic_pipeline" / "judge"))
import bradley_terry  # noqa: E402  (read-only use of the judge's ranking math)

JUDGE_RESULTS = REPO / "agentic_pipeline" / "judge" / "pairwise_results"
HUMAN_RESULTS = REPO / "human_pairwise_results"
PORT = 8765

DIMENSIONS = ["visual_accuracy", "interactivity", "narration_quality",
              "sync", "concept_accuracy", "polish"]

SUBJECT_DIRS = {"circles": "circle problem", "archer": "archer", "binsearch": "binary search"}
VIDEO_EXTS = (".mp4", ".mov", ".webm")


# ── Catalog ────────────────────────────────────────────────────────────────────

def catalog():
    """All comparable items: SocraticAI lesson HTMLs + external tool videos."""
    items = []
    for subject, dirname in SUBJECT_DIRS.items():
        ddir = REPO / "dist" / dirname
        if ddir.is_dir():
            for f in sorted(ddir.glob("*.html")):
                stem = f.stem  # circles_v7 | v7 | circles_v3.1 | v0original
                vid = stem if stem.startswith(subject) else f"{subject}_{stem}"
                items.append({"id": vid, "subject": subject, "kind": "lesson",
                              "label": f"{vid}  (SocraticAI)",
                              "url": f"/media/dist/{dirname}/{f.name}"})
        bdir = REPO / "benchmark_comparison" / subject
        if bdir.is_dir():
            for f in sorted(bdir.iterdir()):
                if f.suffix in VIDEO_EXTS and f.parent == bdir:
                    vid = f"{subject}_{f.stem}"
                    if any(i["id"] == vid for i in items):
                        continue
                    items.append({"id": vid, "subject": subject, "kind": "video",
                                  "label": f"{vid}  (external)",
                                  "url": f"/media/benchmark_comparison/{subject}/{f.name}"})
    return items


def pair_key(a, b):
    s1, s2 = sorted([a, b])
    return f"{s1}__{s2}"


def judge_result_for(a, b):
    p = JUDGE_RESULTS / f"{pair_key(a, b)}.json"
    if p.exists():
        try:
            return json.loads(p.read_text())
        except json.JSONDecodeError:
            return None
    return None


def human_results_for(a, b):
    out = []
    if HUMAN_RESULTS.is_dir():
        for p in sorted(HUMAN_RESULTS.glob(f"{pair_key(a, b)}__human_*.json")):
            try:
                out.append(json.loads(p.read_text()))
            except json.JSONDecodeError:
                pass
    return out


def load_judge_results(subject=None):
    out = []
    if JUDGE_RESULTS.is_dir():
        for p in sorted(JUDGE_RESULTS.glob("*.json")):
            try:
                r = json.loads(p.read_text())
            except json.JSONDecodeError:
                continue
            if subject and r.get("subject") != subject:
                continue
            out.append(r)
    return out


# ── HTTP handler ───────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # quiet
        pass

    # -- helpers --
    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _file(self, path):
        """Serve a file with HTTP Range support (needed for <video> scrubbing)."""
        path = Path(path)
        if not path.is_file():
            self.send_error(404)
            return
        size = path.stat().st_size
        ctype = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        if path.suffix == ".mov":
            ctype = "video/mp4"  # h264 .mov plays fine when labeled mp4
        rng = self.headers.get("Range")
        start, end = 0, size - 1
        code = 200
        if rng:
            m = re.match(r"bytes=(\d*)-(\d*)", rng)
            if m:
                if m.group(1):
                    start = int(m.group(1))
                if m.group(2):
                    end = min(int(m.group(2)), size - 1)
                code = 206
        length = end - start + 1
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        if code == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(1 << 20, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return
                remaining -= len(chunk)

    # -- routes --
    def do_GET(self):
        url = urlparse(self.path)
        path = unquote(url.path)

        if path in ("/", "/index.html"):
            return self._file(Path(__file__).parent / "index.html")

        if path.startswith("/media/"):
            rel = path[len("/media/"):]
            target = (REPO / rel).resolve()
            if not str(target).startswith(str(REPO)):  # no path escape
                return self.send_error(403)
            return self._file(target)

        if path == "/api/videos":
            return self._json(catalog())

        if path.startswith("/api/pair/"):
            parts = path.split("/")
            if len(parts) == 5:
                a, b = parts[3], parts[4]
                return self._json({
                    "judge": judge_result_for(a, b),
                    "human": human_results_for(a, b),
                })

        if path == "/api/next_pair":
            items = catalog()
            by_subject = {}
            for i in items:
                by_subject.setdefault(i["subject"], []).append(i["id"])
            candidates = []
            for subject, ids in by_subject.items():
                for x in range(len(ids)):
                    for y in range(x + 1, len(ids)):
                        a, b = ids[x], ids[y]
                        has_human = bool(human_results_for(a, b))
                        has_judge = judge_result_for(a, b) is not None
                        candidates.append((has_human, not has_judge, a, b))
            if not candidates:
                return self._json({"error": "no pairs"}, 404)
            # Prefer: no human review first; among those, judged pairs first
            # (so human verdicts can be compared against the machine's).
            random.shuffle(candidates)
            candidates.sort(key=lambda c: (c[0], c[1]))
            _, _, a, b = candidates[0]
            return self._json({"a": a, "b": b})

        if path.startswith("/api/rankings/"):
            subject = path.rsplit("/", 1)[1]
            results = load_judge_results(subject)
            if not results:
                return self._json({"overall": [], "dimensions": {}})
            return self._json(bradley_terry.rank_all(results))

        self.send_error(404)

    def do_POST(self):
        url = urlparse(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        data = json.loads(self.rfile.read(length) or b"{}")

        if url.path == "/api/verdict":
            a, b = data.get("setupA"), data.get("setupB")
            if not a or not b or not data.get("dimensions"):
                return self._json({"error": "setupA, setupB, dimensions required"}, 400)
            HUMAN_RESULTS.mkdir(exist_ok=True)
            ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            record = {
                "setupA": a, "setupB": b,
                "subject": a.split("_", 1)[0],
                "source": "human",
                "dimensions": data["dimensions"],       # {dim: {winner, note}}
                "aggregator": data.get("aggregator"),   # {winner, note}
                "evaluatedAt": datetime.now(timezone.utc).isoformat(),
            }
            out = HUMAN_RESULTS / f"{pair_key(a, b)}__human_{ts}.json"
            out.write_text(json.dumps(record, indent=2))
            return self._json({"saved": out.name})

        if url.path == "/api/judge_feedback":
            a, b = data.get("setupA"), data.get("setupB")
            if not a or not b:
                return self._json({"error": "setupA, setupB required"}, 400)
            HUMAN_RESULTS.mkdir(exist_ok=True)
            ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            record = {
                "setupA": a, "setupB": b, "source": "human-judge-feedback",
                "feedback": data.get("feedback", {}),   # {dim: "agree"|"disagree"}
                "evaluatedAt": datetime.now(timezone.utc).isoformat(),
            }
            out = HUMAN_RESULTS / f"{pair_key(a, b)}__judgefb_{ts}.json"
            out.write_text(json.dumps(record, indent=2))
            return self._json({"saved": out.name})

        self.send_error(404)


def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    n = len(catalog())
    print(f"Pairwise comparison dashboard: http://localhost:{PORT}  ({n} videos)")
    print("Human verdicts save to:", HUMAN_RESULTS)
    server.serve_forever()


if __name__ == "__main__":
    main()
