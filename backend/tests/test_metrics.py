import numpy as np

from app.grid.metrics import hours_of_hardship, lifeline_availability, saidi, saifi


def test_hours_of_hardship_counts_unserved_intervals() -> None:
    unserved = np.array([0.0, 2.0, 3.0, 0.0, 1.0])
    assert hours_of_hardship(unserved, interval_hours=0.25) == 3 * 0.25


def test_hours_of_hardship_zero_when_fully_served() -> None:
    assert hours_of_hardship(np.zeros(10)) == 0.0


def test_saidi_basic() -> None:
    durations = {"dt_a": 10.0, "dt_b": 5.0}
    assert saidi(durations, total_customers=100) == 0.15


def test_saidi_zero_customers_is_zero() -> None:
    assert saidi({"dt_a": 10.0}, total_customers=0) == 0.0


def test_saifi_basic() -> None:
    counts = {"dt_a": 3, "dt_b": 1}
    assert saifi(counts, total_customers=200) == 0.02


def test_lifeline_availability_full_coverage() -> None:
    served = np.full(96, 400.0)
    assert lifeline_availability(served, lifeline_floor_w=300) == 1.0


def test_lifeline_availability_partial_coverage() -> None:
    served = np.array([400, 200, 400, 200])
    assert lifeline_availability(served, lifeline_floor_w=300) == 0.5


def test_lifeline_availability_empty_defaults_to_full() -> None:
    assert lifeline_availability(np.array([])) == 1.0
