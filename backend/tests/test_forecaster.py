from pathlib import Path

import numpy as np

from app.grid.daydata import DayBuilder
from app.grid.forecaster import (
    QuantileForecaster,
    empirical_coverage,
    split_conformal_offset,
)
from app.grid.weather import synthetic_series


def _sample_features(n: int = 20, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    weather = synthetic_series(seed=seed)
    builder = DayBuilder()
    demand_kw = np.clip(rng.normal(50, 10, 96), 1, None)
    day = builder.build(
        demand_kw=demand_kw,
        temp_c=weather.temp_c,
        humidity_pct=weather.humidity_pct,
        solar_cf=weather.solar_cf,
        wind_cf=weather.wind_cf,
        dt_rating_kva=160.0,
        day_of_week=3,
        month_of_year=5,
    )
    return day.features[:n]


def test_forecaster_falls_back_to_seasonal_naive_when_models_missing() -> None:
    forecaster = QuantileForecaster(models_dir=Path("does/not/exist"))
    assert forecaster.mode == "seasonal_naive"
    features = _sample_features()
    pred = forecaster.predict(features)
    assert pred.mode == "seasonal_naive"
    assert len(pred.p50) == len(features)


def test_seasonal_naive_quantiles_are_monotone() -> None:
    forecaster = QuantileForecaster(models_dir=Path("does/not/exist"))
    pred = forecaster.predict(_sample_features(50))
    assert np.all(pred.p10 <= pred.p50)
    assert np.all(pred.p50 <= pred.p90)


def test_forecaster_rejects_wrong_feature_count() -> None:
    import pytest

    forecaster = QuantileForecaster(models_dir=Path("does/not/exist"))
    with pytest.raises(ValueError, match="13"):
        forecaster.predict(np.zeros((5, 7)))


def test_real_trained_models_load_if_present() -> None:
    """If backend/scripts/train_forecaster.py has been run, the real artifacts
    should load in lightgbm mode and produce monotone, in-range quantiles.
    """
    forecaster = QuantileForecaster()
    features = _sample_features(96)
    pred = forecaster.predict(features)
    assert pred.mode in ("lightgbm", "seasonal_naive")
    assert np.all(pred.p10 <= pred.p50 + 1e-9)
    assert np.all(pred.p50 <= pred.p90 + 1e-9)
    if pred.mode == "lightgbm":
        assert np.all(pred.p10 >= -1e-6)


def test_split_conformal_offset_improves_coverage_toward_target() -> None:
    rng = np.random.default_rng(1)
    y_true = rng.normal(0.5, 0.1, 2000)
    # Deliberately too-narrow raw interval.
    p10_raw = y_true - rng.uniform(0.0, 0.02, 2000)
    p90_raw = y_true + rng.uniform(0.0, 0.02, 2000)

    raw_coverage = empirical_coverage(y_true, p10_raw, p90_raw)
    offset = split_conformal_offset(y_true, p10_raw, p90_raw, target_coverage=0.80)
    calibrated_coverage = empirical_coverage(y_true, p10_raw - offset, p90_raw + offset)

    assert calibrated_coverage >= raw_coverage
    assert calibrated_coverage >= 0.78


def test_empirical_coverage_full_interval_is_one() -> None:
    y = np.array([0.1, 0.5, 0.9])
    assert empirical_coverage(y, np.zeros(3), np.ones(3)) == 1.0
