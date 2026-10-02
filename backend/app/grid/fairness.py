"""Fairness metrics: Jain index, Gini coefficient, Lorenz curve, and served
fraction by consumer tier -- used to show the fairness ledger spreads burden
evenly across consumers rather than concentrating it.
"""

from __future__ import annotations

import numpy as np


def jain_index(values: np.ndarray) -> float:
    """Jain's fairness index in (0, 1]; 1.0 = perfectly equal allocation."""
    values = np.asarray(values, dtype=float)
    n = len(values)
    if n == 0:
        return 1.0
    denom = n * np.sum(values**2)
    if denom == 0:
        return 1.0
    return float(np.sum(values) ** 2 / denom)


def gini_coefficient(values: np.ndarray) -> float:
    """Gini coefficient in [0, 1]; 0 = perfect equality, 1 = max inequality."""
    values = np.asarray(values, dtype=float)
    n = len(values)
    if n == 0:
        return 0.0
    sorted_v = np.sort(values)
    cum = np.cumsum(sorted_v)
    total = cum[-1]
    if total == 0:
        return 0.0
    return float((n + 1 - 2 * np.sum(cum) / total) / n)


def lorenz_curve(values: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Lorenz curve as (population_fraction, cumulative_value_fraction) arrays,
    both starting at (0, 0) and ending at (1, 1).
    """
    values = np.asarray(values, dtype=float)
    n = len(values)
    if n == 0:
        return np.array([0.0, 1.0]), np.array([0.0, 1.0])
    sorted_v = np.sort(values)
    cum = np.cumsum(sorted_v)
    total = cum[-1]
    cum_frac = np.insert(cum / total, 0, 0.0) if total != 0 else np.linspace(0, 1, n + 1)
    pop_frac = np.linspace(0.0, 1.0, n + 1)
    return pop_frac, cum_frac


def served_fraction_by_tier(
    served_kw: dict[str, float], demand_kw: dict[str, float], tier_of: dict[str, str]
) -> dict[str, float]:
    """Per-tier served/demand ratio (1.0 = fully served on average)."""
    served_sum: dict[str, float] = {}
    demand_sum: dict[str, float] = {}
    for consumer_id, served in served_kw.items():
        tier = tier_of.get(consumer_id)
        if tier is None:
            continue
        served_sum[tier] = served_sum.get(tier, 0.0) + served
        demand_sum[tier] = demand_sum.get(tier, 0.0) + demand_kw.get(consumer_id, 0.0)

    result: dict[str, float] = {}
    for tier, demand in demand_sum.items():
        result[tier] = served_sum[tier] / demand if demand > 0 else 1.0
    return result
