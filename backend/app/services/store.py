"""Best-effort JSON snapshot persistence for ``GridService`` (Lane B, B5).

Known limitation (documented, not engineered around -- see docs/SPEC.md
section 9): Cloud Run's free-tier container has no durable volume, so on a
cold start the world simply rebuilds from the scenario start rather than
restoring this snapshot. The snapshot exists so a *warm* restart (local dev,
or a Cloud Run instance that stays warm between requests) can resume without
losing a running demo, written at most once every ``MIN_SAVE_INTERVAL_SECONDS``
real seconds while the service is dirty.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

DEFAULT_STATE_PATH = Path(".runtime/grid_state.json")
MIN_SAVE_INTERVAL_SECONDS = 5.0


class StateStore:
    """Debounced JSON writer: ``save`` only actually writes if the state is
    dirty AND at least ``MIN_SAVE_INTERVAL_SECONDS`` have passed since the
    last write.
    """

    def __init__(
        self, path: Path | None = None, min_interval_seconds: float = MIN_SAVE_INTERVAL_SECONDS
    ) -> None:
        self.path = path or DEFAULT_STATE_PATH
        self.min_interval_seconds = min_interval_seconds
        self._dirty = False
        self._last_write_monotonic: float | None = None

    def mark_dirty(self) -> None:
        self._dirty = True

    def save(self, state: dict[str, Any], *, force: bool = False) -> bool:
        """Write ``state`` to disk if dirty (or ``force``d) and the debounce
        interval has elapsed. Returns whether a write actually happened.
        """
        if not self._dirty and not force:
            return False
        now = time.monotonic()
        if (
            not force
            and self._last_write_monotonic is not None
            and now - self._last_write_monotonic < self.min_interval_seconds
        ):
            return False
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(state, indent=2), encoding="utf-8")
        self._dirty = False
        self._last_write_monotonic = now
        return True

    def load(self) -> dict[str, Any] | None:
        if not self.path.exists():
            return None
        return json.loads(self.path.read_text(encoding="utf-8"))


__all__ = ["StateStore", "DEFAULT_STATE_PATH", "MIN_SAVE_INTERVAL_SECONDS"]
