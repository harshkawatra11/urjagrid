from app.grid.models import RiskLevel
from app.grid.risk import compute_dt_risk, rank_by_risk


def test_compute_dt_risk_low_when_healthy() -> None:
    risk = compute_dt_risk(
        "dt_sn_01", hot_spot_c=70.0, forecast_gap_kw=0.0, dt_limit_kw=100.0, ageing_factor=0.5
    )
    assert risk.level == RiskLevel.LOW


def test_compute_dt_risk_critical_when_overloaded_and_hot() -> None:
    risk = compute_dt_risk(
        "dt_sn_02", hot_spot_c=140.0, forecast_gap_kw=90.0, dt_limit_kw=100.0, ageing_factor=25.0
    )
    assert risk.level == RiskLevel.CRITICAL


def test_compute_dt_risk_components_sum_to_score() -> None:
    risk = compute_dt_risk(
        "dt_sn_03", hot_spot_c=110.0, forecast_gap_kw=50.0, dt_limit_kw=100.0, ageing_factor=1.0
    )
    expected = 0.4 * risk.thermal_component + 0.4 * risk.gap_component + 0.2 * risk.ageing_component
    assert risk.score == expected


def test_rank_by_risk_highest_first() -> None:
    low = compute_dt_risk("dt_a", 70.0, 0.0, 100.0, 0.5)
    high = compute_dt_risk("dt_b", 140.0, 90.0, 100.0, 25.0)
    ranked = rank_by_risk([low, high])
    assert ranked[0].dt_id == "dt_b"
    assert ranked[1].dt_id == "dt_a"


def test_rank_by_risk_ties_broken_by_id() -> None:
    a = compute_dt_risk("dt_z", 70.0, 0.0, 100.0, 0.5)
    b = compute_dt_risk("dt_a", 70.0, 0.0, 100.0, 0.5)
    ranked = rank_by_risk([a, b])
    assert ranked[0].dt_id == "dt_a"
