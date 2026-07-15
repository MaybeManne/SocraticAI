#!/usr/bin/env python3
"""
Launch a SECOND dashboard instance on an alternate port without modifying
app.py or disturbing its already-running instance.

Both instances import the same handler and read the SAME live data from
agentic_pipeline/judge/pairwise_results/ on every request — so they always
show identical, current results. This exists only to satisfy "run it on a
different port too"; it is not a separate data snapshot.

    PORT=8766 OPENAI_API_KEY=... python3 dashboard/app_alt_port.py
"""
import os
import app  # noqa: E402  (same directory; reuses all handlers/routes)

app.PORT = int(os.environ.get("PORT", "8766"))
app.main()
