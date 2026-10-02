"""Non-residential asset profiles and network sizing.

``AssetProfiles`` generates 96-slot kW curves for the asset types that sit
alongside households on a DT: managed-charging hubs (e-rickshaw/EV),
shiftable public loads (water pumps, telecom towers), critical facilities
(never capped/shed), and rooftop PV injection. ``size_network`` turns raw
per-DT demand curves + DT ratings into loading-pu arrays and flags DTs that
land in a target overload band, which is how the seed network's DT ratings
were chosen (tight enough that heatwave days produce genuine thermal
deficits, loose enough that most DTs stay healthy).
"""

from __future__ import annotations

import numpy as np

from app.grid.constants import SLOTS_PER_DAY
from app.grid.loadgen import gauss_bump
from app.grid.weather import WeatherSeries

_HOURS = np.arange(SLOTS_PER_DAY) / 4.0


class AssetProfiles:
    """96-slot kW shape generators for non-residential DT-attached assets."""

    @staticmethod
    def hub_profile(rated_kw: float, n_sessions_per_day: float = 1.0) -> np.ndarray:
        """Managed-charging hub (e-rickshaw/EV) load: morning + evening peaks."""
        shape = 0.15 + 0.8 * gauss_bump(_HOURS, 9.0, 2.0) + 0.9 * gauss_bump(_HOURS, 19.0, 2.0)
        return np.clip(shape, 0.05, 1.0) * rated_kw * max(n_sessions_per_day, 0.1)

    @staticmethod
    def shift_profile_pump(rated_kw: float) -> np.ndarray:
        """Agricultural water pump: runs mainly midday/early-afternoon."""
        shape = 0.9 * gauss_bump(_HOURS, 13.0, 3.0)
        return np.clip(shape, 0.0, 1.0) * rated_kw

    @staticmethod
    def shift_profile_telecom_tower(rated_kw: float) -> np.ndarray:
        """Telecom tower: near-flat baseline load, mild evening bump."""
        shape = 0.85 + 0.15 * gauss_bump(_HOURS, 20.0, 3.0)
        return np.clip(shape, 0.0, 1.0) * rated_kw

    @staticmethod
    def facility_profile(rated_kw: float) -> np.ndarray:
        """Critical facility (hospital/water works): flat baseline, never capped/shed."""
        return np.full(SLOTS_PER_DAY, rated_kw)

    @staticmethod
    def pv_profile(rated_kwp: float, weather: WeatherSeries) -> np.ndarray:
        """Rooftop solar injection: rated capacity scaled by the day's solar CF."""
        return rated_kwp * weather.solar_cf


def loading_pu(demand_kw: np.ndarray, rating_kva: float, power_factor: float = 0.9) -> np.ndarray:
    """Per-slot DT loading in per-unit of rated capacity."""
    rated_kw = rating_kva * power_factor
    if rated_kw <= 0:
        raise ValueError("rating_kva must be positive")
    return demand_kw / rated_kw


def size_network(
    dt_demand_kw: dict[str, np.ndarray],
    dt_rating_kva: dict[str, float],
    power_factor: float = 0.9,
) -> dict[str, dict[str, float]]:
    """Summarise each DT's loading for sizing/calibration checks.

    Returns, per DT id: ``peak_loading_pu``, ``mean_loading_pu``, and
    ``overloaded`` (peak_loading_pu > 1.0).
    """
    summary: dict[str, dict[str, float]] = {}
    for dt_id, demand in dt_demand_kw.items():
        rating = dt_rating_kva.get(dt_id)
        if rating is None:
            continue
        pu = loading_pu(demand, rating, power_factor)
        summary[dt_id] = {
            "peak_loading_pu": float(np.max(pu)),
            "mean_loading_pu": float(np.mean(pu)),
            "overloaded": bool(np.max(pu) > 1.0),
        }
    return summary


def overload_fraction(summary: dict[str, dict[str, float]]) -> float:
    """Fraction of DTs flagged ``overloaded`` in a ``size_network`` summary."""
    if not summary:
        return 0.0
    return sum(1 for v in summary.values() if v["overloaded"]) / len(summary)
