import numpy as np

from app.grid.constants import SLOTS_PER_DAY
from app.grid.weather import (
    BUILTIN_SCENARIOS,
    Scenario,
    WeatherProvider,
    WeatherSeries,
    synthetic_series,
)


def test_synthetic_series_has_correct_shape_and_bounds() -> None:
    series = synthetic_series(seed=1)
    assert len(series.temp_c) == SLOTS_PER_DAY
    assert np.all(series.solar_cf >= 0.0) and np.all(series.solar_cf <= 1.0)
    assert np.all(series.wind_cf >= 0.0) and np.all(series.wind_cf <= 1.0)
    assert np.all(series.humidity_pct >= 10.0) and np.all(series.humidity_pct <= 100.0)


def test_synthetic_series_deterministic() -> None:
    a = synthetic_series(seed=5)
    b = synthetic_series(seed=5)
    assert np.allclose(a.temp_c, b.temp_c)
    assert np.allclose(a.solar_cf, b.solar_cf)


def test_synthetic_series_solar_zero_at_night_peaks_midday() -> None:
    series = synthetic_series(seed=2)
    assert series.solar_cf[0] == 0.0  # midnight
    noon_slot = 48
    night_slot = 4
    assert series.solar_cf[noon_slot] > series.solar_cf[night_slot]


def test_weather_series_rejects_wrong_length() -> None:
    import pytest

    with pytest.raises(ValueError, match="96 slots"):
        WeatherSeries(
            temp_c=np.zeros(10), solar_cf=np.zeros(10), wind_cf=np.zeros(10), humidity_pct=np.zeros(10)
        )


def test_builtin_scenarios_present_and_shaped() -> None:
    for name in ("heatwave_evening", "monsoon_cloud", "solar_noon", "re_2047"):
        assert name in BUILTIN_SCENARIOS
        scenario = BUILTIN_SCENARIOS[name]
        assert len(scenario.temp_c) == SLOTS_PER_DAY
        assert scenario.source in ("open_meteo_archive", "synthetic")


def test_re_2047_is_always_synthetic() -> None:
    assert BUILTIN_SCENARIOS["re_2047"].source == "synthetic"


def test_heatwave_scenario_is_hot() -> None:
    scenario = BUILTIN_SCENARIOS["heatwave_evening"]
    assert max(scenario.temp_c) >= 35.0


def test_scenario_round_trip_to_series() -> None:
    scenario = BUILTIN_SCENARIOS["solar_noon"]
    series = scenario.to_series()
    rebuilt = Scenario.from_series("solar_noon", scenario.label, scenario.town, scenario.source, series)
    assert np.allclose(rebuilt.temp_c, scenario.temp_c)


def test_weather_provider_actual_matches_scenario() -> None:
    scenario = BUILTIN_SCENARIOS["monsoon_cloud"]
    provider = WeatherProvider(scenario)
    actual = provider.actual()
    assert np.allclose(actual.temp_c, np.array(scenario.temp_c))


def test_weather_provider_forecast_error_grows_with_lead_time() -> None:
    scenario = BUILTIN_SCENARIOS["heatwave_evening"]
    provider = WeatherProvider(scenario, forecast_seed=42)
    actual = provider.actual()

    near = provider.forecast(lead_slots=1)
    far = provider.forecast(lead_slots=120)

    near_err = np.mean(np.abs(near.temp_c - actual.temp_c))
    far_err = np.mean(np.abs(far.temp_c - actual.temp_c))
    assert far_err > near_err


def test_weather_provider_forecast_deterministic_for_same_seed() -> None:
    scenario = BUILTIN_SCENARIOS["solar_noon"]
    a = WeatherProvider(scenario, forecast_seed=7).forecast(lead_slots=20)
    b = WeatherProvider(scenario, forecast_seed=7).forecast(lead_slots=20)
    assert np.allclose(a.temp_c, b.temp_c)
