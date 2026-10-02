from pathlib import Path

import pytest

from app.services.deps import get_grid_service, reset_grid_service
from app.services.service import GridService, build_scenario
from app.services.store import StateStore


def test_build_scenario_produces_per_dt_arrays() -> None:
    scenario = build_scenario(seed=1)
    assert len(scenario.network.dt_ids) > 0
    for dt_id in scenario.network.dt_ids:
        assert dt_id in scenario.dt_gross_kw
        assert dt_id in scenario.dt_ambient_c
        assert dt_id in scenario.dt_available_kw


def test_grid_service_boots_at_slot_zero() -> None:
    service = GridService(seed=1)
    service.boot()
    assert service.state.slot == 0
    assert service.solution_logs == []


def test_advance_one_interval_appends_logs() -> None:
    service = GridService(seed=1)
    service.boot()
    sol_row, shadow_row = service.advance_one_interval()
    assert sol_row.slot == 0
    assert shadow_row.slot == 0
    assert service.state.slot == 1
    assert len(service.solution_logs) == 1


def test_tick_fires_interval_only_after_enough_sim_time_accumulates() -> None:
    service = GridService(seed=1, time_scale=60)
    service.boot()
    # 900 sim-seconds per interval / 60 scale = 15 real seconds needed.
    fired_early = service.tick(real_dt_seconds=1.0)
    assert fired_early == []
    fired_later = service.tick(real_dt_seconds=14.0)
    assert len(fired_later) == 1


def test_jump_advances_n_intervals_directly() -> None:
    service = GridService(seed=1)
    service.boot()
    service.jump(5)
    assert service.state.slot == 5
    assert len(service.solution_logs) == 5


def test_kpis_before_any_tick_are_well_defined() -> None:
    service = GridService(seed=1)
    service.boot()
    kpis = service.kpis()
    assert kpis["n_intervals_simulated"] == 0
    assert kpis["solution_lifeline_availability"] == 1.0


def test_kpis_after_ticks_report_hardship_metrics() -> None:
    service = GridService(seed=1)
    service.boot()
    service.jump(4)
    kpis = service.kpis()
    assert kpis["n_intervals_simulated"] == 4
    assert "solution_hours_of_hardship" in kpis
    assert "shadow_hours_of_hardship" in kpis


def test_reset_rebuilds_from_scratch() -> None:
    service = GridService(seed=1)
    service.boot()
    service.jump(3)
    assert service.state.slot == 3
    service.reset()
    assert service.state.slot == 0
    assert service.solution_logs == []


def test_set_autopilot_toggles_flag() -> None:
    service = GridService(seed=1)
    service.boot()
    assert service.state.autopilot_enabled is False
    service.set_autopilot(True)
    assert service.state.autopilot_enabled is True


def test_risk_summary_empty_before_any_tick() -> None:
    service = GridService(seed=1)
    service.boot()
    assert service.risk_summary() == []


def test_risk_summary_after_tick_ranks_dts() -> None:
    service = GridService(seed=1)
    service.boot()
    service.jump(1)
    summary = service.risk_summary()
    assert len(summary) == len(service.dt_statics)
    assert all("level" in r for r in summary)


# -- deps ---------------------------------------------------------------------


def test_get_grid_service_returns_singleton() -> None:
    reset_grid_service()
    a = get_grid_service()
    b = get_grid_service()
    assert a is b


def test_reset_grid_service_creates_new_instance() -> None:
    a = get_grid_service()
    b = reset_grid_service()
    assert a is not b


# -- store --------------------------------------------------------------------


def test_state_store_does_not_write_when_not_dirty(tmp_path: Path) -> None:
    store = StateStore(path=tmp_path / "state.json")
    wrote = store.save({"x": 1})
    assert wrote is False
    assert not store.path.exists()


def test_state_store_writes_when_dirty(tmp_path: Path) -> None:
    store = StateStore(path=tmp_path / "state.json")
    store.mark_dirty()
    wrote = store.save({"x": 1})
    assert wrote is True
    assert store.path.exists()


def test_state_store_debounces_rapid_writes(tmp_path: Path) -> None:
    store = StateStore(path=tmp_path / "state.json", min_interval_seconds=100.0)
    store.mark_dirty()
    assert store.save({"x": 1}) is True
    store.mark_dirty()
    assert store.save({"x": 2}) is False  # too soon


def test_state_store_force_bypasses_debounce(tmp_path: Path) -> None:
    store = StateStore(path=tmp_path / "state.json", min_interval_seconds=100.0)
    assert store.save({"x": 1}, force=True) is True


def test_state_store_load_round_trip(tmp_path: Path) -> None:
    store = StateStore(path=tmp_path / "state.json")
    store.mark_dirty()
    store.save({"slot": 42})
    loaded = store.load()
    assert loaded == {"slot": 42}


def test_state_store_load_missing_returns_none(tmp_path: Path) -> None:
    store = StateStore(path=tmp_path / "does_not_exist.json")
    assert store.load() is None
