#!/usr/bin/env python3
"""
run_judge.py — CLI for the pairwise lesson judge.

Compare one pair (manual pair selection, not automatic round-robin):
    python3 judge/run_judge.py --a circles_v3 --b circles_v5
    python3 judge/run_judge.py --a circles_v3 --b circles_v5 --force

Rank all stored results (7 Bradley-Terry rankings: overall + 6 per-dimension):
    python3 judge/run_judge.py --rank
    python3 judge/run_judge.py --rank --subject circles

Requires OPENAI_API_KEY in the environment for comparisons (fails immediately
if unset — no fallback provider, no hardcoded key). --rank only reads stored
result files and needs no key.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bradley_terry
import pairwise_evaluator


def cmd_compare(args):
    a, b = args.a, args.b
    out_path = pairwise_evaluator.result_path(a, b)
    if out_path.exists() and not args.force:
        print(f"Result already exists: {out_path}")
        print("Skipping (pass --force to re-run).")
        return 0

    # Fail fast on a missing key BEFORE doing any work (screenshots, etc.).
    pairwise_evaluator.require_api_key()

    print(f"Judging {a} vs {b} with {pairwise_evaluator.JUDGE_MODEL} "
          f"(6 parallel dimension calls + 1 aggregator)...")
    result = pairwise_evaluator.run_pairwise(a, b)
    saved = pairwise_evaluator.save_result(result)

    print(f"\nSaved: {saved}\n")
    for dim, r in result["dimensions"].items():
        print(f"  {dim:<20} winner={r['winner']:<24} confidence={r['confidence']}")
        print(f"  {'':<20} {r['rationale']}")
    agg = result["aggregator"]
    print(f"\n  OVERALL{'':<13} winner={agg['winner']:<24} confidence={agg['confidence']}")
    print(f"  {'':<20} {agg['explanation']}")
    return 0


def cmd_rank(args):
    results = pairwise_evaluator.load_all_results(subject=args.subject)
    if not results:
        where = pairwise_evaluator.results_dir()
        scope = f" for subject {args.subject!r}" if args.subject else ""
        print(f"No stored pairwise results{scope} in {where}")
        return 1

    print(f"Ranking from {len(results)} stored pairwise result(s)"
          + (f" (subject: {args.subject})" if args.subject else "") + "\n")
    rankings = bradley_terry.rank_all(results)
    print(bradley_terry.format_ranking_table("OVERALL (aggregator winners)", rankings["overall"]))
    for dim in bradley_terry.DIMENSIONS:
        print()
        print(bradley_terry.format_ranking_table(dim, rankings["dimensions"][dim]))
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Pairwise lesson judge (6 dimensions + aggregator, Bradley-Terry ranking)."
    )
    parser.add_argument("--a", help="first variant id (e.g. circles_v3)")
    parser.add_argument("--b", help="second variant id (e.g. circles_v5)")
    parser.add_argument("--force", action="store_true",
                        help="re-run even if this pair's result file already exists")
    parser.add_argument("--rank", action="store_true",
                        help="compute the 7 Bradley-Terry rankings from all stored results")
    parser.add_argument("--subject", help="with --rank: filter to one subject "
                                          "(circles, archer, binsearch)")
    args = parser.parse_args(argv)

    if args.rank:
        return cmd_rank(args)
    if args.a and args.b:
        return cmd_compare(args)
    parser.error("Provide --a and --b to judge a pair, or --rank to compute rankings.")


if __name__ == "__main__":
    raise SystemExit(main())
