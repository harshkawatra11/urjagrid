"""Deficit-window detection and DT thermal limits by temperature.

``find_windows`` turns a boolean "is there a deficit this slot" array into a
list of (start, end) contiguous windows; ``merge_windows``/``split_windows``
apply the merge (bridge brief gaps) and split (cap window length) rules a
raw per-slot scan needs before it is usable as a Flex Plan optimiser input.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.grid.constants import MAX_WINDOW_SLOTS
from app.grid.thermal import dynamic_thermal_rating


def find_windows(flag: np.ndarray) -> list[tuple[int, int]]:
    """Contiguous ``True`` runs in ``flag`` as (start, end) slot indices, end-exclusive."""
    flag = np.asarray(flag, dtype=bool)
    if len(flag) == 0:
        return []
    windows: list[tuple[int, int]] = []
    start: int | None = None
    for i, v in enumerate(flag):
        if v and start is None:
            start = i
        elif not v and start is not None:
            windows.append((start, i))
            start = None
    if start is not None:
        windows.append((start, len(flag)))
    return windows


def merge_windows(windows: list[tuple[int, int]], max_gap: int = 1) -> list[tuple[int, int]]:
    """Merge windows separated by a gap of ``max_gap`` slots or fewer."""
    if not windows:
        return []
    windows = sorted(windows)
    merged = [windows[0]]
    for start, end in windows[1:]:
        last_start, last_end = merged[-1]
        if start - last_end <= max_gap:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


def split_windows(
    windows: list[tuple[int, int]], max_len: int = MAX_WINDOW_SLOTS
) -> list[tuple[int, int]]:
    """Split any window longer than ``max_len`` slots into consecutive chunks."""
    result: list[tuple[int, int]] = []
    for start, end in windows:
        pos = start
        while pos < end:
            chunk_end = min(pos + max_len, end)
            result.append((pos, chunk_end))
            pos = chunk_end
    return result


def find_deficit_windows(
    gap_kw: np.ndarray,
    threshold_kw: float = 0.0,
    max_gap: int = 1,
    max_len: int = MAX_WINDOW_SLOTS,
) -> list[tuple[int, int]]:
    """Full pipeline: flag slots where ``gap_kw > threshold_kw``, merge brief
    gaps, then split any resulting window longer than ``max_len`` slots.
    """
    flag = np.asarray(gap_kw) > threshold_kw
    windows = find_windows(flag)
    windows = merge_windows(windows, max_gap=max_gap)
    windows = split_windows(windows, max_len=max_len)
    return windows


@dataclass
class DeficitWindow:
    dt_id: str
    start_slot: int
    end_slot: int
    gap_kw: np.ndarray  # slice of the gap array covering [start_slot, end_slot)

    @property
    def peak_gap_kw(self) -> float:
        return float(np.max(self.gap_kw)) if len(self.gap_kw) else 0.0

    @property
    def n_slots(self) -> int:
        return self.end_slot - self.start_slot


def build_deficit_windows(
    dt_id: str, gap_kw: np.ndarray, **kwargs: object
) -> list[DeficitWindow]:
    windows = find_deficit_windows(gap_kw, **kwargs)  # type: ignore[arg-type]
    return [
        DeficitWindow(dt_id=dt_id, start_slot=s, end_slot=e, gap_kw=gap_kw[s:e]) for s, e in windows
    ]


def dt_thermal_limit_kw(
    ambient_c: float,
    rating_kva: float,
    power_factor: float = 0.9,
    hotspot_limit_c: float = 120.0,
) -> float:
    """Max deliverable kW for a DT at a given ambient temperature, keeping its
    steady-state hot-spot at or below ``hotspot_limit_c`` (IEEE C57.91).
    """
    k_max = dynamic_thermal_rating(ambient_c, hotspot_limit_c)
    return k_max * rating_kva * power_factor


def dt_thermal_limit_series_kw(
    ambient_c: np.ndarray,
    rating_kva: float,
    power_factor: float = 0.9,
    hotspot_limit_c: float = 120.0,
) -> np.ndarray:
    return np.array(
        [dt_thermal_limit_kw(t, rating_kva, power_factor, hotspot_limit_c) for t in ambient_c]
    )
