#!/usr/bin/env python3
"""
Build a static, shareable clone of the LIVE dashboard (dashboard/index.html)
for Vercel. Uses the real dashboard UI verbatim; only the data layer is
swapped: every GET /api/* response is baked to a data.js at build time, and
the operator-only write features (Run AI Judge, submit verdict) are hidden
since they need the server. Read-only, no API key, deployable as static files.

    python3 dashboard_share/build.py        # writes dashboard_share/socraticai-dashboard/
"""
import json
import re
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SHARE = Path(__file__).resolve().parent
OUT = SHARE / "socraticai-dashboard"
MEDIA = OUT / "media"
BENCH720 = REPO / "benchmark_site" / "socraticai-benchmark" / "media"  # reuse 720p encodes

sys.path.insert(0, str(REPO / "dashboard"))
import app  # noqa: E402  the live dashboard server module (catalog/stats/rankings logic)
sys.path.insert(0, str(REPO / "agentic_pipeline" / "judge"))
import bradley_terry  # noqa: E402

PRIMARY = re.compile(r"_(v[1-7]|veo3|mathgpt|notebooklm|videotutor)$")
DIMS = app.DIMENSIONS


def stats_for(vid, results):
    """Replicate the server's /api/stats/<vid> aggregation exactly."""
    dim_rec = {d: {"w": 0, "l": 0, "t": 0} for d in DIMS}
    ov_rec = {"w": 0, "l": 0, "t": 0}
    matches = []
    for r in results:
        if vid not in (r.get("setupA"), r.get("setupB")):
            continue
        opp = r["setupB"] if r["setupA"] == vid else r["setupA"]
        dims = {}
        for d in DIMS:
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
    return {"video": vid, "matches": matches, "dimRecord": dim_rec, "overallRecord": ov_rec}


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    MEDIA.mkdir(parents=True)

    # Benchmark set only: v1-v7 + externals, no misc pilots.
    items = [it for it in app.catalog()
             if PRIMARY.search(it["id"]) and not it["id"].startswith("misc_")]

    baked_items = []
    for it in items:
        if it["kind"] == "video":
            src = BENCH720 / f"{it['id']}.mp4"          # reuse cropped 720p encode
            if not src.exists():
                print(f"  WARN missing 720p video {src.name}", file=sys.stderr); continue
            dest = MEDIA / f"{it['id']}.mp4"
        else:
            src = REPO / it["url"][len("/media/"):]      # self-contained lesson HTML
            if not src.exists():
                print(f"  WARN missing lesson {src}", file=sys.stderr); continue
            dest = MEDIA / f"{it['id']}.html"
        shutil.copy2(src, dest)
        baked_items.append({**it, "url": f"media/{dest.name}"})

    ids = [it["id"] for it in baked_items]
    all_results = app.load_judge_results()

    rankings = {s: bradley_terry.rank_all(app.load_judge_results(s))
                for s in app.SUBJECT_DIRS}  # subjects come from the manifest via app.py
    stats = {vid: stats_for(vid, all_results) for vid in ids}
    pairs = {}
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            jr = app.judge_result_for(ids[i], ids[j])
            if jr:
                pairs[app.pair_key(ids[i], ids[j])] = {"judge": jr, "human": []}

    # a sensible default "Suggest a pair": first two circles items
    circ = [i for i in ids if i.startswith("circles")]
    next_pair = {"a": circ[0], "b": circ[1]} if len(circ) >= 2 else {}

    baked = {"videos": baked_items, "rankings": rankings, "stats": stats,
             "pairs": pairs, "nextPair": next_pair}
    (OUT / "data.js").write_text("window.BAKED = " + json.dumps(baked) + ";\n")

    patch_index(OUT / "index.html")
    total = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"Built {OUT}: {len(baked_items)} items, {len(pairs)} judged pairs, "
          f"{total/1e6:.0f} MB")


def patch_index(dest):
    """Copy the live dashboard index.html and swap its data layer to the
    baked static data; hide operator-only write controls."""
    html = (REPO / "dashboard" / "index.html").read_text()

    shim = r"""const api = (p, o) => {
  if (o && o.method === "POST") return Promise.resolve({ error: "read-only shared view" });
  const u = new URL(p, location.origin).pathname, B = window.BAKED, seg = decodeURIComponent(u.split("/").pop());
  if (u === "/api/videos") return Promise.resolve(B.videos);
  if (u.startsWith("/api/rankings/")) return Promise.resolve(B.rankings[seg] || {overall:[],dimensions:{}});
  if (u.startsWith("/api/stats/")) return Promise.resolve(B.stats[seg] ||
      {video:seg,matches:[],dimRecord:{},overallRecord:{w:0,l:0,t:0}});
  if (u.startsWith("/api/pair/")) { const parts = u.split("/");
      const key = [decodeURIComponent(parts[3]), decodeURIComponent(parts[4])].sort().join("__");
      return Promise.resolve(B.pairs[key] || {judge:null, human:[]}); }
  if (u === "/api/next_pair") return Promise.resolve(B.nextPair);
  if (u.startsWith("/api/job/")) return Promise.resolve({status:"error", error:"disabled in shared view"});
  return Promise.resolve({});
};"""
    orig_api = 'const api = (p, o) => fetch(p, o).then(r => r.json());'
    assert orig_api in html, "api() anchor not found — dashboard/index.html changed"
    html = html.replace(orig_api, shim)

    # Load baked data + hide write-only controls, keep the read-only
    # "Machine judge said…" verdict table.
    inject = """<script src="data.js"></script>
<style>
  #runJudge, #judgeStatus, .quick, #verdictRows, #submitVerdict, #saveMsg { display:none !important; }
  #verdictPanel > div:first-child, #verdictPanel > h3 { display:none !important; }
  #verdictPanel::before { content:"Read-only shared view — verdicts and the live judge are disabled. Everything else mirrors the SocraticAI benchmark dashboard."; color:#9094a2; font-size:12px; display:block; margin-bottom:6px; }
</style>
"""
    html = html.replace("<script>\nconst DIMS", inject + "<script>\nconst DIMS", 1)

    # Retitle for sharing.
    html = html.replace("<title>Compare</title>",
                        "<title>SocraticAI — Benchmark Dashboard</title>")
    dest.write_text(html)


if __name__ == "__main__":
    main()
