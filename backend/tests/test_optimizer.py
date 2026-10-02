from app.grid.models import PlanInputs
from app.grid.optimizer import _solve_greedy, _solve_milp, solve_plan


def _simple_inputs(**overrides) -> PlanInputs:
    defaults = dict(
        window_id="dw_test0001",
        subdivision_id="sd_subhashnagar",
        slots=[0, 1, 2, 3],
        dt_ids=["dt_sn_01"],
        gap_kw={"dt_sn_01": [10.0, 12.0, 8.0, 5.0]},
        dt_limit_kw={"dt_sn_01": 200.0},
        dr_potential_kw={"dt_sn_01": 15.0},
        hub_potential_kw={"dt_sn_01": 0.0},
        storage_energy_kwh={"dt_sn_01": 0.0},
        shift_potential_kw={"dt_sn_01": 0.0},
    )
    defaults.update(overrides)
    return PlanInputs(**defaults)


def test_milp_covers_gap_with_dr_alone_when_sufficient() -> None:
    inputs = _simple_inputs()  # peak gap 12, dr_potential 15 -> fully covered by DR
    solution = _solve_milp(inputs)
    assert solution.status == "optimal"
    assert solution.dr_on_by_dt["dt_sn_01"] is True
    assert solution.cap_level_by_dt["dt_sn_01"] == 0
    assert solution.unserved_kw_by_dt["dt_sn_01"] == 0.0


def test_milp_escalates_to_cap_when_levers_insufficient() -> None:
    inputs = _simple_inputs(
        gap_kw={"dt_sn_01": [100.0, 100.0, 100.0, 100.0]},
        dr_potential_kw={"dt_sn_01": 5.0},
    )
    solution = _solve_milp(inputs)
    assert solution.status == "optimal"
    assert solution.cap_level_by_dt["dt_sn_01"] > 0


def test_milp_empty_dt_list_returns_trivial_solution() -> None:
    inputs = PlanInputs(window_id="dw_empty001", subdivision_id="sd_faridpur", dt_ids=[])
    solution = solve_plan(inputs)
    assert solution.objective_value == 0.0
    assert solution.cap_level_by_dt == {}


def test_solve_plan_falls_back_to_greedy_on_forced_failure(monkeypatch) -> None:
    import app.grid.optimizer as optimizer_module

    def _boom(_inputs):
        raise RuntimeError("forced failure for fallback test")

    monkeypatch.setattr(optimizer_module, "_solve_milp", _boom)
    inputs = _simple_inputs()
    solution = optimizer_module.solve_plan(inputs)
    assert solution.status == "greedy_fallback"


def test_greedy_matches_milp_qualitatively_on_simple_case() -> None:
    inputs = _simple_inputs()
    greedy = _solve_greedy(inputs)
    milp_solution = _solve_milp(inputs)
    # Both should fully cover this easy case with DR alone, no cap needed.
    assert greedy.unserved_kw_by_dt["dt_sn_01"] == 0.0
    assert milp_solution.unserved_kw_by_dt["dt_sn_01"] == 0.0
    assert greedy.cap_level_by_dt["dt_sn_01"] == 0
    assert milp_solution.cap_level_by_dt["dt_sn_01"] == 0


def test_greedy_lever_order_is_dr_then_hub_then_shift_then_storage_then_cap() -> None:
    inputs = _simple_inputs(
        gap_kw={"dt_sn_01": [50.0, 50.0, 50.0, 50.0]},
        dr_potential_kw={"dt_sn_01": 10.0},
        hub_potential_kw={"dt_sn_01": 10.0},
        shift_potential_kw={"dt_sn_01": 10.0},
        storage_energy_kwh={"dt_sn_01": 10.0},
    )
    solution = _solve_greedy(inputs)
    assert solution.dr_on_by_dt["dt_sn_01"] is True
    assert solution.hub_frac_by_dt["dt_sn_01"] < 1.0
    assert solution.shift_on_by_dt["dt_sn_01"] is False
    assert solution.storage_kw_by_dt["dt_sn_01"] == 10.0
    # 10+10+10+10=40 relief vs 50 gap -> 10 remaining needs a cap level
    assert solution.cap_level_by_dt["dt_sn_01"] > 0


def test_solve_plan_multi_dt_covers_each_independently() -> None:
    inputs = PlanInputs(
        window_id="dw_multi0001",
        subdivision_id="sd_izzatnagar",
        dt_ids=["dt_iz_01", "dt_iz_02"],
        gap_kw={"dt_iz_01": [5.0], "dt_iz_02": [40.0]},
        dt_limit_kw={"dt_iz_01": 100.0, "dt_iz_02": 100.0},
        dr_potential_kw={"dt_iz_01": 6.0, "dt_iz_02": 2.0},
        hub_potential_kw={"dt_iz_01": 0.0, "dt_iz_02": 0.0},
        storage_energy_kwh={"dt_iz_01": 0.0, "dt_iz_02": 0.0},
        shift_potential_kw={"dt_iz_01": 0.0, "dt_iz_02": 0.0},
    )
    solution = solve_plan(inputs)
    assert solution.cap_level_by_dt["dt_iz_01"] == 0
    assert solution.cap_level_by_dt["dt_iz_02"] > 0
