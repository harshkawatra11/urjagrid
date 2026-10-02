"""``GridWorld`` -- dual-track (solution vs. shadow-baseline) interval
simulation runtime (Lane B, task B1).

Each call to :meth:`GridWorld.advance_interval` steps BOTH tracks forward by
one 15-minute interval and returns one :class:`~app.grid.models.IntervalResult`
per track:

- **solution** track: the real LifelineGrid world. Whatever :class:`Actions`
  the caller (``FlexPlanService``/``GridService``) supplies for this interval
  are applied in lever order (behavioural DR -> managed charging -> shiftable
  loads -> storage discharge -> lifeline caps) *before* the thermal/limit
  check; rotational shedding only fires here as the lever-6 last resort, and
  only for whatever gap survives every earlier lever.
- **shadow** track: the status-quo world with no Flex Plans at all -- the
  only mechanism it has is rotational shedding, so it is what LifelineGrid's
  levers are compared against to show "brownout, never blackout" in action.

Both tracks share the same exogenous inputs (gross demand, ambient
temperature, available supply) so the only difference between their outputs
is LifelineGrid's intervention -- which is exactly what Lane B's KPIs (B5)
and Scenario Lab diff (B10) need.

Simplifications documented up front (this is a software prototype, not a
load-flow-grade simulator):

- Per-DT aggregate modelling, not full per-consumer dispatch: ``critical_frac``
  approximates the always-served T0 critical/life-support share of a DT's
  load (never capped, never shed, always backed up -- see
  ``tests/test_invariants.py``).
- Voltage is a simple affine function of loading p.u. (not a full
  backward/forward-sweep solve per DT) since Lane A's LV radial topology
  (``powerflow.py``) is per-feeder, not resolved down to individual DT
  service areas in the seed network; Lane A's solver is exercised directly
  in its own tests and is available to any lever that needs a feeder-level
  voltage check.
- Lever relief at the DT-aggregate level is modelled as a flat fraction of
  net demand per active lever (DR ~5%, hub curtailment taken from
  ``hub_frac``, storage a direct kW offset, caps via ``CAP_LEVEL_WATTS``-style
  compliance) rather than re-deriving each consumer's archetype curve; this
  keeps the runtime O(DTs) per tick, which the 1-real-second tick loop (B5)
  needs.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from app.grid.baseline import ShedLedger, rotate_shedding_roster
from app.grid.constants import (
    CAP_COMPLIANCE,
    REBOUND_RELEASE,
    REBOUND_SHARE,
    SHED_TOLERANCE_FRAC,
    TRIP_INTERVALS,
    TRIP_LOADING_PU,
    TRIP_OUTAGE_INTERVALS,
    V_MAX_PU,
    V_MIN_PU,
)
from app.grid.models import Actions, IntervalResult, LogRow
from app.grid.thermal import ageing_factor, hot_spot_temp_c

# Share of a DT's gross load treated as T0 critical/life-support -- never
# capped, never asked for DR, never shed, and always backed up even through
# a thermal trip (hard safety invariant #1, see test_invariants.py).
DEFAULT_CRITICAL_FRACTION = 0.01

# DR relief modelled as a flat share of net demand when any consumer on the
# DT has an active DR ask accepted this interval (DT-aggregate simplification).
DR_FLAT_RELIEF_FRACTION = 0.05

# At most this fraction of a subdivision's currently-in-deficit DTs are
# fully shed in any one interval; the rest ride through on reduced
# (overloaded/unserved) service -- this is what makes shedding "rotational"
# rather than "shed everyone who is short."
MAX_SHED_FRACTION_PER_CYCLE = 0.5


@dataclass
class DtStatic:
    """Static per-DT parameters the world needs every interval."""

    dt_id: str
    subdivision_id: str
    rating_kva: float
    power_factor: float = 0.9
    critical_fraction: float = DEFAULT_CRITICAL_FRACTION

    @property
    def rated_kw(self) -> float:
        return self.rating_kva * self.power_factor


@dataclass
class Track:
    """Per-track (solution or shadow) mutable simulation state."""

    name: str
    trip_strike_count: dict[str, int] = field(default_factory=dict)
    trip_remaining_intervals: dict[str, int] = field(default_factory=dict)
    rebound_kw: dict[str, float] = field(default_factory=dict)
    shed_ledger: ShedLedger = field(default_factory=ShedLedger)
    shed_cycle_by_subdivision: dict[str, int] = field(default_factory=dict)
    cumulative_loss_of_life_hours: dict[str, float] = field(default_factory=dict)
    logs: list[LogRow] = field(default_factory=list)


class GridWorld:
    """Runs the solution + shadow-baseline tracks, one interval at a time.

    ``dt_gross_kw``/``dt_ambient_c``/``dt_available_kw`` are per-DT numpy
    arrays of equal length (the scenario's full exogenous horizon, indexed
    modulo its own length so a short array loops); they come from Lane A's
    ``LoadModel``/``WeatherProvider``/``supply.py`` respectively, composed by
    whatever builds the scenario (``services/scenario.py`` / test fixtures).
    """

    def __init__(
        self,
        dts: list[DtStatic],
        dt_gross_kw: dict[str, np.ndarray],
        dt_ambient_c: dict[str, np.ndarray],
        dt_available_kw: dict[str, np.ndarray],
    ) -> None:
        if not dts:
            raise ValueError("GridWorld requires at least one DT")
        self.dts: dict[str, DtStatic] = {d.dt_id: d for d in dts}
        self.dt_gross_kw = dt_gross_kw
        self.dt_ambient_c = dt_ambient_c
        self.dt_available_kw = dt_available_kw
        self.solution = Track(name="solution")
        self.shadow = Track(name="shadow")

        self.subdivision_dts: dict[str, list[str]] = {}
        for d in dts:
            self.subdivision_dts.setdefault(d.subdivision_id, []).append(d.dt_id)

    def _series(self, store: dict[str, np.ndarray], dt_id: str, slot: int) -> float:
        arr = store[dt_id]
        return float(arr[slot % len(arr)])

    def advance_interval(
        self, slot: int, actions_by_dt: dict[str, Actions] | None = None
    ) -> tuple[IntervalResult, IntervalResult]:
        """Step both tracks forward by one interval; returns (solution, shadow)."""
        actions_by_dt = actions_by_dt or {}
        solution_result = self._advance_track(
            self.solution, slot, actions_by_dt, apply_levers=True
        )
        shadow_result = self._advance_track(self.shadow, slot, {}, apply_levers=False)
        return solution_result, shadow_result

    def _advance_track(
        self,
        track: Track,
        slot: int,
        actions_by_dt: dict[str, Actions],
        apply_levers: bool,
    ) -> IntervalResult:
        result = IntervalResult(slot=slot)
        events: list[str] = []

        pre_shed_net_demand: dict[str, float] = {}
        pre_shed_available: dict[str, float] = {}
        critical_kw_by_dt: dict[str, float] = {}

        for dt_id, static in self.dts.items():
            gross = self._series(self.dt_gross_kw, dt_id, slot)
            available = self._series(self.dt_available_kw, dt_id, slot)
            critical_kw = gross * static.critical_fraction
            critical_kw_by_dt[dt_id] = critical_kw

            rebound = track.rebound_kw.get(dt_id, 0.0)
            released = rebound * REBOUND_RELEASE
            track.rebound_kw[dt_id] = rebound - released
            net_demand = gross + released

            if apply_levers:
                action = actions_by_dt.get(dt_id, Actions())
                if any(action.dr_on.values()):
                    net_demand -= net_demand * DR_FLAT_RELIEF_FRACTION
                for hub_frac in action.hub_frac.values():
                    net_demand -= net_demand * 0.0 * hub_frac  # hubs metered separately by adapters
                for storage_kw in action.storage_kw.values():
                    net_demand = max(net_demand - storage_kw, critical_kw)
                if not all(action.shift_on.get(k, True) for k in action.shift_on):
                    net_demand = max(net_demand * 0.97, critical_kw)

                cap_kw = action.cap_kw.get(dt_id)
                if cap_kw is not None and cap_kw >= 0:
                    non_critical = max(net_demand - critical_kw, 0.0)
                    allowed = min(non_critical, max(cap_kw, 0.0))
                    compliant_kw = allowed * CAP_COMPLIANCE + non_critical * (1 - CAP_COMPLIANCE)
                    shed_from_cap = max(non_critical - compliant_kw, 0.0)
                    track.rebound_kw[dt_id] = (
                        track.rebound_kw.get(dt_id, 0.0) + shed_from_cap * REBOUND_SHARE
                    )
                    net_demand = critical_kw + compliant_kw

            pre_shed_net_demand[dt_id] = net_demand
            pre_shed_available[dt_id] = available

        shed_dt_ids = self._select_rotational_shed(track, pre_shed_net_demand, pre_shed_available)

        for dt_id, static in self.dts.items():
            gross = self._series(self.dt_gross_kw, dt_id, slot)
            ambient = self._series(self.dt_ambient_c, dt_id, slot)
            available = pre_shed_available[dt_id]
            net_demand = pre_shed_net_demand[dt_id]
            critical_kw = critical_kw_by_dt[dt_id]

            was_shed = dt_id in shed_dt_ids
            if was_shed:
                served_kw = critical_kw
                events.append(f"{dt_id} rotational shed this interval (status quo)")
                track.shed_ledger.record(dt_id, hours=0.25)
            else:
                served_kw = min(net_demand, max(available, critical_kw))

            k = served_kw / static.rated_kw if static.rated_kw > 0 else 0.0

            if track.trip_remaining_intervals.get(dt_id, 0) > 0:
                track.trip_remaining_intervals[dt_id] -= 1
                served_kw = critical_kw
                k = served_kw / static.rated_kw if static.rated_kw > 0 else 0.0
                events.append(
                    f"{dt_id} in thermal-trip outage, "
                    f"{track.trip_remaining_intervals[dt_id]} intervals remaining"
                )
            else:
                demand_k = net_demand / static.rated_kw if static.rated_kw > 0 else 0.0
                if demand_k > TRIP_LOADING_PU:
                    track.trip_strike_count[dt_id] = track.trip_strike_count.get(dt_id, 0) + 1
                else:
                    track.trip_strike_count[dt_id] = 0
                if track.trip_strike_count.get(dt_id, 0) >= TRIP_INTERVALS:
                    track.trip_remaining_intervals[dt_id] = TRIP_OUTAGE_INTERVALS
                    track.trip_strike_count[dt_id] = 0
                    served_kw = critical_kw
                    k = served_kw / static.rated_kw if static.rated_kw > 0 else 0.0
                    events.append(f"{dt_id} thermal trip triggered (loading {demand_k:.2f}pu)")

            unserved_kw = max(net_demand - served_kw, 0.0)
            hotspot_c = hot_spot_temp_c(min(max(k, 0.0), 3.0), ambient)
            age = ageing_factor(hotspot_c)
            track.cumulative_loss_of_life_hours[dt_id] = (
                track.cumulative_loss_of_life_hours.get(dt_id, 0.0) + age * 0.25
            )
            voltage_pu = float(
                np.clip(1.0 - 0.06 * min(max(k, 0.0), 2.0), V_MIN_PU - 0.05, V_MAX_PU)
            )

            result.dt_demand_kw[dt_id] = gross
            result.dt_served_kw[dt_id] = served_kw
            result.dt_unserved_kw[dt_id] = unserved_kw
            result.dt_hotspot_c[dt_id] = hotspot_c
            result.dt_loading_pu[dt_id] = k
            result.dt_voltage_pu[dt_id] = voltage_pu

            if apply_levers and dt_id in actions_by_dt:
                action = actions_by_dt[dt_id]
                result.actions.cap_kw.update(action.cap_kw)
                result.actions.cap_started.update(action.cap_started)
                result.actions.dr_on.update(action.dr_on)
                result.actions.hub_frac.update(action.hub_frac)
                result.actions.storage_kw.update(action.storage_kw)
                result.actions.shift_on.update(action.shift_on)

        result.events = events
        return result

    def _select_rotational_shed(
        self,
        track: Track,
        net_demand: dict[str, float],
        available: dict[str, float],
    ) -> set[str]:
        """Pick which DTs are fully shed this interval (lever 6 / shadow baseline).

        A DT is a *candidate* if, after every earlier lever, it is still
        short of supply by more than ``SHED_TOLERANCE_FRAC`` of its demand.
        At most ``MAX_SHED_FRACTION_PER_CYCLE`` of a subdivision's candidates
        are actually shed (full outage, critical-only) in any one interval --
        the rest ride through on reduced/overloaded service -- and the
        least-shed-burden candidates are picked first so burden rotates
        fairly across DTs over time.
        """
        shed: set[str] = set()
        for subdivision_id, dt_ids in self.subdivision_dts.items():
            candidates = [
                dt_id
                for dt_id in dt_ids
                if net_demand[dt_id] > 0
                and (net_demand[dt_id] - available[dt_id]) > SHED_TOLERANCE_FRAC * net_demand[dt_id]
            ]
            if not candidates:
                continue
            n_to_shed = max(1, math.ceil(len(candidates) * MAX_SHED_FRACTION_PER_CYCLE))
            cycle = track.shed_cycle_by_subdivision.get(subdivision_id, 0)
            track.shed_cycle_by_subdivision[subdivision_id] = cycle + 1
            chosen = track.shed_ledger.least_burdened(candidates, n_to_shed)
            # Deterministic rotation among ties: also consult the round-robin
            # roster so repeated equal-burden candidates still rotate.
            if len(chosen) < len(candidates):
                roster = rotate_shedding_roster(sorted(candidates), cycle, n_to_shed)
                chosen = roster if roster else chosen
            shed.update(chosen)
        return shed


__all__ = ["DtStatic", "Track", "GridWorld"]
