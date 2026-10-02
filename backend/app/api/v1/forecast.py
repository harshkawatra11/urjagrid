"""``/api/v1/forecast`` -- per-sub-division ``ForecastBundle`` (B9).

Simplification note: this endpoint builds its per-DT P10/P50/P90 band
directly from the scenario's bottom-up demand array (P50 = bottom-up,
P10/P90 = +-20%) rather than invoking Lane A's trained LightGBM quantile
models per DT (``forecaster.QuantileForecaster``), which expects a
DT-specific 13-feature matrix (``daydata.DayBuilder``) that this prototype's
per-tick scenario data doesn't assemble yet. Lane A's forecaster is fully
exercised and verified in its own test module (``test_forecaster.py``); wiring
it into this endpoint instead of the flat +-20% band is a natural follow-up,
not a correctness gap in the forecaster itself.
"""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter, Depends

from app.core.exceptions import NotFoundError
from app.grid.planner import DtForecastInput, build_forecast_bundle
from app.services.deps import get_grid_service
from app.services.service import GridService

router = APIRouter(prefix="/api/v1/forecast", tags=["forecast"])


@router.get("/{subdivision_id}")
async def get_forecast(
    subdivision_id: str, service: GridService = Depends(get_grid_service)
) -> dict:
    network = service.scenario.network
    if subdivision_id not in network.subdivision_ids:
        raise NotFoundError("Subdivision", subdivision_id)

    dt_inputs: list[DtForecastInput] = []
    for dt_id in network.dt_ids:
        if network.dt_subdivision[dt_id] != subdivision_id:
            continue
        gross = service.scenario.dt_gross_kw[dt_id]
        rated_kw = next(d.rated_kw for d in service.dt_statics if d.dt_id == dt_id)
        p50_pu = np.clip(gross / rated_kw, 0.0, None)
        dt_inputs.append(
            DtForecastInput(
                dt_id=dt_id,
                bottom_up_kw=gross,
                p10_pu=p50_pu * 0.8,
                p50_pu=p50_pu,
                p90_pu=p50_pu * 1.2,
                rated_kw=rated_kw,
                available_kw=service.scenario.dt_available_kw[dt_id],
            )
        )
    bundle = build_forecast_bundle(subdivision_id, dt_inputs)
    return bundle.model_dump(mode="json")


__all__ = ["router"]
