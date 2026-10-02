"""``/api/v1/economics`` -- unit + national economics (B9/B10)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.grid.constants import DR_REBATE_RS_PER_KWH
from app.services.deps import get_grid_service
from app.services.economics import (
    AVOIDED_SHEDDING_VALUE_RS_PER_KWH,
    SOFTWARE_FEE_RS_PER_METER_PER_MONTH,
    national_impact,
    unit_economics,
)
from app.services.service import GridService

router = APIRouter(prefix="/api/v1/economics", tags=["economics"])


@router.get("/unit")
async def get_unit_economics(
    monthly_dr_kwh_shifted: float = 500.0,
    monthly_avoided_shedding_kwh: float = 2000.0,
    service: GridService = Depends(get_grid_service),
) -> dict:
    """Frontend-shaped composition of ``unit_economics()`` -- the raw
    dataclass (snake_case, a different field set) is unchanged and still
    covered directly by ``test_economics.py``; this re-packages its real
    numbers into `frontend/src/lib/api/types.ts#EconomicsAssumptions` /
    `EconomicsSummary`.
    """
    n_meters = len(service.scenario.network.consumers)
    econ = unit_economics(n_meters, monthly_dr_kwh_shifted, monthly_avoided_shedding_kwh)
    cost = econ.monthly_dr_rebate_cost_rs + econ.monthly_software_fee_rs
    bcr = round(econ.monthly_avoided_shedding_value_rs / cost, 3) if cost > 0 else 0.0
    return {
        "assumptions": {
            "rebateRsPerKwh": DR_REBATE_RS_PER_KWH,
            "dtFailureCostRs": 0.0,  # not modelled as a separate cost constant yet
            "deferredUpgradeCostRs": 0.0,  # not modelled as a separate cost constant yet
            "energyValueRsPerKwh": AVOIDED_SHEDDING_VALUE_RS_PER_KWH,
            "monthlyFeeRsPerMeter": SOFTWARE_FEE_RS_PER_METER_PER_MONTH,
        },
        "summary": {
            "paybackMonths": round(econ.payback_period_months, 2)
            if econ.payback_period_months is not None
            else 0.0,
            "bcr": bcr,
            "monthlyFeeRs": round(econ.monthly_software_fee_rs, 2),
            "annualSavingsRs": round(econ.monthly_net_benefit_rs * 12, 2),
            "nMeters": econ.n_meters,
            "moneyFlow": [
                {
                    "from": "discom",
                    "to": "software_fee",
                    "amountRs": round(econ.monthly_software_fee_rs, 2),
                },
                {
                    "from": "discom",
                    "to": "dr_rebates",
                    "amountRs": round(econ.monthly_dr_rebate_cost_rs, 2),
                },
                {
                    "from": "avoided_shedding",
                    "to": "discom",
                    "amountRs": round(econ.monthly_avoided_shedding_value_rs, 2),
                },
            ],
        },
    }


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
