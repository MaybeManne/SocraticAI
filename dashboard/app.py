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
import subprocess
import sys
import threading
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "agentic_pipeline" / "judge"))
import bradley_terry  # noqa: E402  (read-only use of the judge's ranking math)

JUDGE_RESULTS = REPO / "agentic_pipeline" / "judge" / "pairwise_results"
HUMAN_RESULTS = REPO / "human_pairwise_results"
VIDEO_SCORES = REPO / "agentic_pipeline" / "judge" / "video_scores"
HUMAN_VIDEO_SCORES = REPO / "human_video_scores"   # per-video human narration/sync
PORT = 8765

# Python used to RUN the judge (needs openai + playwright for screenshot prep).
# Override with JUDGE_PYTHON; falls back to the judge venv, then this python.
_VENV_PY = Path.home() / "Coding Projects" / "socraticai-judge" / ".venv-judge" / "bin" / "python3"
JUDGE_PYTHON = os.environ.get("JUDGE_PYTHON") or (str(_VENV_PY) if _VENV_PY.exists() else sys.executable)
RUN_JUDGE = REPO / "agentic_pipeline" / "judge" / "run_judge.py"

# In-flight judge runs: job_id -> {status, pair, error, startedAt}
JOBS = {}


def _run_judge_job(job_id, a, b):
    JOBS[job_id]["status"] = "running"
    try:
        r = subprocess.run(
            [JUDGE_PYTHON, str(RUN_JUDGE), "--a", a, "--b", b, "--force"],
            capture_output=True, text=True, timeout=600,
            env={**os.environ},
        )
        if r.returncode != 0:
            tail = ((r.stderr or "") + "\n" + (r.stdout or "")).strip()[-600:]
            JOBS[job_id].update(status="error", error=tail or f"exit {r.returncode}")
        elif not (JUDGE_RESULTS / f"{pair_key(a, b)}.json").exists():
            JOBS[job_id].update(status="error", error="judge finished but no result file was written")
        else:
            JOBS[job_id]["status"] = "done"
    except subprocess.TimeoutExpired:
        JOBS[job_id].update(status="error", error="judge timed out after 10 minutes")
    except Exception as e:
        JOBS[job_id].update(status="error", error=str(e))

DIMENSIONS = ["visual_accuracy", "interactivity", "narration_quality",
              "sync", "concept_accuracy", "polish"]

# Problem set comes from the single manifest (benchmark/problems.json);
# adding a problem there is all the dashboard needs.
PROBLEMS_MANIFEST = REPO / "agentic_pipeline" / "benchmark" / "problems.json"
_problems = json.loads(PROBLEMS_MANIFEST.read_text())["problems"]
SUBJECT_DIRS = {p["id"]: p["dist_dir"] for p in _problems}
SUBJECT_TITLES = {p["id"]: p.get("title", p["id"]) for p in _problems}
VIDEO_EXTS = (".mp4", ".mov", ".webm")


# ── Catalog ────────────────────────────────────────────────────────────────────

def catalog():
    """EVERY comparable item in the repo: subject lesson HTMLs, external tool
    videos, plus all other lesson HTMLs ever built (dist root, examples,
    demo_bench, AMC demo) under a 'misc' group."""
    items = []
    seen = set()

    def add(vid, subject, kind, label, url):
        if vid in seen:
            return
        seen.add(vid)
        items.append({"id": vid, "subject": subject, "kind": kind,
                      "label": label, "url": url})

    for subject, dirname in SUBJECT_DIRS.items():
        ddir = REPO / "dist" / dirname
        if ddir.is_dir():
            for f in sorted(ddir.glob("*.html")):
                stem = f.stem  # circles_v7 | v7 | circles_v3.1 | v0original
                vid = stem if stem.startswith(subject) else f"{subject}_{stem}"
                add(vid, subject, "lesson", f"{vid}  (SocraticAI)",
                    f"/media/dist/{dirname}/{f.name}")
        bdir = REPO / "benchmark_comparison" / subject
        if bdir.is_dir():
            for f in sorted(bdir.iterdir()):
                if any(t in f.stem for t in ("_untrimmed", "_precrop", "_backup")):
                    continue  # pre-edit backups, not comparison candidates
                if f.suffix in VIDEO_EXTS and f.parent == bdir and "_scenes" not in f.parent.name:
                    add(f"{subject}_{f.stem}", subject, "video",
                        f"{subject}_{f.stem}  (external)",
                        f"/media/benchmark_comparison/{subject}/{f.name}")

    # Everything else ever built — dist root, examples, demo_bench, AMC demo.
    misc_dirs = [("dist", REPO / "dist"),
                 ("dist/examples", REPO / "dist" / "examples"),
                 ("demo_bench", REPO / "demo_bench"),
                 ("AMC demo", REPO / "AMC demo")]
    for rel, d in misc_dirs:
        if not d.is_dir():
            continue
        for f in sorted(d.glob("*.html")):
            add(f"misc_{f.stem}", "misc", "lesson", f"{f.stem}  ({rel})",
                f"/media/{rel}/{f.name}")
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
            # Same-subject pairs only, with judged/human lookups precomputed
            # as filename sets (two glob passes total) instead of two disk
            # probes per candidate pair — stays fast at hundreds of videos.
            items = catalog()
            judged = {p.stem for p in JUDGE_RESULTS.glob("*.json")} \
                if JUDGE_RESULTS.is_dir() else set()
            humaned = {p.name.split("__human_")[0] for p in
                       HUMAN_RESULTS.glob("*__human_*.json")} \
                if HUMAN_RESULTS.is_dir() else set()
            by_subject = {}
            for i in items:
                if i["subject"] != "misc":
                    by_subject.setdefault(i["subject"], []).append(i["id"])
            candidates = []
            for subject, ids in by_subject.items():
                for x in range(len(ids)):
                    for y in range(x + 1, len(ids)):
                        key = pair_key(ids[x], ids[y])
                        candidates.append((key in humaned, key not in judged,
                                           ids[x], ids[y]))
            if not candidates:
                return self._json({"error": "no pairs"}, 404)
            # Prefer: no human review first; among those, judged pairs first
            # (so human verdicts can be compared against the machine's).
            random.shuffle(candidates)
            candidates.sort(key=lambda c: (c[0], c[1]))
            _, _, a, b = candidates[0]
            return self._json({"a": a, "b": b})

        if path == "/api/aggregate":
            # Cross-problem view: per variant/tool suffix, win rate averaged
            # over the problems where it has judged matches.
            per = {}   # suffix -> {subject -> [w, l, t]}
            for r in load_judge_results():
                w = (r.get("aggregator") or {}).get("winner")
                for s in (r["setupA"], r["setupB"]):
                    suffix = s.split("_", 1)[1] if "_" in s else s
                    rec = per.setdefault(suffix, {}).setdefault(r["subject"], [0, 0, 0])
                    rec[2 if w == "tie" else 0 if w == s else 1] += 1
            rows = []
            for suffix, subs in per.items():
                rates, tw = [], [0, 0, 0]
                for rec in subs.values():
                    n = sum(rec)
                    if n:
                        rates.append((rec[0] + 0.5 * rec[2]) / n)
                    for i in range(3):
                        tw[i] += rec[i]
                rows.append({
                    "id": suffix, "problems": len(subs),
                    "avgWinRate": round(sum(rates) / len(rates), 4) if rates else 0,
                    "wins": tw[0], "losses": tw[1], "ties": tw[2],
                    "comparisons": sum(tw),
                })
            rows.sort(key=lambda r: (-r["avgWinRate"], -r["comparisons"]))
            return self._json({"rows": rows, "subjects": list(SUBJECT_TITLES)})

        if path.startswith("/api/stats/"):
            vid = unquote(path.rsplit("/", 1)[1])
            matches = []
            dim_rec = {d: {"w": 0, "l": 0, "t": 0} for d in DIMENSIONS}
            ov_rec = {"w": 0, "l": 0, "t": 0}
            for r in load_judge_results():
                if vid not in (r.get("setupA"), r.get("setupB")):
                    continue
                opp = r["setupB"] if r["setupA"] == vid else r["setupA"]
                dims = {}
                for d in DIMENSIONS:
                    v = r.get("dimensions", {}).get(d)
                    if not v:
                        continue
                    res = "t" if v["winner"] == "tie" else ("w" if v["winner"] == vid else "l")
                    dim_rec[d][res] += 1
                    dims[d] = {"result": res, "confidence": v.get("confidence"),
                               "rationale": v.get("rationale")}
                agg = r.get("aggregator") or {}
                ores = "t" if agg.get("winner") == "tie" else ("w" if agg.get("winner") == vid else "l")
                ov_rec[ores] += 1
                matches.append({"opponent": opp, "subject": r.get("subject"),
                                "overall": {"result": ores, "confidence": agg.get("confidence")},
                                "dimensions": dims, "evaluatedAt": r.get("evaluatedAt")})
            return self._json({"video": vid, "matches": matches,
                               "dimRecord": dim_rec, "overallRecord": ov_rec})

        if path == "/api/video_meta":
            # Per-video metadata (duration/solved/explained/visualCount from
            # video_meta.py) + per-video HUMAN narration/sync score averages.
            # Kept fully separate from AI pairwise results.
            meta = {}
            if VIDEO_SCORES.is_dir():
                for p in sorted(VIDEO_SCORES.glob("*.json")):
                    try:
                        m = json.loads(p.read_text())
                        meta[m["id"]] = m
                    except (json.JSONDecodeError, KeyError):
                        pass
            if HUMAN_VIDEO_SCORES.is_dir():
                agg = {}
                for p in sorted(HUMAN_VIDEO_SCORES.glob("*.json")):
                    try:
                        h = json.loads(p.read_text())
                        a = agg.setdefault(h["video"], {"narration": [], "sync": []})
                        a["narration"].append(h["narration"])
                        a["sync"].append(h["sync"])
                    except (json.JSONDecodeError, KeyError):
                        pass
                for vid, a in agg.items():
                    meta.setdefault(vid, {"id": vid})["human"] = {
                        "narration": round(sum(a["narration"]) / len(a["narration"]), 1),
                        "sync": round(sum(a["sync"]) / len(a["sync"]), 1),
                        "n": len(a["narration"]),
                    }
            return self._json(meta)

        if path.startswith("/api/job/"):
            job = JOBS.get(path.rsplit("/", 1)[1])
            return self._json(job or {"status": "unknown"}, 200 if job else 404)

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

        if url.path == "/api/run_judge":
            a, b = data.get("a"), data.get("b")
            if not a or not b:
                return self._json({"error": "a and b required"}, 400)
            if not os.environ.get("OPENAI_API_KEY"):
                return self._json({"error": "server was started without OPENAI_API_KEY — "
                                            "restart: OPENAI_API_KEY=... python3 dashboard/app.py"}, 400)
            # one run at a time per pair
            for j in JOBS.values():
                if j["pair"] == pair_key(a, b) and j["status"] in ("queued", "running"):
                    return self._json({"error": "a judge run for this pair is already in progress"}, 409)
            job_id = uuid.uuid4().hex[:10]
            JOBS[job_id] = {"status": "queued", "pair": pair_key(a, b),
                            "startedAt": datetime.now(timezone.utc).isoformat(), "error": None}
            threading.Thread(target=_run_judge_job, args=(job_id, a, b), daemon=True).start()
            return self._json({"job": job_id})

        if url.path == "/api/human_video_score":
            # Per-VIDEO human scores for narration & sync (1-5), stored in
            # human_video_scores/ — never mixed with AI judge results.
            vid = data.get("video")
            narr, sync = data.get("narration"), data.get("sync")
            ok = (vid and isinstance(narr, (int, float)) and isinstance(sync, (int, float))
                  and 1 <= narr <= 5 and 1 <= sync <= 5)
            if not ok:
                return self._json({"error": "video, narration (1-5), sync (1-5) required"}, 400)
            HUMAN_VIDEO_SCORES.mkdir(exist_ok=True)
            ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            record = {"video": vid, "narration": narr, "sync": sync,
                      "note": data.get("note") or None, "source": "human",
                      "scoredAt": datetime.now(timezone.utc).isoformat()}
            out = HUMAN_VIDEO_SCORES / f"{vid}__{ts}.json"
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
