"""MILP Flex Plan optimiser (HiGHS via ``scipy.optimize.milp``), with a
greedy lever-order fallback if HiGHS is unavailable or the solve fails.

Window-level (not per-slot) formulation: each DT's deficit is summarised by
its peak gap over the window (the standard "size for worst case" approach
for a fixed-duration plan), and the optimiser chooses, per DT: a cap level
(one-hot binary over 0..3), a DR accept flag, an hourly-charging-hub
curtailation fraction, a storage discharge amount, and a shiftable-load
on/off flag, to cover that gap at minimum weighted cost, with ``unserved_kw``
(coverage shortfall) and ``overload_kw`` (residual beyond the DT's thermal
limit) as penalised slack.

Cap-level relief is modelled as a fraction of the DT's peak gap recoverable
at each severity (Comfort/Essential/Lifeline) -- 25%/55%/85% respectively --
a simplifying assumption appropriate for a window-level plan; A10's
``cap_reduction_kw`` gives the more precise per-consumer-tier version when a
DT's tier mix is known.
"""

from __future__ import annotations

import time

import numpy as np

from app.grid.constants import LEVER_ORDER
from app.grid.models import PlanInputs, PlanSolution

CAP_RELIEF_FRACTION: dict[int, float] = {0: 0.0, 1: 0.25, 2: 0.55, 3: 0.85}
CAP_SEVERITY_COST: dict[int, float] = {0: 0.0, 1: 1.0, 2: 2.0, 3: 4.0}


def _peak_gap(inputs: PlanInputs, dt_id: str) -> float:
    series = inputs.gap_kw.get(dt_id, [])
    return float(max(series)) if series else 0.0


def solve_plan(inputs: PlanInputs) -> PlanSolution:
    """Solve a Flex Plan for one deficit window. Tries the HiGHS MILP first,
    falls back to a deterministic greedy lever-order heuristic on any failure.
    """
    start = time.monotonic()
    try:
        solution = _solve_milp(inputs)
        solution.solve_seconds = time.monotonic() - start
        return solution
    except Exception:  # noqa: BLE001 -- HiGHS unavailable/infeasible -> fallback
        solution = _solve_greedy(inputs)
        solution.solve_seconds = time.monotonic() - start
        return solution


def _solve_milp(inputs: PlanInputs) -> PlanSolution:
    from scipy.optimize import Bounds, LinearConstraint, milp

    dt_ids = inputs.dt_ids
    n = len(dt_ids)
    if n == 0:
        return PlanSolution(window_id=inputs.window_id, status="optimal", objective_value=0.0)

    # Variable layout per DT i (block of 9): [z0,z1,z2,z3, hub_frac, storage_kw,
    # shift_off, dr_on, unserved_kw] then one trailing block of n for overload_kw.
    block = 9
    n_vars = n * block + n
    c = np.zeros(n_vars)

    gap = {dt_id: _peak_gap(inputs, dt_id) for dt_id in dt_ids}
    storage_budget = {
        dt_id: inputs.storage_energy_kwh.get(dt_id, 0.0) for dt_id in dt_ids
    }  # kWh over the window ~= kW for a 1h-equivalent window, used as a kW cap here

    constraints_rows: list[np.ndarray] = []
    constraints_lb: list[float] = []
    constraints_ub: list[float] = []

    lb = np.zeros(n_vars)
    ub = np.full(n_vars, np.inf)
    integrality = np.zeros(n_vars)

    for i, dt_id in enumerate(dt_ids):
        base = i * block
        z0, z1, z2, z3, hub_frac, storage_kw, shift_off, dr_on, unserved = range(base, base + block)
        overload = n * block + i

        # one-hot cap level
        row = np.zeros(n_vars)
        row[[z0, z1, z2, z3]] = 1.0
        constraints_rows.append(row)
        constraints_lb.append(1.0)
        constraints_ub.append(1.0)

        for idx in (z0, z1, z2, z3, shift_off, dr_on):
            integrality[idx] = 1
            ub[idx] = 1.0
        ub[hub_frac] = 1.0
        ub[storage_kw] = max(storage_budget[dt_id], 0.0)
        ub[unserved] = np.inf
        ub[overload] = np.inf

        hub_potential = inputs.hub_potential_kw.get(dt_id, 0.0)
        shift_potential = inputs.shift_potential_kw.get(dt_id, 0.0)
        dr_potential = inputs.dr_potential_kw.get(dt_id, 0.0)
        dt_limit = inputs.dt_limit_kw.get(dt_id, gap[dt_id] + 1e9)

        # relief_total = hub_potential*(1-hub_frac) + storage_kw + shift_potential*(1-shift_off)
        #              + dr_potential*dr_on + sum(z_level * cap_fraction[level]*gap)
        # Coverage constraint: relief_total + unserved >= gap
        #   => -hub_potential*hub_frac - storage_kw - shift_potential*shift_off(negated)
        #      ... rearranged into a single linear row below.
        cover_row = np.zeros(n_vars)
        cover_row[hub_frac] = -hub_potential  # relief loses hub_potential per unit hub_frac
        cover_row[storage_kw] = 1.0
        cover_row[shift_off] = shift_potential  # shift_off=1 means paused -> relief
        cover_row[dr_on] = dr_potential
        cover_row[unserved] = 1.0
        for level in (0, 1, 2, 3):
            cover_row[base + level] = CAP_RELIEF_FRACTION[level] * gap[dt_id]
        # constant hub_potential term (relief includes +hub_potential when hub_frac=0)
        constraints_rows.append(cover_row)
        constraints_lb.append(gap[dt_id] - hub_potential)
        constraints_ub.append(np.inf)

        # Overload constraint: overload >= (gap - dt_limit) - relief_total
        overload_row = np.array(cover_row)
        overload_row[overload] = 1.0
        overload_row[unserved] = 0.0  # unserved isn't part of relief_total
        constraints_rows.append(overload_row)
        constraints_lb.append((gap[dt_id] - dt_limit) - hub_potential)
        constraints_ub.append(np.inf)

        # Objective weights
        c[z1] += CAP_SEVERITY_COST[1] * inputs.cap_cost_weight
        c[z2] += CAP_SEVERITY_COST[2] * inputs.cap_cost_weight
        c[z3] += CAP_SEVERITY_COST[3] * inputs.cap_cost_weight
        c[hub_frac] += 0.0  # curtailing (low hub_frac) is "free" by lever order preference
        c[storage_kw] += 0.5
        c[shift_off] += 1.5
        c[dr_on] += 0.2
        c[unserved] += inputs.unserved_penalty_weight
        c[overload] += inputs.overload_penalty_weight

    A = np.vstack(constraints_rows)
    constraint = LinearConstraint(A, np.array(constraints_lb), np.array(constraints_ub))
    bounds = Bounds(lb, ub)

    result = milp(c=c, constraints=constraint, integrality=integrality, bounds=bounds)
    if not result.success:
        raise RuntimeError(f"MILP solve failed: {result.message}")

    x = result.x
    cap_level_by_dt: dict[str, int] = {}
    hub_frac_by_dt: dict[str, float] = {}
    storage_kw_by_dt: dict[str, float] = {}
    shift_on_by_dt: dict[str, bool] = {}
    dr_on_by_dt: dict[str, bool] = {}
    unserved_kw_by_dt: dict[str, float] = {}
    overload_kw_by_dt: dict[str, float] = {}

    for i, dt_id in enumerate(dt_ids):
        base = i * block
        z = x[base : base + 4]
        cap_level_by_dt[dt_id] = int(np.argmax(z))
        hub_frac_by_dt[dt_id] = float(x[base + 4])
        storage_kw_by_dt[dt_id] = float(x[base + 5])
        shift_on_by_dt[dt_id] = bool(round(x[base + 6]) == 0)
        dr_on_by_dt[dt_id] = bool(round(x[base + 7]) == 1)
        unserved_kw_by_dt[dt_id] = max(float(x[base + 8]), 0.0)
        overload_kw_by_dt[dt_id] = max(float(x[n * block + i]), 0.0)

    return PlanSolution(
        window_id=inputs.window_id,
        status="optimal",
        objective_value=float(result.fun),
        cap_level_by_dt=cap_level_by_dt,
        hub_frac_by_dt=hub_frac_by_dt,
        storage_kw_by_dt=storage_kw_by_dt,
        shift_on_by_dt=shift_on_by_dt,
        dr_on_by_dt=dr_on_by_dt,
        unserved_kw_by_dt=unserved_kw_by_dt,
        overload_kw_by_dt=overload_kw_by_dt,
    )


def _solve_greedy(inputs: PlanInputs) -> PlanSolution:
    """Deterministic greedy fallback: apply levers in ``LEVER_ORDER`` until the
    gap is covered, escalating cap level only as a last resort before shedding.
    """
    cap_level_by_dt: dict[str, int] = {}
    hub_frac_by_dt: dict[str, float] = {}
    storage_kw_by_dt: dict[str, float] = {}
    shift_on_by_dt: dict[str, bool] = {}
    dr_on_by_dt: dict[str, bool] = {}
    unserved_kw_by_dt: dict[str, float] = {}
    overload_kw_by_dt: dict[str, float] = {}

    for dt_id in inputs.dt_ids:
        remaining = _peak_gap(inputs, dt_id)
        dr_potential = inputs.dr_potential_kw.get(dt_id, 0.0)
        hub_potential = inputs.hub_potential_kw.get(dt_id, 0.0)
        shift_potential = inputs.shift_potential_kw.get(dt_id, 0.0)
        storage_budget = inputs.storage_energy_kwh.get(dt_id, 0.0)

        dr_on = remaining > 0 and dr_potential > 0
        if dr_on:
            remaining -= dr_potential

        hub_frac = 1.0
        if remaining > 0 and hub_potential > 0:
            used = min(hub_potential, max(remaining, 0.0))
            hub_frac = max(0.0, 1.0 - used / hub_potential)
            remaining -= used

        shift_on = True
        if remaining > 0 and shift_potential > 0:
            shift_on = False
            remaining -= shift_potential

        storage_kw = 0.0
        if remaining > 0 and storage_budget > 0:
            storage_kw = min(storage_budget, max(remaining, 0.0))
            remaining -= storage_kw

        cap_level = 0
        if remaining > 0:
            gap = _peak_gap(inputs, dt_id)
            for level in (1, 2, 3):
                relief = CAP_RELIEF_FRACTION[level] * gap
                if relief >= remaining:
                    cap_level = level
                    remaining -= relief
                    break
            else:
                cap_level = 3
                remaining -= CAP_RELIEF_FRACTION[3] * gap

        dt_limit = inputs.dt_limit_kw.get(dt_id, _peak_gap(inputs, dt_id) + 1e9)
        overload = max(0.0, _peak_gap(inputs, dt_id) - dt_limit - (
            _peak_gap(inputs, dt_id) - remaining
        ))

        cap_level_by_dt[dt_id] = cap_level
        hub_frac_by_dt[dt_id] = hub_frac
        storage_kw_by_dt[dt_id] = storage_kw
        shift_on_by_dt[dt_id] = shift_on
        dr_on_by_dt[dt_id] = dr_on
        unserved_kw_by_dt[dt_id] = max(remaining, 0.0)
        overload_kw_by_dt[dt_id] = overload

    return PlanSolution(
        window_id=inputs.window_id,
        status="greedy_fallback",
        objective_value=sum(unserved_kw_by_dt.values()) * inputs.unserved_penalty_weight
        + sum(overload_kw_by_dt.values()) * inputs.overload_penalty_weight,
        cap_level_by_dt=cap_level_by_dt,
        hub_frac_by_dt=hub_frac_by_dt,
        storage_kw_by_dt=storage_kw_by_dt,
        shift_on_by_dt=shift_on_by_dt,
        dr_on_by_dt=dr_on_by_dt,
        unserved_kw_by_dt=unserved_kw_by_dt,
        overload_kw_by_dt=overload_kw_by_dt,
    )


__all__ = ["solve_plan", "LEVER_ORDER"]
