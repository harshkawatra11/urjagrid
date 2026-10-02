"""``/api/v1/events`` -- the live event timeline (B9), built from the real
events ``GridWorld`` emits every interval (``GridService.events``: trip/
thermal-alarm/shed/critical-backup strings -- see ``grid/world.py``).

Simplification note: the world currently emits free-text event strings
rather than structured records, so this view assigns a synthetic
monotonic id/timestamp and leaves ``dtId``/``planId`` unset (``null``) --
those correlations exist in the world's internal control flow but aren't
threaded through the event string today. Extracting them is a natural
follow-up to ``grid/world.py``'s event-emission call sites, not a fabrication
of this view.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends

from app.grid.constants import INTERVAL_MIN
from app.services.deps import get_grid_service
from app.services.service import GridService

router = APIRouter(prefix="/api/v1/events", tags=["events"])

_SLOT_EPOCH = datetime(2025, 1, 1, tzinfo=UTC)


def _kind_of(message: str) -> str:
    lowered = message.lower()
    if "trip" in lowered:
        return "alarm"
    if "shed" in lowered:
        return "dispatch"
    if "critical" in lowered or "backup" in lowered:
        return "alarm"
    return "info"


@router.get("")
async def list_events(
    subdivision_id: str | None = None, service: GridService = Depends(get_grid_service)
) -> dict:
    events = []
    for idx, message in enumerate(service.events):
        slot = max(service.state.slot - 1, 0)
        events.append(
            {
                "id": f"evt_{idx}",
                "timestampIso": (
                    _SLOT_EPOCH + timedelta(minutes=INTERVAL_MIN * slot)
                ).isoformat(),
                "kind": _kind_of(message),
                "subdivisionId": subdivision_id,
                "dtId": None,
                "planId": None,
                "message": message,
            }
        )
    events.reverse()  # newest first, matching the committed fixture's ordering
    return {"events": events}


__all__ = ["router"]
