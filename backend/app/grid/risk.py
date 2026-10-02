"""DT risk scoring: combines thermal headroom, forecast deficit, and
insulation ageing into a single, bucketed risk level for the dashboard.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.grid.constants import HOTSPOT_LIMIT_C
from app.grid.models import RiskLevel


@dataclass
class DtRisk:
    dt_id: str
    score: float
    level: RiskLevel
    thermal_component: float
    gap_component: float
    ageing_component: float


def _bucket(score: float) -> RiskLevel:
    if score >= 1.2:
        return RiskLevel.CRITICAL
    if score >= 0.8:
        return RiskLevel.HIGH
    if score >= 0.4:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


def compute_dt_risk(
    dt_id: str,
    hot_spot_c: float,
    forecast_gap_kw: float,
    dt_limit_kw: float,
    ageing_factor: float,
    hotspot_limit_c: float = HOTSPOT_LIMIT_C,
) -> DtRisk:
    """Weighted blend of three normalised risk signals, each clipped to [0, 2]."""
    thermal_component = min(max(hot_spot_c / hotspot_limit_c, 0.0), 2.0)
    gap_component = min(max(forecast_gap_kw / max(dt_limit_kw, 1e-6), 0.0), 2.0)
    ageing_component = min(max(ageing_factor / 10.0, 0.0), 2.0)

    score = 0.4 * thermal_component + 0.4 * gap_component + 0.2 * ageing_component
    return DtRisk(
        dt_id=dt_id,
        score=score,
        level=_bucket(score),
        thermal_component=thermal_component,
        gap_component=gap_component,
        ageing_component=ageing_component,
    )


def rank_by_risk(risks: list[DtRisk]) -> list[DtRisk]:
    """Highest risk first, ties broken by dt_id for determinism."""
    return sorted(risks, key=lambda r: (-r.score, r.dt_id))
