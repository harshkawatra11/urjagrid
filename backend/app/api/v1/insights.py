"""``/api/v1/insights`` -- aggregate KPIs + DT risk ranking (B9)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.services.deps import get_grid_service
from app.services.service import GridService

router = APIRouter(prefix="/api/v1/insights", tags=["insights"])


@router.get("")
async def get_insights(service: GridService = Depends(get_grid_service)) -> dict:
    return {"kpis": service.kpis(), "risk": service.risk_summary()}


__all__ = ["router"]
