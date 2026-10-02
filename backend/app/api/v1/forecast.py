"""``/api/v1/forecast`` -- per-DT forecast (B9).

Wire contract note: the frontend's `ForecastBundle` type (`lib/api/types.ts`)
is a single-DT, points-array shape (``points: ForecastPoint[]``, each with a
``slotIso``) plus a ``deficitWindows`` array -- not Lane A/B's internal
parallel-arrays-per-sub-division ``grid.models.ForecastBundle``. This router
builds the former from the latter for exactly the DT asked for, reusing
``build_forecast_bundle``/``find_deficit_windows`` (both real, tested engine
code) rather than re-deriving the numbers.

Simplification note (unchanged from the original B9 cut): the P10/P50/P90
band is still a flat +-20% envelope around the scenario's bottom-up demand
array rather than Lane A's trained LightGBM quantile models
(``forecaster.QuantileForecaster``), which need a DT-specific 13-feature
matrix (``daydata.DayBuilder``) this prototype's per-tick scenario data
doesn't assemble. That forecaster is exercised in its own test module
(``test_forecaster.py``) and surfaced for real via ``/forecast/importance``
below (actual trained-model feature importances), just not yet wired into
this per-tick endpoint's band.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import numpy as np
from fastapi import APIRouter, Depends

from app.core.exceptions import NotFoundError
from app.grid.constants import INTERVAL_MIN
from app.grid.deficits import find_windows
from app.grid.forecaster import QuantileForecaster
from app.grid.planner import DtForecastInput, build_forecast_bundle
from app.services.deps import get_grid_service
from app.services.service import GridService

router = APIRouter(prefix="/api/v1/forecast", tags=["forecast"])

_SLOT_EPOCH = datetime(2025, 1, 1, tzinfo=UTC)


def _slot_iso(slot: int) -> str:
    return (_SLOT_EPOCH + timedelta(minutes=INTERVAL_MIN * slot)).isoformat()


def _build_dt_bundle(service: GridService, dt_id: str, subdivision_id: str) -> dict:
    gross = service.scenario.dt_gross_kw[dt_id]
    rated_kw = next(d.rated_kw for d in service.dt_statics if d.dt_id == dt_id)
    p50_pu = np.clip(gross / rated_kw, 0.0, None)
    dt_input = DtForecastInput(
        dt_id=dt_id,
        bottom_up_kw=gross,
        p10_pu=p50_pu * 0.8,
        p50_pu=p50_pu,
        p90_pu=p50_pu * 1.2,
        rated_kw=rated_kw,
        available_kw=service.scenario.dt_available_kw[dt_id],
    )
    bundle = build_forecast_bundle(subdivision_id, [dt_input])
    limit_kw = float(np.max(dt_input.available_kw)) if len(dt_input.available_kw) else rated_kw

    points = [
        {
            "slotIso": _slot_iso(slot),
            "p10Kw": round(bundle.p10_kw[slot], 2),
            "p50Kw": round(bundle.p50_kw[slot], 2),
            "p90Kw": round(bundle.p90_kw[slot], 2),
            "availableKw": round(bundle.available_kw[slot], 2),
            "limitKw": round(limit_kw, 2),
            "actualKw": round(bundle.gross_kw[slot], 2) if slot < len(gross) else None,
        }
        for slot in range(bundle.horizon_slots)
    ]

    gap_flag = np.asarray(bundle.gap_kw) > 0
    windows = find_windows(gap_flag)
    deficit_windows = [
        {
            "id": f"dw_{dt_id}_{start}_{end}",
            "dtId": dt_id,
            "subdivisionId": subdivision_id,
            "startIso": _slot_iso(start),
            "endIso": _slot_iso(end),
            "gapKw": round(float(np.max(bundle.gap_kw[start:end])), 2),
            "thermalRisk": bool(np.max(bundle.gap_kw[start:end]) > 0.2 * rated_kw),
        }
        for start, end in windows
    ]

    return {
        "dtId": dt_id,
        "subdivisionId": subdivision_id,
        "horizonSlots": bundle.horizon_slots,
        "points": points,
        "deficitWindows": deficit_windows,
    }


@router.get("/importance")
async def forecast_importance() -> dict:
    """Real LightGBM P50-model feature importances (A9), paired with the
    13 feature names the model was trained on (``daydata.FEATURE_NAMES``).
    Falls back to an empty list in ``seasonal_naive`` mode (no model files
    committed in this environment) rather than fabricating numbers.
    """
    from app.grid.daydata import FEATURE_NAMES

    forecaster = QuantileForecaster()
    features: list[dict] = []
    if forecaster.mode == "lightgbm" and forecaster._boosters is not None:  # noqa: SLF001
        booster = forecaster._boosters["p50"]  # noqa: SLF001
        importances = booster.feature_importance(importance_type="gain")
        total = float(sum(importances)) or 1.0
        features = [
            {"name": name, "importance": round(float(value) / total, 4)}
            for name, value in zip(FEATURE_NAMES, importances, strict=False)
        ]
        features.sort(key=lambda f: f["importance"], reverse=True)
    return {"features": features}


@router.get("/{dt_id}")
async def get_forecast(dt_id: str, service: GridService = Depends(get_grid_service)) -> dict:
    network = service.scenario.network
    if dt_id not in network.dt_ids:
        raise NotFoundError("Transformer", dt_id)
    subdivision_id = network.dt_subdivision[dt_id]
    return _build_dt_bundle(service, dt_id, subdivision_id)


__all__ = ["router"]
