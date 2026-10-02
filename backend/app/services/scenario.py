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
from app.services.service import GridService

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
            "scenarioName": self.scenario_name,
            "nIntervals": self.n_intervals,
            "solution": self.solution_kpis,
            "shadowBaseline": self.shadow_kpis,
            "diff": {
                "reliefKwAvoided": round(self.relief_kw_avoided, 3),
                "hardshipHoursAvoided": round(self.hardship_hours_avoided, 3),
            },
        }


def run_scenario(scenario_name: str, n_intervals: int = 24, seed: int = 0) -> ScenarioRunResult:
    """Boot a fresh ``GridService`` for ``scenario_name``, advance it
    ``n_intervals`` steps, and diff the solution track against the shadow
    (status-quo, no Flex Plans) baseline that runs alongside it.
    """
    service = GridService(seed=seed, scenario_name=scenario_name)
    service.boot()
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
            "totalServedKw": sum(sol_served),
            "totalUnservedKw": sum(sol_unserved),
            "hoursOfHardship": sol_hardship,
        },
        shadow_kpis={
            "totalServedKw": sum(shadow_served),
            "totalUnservedKw": sum(shadow_unserved),
            "hoursOfHardship": shadow_hardship,
        },
        relief_kw_avoided=relief_kw_avoided,
        hardship_hours_avoided=shadow_hardship - sol_hardship,
    )


__all__ = ["BUILTIN_SCENARIO_NAMES", "ScenarioRunResult", "run_scenario"]
