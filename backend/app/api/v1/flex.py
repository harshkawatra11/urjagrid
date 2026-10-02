"""``/api/v1/flex`` -- live lever status by category (chargers/storage/DR/
lifeline caps), derived from the protocol ledger + active plans (B9)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.grid.models import PlanStatus
from app.services.deps import get_grid_service
from app.services.service import GridService

router = APIRouter(prefix="/api/v1/flex", tags=["flex"])


def _active_plans(service: GridService) -> list:
    return [
        p
        for p in service.plan_service.list_plans()
        if p.status in (PlanStatus.APPROVED, PlanStatus.DISPATCHED)
    ]


@router.get("")
async def flex_overview(service: GridService = Depends(get_grid_service)) -> dict:
    plans = _active_plans(service)
    return {
        "active_plan_count": len(plans),
        "ledger_counts": service.ledger.counts_by_protocol(),
    }


@router.get("/chargers")
async def flex_chargers(service: GridService = Depends(get_grid_service)) -> list[dict]:
    plans = _active_plans(service)
    return [
        {"dt_id": dt_id, "hub_frac": frac, "plan_id": plan.id}
        for plan in plans
        for dt_id, frac in plan.solution.hub_frac_by_dt.items()
    ]


@router.get("/storage")
async def flex_storage(service: GridService = Depends(get_grid_service)) -> list[dict]:
    plans = _active_plans(service)
    return [
        {"dt_id": dt_id, "storage_kw": kw, "plan_id": plan.id}
        for plan in plans
        for dt_id, kw in plan.solution.storage_kw_by_dt.items()
        if kw > 0
    ]


@router.get("/dr")
async def flex_dr(service: GridService = Depends(get_grid_service)) -> list[dict]:
    plans = _active_plans(service)
    return [
        {"dt_id": dt_id, "dr_on": on, "plan_id": plan.id}
        for plan in plans
        for dt_id, on in plan.solution.dr_on_by_dt.items()
        if on
    ]


@router.get("/lifeline")
async def flex_lifeline(service: GridService = Depends(get_grid_service)) -> list[dict]:
    plans = _active_plans(service)
    return [
        {"dt_id": dt_id, "cap_level": level, "plan_id": plan.id}
        for plan in plans
        for dt_id, level in plan.solution.cap_level_by_dt.items()
        if level > 0
    ]


__all__ = ["router"]
