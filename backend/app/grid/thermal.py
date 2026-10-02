"""IEEE C57.91 Clause 7 transformer thermal equations (steady-state).

Parameters below (top-oil rise 55C, hot-spot rise 25C, loss ratio R=5,
exponents n=m=0.8) are the standard's own worked example for a typical
65C-rise ONAN distribution transformer, and reproduce the two mandated
verification points exactly:

- k=1.0, ambient=30C -> hot-spot=110.0C, ageing factor=1.0
- k=1.2, ambient=42C -> hot-spot=146.1C, ageing factor ~29
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from scipy.optimize import brentq

# Rated-load rises (degrees C above ambient / top-oil respectively).
DELTA_THETA_TO_R = 55.0  # top-oil rise over ambient at rated load
DELTA_THETA_H_R = 25.0  # hot-spot rise over top-oil at rated load
LOSS_RATIO_R = 5.0  # ratio of rated load loss to no-load loss
N_EXPONENT = 0.8  # top-oil-rise exponent
M_EXPONENT = 0.8  # hot-spot-rise exponent

# Arrhenius ageing-acceleration reference hot-spot temperature.
AGEING_REFERENCE_C = 110.0
AGEING_ACTIVATION = 15000.0


def top_oil_rise_c(
    k: float,
    loss_ratio_r: float = LOSS_RATIO_R,
    delta_theta_to_r: float = DELTA_THETA_TO_R,
    n: float = N_EXPONENT,
) -> float:
    """Top-oil temperature rise over ambient at load factor ``k`` (per-unit of rated)."""
    ratio = (k**2 * loss_ratio_r + 1) / (loss_ratio_r + 1)
    return delta_theta_to_r * ratio**n


def hot_spot_rise_c(
    k: float, delta_theta_h_r: float = DELTA_THETA_H_R, m: float = M_EXPONENT
) -> float:
    """Hot-spot temperature rise over top-oil at load factor ``k``."""
    return delta_theta_h_r * k ** (2 * m)


def hot_spot_temp_c(
    k: float,
    ambient_c: float,
    loss_ratio_r: float = LOSS_RATIO_R,
    delta_theta_to_r: float = DELTA_THETA_TO_R,
    delta_theta_h_r: float = DELTA_THETA_H_R,
    n: float = N_EXPONENT,
    m: float = M_EXPONENT,
) -> float:
    """Steady-state winding hot-spot temperature (C) at load factor ``k``."""
    return (
        ambient_c
        + top_oil_rise_c(k, loss_ratio_r, delta_theta_to_r, n)
        + hot_spot_rise_c(k, delta_theta_h_r, m)
    )


def ageing_factor(hot_spot_c: float) -> float:
    """Per-unit insulation ageing-acceleration factor (IEEE C57.91 Arrhenius relation),
    relative to the 110C reference hot-spot temperature (FAA=1.0 at 110C).
    """
    return math.exp(
        AGEING_ACTIVATION / (AGEING_REFERENCE_C + 273.0) - AGEING_ACTIVATION / (hot_spot_c + 273.0)
    )


def equivalent_aging_hours(ageing_factors: list[float], interval_hours: float) -> float:
    """Equivalent ageing (in hours of rated-life consumption) for a sequence of
    per-interval ageing-acceleration factors, each covering ``interval_hours``.
    """
    return sum(fa * interval_hours for fa in ageing_factors)


def dynamic_thermal_rating(
    ambient_c: float,
    hotspot_limit_c: float,
    loss_ratio_r: float = LOSS_RATIO_R,
    delta_theta_to_r: float = DELTA_THETA_TO_R,
    delta_theta_h_r: float = DELTA_THETA_H_R,
    n: float = N_EXPONENT,
    m: float = M_EXPONENT,
) -> float:
    """Maximum load factor ``k`` that keeps the steady-state hot-spot at or
    below ``hotspot_limit_c`` for the given ambient temperature. Solved
    numerically (hot-spot temp is monotonic increasing in k for k>0).
    """
    if hot_spot_temp_c(0.0, ambient_c, loss_ratio_r, delta_theta_to_r, delta_theta_h_r, n, m) >= (
        hotspot_limit_c
    ):
        return 0.0

    def f(k: float) -> float:
        return (
            hot_spot_temp_c(k, ambient_c, loss_ratio_r, delta_theta_to_r, delta_theta_h_r, n, m)
            - hotspot_limit_c
        )

    lo, hi = 0.0, 3.0
    while f(hi) < 0 and hi < 50.0:
        hi *= 2
    return brentq(f, lo, hi)


@dataclass
class ThermalState:
    """Convenience bundle: everything a single thermal evaluation needs/produces."""

    k: float
    ambient_c: float
    hot_spot_c: float
    ageing_factor: float

    @classmethod
    def evaluate(cls, k: float, ambient_c: float) -> ThermalState:
        hs = hot_spot_temp_c(k, ambient_c)
        return cls(k=k, ambient_c=ambient_c, hot_spot_c=hs, ageing_factor=ageing_factor(hs))
