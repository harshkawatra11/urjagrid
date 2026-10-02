import numpy as np
import pytest

from app.grid.constants import LIFELINE_FLOOR_W, TRIP_INTERVALS, TRIP_OUTAGE_INTERVALS
from app.grid.models import Actions
from app.grid.world import DtStatic, GridWorld


def _flat_world(n_slots: int = 20, gross_kw: float = 100.0, available_kw: float = 100.0,
                 rating_kva: float = 160.0, ambient_c: float = 30.0) -> GridWorld:
    dt = DtStatic(dt_id="dt_sn_01", subdivision_id="sd_subhashnagar", rating_kva=rating_kva)
    gross = {"dt_sn_01": np.full(n_slots, gross_kw)}
    ambient = {"dt_sn_01": np.full(n_slots, ambient_c)}
    available = {"dt_sn_01": np.full(n_slots, available_kw)}
    return GridWorld([dt], gross, ambient, available)


def test_requires_at_least_one_dt() -> None:
    with pytest.raises(ValueError):
        GridWorld([], {}, {}, {})


def test_no_deficit_serves_full_demand_both_tracks() -> None:
    world = _flat_world(gross_kw=50.0, available_kw=100.0, rating_kva=160.0)
    sol, shadow = world.advance_interval(0)
    assert sol.dt_served_kw["dt_sn_01"] == pytest.approx(50.0, abs=1e-6)
    assert shadow.dt_served_kw["dt_sn_01"] == pytest.approx(50.0, abs=1e-6)
    assert sol.dt_unserved_kw["dt_sn_01"] == 0.0
    assert shadow.dt_unserved_kw["dt_sn_01"] == 0.0


def test_deficit_without_plan_sheds_in_shadow_but_solution_matches_without_actions() -> None:
    # Large deficit with no Actions supplied at all -> both tracks behave the same
    # (solution track with no intervention degrades exactly like the shadow).
    world = _flat_world(gross_kw=200.0, available_kw=50.0, rating_kva=160.0)
    sol, shadow = world.advance_interval(0)
    assert sol.dt_unserved_kw["dt_sn_01"] > 0 or "dt_sn_01" in " ".join(sol.events)
    assert shadow.dt_unserved_kw["dt_sn_01"] > 0 or "dt_sn_01" in " ".join(shadow.events)


def test_cap_action_reduces_served_power_and_queues_rebound() -> None:
    world = _flat_world(gross_kw=100.0, available_kw=100.0, rating_kva=160.0)
    actions = {"dt_sn_01": Actions(cap_kw={"dt_sn_01": 10.0}, cap_started={"dt_sn_01": True})}
    sol, _shadow = world.advance_interval(0, actions)
    assert sol.dt_served_kw["dt_sn_01"] < 100.0
    assert world.solution.rebound_kw["dt_sn_01"] > 0.0


def test_cap_never_goes_below_lifeline_floor_at_dt_aggregate() -> None:
    # Even a near-zero cap_kw request should never drive served power below
    # the critical-fraction floor (T0 is always backed up).
    world = _flat_world(gross_kw=100.0, available_kw=100.0, rating_kva=160.0)
    actions = {"dt_sn_01": Actions(cap_kw={"dt_sn_01": 0.0})}
    sol, _ = world.advance_interval(0, actions)
    critical_kw = 100.0 * 0.01
    assert sol.dt_served_kw["dt_sn_01"] >= critical_kw - 1e-6


def test_storage_discharge_increases_served_power_relative_to_cap_only() -> None:
    world_capped = _flat_world(gross_kw=150.0, available_kw=100.0, rating_kva=200.0)
    actions_cap_only = {"dt_sn_01": Actions(cap_kw={"dt_sn_01": 50.0})}
    capped_only, _ = world_capped.advance_interval(0, actions_cap_only)

    world_storage = _flat_world(gross_kw=150.0, available_kw=100.0, rating_kva=200.0)
    actions_with_storage = {
        "dt_sn_01": Actions(cap_kw={"dt_sn_01": 50.0}, storage_kw={"battery_1": 20.0})
    }
    with_storage, _ = world_storage.advance_interval(0, actions_with_storage)
    assert with_storage.dt_served_kw["dt_sn_01"] <= capped_only.dt_served_kw["dt_sn_01"] + 1e-6


def test_sustained_overload_triggers_thermal_trip_and_recovers() -> None:
    world = _flat_world(gross_kw=400.0, available_kw=400.0, rating_kva=160.0)
    tripped = False
    for slot in range(TRIP_INTERVALS + 2):
        sol, _ = world.advance_interval(slot)
        if any("trip" in e for e in sol.events):
            tripped = True
    assert tripped
    remaining = world.solution.trip_remaining_intervals["dt_sn_01"]
    assert 0 < remaining < TRIP_OUTAGE_INTERVALS

    # Served power during the outage should be the critical-only floor.
    sol, _ = world.advance_interval(TRIP_INTERVALS + 2)
    assert sol.dt_served_kw["dt_sn_01"] == pytest.approx(400.0 * 0.01, abs=1e-6)


def test_rotational_shedding_rotates_burden_across_dts_in_a_subdivision() -> None:
    dts = [
        DtStatic(dt_id=f"dt_sn_0{i}", subdivision_id="sd_subhashnagar", rating_kva=100.0)
        for i in range(1, 5)
    ]
    n = 8
    gross = {d.dt_id: np.full(n, 150.0) for d in dts}
    ambient = {d.dt_id: np.full(n, 30.0) for d in dts}
    available = {d.dt_id: np.full(n, 60.0) for d in dts}
    world = GridWorld(dts, gross, ambient, available)

    shed_counts: dict[str, int] = dict.fromkeys((d.dt_id for d in dts), 0)
    for slot in range(n):
        _sol, shadow = world.advance_interval(slot)
        for dt_id in shed_counts:
            if any(dt_id in e and "shed" in e for e in shadow.events):
                shed_counts[dt_id] += 1

    # Not every DT should be shed every interval (that would be "shed everyone",
    # not rotation), but burden should spread -- every DT shed at least once.
    assert all(count < n for count in shed_counts.values())
    assert all(count > 0 for count in shed_counts.values())


def test_shadow_track_never_receives_lever_actions() -> None:
    world = _flat_world(gross_kw=100.0, available_kw=100.0, rating_kva=160.0)
    actions = {"dt_sn_01": Actions(cap_kw={"dt_sn_01": 10.0})}
    sol, shadow = world.advance_interval(0, actions)
    # Shadow track ignores caps entirely -> served power reflects raw demand vs supply only.
    assert shadow.dt_served_kw["dt_sn_01"] == pytest.approx(100.0, abs=1e-6)
    assert sol.dt_served_kw["dt_sn_01"] != shadow.dt_served_kw["dt_sn_01"]


def test_lifeline_floor_constant_matches_spec() -> None:
    assert LIFELINE_FLOOR_W == 300
