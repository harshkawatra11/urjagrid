"""Bottom-up per-consumer demand model.

Archetype shapes are calibrated, by eye, against the broad diurnal pattern
reported in CEEW's India Residential Energy Survey / smart-meter studies
(morning cooking bump, low midday baseload, evening lighting+entertainment
peak, AC/cooler load tracking ambient temperature) -- this is a prototype
calibration, not a statistical fit to the raw CEEW dataset, which was not
available in this environment.
"""

from __future__ import annotations

import numpy as np
from numpy.random import default_rng

from app.grid.constants import SLOTS_PER_DAY
from app.grid.network import ConsumerArrays
from app.grid.weather import WeatherSeries

# Relative (0..1) 96-slot diurnal shapes, hand-calibrated per archetype.
_HOURS = np.arange(SLOTS_PER_DAY) / 4.0


def gauss_bump(hours: np.ndarray, center: float, width: float) -> np.ndarray:
    """Gaussian bump centered at ``center`` hours, used to build diurnal shapes."""
    return np.exp(-0.5 * ((hours - center) / width) ** 2)


def _archetype_shape(archetype: str) -> np.ndarray:
    h = _HOURS
    if archetype == "lighting_fan":
        shape = 0.15 + 0.5 * gauss_bump(h, 20.0, 2.5) + 0.2 * gauss_bump(h, 7.0, 1.5)
    elif archetype == "cooler_ac":
        shape = 0.05 + 0.9 * gauss_bump(h, 15.0, 4.0) + 0.3 * gauss_bump(h, 22.0, 2.0)
    elif archetype == "fridge_tv":
        shape = 0.5 + 0.3 * gauss_bump(h, 20.5, 2.0) + 0.15 * gauss_bump(h, 8.0, 1.5)
    elif archetype == "shop_small":
        shape = 0.1 + 0.8 * np.where((h >= 9.0) & (h <= 21.0), 1.0, 0.0) * gauss_bump(h, 14.0, 6.0)
    elif archetype == "shop_cold_chain":
        shape = 0.6 + 0.25 * gauss_bump(h, 14.0, 5.0)
    else:
        raise ValueError(f"unknown archetype {archetype!r}")
    return np.clip(shape, 0.02, None)


ARCHETYPE_SHAPES: dict[str, np.ndarray] = {
    name: _archetype_shape(name)
    for name in ("lighting_fan", "cooler_ac", "fridge_tv", "shop_small", "shop_cold_chain")
}

# Rough connected-load peak (kW) per consumer, by archetype -- small-town
# Indian household/shop scale.
ARCHETYPE_PEAK_KW: dict[str, float] = {
    "lighting_fan": 0.5,
    "cooler_ac": 1.8,
    "fridge_tv": 0.6,
    "shop_small": 1.2,
    "shop_cold_chain": 2.5,
}

# Archetypes whose load scales up with ambient temperature (cooling load).
_TEMP_SENSITIVE = {"cooler_ac": 1.0, "shop_cold_chain": 0.4}
_TEMP_REFERENCE_C = 30.0
_TEMP_SENSITIVITY_PER_C = 0.045  # +4.5% load per degree above reference


class LoadModel:
    """Bottom-up per-consumer, then per-DT-aggregated, 96-slot demand generator."""

    def __init__(self, seed: int = 0) -> None:
        self._rng = default_rng(seed)

    def consumer_demand_kw(self, archetype: str, temp_c: np.ndarray) -> np.ndarray:
        """One consumer's 96-slot demand curve (kW) for a given archetype and
        temperature series, with small multiplicative noise.
        """
        shape = ARCHETYPE_SHAPES[archetype]
        peak = ARCHETYPE_PEAK_KW[archetype]
        temp_mult = 1.0
        if archetype in _TEMP_SENSITIVE:
            delta = np.clip(temp_c - _TEMP_REFERENCE_C, 0.0, None)
            temp_mult = 1.0 + _TEMP_SENSITIVE[archetype] * _TEMP_SENSITIVITY_PER_C * delta
        noise = 1.0 + self._rng.normal(0, 0.05, SLOTS_PER_DAY)
        return np.clip(shape * peak * temp_mult * noise, 0.0, None)

    def generate_network_demand(
        self, consumers: ConsumerArrays, weather: WeatherSeries
    ) -> dict[str, np.ndarray]:
        """Aggregate every consumer's demand curve up to its parent DT.

        Returns a dict of DT id -> 96-slot total kW demand array.
        """
        dt_totals: dict[str, np.ndarray] = {}
        for dt_id in np.unique(consumers.dt_ids):
            dt_totals[str(dt_id)] = np.zeros(SLOTS_PER_DAY)

        for i in range(len(consumers)):
            dt_id = str(consumers.dt_ids[i])
            archetype = str(consumers.archetype[i])
            curve = self.consumer_demand_kw(archetype, weather.temp_c)
            dt_totals[dt_id] += curve
        return dt_totals
