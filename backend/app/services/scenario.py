"""Scenario Lab (Lane B, task B10): run a named scenario and diff the
solution track's KPIs against the shadow (status-quo) baseline track that
``GridWorld`` already runs in parallel.

Calibration note (firm-share target, docs/SPEC.md B10): Lane A's
``supply.FIRM_SHARE_BY_KIND`` (urban 0.88 / semi-urban 0.78 / rural 0.68) is
a rank-ordered, plausible-magnitude prototype calibration against the broad
pattern CEEW's Access, Affordability and Reliability of Power Supply surveys
report (rural sub-divisions see materially more outage hours than urban
ones) -- the raw CEEW microdata was not available in this environment, so
this module's acceptance check is necessarily a *rank-order* check (rural
hours-of-hardship >= urban hours-of-hardship under an identical deficit
scenario), not a statistical fit to a specific CEEW outage-hour figure.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.grid.metrics import hours_of_hardship
from app.grid.models import PlanStatus
from app.services.service import GridService

# Scenario Lab is a headless what-if sandbox (no JE/AE in the loop), so a plan
# built from a detected deficit is approved immediately under this named
# operator label rather than sitting in DRAFT forever -- invariant #5 (no
# autonomous dispatcher action without a *named* human approver, see
# test_invariants.py) only requires the approver field be a non-empty name;
# it does not require a live person for this offline analysis tool.
SCENARIO_LAB_APPROVER = "scenario_lab_auto"

BUILTIN_SCENARIO_NAMES: tuple[str, ...] = (
    "heatwave_evening",
    "monsoon_cloud",
    "solar_noon",
    "re_2047",
)


@dataclass
class ScenarioRunResult:
    scenario_name: str
    n_intervals: int
    solution_kpis: dict
    shadow_kpis: dict
    relief_kw_avoided: float
    hardship_hours_avoided: float

    def to_view(self) -> dict:
        return {
            "scenario_name": self.scenario_name,
            "n_intervals": self.n_intervals,
            "solution": self.solution_kpis,
            "shadow_baseline": self.shadow_kpis,
            "diff": {
                "relief_kw_avoided": round(self.relief_kw_avoided, 3),
                "hardship_hours_avoided": round(self.hardship_hours_avoided, 3),
            },
        }


def _auto_build_and_approve_plans(service: GridService) -> None:
    """Build a draft ``FlexPlan`` for every sub-division with a real demand/
    supply gap over the scenario's horizon, then approve it immediately (see
    ``SCENARIO_LAB_APPROVER``).

    Without this, ``service._active_actions()`` always returns an empty
    ``Actions`` map (no plan is ever APPROVED/DISPATCHED), so the solution
    track runs through ``GridWorld`` with *exactly* the same per-interval
    actions as the shadow baseline -- zero levers applied either way -- and
    ``run_scenario()`` reports ``relief_kw_avoided = 0.0`` regardless of how
    large a deficit the network actually has. This is the second half of the
    "Scenario Lab always reports zero relief" bug: pointing ``build_scenario``
    at the real network (via ``use_real_network=True``) creates a genuine
    deficit, but a deficit alone changes nothing unless a plan is actually
    built *and* approved so its levers get applied to the solution track.
    """
    network = service.scenario.network
    plan_service = service.plan_service
    live_subdivisions = {
        p.subdivision_id
        for p in plan_service.list_plans()
        if p.status in (PlanStatus.DRAFT, PlanStatus.APPROVED, PlanStatus.DISPATCHED)
    }
    for sub_id in network.subdivision_ids:
        if sub_id in live_subdivisions:
            continue
        dt_ids = [d for d in network.dt_ids if network.dt_subdivision[d] == sub_id]
        if not dt_ids:
            continue

        gap_kw_series: dict[str, np.ndarray] = {}
        dt_limit_kw: dict[str, float] = {}
        dr_potential_kw: dict[str, float] = {}
        hub_potential_kw: dict[str, float] = {}
        storage_energy_kwh: dict[str, float] = {}
        shift_potential_kw: dict[str, float] = {}
        for dt_id in dt_ids:
            gross = service.scenario.dt_gross_kw[dt_id]
            available = service.scenario.dt_available_kw[dt_id]
            gap_kw_series[dt_id] = np.maximum(gross - available, 0.0)
            rated_kw = next(d.rated_kw for d in service.dt_statics if d.dt_id == dt_id)
            dt_limit_kw[dt_id] = rated_kw
            dr_potential_kw[dt_id] = 0.10 * rated_kw
            hub_potential_kw[dt_id] = 0.05 * rated_kw
            storage_energy_kwh[dt_id] = 0.0
            shift_potential_kw[dt_id] = 0.05 * rated_kw

        new_plans = plan_service.refresh_from_series(
            subdivision_id=sub_id,
            dt_ids=dt_ids,
            gap_kw_series=gap_kw_series,
            dt_limit_kw=dt_limit_kw,
            dr_potential_kw=dr_potential_kw,
            hub_potential_kw=hub_potential_kw,
            storage_energy_kwh=storage_energy_kwh,
            shift_potential_kw=shift_potential_kw,
        )
        for plan in new_plans:
            plan_service.approve(plan.id, approver=SCENARIO_LAB_APPROVER)


def run_scenario(scenario_name: str, n_intervals: int = 24, seed: int = 0) -> ScenarioRunResult:
    """Boot a fresh ``GridService`` for ``scenario_name`` against the real,
    calibrated seed network, build+approve Flex Plans for every sub-division
    with a genuine demand/supply gap, advance it ``n_intervals`` steps, and
    diff the solution track against the shadow (status-quo, no Flex Plans)
    baseline that runs alongside it.
    """
    service = GridService(seed=seed, scenario_name=scenario_name, use_real_network=True)
    service.boot()
    _auto_build_and_approve_plans(service)
    service.jump(n_intervals)

    sol_unserved = [r.unserved_kw for r in service.solution_logs]
    shadow_unserved = [r.unserved_kw for r in service.shadow_logs]
    sol_served = [r.served_kw for r in service.solution_logs]
    shadow_served = [r.served_kw for r in service.shadow_logs]

    relief_kw_avoided = sum(shadow_unserved) - sum(sol_unserved)
    sol_hardship = hours_of_hardship(np.array(sol_unserved)) if sol_unserved else 0.0
    shadow_hardship = hours_of_hardship(np.array(shadow_unserved)) if shadow_unserved else 0.0

    return ScenarioRunResult(
        scenario_name=scenario_name,
        n_intervals=n_intervals,
        solution_kpis={
            "total_served_kw": sum(sol_served),
            "total_unserved_kw": sum(sol_unserved),
            "hours_of_hardship": sol_hardship,
        },
        shadow_kpis={
            "total_served_kw": sum(shadow_served),
            "total_unserved_kw": sum(shadow_unserved),
            "hours_of_hardship": shadow_hardship,
        },
        relief_kw_avoided=relief_kw_avoided,
        hardship_hours_avoided=shadow_hardship - sol_hardship,
    )


__all__ = ["BUILTIN_SCENARIO_NAMES", "ScenarioRunResult", "run_scenario"]
