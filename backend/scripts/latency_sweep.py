"""Endpoint-latency sweep (B13): hits every GET endpoint ``export_fixtures``
knows about N times and reports p50/p95/max latency per endpoint, in-process
(via ``TestClient``, no real network hop) -- a quick regression check that a
change hasn't made some endpoint pathologically slow.

Usage (from ``backend/``): ``.venv/Scripts/python scripts/latency_sweep.py [--n 20]``
"""

from __future__ import annotations

import argparse
import statistics
import sys
import time
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402
from app.services.deps import reset_grid_service  # noqa: E402
from scripts.export_fixtures import STATIC_GET_ENDPOINTS  # noqa: E402


def sweep(n: int = 20) -> dict[str, dict[str, float]]:
    reset_grid_service()
    client = TestClient(create_app())
    results: dict[str, dict[str, float]] = {}

    for name, path in STATIC_GET_ENDPOINTS:
        samples: list[float] = []
        for _ in range(n):
            start = time.perf_counter()
            client.get(path)
            samples.append((time.perf_counter() - start) * 1000.0)
        samples.sort()
        results[name] = {
            "p50_ms": statistics.median(samples),
            "p95_ms": samples[round(0.95 * (len(samples) - 1))],
            "max_ms": max(samples),
        }
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--n", type=int, default=20)
    args = parser.parse_args()

    results = sweep(args.n)
    width = max(len(name) for name in results)
    for name, stats in sorted(results.items(), key=lambda kv: -kv[1]["p95_ms"]):
        p50, p95, mx = stats["p50_ms"], stats["p95_ms"], stats["max_ms"]
        print(f"{name:<{width}}  p50={p50:7.2f}ms  p95={p95:7.2f}ms  max={mx:7.2f}ms")


if __name__ == "__main__":
    main()
