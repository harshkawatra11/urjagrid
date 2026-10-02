import pytest

from app.services.economics import national_impact, unit_economics


def test_unit_economics_computes_net_benefit() -> None:
    econ = unit_economics(n_meters=7000, monthly_dr_kwh_shifted=500.0, monthly_avoided_shedding_kwh=2000.0)
    view = econ.to_view()
    assert view["n_meters"] == 7000
    assert view["monthly_software_fee_rs"] == pytest.approx(7000 * 8.0)
    assert "monthly_net_benefit_rs" in view


def test_unit_economics_payback_period_when_profitable() -> None:
    econ = unit_economics(
        n_meters=100, monthly_dr_kwh_shifted=100.0, monthly_avoided_shedding_kwh=5000.0,
        one_time_implementation_cost_rs=100_000.0,
    )
    assert econ.payback_period_months is not None
    assert econ.payback_period_months > 0


def test_unit_economics_no_payback_when_unprofitable() -> None:
    econ = unit_economics(
        n_meters=7000, monthly_dr_kwh_shifted=100_000.0, monthly_avoided_shedding_kwh=1.0,
        one_time_implementation_cost_rs=100_000.0,
    )
    assert econ.monthly_net_benefit_rs < 0
    assert econ.payback_period_months is None


def test_national_impact_scales_linearly() -> None:
    econ = unit_economics(n_meters=7000, monthly_dr_kwh_shifted=500.0, monthly_avoided_shedding_kwh=2000.0)
    impact = national_impact(econ, pilot_meter_count=7000, national_meter_count=70_000)
    assert impact.scale_factor == pytest.approx(10.0)
    assert impact.annual_software_revenue_rs == pytest.approx(econ.monthly_software_fee_rs * 10 * 12)


def test_national_impact_zero_pilot_meters_is_safe() -> None:
    econ = unit_economics(n_meters=0, monthly_dr_kwh_shifted=0.0, monthly_avoided_shedding_kwh=0.0)
    impact = national_impact(econ, pilot_meter_count=0)
    assert impact.scale_factor == 0.0
