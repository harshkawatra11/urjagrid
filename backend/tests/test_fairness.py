import numpy as np
import pytest

from app.grid.fairness import (
    gini_coefficient,
    jain_index,
    lorenz_curve,
    served_fraction_by_tier,
)


def test_jain_index_perfect_equality_is_one() -> None:
    assert jain_index(np.array([5.0, 5.0, 5.0, 5.0])) == 1.0


def test_jain_index_inequality_less_than_one() -> None:
    assert jain_index(np.array([10.0, 0.0, 0.0, 0.0])) < 1.0


def test_jain_index_empty_defaults_to_one() -> None:
    assert jain_index(np.array([])) == 1.0


def test_gini_coefficient_perfect_equality_is_zero() -> None:
    assert gini_coefficient(np.array([3.0, 3.0, 3.0])) == 0.0


def test_gini_coefficient_inequality_is_positive() -> None:
    assert gini_coefficient(np.array([10.0, 0.0, 0.0, 0.0])) > 0.0


def test_gini_coefficient_all_zero_values() -> None:
    assert gini_coefficient(np.array([0.0, 0.0])) == 0.0


def test_lorenz_curve_endpoints() -> None:
    pop_frac, cum_frac = lorenz_curve(np.array([1.0, 2.0, 3.0, 4.0]))
    assert pop_frac[0] == 0.0 and pop_frac[-1] == 1.0
    assert cum_frac[0] == 0.0
    assert cum_frac[-1] == pytest.approx(1.0)


def test_lorenz_curve_is_sorted_cumulative() -> None:
    pop_frac, cum_frac = lorenz_curve(np.array([4.0, 1.0, 3.0]))
    assert np.all(np.diff(cum_frac) >= -1e-9)


def test_served_fraction_by_tier() -> None:
    served = {"c1": 1.0, "c2": 0.5, "c3": 2.0}
    demand = {"c1": 2.0, "c2": 1.0, "c3": 2.0}
    tier_of = {"c1": "t1", "c2": "t1", "c3": "t2"}
    result = served_fraction_by_tier(served, demand, tier_of)
    assert result["t1"] == (1.0 + 0.5) / (2.0 + 1.0)
    assert result["t2"] == 1.0


def test_served_fraction_by_tier_zero_demand_defaults_full() -> None:
    result = served_fraction_by_tier({"c1": 0.0}, {"c1": 0.0}, {"c1": "t1"})
    assert result["t1"] == 1.0
