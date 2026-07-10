"""
bradley_terry.py — Bradley-Terry ranking over stored pairwise judge results.

Direct port of computeBradleyTerry() from visionbook/figure-platform's
backend/server.js (the MM / minorization-maximization iteration):

    p_i  <-  W_i / sum_{j != i} [ N_ij / (p_i + p_j) ]

where W_i is total win-share (win = 1, tie = 0.5, loss = 0) and N_ij is the
symmetric total comparison count between i and j. Strengths are normalized to
sum to 1 each iteration; iterate up to 500 times, break when the max change
drops below 1e-8.

Rankings are computed SEVEN ways: once from the aggregator's overall winner
per pair ("overall"), and once per dimension using that dimension's own
winner, bypassing the aggregator entirely.
"""

DIMENSIONS = [
    "visual_accuracy",
    "interactivity",
    "narration_quality",
    "sync",
    "concept_accuracy",
    "polish",
]

MAX_ITER = 500
TOLERANCE = 1e-8


def compute_bradley_terry(matchups):
    """
    @param matchups: list of {"a": id, "b": id, "aWins": 0 | 0.5 | 1}
    @returns: sorted list of {"id", "score", "wins", "losses", "ties", "comparisons"}
    """
    setups = sorted({m["a"] for m in matchups} | {m["b"] for m in matchups})
    if not setups:
        return []

    W = {s: 0.0 for s in setups}
    raw_wins = {s: 0 for s in setups}
    raw_losses = {s: 0 for s in setups}
    raw_ties = {s: 0 for s in setups}
    Nij = {s: {t: 0 for t in setups} for s in setups}

    for m in matchups:
        a, b, a_wins = m["a"], m["b"], m["aWins"]
        W[a] += a_wins
        W[b] += 1 - a_wins
        Nij[a][b] += 1
        Nij[b][a] += 1
        if a_wins == 1:
            raw_wins[a] += 1
            raw_losses[b] += 1
        elif a_wins == 0:
            raw_losses[a] += 1
            raw_wins[b] += 1
        else:
            raw_ties[a] += 1
            raw_ties[b] += 1

    p = {s: 1.0 for s in setups}
    for _ in range(MAX_ITER):
        new_p = {}
        for i in setups:
            denom = 0.0
            for j in setups:
                if j != i:
                    denom += Nij[i][j] / (p[i] + p[j])
            new_p[i] = W[i] / denom if denom > 0 else p[i]

        total = sum(new_p.values())
        max_change = 0.0
        for s in setups:
            norm = new_p[s] / total if total > 0 else 1.0 / len(setups)
            max_change = max(max_change, abs(norm - p[s]))
            p[s] = norm
        if max_change < TOLERANCE:
            break

    return sorted(
        (
            {
                "id": s,
                "score": p[s],
                "wins": raw_wins[s],
                "losses": raw_losses[s],
                "ties": raw_ties[s],
                "comparisons": raw_wins[s] + raw_losses[s] + raw_ties[s],
            }
            for s in setups
        ),
        key=lambda r: r["score"],
        reverse=True,
    )


def _build_matchups(results, get_winner):
    """Convert stored pair results to BT matchups via a winner extractor."""
    matchups = []
    for r in results:
        winner = get_winner(r)
        a, b = r.get("setupA"), r.get("setupB")
        if not winner or not a or not b:
            continue
        if winner not in (a, b, "tie"):
            continue
        matchups.append({"a": a, "b": b, "aWins": 1 if winner == a else 0.5 if winner == "tie" else 0})
    return matchups


def rank_all(results):
    """
    Compute all 7 Bradley-Terry rankings from stored pairwise results.

    @param results: list of result dicts as saved by pairwise_evaluator
    @returns: {"overall": [...], "dimensions": {dim: [...] for each of the 6}}
    """
    overall = compute_bradley_terry(
        _build_matchups(results, lambda r: (r.get("aggregator") or {}).get("winner"))
    )
    dimensions = {
        dim: compute_bradley_terry(
            _build_matchups(
                results,
                lambda r, d=dim: ((r.get("dimensions") or {}).get(d) or {}).get("winner"),
            )
        )
        for dim in DIMENSIONS
    }
    return {"overall": overall, "dimensions": dimensions}


def format_ranking_table(title, ranking):
    """Render one ranking as a plain-text table."""
    lines = [f"── {title} " + "─" * max(0, 58 - len(title))]
    if not ranking:
        lines.append("  (no comparisons recorded)")
        return "\n".join(lines)
    lines.append(f"  {'#':>2}  {'variant':<24} {'score':>8}  {'W':>3} {'L':>3} {'T':>3}  {'n':>3}")
    for rank, row in enumerate(ranking, 1):
        lines.append(
            f"  {rank:>2}  {row['id']:<24} {row['score']:>8.4f}  "
            f"{row['wins']:>3} {row['losses']:>3} {row['ties']:>3}  {row['comparisons']:>3}"
        )
    return "\n".join(lines)
