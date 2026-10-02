"""Weather series, scenarios, and the actual-vs-forecast provider.

Data provenance: ``heatwave_evening``, ``monsoon_cloud``, and ``solar_noon``
are built from *real* Open-Meteo historical archive data for Bareilly/Mathura
by ``backend/scripts/fetch_weather.py``, committed to
``backend/data/weather/<name>.json``. ``re_2047`` depicts a hypothetical
2047 renewable-heavy grid day -- by definition no historical data exists for
it, so it is built entirely by ``synthetic_series`` (a physically-reasonable
diurnal generator), as documented on ``BUILTIN_SCENARIOS["re_2047"]``.

If a scenario's JSON file is missing (e.g. the fetch script was never run,
or Open-Meteo was unreachable at build time), ``BUILTIN_SCENARIOS`` falls
back to ``synthetic_series`` for that scenario too, so this module never
requires network access at import/test time.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from numpy.random import default_rng
from pydantic import BaseModel, Field

from app.grid.constants import SLOTS_PER_DAY

WEATHER_DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "weather"


# ---------------------------------------------------------------------------
# Engine-internal series (numpy)
# ---------------------------------------------------------------------------


@dataclass
class WeatherSeries:
    """96-slot (IST-aligned, slot 0 = 00:00 IST) per-day weather arrays."""

    temp_c: np.ndarray
    solar_cf: np.ndarray  # capacity factor in [0, 1]
    wind_cf: np.ndarray  # capacity factor in [0, 1]
    humidity_pct: np.ndarray

    def __post_init__(self) -> None:
        for name in ("temp_c", "solar_cf", "wind_cf", "humidity_pct"):
            arr = getattr(self, name)
            if len(arr) != SLOTS_PER_DAY:
                raise ValueError(f"{name} must have {SLOTS_PER_DAY} slots, got {len(arr)}")


def _diurnal_temp(slot: np.ndarray, t_min: float, t_max: float) -> np.ndarray:
    """Simple diurnal temperature curve, min near 05:00 IST, max near 15:00 IST."""
    hours = slot / 4.0  # 4 slots/hour
    phase = (hours - 15.0) / 24.0 * 2 * np.pi
    return (t_min + t_max) / 2 + (t_max - t_min) / 2 * np.cos(phase)


def _solar_curve(slot: np.ndarray, cloud_factor: float = 1.0) -> np.ndarray:
    """Bell-shaped daylight solar capacity factor peaking at slot 48 (12:00 IST)."""
    hours = slot / 4.0
    base = np.clip(np.sin((hours - 6.0) / 12.0 * np.pi), 0.0, 1.0)
    cf = np.where((hours >= 6.0) & (hours <= 18.0), base**1.5, 0.0)
    return np.clip(cf * cloud_factor, 0.0, 1.0)


def synthetic_series(
    seed: int,
    t_min: float = 24.0,
    t_max: float = 38.0,
    cloud_factor: float = 1.0,
    wind_base: float = 0.3,
    humidity_base: float = 55.0,
) -> WeatherSeries:
    """Physically-reasonable synthetic 96-slot weather day, fully deterministic."""
    rng = default_rng(seed)
    slot = np.arange(SLOTS_PER_DAY)
    temp_c = _diurnal_temp(slot, t_min, t_max) + rng.normal(0, 0.4, SLOTS_PER_DAY)
    solar_cf = _solar_curve(slot, cloud_factor) * (1 + rng.normal(0, 0.03, SLOTS_PER_DAY))
    solar_cf = np.clip(solar_cf, 0.0, 1.0)
    wind_cf = np.clip(wind_base + rng.normal(0, 0.12, SLOTS_PER_DAY), 0.0, 1.0)
    humidity_pct = np.clip(humidity_base + rng.normal(0, 8.0, SLOTS_PER_DAY), 10.0, 100.0)
    return WeatherSeries(
        temp_c=temp_c, solar_cf=solar_cf, wind_cf=wind_cf, humidity_pct=humidity_pct
    )


# ---------------------------------------------------------------------------
# Wire-level scenario model
# ---------------------------------------------------------------------------


class Scenario(BaseModel):
    """A named weather day: either real archive data or synthetic, 96 slots."""

    name: str
    label: str
    town: str
    source: str = Field(..., description="'open_meteo_archive' | 'synthetic'")
    temp_c: list[float]
    solar_cf: list[float]
    wind_cf: list[float]
    humidity_pct: list[float]

    def to_series(self) -> WeatherSeries:
        return WeatherSeries(
            temp_c=np.array(self.temp_c, dtype=float),
            solar_cf=np.array(self.solar_cf, dtype=float),
            wind_cf=np.array(self.wind_cf, dtype=float),
            humidity_pct=np.array(self.humidity_pct, dtype=float),
        )

    @classmethod
    def from_series(
        cls, name: str, label: str, town: str, source: str, series: WeatherSeries
    ) -> Scenario:
        return cls(
            name=name,
            label=label,
            town=town,
            source=source,
            temp_c=series.temp_c.tolist(),
            solar_cf=series.solar_cf.tolist(),
            wind_cf=series.wind_cf.tolist(),
            humidity_pct=series.humidity_pct.tolist(),
        )


_SYNTHETIC_SCENARIO_PARAMS: dict[str, dict] = {
    "heatwave_evening": dict(
        seed=101, t_min=30.0, t_max=44.0, cloud_factor=1.0, wind_base=0.15, humidity_base=25.0
    ),
    "monsoon_cloud": dict(
        seed=102, t_min=26.0, t_max=31.0, cloud_factor=0.35, wind_base=0.45, humidity_base=85.0
    ),
    "solar_noon": dict(
        seed=103, t_min=22.0, t_max=36.0, cloud_factor=1.0, wind_base=0.3, humidity_base=40.0
    ),
    "re_2047": dict(
        seed=104, t_min=25.0, t_max=39.0, cloud_factor=0.9, wind_base=0.55, humidity_base=45.0
    ),
}

_SCENARIO_LABELS: dict[str, tuple[str, str]] = {
    "heatwave_evening": ("Heatwave evening peak", "Bareilly"),
    "monsoon_cloud": ("Monsoon cloud cover", "Mathura"),
    "solar_noon": ("Clear solar noon", "Bareilly"),
    "re_2047": ("RE-2047 high-renewable day (hypothetical)", "Mathura"),
}


def _load_or_synthesize(name: str) -> Scenario:
    path = WEATHER_DATA_DIR / f"{name}.json"
    if path.exists():
        raw = json.loads(path.read_text(encoding="utf-8"))
        return Scenario.model_validate(raw)
    label, town = _SCENARIO_LABELS[name]
    series = synthetic_series(**_SYNTHETIC_SCENARIO_PARAMS[name])
    return Scenario.from_series(name, label, town, "synthetic", series)


BUILTIN_SCENARIOS: dict[str, Scenario] = {
    name: _load_or_synthesize(name) for name in _SCENARIO_LABELS
}


# ---------------------------------------------------------------------------
# Actual vs forecast-with-error provider
# ---------------------------------------------------------------------------


class WeatherProvider:
    """Serves a scenario's "actual" series, and a forecast series with
    injected, seeded error that grows with lead time -- used to make the
    quantile forecaster's inputs imperfect in a realistic, reproducible way.
    """

    def __init__(self, scenario: Scenario, forecast_seed: int = 0) -> None:
        self.scenario = scenario
        self._rng = default_rng(forecast_seed if forecast_seed else hash(scenario.name) & 0xFFFF)

    def actual(self) -> WeatherSeries:
        return self.scenario.to_series()

    def forecast(self, lead_slots: int = 0) -> WeatherSeries:
        """Forecast series for a given lead time (in 15-min slots ahead).

        Error standard deviation grows linearly with lead time, capped at a
        realistic ceiling, applied independently to each channel.
        """
        actual = self.actual()
        lead_hours = max(lead_slots, 0) / 4.0
        temp_sd = min(0.5 + 0.15 * lead_hours, 4.0)
        solar_sd = min(0.02 + 0.01 * lead_hours, 0.25)
        wind_sd = min(0.03 + 0.01 * lead_hours, 0.3)

        temp_c = actual.temp_c + self._rng.normal(0, temp_sd, SLOTS_PER_DAY)
        solar_cf = np.clip(actual.solar_cf + self._rng.normal(0, solar_sd, SLOTS_PER_DAY), 0.0, 1.0)
        wind_cf = np.clip(actual.wind_cf + self._rng.normal(0, wind_sd, SLOTS_PER_DAY), 0.0, 1.0)
        humidity_pct = np.clip(
            actual.humidity_pct + self._rng.normal(0, temp_sd * 2, SLOTS_PER_DAY), 10.0, 100.0
        )
        return WeatherSeries(
        temp_c=temp_c, solar_cf=solar_cf, wind_cf=wind_cf, humidity_pct=humidity_pct
    )
