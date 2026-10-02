"""``/api/v1/protocols`` -- protocol ledger + federation stub (B9)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.adapters.ledger import PROTOCOL_NAMES
from app.grid.constants import DISCOM_IDS, SUBDIVISION_DISCOM
from app.grid.views import protocol_ledger_view
from app.services.deps import get_grid_service
from app.services.service import GridService

router = APIRouter(prefix="/api/v1", tags=["protocols"])


@router.get("/protocols")
async def list_protocol_traffic(
    protocol: str | None = None, service: GridService = Depends(get_grid_service)
) -> dict:
    entries = service.ledger.by_protocol(protocol) if protocol else service.ledger.all()
    return {
        "protocol_names": PROTOCOL_NAMES,
        "counts": service.ledger.counts_by_protocol(),
        "entries": protocol_ledger_view(entries),
    }


@router.get("/federation")
async def federation_overview() -> dict:
    """WIRED: a single-process prototype has one logical DISCOM node; this
    endpoint describes the federation topology the real multi-DISCOM
    deployment would have (MVVNL Bareilly / DVVNL Mathura), not a live
    cross-DISCOM link.
    """
    return {
        "status_tag": "WIRED",
        "discom_ids": list(DISCOM_IDS),
        "subdivision_discom": dict(SUBDIVISION_DISCOM),
    }


__all__ = ["router"]
