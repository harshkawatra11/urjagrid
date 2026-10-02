"""Lever potential calculators -- how much relief (kW/kWh) each lever in
``LEVER_ORDER`` can plausibly contribute for a given DT/window.

These are used by the deficit detector (to size how much relief is needed
per lever before escalating to the next one) and by the MILP optimiser
(A11) as per-lever capacity bounds.
"""

from __future__ import annotations

from app.grid.constants import CAP_LEVEL_WATTS


def cap_reduction_kw(
    tier_counts: dict[str, int], baseline_avg_kw: dict[str, float], cap_level: int
) -> float:
    """Total kW freed by applying ``cap_level`` to every T1/T2 consumer on a DT.

    ``tier_counts``/``baseline_avg_kw`` are keyed by tier ("t1","t2"); T0 is
    never included (critical facilities/life-support are never capped).
    """
    if cap_level == 0:
        return 0.0
    watts_by_tier = CAP_LEVEL_WATTS[cap_level]
    freed = 0.0
    for tier in ("t1", "t2"):
        count = tier_counts.get(tier, 0)
        baseline = baseline_avg_kw.get(tier, 0.0)
        cap_kw = watts_by_tier.get(tier, 0) / 1000.0
        freed += count * max(baseline - cap_kw, 0.0)
    return freed


def dr_expected_kw(n_consumers: int, acceptance_prob: float, avg_shiftable_kw: float) -> float:
    """Expected behavioural-DR relief: consumers x acceptance probability x
    average shiftable load per accepting consumer.
    """
    return n_consumers * max(min(acceptance_prob, 1.0), 0.0) * avg_shiftable_kw


def hub_curtailment_kw(rated_kw: float, hub_frac: float) -> float:
    """Managed-charging relief available by curtailing a hub to ``hub_frac``
    (fraction of rated power still allowed to flow, in [0, 1]).
    """
    hub_frac = max(min(hub_frac, 1.0), 0.0)
    return rated_kw * (1.0 - hub_frac)


def shift_reduction_kw(rated_kw: float, shift_on: bool) -> float:
    """Relief from pausing a shiftable public load (water pump, telecom tower)."""
    return 0.0 if shift_on else rated_kw


def storage_recoverable_energy_kwh(
    capacity_kwh: float, soc_frac: float, max_discharge_kw: float, duration_hours: float
) -> float:
    """Energy a storage asset can deliver over ``duration_hours``, limited by
    both its remaining state of charge and its discharge power rating.
    """
    soc_frac = max(min(soc_frac, 1.0), 0.0)
    energy_from_soc = capacity_kwh * soc_frac
    energy_from_power = max(max_discharge_kw, 0.0) * max(duration_hours, 0.0)
    return min(energy_from_soc, energy_from_power)


def total_lever_potential_kw(
    dr_kw: float, hub_kw: float, shift_kw: float, storage_kw: float, cap_kw: float
) -> float:
    """Sum of every lever's instantaneous relief potential, in lever order
    (behavioural DR -> managed charging -> shiftable loads -> storage -> caps).
    """
    return dr_kw + hub_kw + shift_kw + storage_kw + cap_kw
