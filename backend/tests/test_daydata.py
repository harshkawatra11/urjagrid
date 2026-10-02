import numpy as np

from app.grid.daydata import FEATURE_NAMES, DayBuilder


def _day_arrays(seed: int = 0) -> dict:
    rng = np.random.default_rng(seed)
    n = 96
    return dict(
        demand_kw=np.clip(rng.normal(50, 10, n), 1, None),
        temp_c=np.clip(rng.normal(32, 5, n), 15, 48),
        humidity_pct=np.clip(rng.normal(50, 15, n), 10, 100),
        solar_cf=np.clip(rng.normal(0.4, 0.2, n), 0, 1),
        wind_cf=np.clip(rng.normal(0.3, 0.1, n), 0, 1),
    )


def test_feature_names_has_13_entries() -> None:
    assert len(FEATURE_NAMES) == 13
    assert len(set(FEATURE_NAMES)) == 13


def test_day_builder_output_shape() -> None:
    builder = DayBuilder()
    arrays = _day_arrays()
    result = builder.build(
        **arrays, dt_rating_kva=160.0, day_of_week=2, month_of_year=6
    )
    assert result.features.shape == (96, 13)
    assert result.target_pu.shape == (96,)


def test_day_builder_target_is_per_unit_of_rating() -> None:
    builder = DayBuilder()
    arrays = _day_arrays()
    result = builder.build(
        **arrays, dt_rating_kva=100.0, day_of_week=0, month_of_year=1, power_factor=0.9
    )
    expected = arrays["demand_kw"] / (100.0 * 0.9)
    assert np.allclose(result.target_pu, expected)


def test_day_builder_is_weekend_flag() -> None:
    builder = DayBuilder()
    arrays = _day_arrays()
    weekday = builder.build(**arrays, dt_rating_kva=100.0, day_of_week=2, month_of_year=1)
    weekend = builder.build(**arrays, dt_rating_kva=100.0, day_of_week=6, month_of_year=1)
    idx = FEATURE_NAMES.index("is_weekend")
    assert np.all(weekday.features[:, idx] == 0.0)
    assert np.all(weekend.features[:, idx] == 1.0)


def test_day_builder_evening_peak_flag_window() -> None:
    builder = DayBuilder()
    arrays = _day_arrays()
    result = builder.build(**arrays, dt_rating_kva=100.0, day_of_week=0, month_of_year=1)
    idx = FEATURE_NAMES.index("is_evening_peak")
    hour_idx = FEATURE_NAMES.index("hour_of_day")
    hours = result.features[:, hour_idx]
    evening_mask = (hours >= 18.0) & (hours < 22.0)
    assert np.all(result.features[evening_mask, idx] == 1.0)
    assert np.all(result.features[~evening_mask, idx] == 0.0)


def test_day_builder_rejects_wrong_length() -> None:
    import pytest

    builder = DayBuilder()
    with pytest.raises(ValueError, match="96 slots"):
        builder.build(
            demand_kw=np.zeros(10),
            temp_c=np.zeros(96),
            humidity_pct=np.zeros(96),
            solar_cf=np.zeros(96),
            wind_cf=np.zeros(96),
            dt_rating_kva=100.0,
            day_of_week=0,
            month_of_year=1,
        )
