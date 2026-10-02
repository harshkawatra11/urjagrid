"""4 consumer-scoped read-only tools (B11): what a household/shop's own
Urja session may look up about *their own* connection -- never another
consumer's, and never anything mutable.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from app.grid.models import MeterState
from app.services.service import GridService


def get_my_connection_status(service: GridService, consumer_id: str) -> dict[str, Any]:
    network = service.scenario.network
    consumers = network.consumers
    for i in range(len(consumers)):
        if str(consumers.consumer_ids[i]) == consumer_id:
            return {
                "consumer_id": consumer_id,
                "dt_id": str(consumers.dt_ids[i]),
                "tier": str(consumers.tier[i]),
                "meter_state": MeterState.NORMAL.value,
            }
    return {"consumer_id": consumer_id, "found": False}


def get_my_cap_status(service: GridService, consumer_id: str) -> dict[str, Any]:
    status = get_my_connection_status(service, consumer_id)
    if "dt_id" in status:
        for plan in service.plan_service.list_plans():
            level = plan.solution.cap_level_by_dt.get(status["dt_id"], 0)
            if level > 0:
                return {
                    "consumer_id": consumer_id,
                    "capped": True,
                    "plan_id": plan.id,
                    "cap_level": level,
                }
    return {"consumer_id": consumer_id, "capped": False}


def get_my_dr_history(service: GridService, consumer_id: str) -> dict[str, Any]:  # noqa: ARG001
    return {"consumer_id": consumer_id, "dr_events_participated": 0, "rebate_earned_rs": 0.0}


def get_my_messages(service: GridService, consumer_id: str) -> list[dict[str, Any]]:
    entries = service.ledger.by_correlation(consumer_id)
    return [e.to_view() for e in entries]


def build_consumer_tool_functions(
    service: GridService, consumer_id: str
) -> dict[str, Callable[..., Any]]:
    """Bind every consumer tool to one ``consumer_id`` -- an Urja session for
    consumer X can never be pointed at consumer Y's data.
    """
    return {
        "get_my_connection_status": lambda: get_my_connection_status(service, consumer_id),
        "get_my_cap_status": lambda: get_my_cap_status(service, consumer_id),
        "get_my_dr_history": lambda: get_my_dr_history(service, consumer_id),
        "get_my_messages": lambda: get_my_messages(service, consumer_id),
    }


__all__ = [
    "get_my_connection_status",
    "get_my_cap_status",
    "get_my_dr_history",
    "get_my_messages",
    "build_consumer_tool_functions",
]
