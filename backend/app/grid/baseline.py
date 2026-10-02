"""Shadow (status-quo) baseline: rotational feeder/DT shedding.

The shadow baseline never runs a Flex Plan -- when supply falls short it
sheds whole feeders/DTs in rotation, which is what LifelineGrid's Flex Plans
are designed to make unnecessary. ``ShedLedger`` tracks cumulative shed
hours per entity so rotation can prefer the least-burdened entity (fairer
than pure round-robin once entities have uneven prior burden).
"""

from __future__ import annotations

from dataclasses import dataclass, field


def rotate_shedding_roster(entity_ids: list[str], cycle_index: int, n_to_shed: int) -> list[str]:
    """Simple round-robin rotation: which ``n_to_shed`` entities are shed this cycle."""
    n = len(entity_ids)
    if n == 0 or n_to_shed <= 0:
        return []
    n_to_shed = min(n_to_shed, n)
    start = (cycle_index * n_to_shed) % n
    return [entity_ids[(start + i) % n] for i in range(n_to_shed)]


@dataclass
class ShedLedger:
    """Tracks cumulative shed-hours per entity for burden-aware rotation."""

    burden_hours: dict[str, float] = field(default_factory=dict)

    def record(self, entity_id: str, hours: float) -> None:
        self.burden_hours[entity_id] = self.burden_hours.get(entity_id, 0.0) + hours

    def burden(self, entity_id: str) -> float:
        return self.burden_hours.get(entity_id, 0.0)

    def least_burdened(self, entity_ids: list[str], n: int) -> list[str]:
        """Pick the ``n`` entities with the lowest cumulative shed burden,
        breaking ties by id order for determinism.
        """
        ranked = sorted(entity_ids, key=lambda e: (self.burden(e), e))
        return ranked[:n]
