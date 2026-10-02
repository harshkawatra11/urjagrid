import numpy as np

from app.grid.deficits import (
    build_deficit_windows,
    dt_thermal_limit_kw,
    dt_thermal_limit_series_kw,
    find_deficit_windows,
    find_windows,
    merge_windows,
    split_windows,
)


def test_find_windows_detects_contiguous_runs() -> None:
    flag = np.array([0, 1, 1, 0, 0, 1, 1, 1, 0], dtype=bool)
    assert find_windows(flag) == [(1, 3), (5, 8)]


def test_find_windows_empty_input() -> None:
    assert find_windows(np.array([])) == []


def test_find_windows_all_true() -> None:
    assert find_windows(np.ones(5, dtype=bool)) == [(0, 5)]


def test_merge_windows_bridges_small_gaps() -> None:
    windows = [(1, 3), (4, 6)]  # gap of 1 slot between them
    assert merge_windows(windows, max_gap=1) == [(1, 6)]


def test_merge_windows_keeps_large_gaps_separate() -> None:
    windows = [(1, 3), (10, 12)]
    assert merge_windows(windows, max_gap=1) == [(1, 3), (10, 12)]


def test_split_windows_caps_length() -> None:
    windows = [(0, 30)]
    result = split_windows(windows, max_len=24)
    assert result == [(0, 24), (24, 30)]


def test_split_windows_leaves_short_windows_untouched() -> None:
    windows = [(0, 10)]
    assert split_windows(windows, max_len=24) == [(0, 10)]


def test_find_deficit_windows_full_pipeline() -> None:
    gap = np.zeros(40)
    gap[2:5] = 3.0
    gap[6:9] = 2.0  # should merge with the first (gap of 1 slot)
    gap[30:40] = 1.0  # separate window at the end
    windows = find_deficit_windows(gap, threshold_kw=0.0, max_gap=1, max_len=24)
    assert windows == [(2, 9), (30, 40)]


def test_build_deficit_windows_carries_peak_gap() -> None:
    gap = np.array([0, 5, 8, 2, 0])
    windows = build_deficit_windows("dt_sn_01", gap)
    assert len(windows) == 1
    w = windows[0]
    assert w.dt_id == "dt_sn_01"
    assert w.start_slot == 1 and w.end_slot == 4
    assert w.peak_gap_kw == 8.0
    assert w.n_slots == 3


def test_dt_thermal_limit_kw_decreases_with_ambient() -> None:
    cool_limit = dt_thermal_limit_kw(ambient_c=20.0, rating_kva=160.0)
    hot_limit = dt_thermal_limit_kw(ambient_c=45.0, rating_kva=160.0)
    assert cool_limit > hot_limit > 0


def test_dt_thermal_limit_series_matches_scalar() -> None:
    ambient = np.array([20.0, 30.0, 40.0])
    series = dt_thermal_limit_series_kw(ambient, rating_kva=100.0)
    for i, t in enumerate(ambient):
        assert series[i] == dt_thermal_limit_kw(t, rating_kva=100.0)
