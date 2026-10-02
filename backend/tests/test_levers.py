from app.grid.levers import (
    cap_reduction_kw,
    dr_expected_kw,
    hub_curtailment_kw,
    shift_reduction_kw,
    storage_recoverable_energy_kwh,
    total_lever_potential_kw,
)


def test_cap_reduction_kw_lifeline_level() -> None:
    tier_counts = {"t1": 100, "t2": 10}
    baseline = {"t1": 1.0, "t2": 2.0}  # kW
    freed = cap_reduction_kw(tier_counts, baseline, cap_level=3)  # Lifeline: 300W/500W
    expected = 100 * (1.0 - 0.3) + 10 * (2.0 - 0.5)
    assert freed == expected


def test_cap_reduction_kw_none_level_frees_nothing() -> None:
    tier_counts = {"t1": 50}
    baseline = {"t1": 0.8}
    assert cap_reduction_kw(tier_counts, baseline, cap_level=0) == 0.0


def test_dr_expected_kw_basic() -> None:
    assert dr_expected_kw(n_consumers=200, acceptance_prob=0.3, avg_shiftable_kw=0.5) == 30.0


def test_dr_expected_kw_clips_probability() -> None:
    assert dr_expected_kw(100, acceptance_prob=1.5, avg_shiftable_kw=1.0) == 100.0
    assert dr_expected_kw(100, acceptance_prob=-0.5, avg_shiftable_kw=1.0) == 0.0


def test_hub_curtailment_kw() -> None:
    assert hub_curtailment_kw(rated_kw=50.0, hub_frac=0.4) == 30.0
    assert hub_curtailment_kw(rated_kw=50.0, hub_frac=1.0) == 0.0
    assert hub_curtailment_kw(rated_kw=50.0, hub_frac=0.0) == 50.0


def test_shift_reduction_kw() -> None:
    assert shift_reduction_kw(10.0, shift_on=True) == 0.0
    assert shift_reduction_kw(10.0, shift_on=False) == 10.0


def test_storage_recoverable_energy_kwh_limited_by_soc() -> None:
    energy = storage_recoverable_energy_kwh(
        capacity_kwh=20.0, soc_frac=0.3, max_discharge_kw=50.0, duration_hours=1.0
    )
    assert energy == 6.0  # soc-limited (6 kWh) vs power-limited (50 kWh)


def test_storage_recoverable_energy_kwh_limited_by_power() -> None:
    energy = storage_recoverable_energy_kwh(
        capacity_kwh=100.0, soc_frac=0.9, max_discharge_kw=5.0, duration_hours=1.0
    )
    assert energy == 5.0


def test_total_lever_potential_kw_sums_all_levers() -> None:
    assert total_lever_potential_kw(1, 2, 3, 4, 5) == 15
