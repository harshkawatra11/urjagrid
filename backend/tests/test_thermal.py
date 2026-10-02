import pytest

from app.grid.thermal import (
    ThermalState,
    ageing_factor,
    dynamic_thermal_rating,
    hot_spot_temp_c,
)


def test_reference_point_rated_load() -> None:
    """k=1, ambient=30C -> hot-spot=110.0C, ageing factor=1.0 (spec A6)."""
    hs = hot_spot_temp_c(1.0, 30.0)
    assert hs == pytest.approx(110.0, abs=0.05)
    assert ageing_factor(hs) == pytest.approx(1.0, abs=1e-6)


def test_reference_point_overload() -> None:
    """k=1.2, ambient=42C -> hot-spot=146.1C, ageing ~29 (spec A6)."""
    hs = hot_spot_temp_c(1.2, 42.0)
    assert hs == pytest.approx(146.1, abs=0.1)
    assert ageing_factor(hs) == pytest.approx(29.0, rel=0.05)


def test_hot_spot_increases_with_load() -> None:
    lo = hot_spot_temp_c(0.5, 30.0)
    hi = hot_spot_temp_c(1.5, 30.0)
    assert hi > lo


def test_hot_spot_increases_with_ambient() -> None:
    lo = hot_spot_temp_c(1.0, 20.0)
    hi = hot_spot_temp_c(1.0, 40.0)
    assert hi > lo


def test_ageing_factor_below_one_when_cool() -> None:
    assert ageing_factor(90.0) < 1.0


def test_dynamic_thermal_rating_respects_limit() -> None:
    k_max = dynamic_thermal_rating(ambient_c=35.0, hotspot_limit_c=120.0)
    hs = hot_spot_temp_c(k_max, 35.0)
    assert hs == pytest.approx(120.0, abs=0.05)


def test_dynamic_thermal_rating_zero_if_already_over_limit() -> None:
    k_max = dynamic_thermal_rating(ambient_c=130.0, hotspot_limit_c=120.0)
    assert k_max == 0.0


def test_thermal_state_evaluate_bundles_fields() -> None:
    state = ThermalState.evaluate(1.0, 30.0)
    assert state.hot_spot_c == pytest.approx(110.0, abs=0.05)
    assert state.ageing_factor == pytest.approx(1.0, abs=1e-6)
    assert state.k == 1.0
    assert state.ambient_c == 30.0
