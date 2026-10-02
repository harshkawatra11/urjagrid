"""Reliability metrics: Hours of Hardship, SAIDI, SAIFI, lifeline availability."""

from __future__ import annotations

import numpy as np

from app.grid.constants import LIFELINE_FLOOR_W


def hours_of_hardship(unserved_kw: np.ndarray, interval_hours: float = 0.25) -> float:
    """Total hours during which a consumer/DT had any unserved demand at all."""
    return float(np.sum(np.asarray(unserved_kw) > 0) * interval_hours)


def saidi(customer_interruption_hours: dict[str, float], total_customers: int) -> float:
    """System Average Interruption Duration Index: sum(customers interrupted x
    duration) / total customers served.
    """
    if total_customers <= 0:
        return 0.0
    return sum(customer_interruption_hours.values()) / total_customers


def saifi(interruption_counts: dict[str, int], total_customers: int) -> float:
    """System Average Interruption Frequency Index: total interruption events
    / total customers served.
    """
    if total_customers <= 0:
        return 0.0
    return sum(interruption_counts.values()) / total_customers


def lifeline_availability(
    served_w: np.ndarray, lifeline_floor_w: float = LIFELINE_FLOOR_W
) -> float:
    """Fraction of intervals where served power met or exceeded the lifeline floor."""
    served_w = np.asarray(served_w)
    if len(served_w) == 0:
        return 1.0
    return float(np.mean(served_w >= lifeline_floor_w))
