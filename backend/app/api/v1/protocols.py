"""``/api/v1/protocols`` -- protocol ledger + federation overview (B9)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.adapters.ledger import PROTOCOL_NAMES
from app.grid.constants import DISCOM_IDS, SUBDIVISION_DISCOM
from app.grid.views import protocol_ledger_view
from app.services.deps import get_grid_service
from app.services.service import GridService

router = APIRouter(prefix="/api/v1", tags=["protocols"])

_WIRE_PROTOCOL_NAMES = ["hes" if p == "dlms_hes" else p for p in PROTOCOL_NAMES]


@router.get("/protocols")
async def list_protocol_traffic(
    protocol: str | None = None, service: GridService = Depends(get_grid_service)
) -> dict:
    entries = service.ledger.by_protocol(protocol) if protocol else service.ledger.all()
    counts = service.ledger.counts_by_protocol()
    wire_counts = {("hes" if k == "dlms_hes" else k): v for k, v in counts.items()}
    return {
        "protocolNames": _WIRE_PROTOCOL_NAMES,
        "counts": wire_counts,
        "entries": [{**e, "protocol": e["wireProtocol"]} for e in protocol_ledger_view(entries)],
    }


@router.get("/federation")
async def federation_overview(service: GridService = Depends(get_grid_service)) -> dict:
    """Real per-DISCOM rollup of the network (sub-division/consumer counts)
    plus the single-process simulator's current reliability/fairness/active-
    plan numbers, applied to both nodes.

    WIRED, not LIVE: this prototype runs one logical ``GridWorld`` for the
    whole scenario, not two independently-metered DISCOM deployments, so
    the reliability/flexibility/fairness indices are the same simulator-wide
    value on both nodes rather than genuinely DISCOM-split telemetry -- the
    real multi-DISCOM deployment (MVVNL Bareilly / DVVNL Mathura) this
    describes is PILOT.
    """
    network = service.scenario.network
    subdivision_count: dict[str, int] = {}
    for sub_id in network.subdivision_ids:
        discom = SUBDIVISION_DISCOM.get(sub_id, DISCOM_IDS[0])
        subdivision_count[discom] = subdivision_count.get(discom, 0) + 1

    consumer_count: dict[str, int] = {}
    consumers = getattr(network, "consumers", None)
    if consumers is not None:
        for i in range(len(consumers)):
            sub_id = str(consumers.subdivision_ids[i])
            discom = SUBDIVISION_DISCOM.get(sub_id, DISCOM_IDS[0])
            consumer_count[discom] = consumer_count.get(discom, 0) + 1

    kpis = service.kpis()
    reliability_index = round(
        1.0 - min(float(kpis.get("solution_hours_of_hardship", 0.0)) / 24.0, 1.0), 4
    )
    fairness_index = round(float(kpis.get("fairness_jain_index", 1.0)), 4)
    flexibility_index = round(
        min(len(service.plan_service.list_plans()) / 10.0, 1.0), 4
    )

    nodes = [
        {
            "discom": "MVVNL" if discom.startswith("mvvnl") else "DVVNL",
            "town": "Bareilly" if discom.startswith("mvvnl") else "Mathura",
            "subdivisionCount": subdivision_count.get(discom, 0),
            "consumerCount": consumer_count.get(discom, 0),
            "reliabilityIndex": reliability_index,
            "flexibilityIndex": flexibility_index,
            "fairnessIndex": fairness_index,
        }
        for discom in DISCOM_IDS
    ]
    return {"nodes": nodes}


__all__ = ["router"]
