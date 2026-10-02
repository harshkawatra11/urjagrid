"""``DayBuilder``: turns one DT-day of demand + weather into the 13-feature
row the quantile forecaster (``forecaster.py``) trains/predicts on.

All demand values are expressed in per-unit of DT rating (kW / (rating_kva *
power_factor)) so a single model generalises across DTs of different sizes.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.grid.constants import SLOTS_PER_DAY

# Canonical, ordered feature list -- 13 features (spec A9).
FEATURE_NAMES: tuple[str, ...] = (
    "slot_of_day",  # 0..95, normalised 0..1
    "hour_of_day",  # 0..24
    "day_of_week",  # 0..6, normalised 0..1
    "is_weekend",
    "month_of_year",  # 1..12, normalised 0..1
    "temp_c",
    "temp_c_lag_1",  # previous slot's temperature
    "humidity_pct",
    "solar_cf",
    "wind_cf",
    "is_evening_peak",  # 18:00-22:00 IST
    "is_heatwave",  # temp_c > 40
    "dt_rating_kva_norm",  # rating / 250 (typical max DT size), static per DT
)

assert len(FEATURE_NAMES) == 13


@dataclass
class DayFeatures:
    """One DT-day's feature matrix (96 x 13) + target vector (96,) in per-unit."""

    features: np.ndarray  # shape (96, 13)
    target_pu: np.ndarray  # shape (96,)


class DayBuilder:
    """Builds ``DayFeatures`` from raw per-slot arrays for one DT on one day."""

    def build(
        self,
        demand_kw: np.ndarray,
        temp_c: np.ndarray,
        humidity_pct: np.ndarray,
        solar_cf: np.ndarray,
        wind_cf: np.ndarray,
        dt_rating_kva: float,
        day_of_week: int,
        month_of_year: int,
        power_factor: float = 0.9,
    ) -> DayFeatures:
        n = SLOTS_PER_DAY
        for name, arr in (
            ("demand_kw", demand_kw),
            ("temp_c", temp_c),
            ("humidity_pct", humidity_pct),
            ("solar_cf", solar_cf),
            ("wind_cf", wind_cf),
        ):
            if len(arr) != n:
                raise ValueError(f"{name} must have {n} slots, got {len(arr)}")

        slot = np.arange(n)
        hour = slot / 4.0
        temp_lag1 = np.roll(temp_c, 1)
        temp_lag1[0] = temp_c[0]

        is_weekend = 1.0 if day_of_week >= 5 else 0.0
        is_evening = ((hour >= 18.0) & (hour < 22.0)).astype(float)
        is_heatwave = (temp_c > 40.0).astype(float)

        features = np.column_stack(
            [
                slot / (n - 1),
                hour,
                np.full(n, day_of_week / 6.0),
                np.full(n, is_weekend),
                np.full(n, (month_of_year - 1) / 11.0),
                temp_c,
                temp_lag1,
                humidity_pct,
                solar_cf,
                wind_cf,
                is_evening,
                is_heatwave,
                np.full(n, dt_rating_kva / 250.0),
            ]
        )
        assert features.shape == (n, 13)

        rated_kw = dt_rating_kva * power_factor
        target_pu = demand_kw / rated_kw
        return DayFeatures(features=features, target_pu=target_pu)
