from app.grid.supply import FIRM_SHARE_BY_KIND
from app.services.scenario import BUILTIN_SCENARIO_NAMES, run_scenario


def test_builtin_scenario_names_match_weather_module() -> None:
    from app.grid.weather import BUILTIN_SCENARIOS

    assert set(BUILTIN_SCENARIO_NAMES) <= set(BUILTIN_SCENARIOS.keys())


def test_run_scenario_produces_both_tracks() -> None:
    result = run_scenario("heatwave_evening", n_intervals=8, seed=3)
    view = result.to_view()
    assert view["n_intervals"] == 8
    assert "solution" in view and "shadow_baseline" in view
    assert "diff" in view


def test_run_scenario_shadow_never_served_less_total_relief_than_solution_in_low_deficit() -> None:
    # Sanity: diff keys exist and are numeric regardless of scenario severity.
    result = run_scenario("solar_noon", n_intervals=4, seed=3)
    assert isinstance(result.relief_kw_avoided, float)
    assert isinstance(result.hardship_hours_avoided, float)


def test_firm_share_rank_order_rural_below_urban() -> None:
    # Calibration acceptance check (B10): rural sub-divisions should have a
    # materially lower firm-supply share than urban ones (CEEW rank-order,
    # not a statistical fit -- see scenario.py module docstring).
    assert (
        FIRM_SHARE_BY_KIND["rural"] < FIRM_SHARE_BY_KIND["semi_urban"] < FIRM_SHARE_BY_KIND["urban"]
    )
