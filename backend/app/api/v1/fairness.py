"""``/api/v1/fairness`` -- Jain index / Gini coefficient / Lorenz curve
(B9/A12), computed for real from each DT's cumulative loss-of-life hours
(the running simulation's actual per-DT burden distribution), not fabricated.
"""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter, Depends

from app.grid.fairness import gini_coefficient, jain_index, lorenz_curve
from app.services.deps import get_grid_service
from app.services.service import GridService

router = APIRouter(prefix="/api/v1/fairness", tags=["fairness"])


@router.get("")
async def get_fairness(
    subdivision_id: str | None = None, service: GridService = Depends(get_grid_service)
) -> dict:
    burden = np.array(list(service.world.solution.cumulative_loss_of_life_hours.values()))
    pop_frac, cum_frac = lorenz_curve(burden)
    lorenz_points = [
        {
            "cumulativePopulationPct": round(float(p) * 100.0, 2),
            "cumulativeServedPct": round(float(c) * 100.0, 2),
        }
        for p, c in zip(pop_frac, cum_frac, strict=True)
    ]
    return {
        "subdivisionId": subdivision_id or "all",
        "jainIndex": round(jain_index(burden), 4) if len(burden) else 1.0,
        "giniCoefficient": round(gini_coefficient(burden), 4) if len(burden) else 0.0,
        "lorenzPoints": lorenz_points,
    }


__all__ = ["router"]
