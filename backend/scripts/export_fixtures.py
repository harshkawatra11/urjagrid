"""Freeze the running app's state at a representative point ("20:30 IST" --
the demo's framing, even though this is a pure simulation with no real wall
clock tie-in) and export every GET endpoint's response to
``frontend/src/data/fixtures/*.json`` so Lane C/D's frontend can render
fully offline (docs/SPEC.md B13 / section 9).

Usage (from ``backend/``):

    .venv/Scripts/python scripts/export_fixtures.py [--intervals N] [--out DIR]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402
from app.services.deps import get_grid_service, reset_grid_service  # noqa: E402

DEFAULT_OUT_DIR = BACKEND_ROOT.parent / "frontend" / "src" / "data" / "fixtures"

# Every GET endpoint this script knows how to freeze, as
# (fixture filename, path) pairs. Paths with a placeholder are filled in
# dynamically below (one DT id, one sub-division id, one plan id) once the
# scenario has advanced far enough to have real data to point at.
STATIC_GET_ENDPOINTS: list[tuple[str, str]] = [
    ("health", "/health"),
    ("subdivisions", "/api/v1/subdivisions"),
    ("feeders", "/api/v1/feeders"),
    ("transformers", "/api/v1/transformers"),
    ("critical", "/api/v1/critical"),
    ("geo", "/api/v1/geo"),
    ("plans", "/api/v1/plans"),
    ("flex", "/api/v1/flex"),
    ("flex_chargers", "/api/v1/flex/chargers"),
    ("flex_storage", "/api/v1/flex/storage"),
    ("flex_dr", "/api/v1/flex/dr"),
    ("flex_lifeline", "/api/v1/flex/lifeline"),
    ("consumers", "/api/v1/consumers"),
    ("field_registry", "/api/v1/field/registry"),
    ("protocols", "/api/v1/protocols"),
    ("federation", "/api/v1/federation"),
    ("scenario_names", "/api/v1/scenario"),
    ("economics_unit", "/api/v1/economics/unit"),
    ("economics_national", "/api/v1/economics/national"),
    ("openadr_programs", "/api/v1/openadr/programs"),
    ("insights", "/api/v1/insights"),
    ("auth_demo_users", "/api/v1/auth/demo-users"),
]


def export_fixtures(out_dir: Path, n_intervals: int) -> list[str]:
    reset_grid_service()
    app = create_app()
    client = TestClient(app)
    service = get_grid_service()
    service.jump(n_intervals)  # advance to "a representative point" (20:30 IST framing)

    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[str] = []

    for name, path in STATIC_GET_ENDPOINTS:
        response = client.get(path)
        _write(
            out_dir,
            name,
            response.json() if response.status_code == 200 else {"error": response.status_code},
        )
        written.append(name)

    network = service.scenario.network
    if network.dt_ids:
        dt_id = network.dt_ids[0]
        response = client.get(f"/api/v1/transformers/{dt_id}")
        _write(out_dir, "transformer_detail", response.json())
        written.append("transformer_detail")

    if network.subdivision_ids:
        sub_id = network.subdivision_ids[0]
        response = client.get(f"/api/v1/forecast/{sub_id}")
        _write(out_dir, "forecast", response.json())
        written.append("forecast")

    _write(out_dir, "manifest", {"exported_fixtures": written, "framing": "20:30 IST (simulated)"})
    written.append("manifest")
    return written


def _write(out_dir: Path, name: str, data: object) -> None:
    (out_dir / f"{name}.json").write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--intervals",
        type=int,
        default=82,
        help="intervals to advance (82*15min ~= 20:30 IST from 00:00)",
    )
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR)
    args = parser.parse_args()

    written = export_fixtures(args.out, args.intervals)
    print(f"Wrote {len(written)} fixture files to {args.out}")


if __name__ == "__main__":
    main()
