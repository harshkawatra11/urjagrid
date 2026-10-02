"""Available-supply-fraction model (docs/SPEC.md section 6/A8).

``supply_fraction = min(1, firm + re_share*(0.6*solar_cf+0.4*wind_cf)/0.45 + grid_storage*evening)``

Firm share is calibrated per sub-division *kind* (urban/semi-urban/rural) so
the shadow (status-quo) baseline reproduces a plausible, rank-ordered outage
pattern -- rural sub-divisions see materially more outage hours than urban
ones, consistent with the broad pattern reported by CEEW's Access, Affordability
and Reliability of Power Supply surveys. The raw CEEW microdata was not
available in this environment, so these are prototype-calibrated values
(rank-ordered, plausible magnitude), not a statistical fit -- documented here
so Lane B's scenario calibration (B10) knows to treat them as a starting point.
"""

from __future__ import annotations

import numpy as np

from app.grid.constants import SLOTS_PER_DAY, SUBDIVISION_IDS

SUBDIVISION_KIND: dict[str, str] = {
    "sd_subhashnagar": "urban",
    "sd_izzatnagar": "urban",
    "sd_faridpur": "semi_urban",
    "sd_krishnanagar": "urban",
    "sd_kosikalan": "rural",
}

# Rank-ordered firm (guaranteed, non-renewable) supply share by sub-division kind.
FIRM_SHARE_BY_KIND: dict[str, float] = {
    "urban": 0.88,
    "semi_urban": 0.78,
    "rural": 0.68,
}

EVENING_START_HOUR = 18.0
EVENING_END_HOUR = 22.0


def firm_share_for_subdivision(subdivision_id: str) -> float:
    kind = SUBDIVISION_KIND[subdivision_id]
    return FIRM_SHARE_BY_KIND[kind]


def evening_indicator(slots_per_day: int = SLOTS_PER_DAY) -> np.ndarray:
    """1.0 during the evening peak window (18:00-22:00 IST), else 0.0."""
    hours = np.arange(slots_per_day) / 4.0
    return ((hours >= EVENING_START_HOUR) & (hours < EVENING_END_HOUR)).astype(float)


def supply_fraction(
    firm: float | np.ndarray,
    re_share: float,
    solar_cf: np.ndarray,
    wind_cf: np.ndarray,
    grid_storage: float,
    evening: np.ndarray | float,
) -> np.ndarray:
    """Available supply as a fraction of demand, per the spec formula, capped at 1.0."""
    re_term = re_share * (0.6 * solar_cf + 0.4 * wind_cf) / 0.45
    storage_term = grid_storage * evening
    return np.minimum(1.0, firm + re_term + storage_term)


def supply_fraction_for_subdivision(
    subdivision_id: str,
    re_share: float,
    solar_cf: np.ndarray,
    wind_cf: np.ndarray,
    grid_storage: float,
) -> np.ndarray:
    """Convenience wrapper: calibrated firm share + standard evening window."""
    firm = firm_share_for_subdivision(subdivision_id)
    evening = evening_indicator(len(solar_cf))
    return supply_fraction(firm, re_share, solar_cf, wind_cf, grid_storage, evening)


def all_subdivisions_have_calibration() -> bool:
    return all(sd in SUBDIVISION_KIND for sd in SUBDIVISION_IDS)
