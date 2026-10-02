"""``/api/v1/reliability`` -- Hours of Hardship / SAIDI / SAIFI / lifeline
availability (B9/A12), computed for real from the running simulation's
per-interval history (``GridService.solution_logs``), not fabricated.

Scope note: the simulator runs a single aggregate ("all") track rather than
one per sub-division (see ``services/service.py#_to_log_row``), so passing a
``subdivision_id`` currently has no narrower data to filter to; the response
always reflects the whole scenario, consistent with the fixture's own
``subdivisionId: "all"``.
"""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter, Depends

from app.grid.metrics import hours_of_hardship, lifeline_availability, saidi, saifi
from app.services.deps import get_grid_service
from app.services.service import GridService

router = APIRouter(prefix="/api/v1/reliability", tags=["reliability"])


@router.get("")
async def get_reliability(
    subdivision_id: str | None = None, service: GridService = Depends(get_grid_service)
) -> dict:
    logs = service.solution_logs
    unserved = np.array([r.unserved_kw for r in logs])
    served_w = np.array([r.served_kw for r in logs]) * 1000.0
    n_customers = max(
        len(service.scenario.network.consumers)
        if hasattr(service.scenario.network, "consumers")
        else 1,
        1,
    )

    # Every customer is treated as experiencing the same aggregate hardship
    # episodes (the simulator tracks one DT-aggregate world, not per-customer
    # interruption state -- see the module docstring), so feeding
    # `hardship_hours * n_customers` / `episodes * n_customers` through the
    # standard SAIDI/SAIFI formulas (sum of customer-hours / total customers)
    # reduces to the aggregate hardship-hours/episode-count directly.
    hardship_hours = hours_of_hardship(unserved) if len(unserved) else 0.0
    was_unserved = unserved > 0
    episode_starts = int(np.sum(np.diff(np.concatenate(([False], was_unserved))) == 1))
    interruption_hours = {"all": hardship_hours * n_customers}
    interruption_counts = {"all": episode_starts * n_customers}

    return {
        "subdivisionId": subdivision_id or "all",
        "saidiMinutes": round(saidi(interruption_hours, n_customers) * 60.0, 2),
        "saifiCount": round(saifi(interruption_counts, n_customers), 4),
        "lifelineAvailabilityPct": round(
            lifeline_availability(served_w) * 100.0 if len(served_w) else 100.0, 2
        ),
        "hoursOfHelp": round(hours_of_hardship(unserved) if len(unserved) else 0.0, 2),
    }


__all__ = ["router"]
