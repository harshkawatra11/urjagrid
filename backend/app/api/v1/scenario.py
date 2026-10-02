"""``/api/v1/scenario`` -- Scenario Lab (B9/B10)."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.exceptions import ApiError
from app.services.scenario import BUILTIN_SCENARIO_NAMES, run_scenario

router = APIRouter(prefix="/api/v1/scenario", tags=["scenario"])


@router.get("")
async def list_scenarios() -> list[str]:
    return list(BUILTIN_SCENARIO_NAMES)


@router.post("/{scenario_name}/run")
async def run(scenario_name: str, n_intervals: int = 24, seed: int = 0) -> dict:
    if scenario_name not in BUILTIN_SCENARIO_NAMES:
        raise ApiError(404, f"unknown scenario {scenario_name!r}")
    result = run_scenario(scenario_name, n_intervals=n_intervals, seed=seed)
    return result.to_view()


__all__ = ["router"]
