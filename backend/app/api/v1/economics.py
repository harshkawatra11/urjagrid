"""``/api/v1/economics`` -- unit + national economics (B9/B10)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.services.deps import get_grid_service
from app.services.economics import national_impact, unit_economics
from app.services.service import GridService

router = APIRouter(prefix="/api/v1/economics", tags=["economics"])


@router.get("/unit")
async def get_unit_economics(
    monthly_dr_kwh_shifted: float = 500.0,
    monthly_avoided_shedding_kwh: float = 2000.0,
    service: GridService = Depends(get_grid_service),
) -> dict:
    n_meters = len(service.scenario.network.consumers)
    econ = unit_economics(n_meters, monthly_dr_kwh_shifted, monthly_avoided_shedding_kwh)
    return econ.to_view()


@router.get("/national")
async def get_national_impact(
    monthly_dr_kwh_shifted: float = 500.0,
    monthly_avoided_shedding_kwh: float = 2000.0,
    service: GridService = Depends(get_grid_service),
) -> dict:
    n_meters = len(service.scenario.network.consumers)
    econ = unit_economics(n_meters, monthly_dr_kwh_shifted, monthly_avoided_shedding_kwh)
    impact = national_impact(econ, pilot_meter_count=n_meters)
    return impact.to_view()


__all__ = ["router"]
