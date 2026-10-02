"""SSE event framing for ``/api/v1/stream`` (Lane B, B5).

Event types: ``tick`` (per-interval log rows), ``event`` (world events -- trips,
shedding, rebound), ``plan``/``plans`` (single/all Flex Plan updates), ``risk``
(DT risk ranking), ``kpis`` (aggregate KPIs). Kept framework-light (plain
dicts in, ``ServerSentEvent``-shaped dicts out) so it is unit-testable
without starting a real ASGI server; ``api/v1/stream.py`` wraps
``sse_events`` in an ``sse_starlette.EventSourceResponse``.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any

from app.services.service import GridService

SSE_EVENT_TYPES = ("tick", "event", "plan", "plans", "risk", "kpis")


def make_sse_event(event_type: str, data: dict[str, Any]) -> dict[str, str]:
    if event_type not in SSE_EVENT_TYPES:
        raise ValueError(f"unknown SSE event type {event_type!r}; must be one of {SSE_EVENT_TYPES}")
    return {"event": event_type, "data": json.dumps(data, default=str)}


def tick_events(service: GridService) -> Iterator[dict[str, str]]:
    """Fire one real-time tick and yield every SSE event it produces."""
    fired = service.tick(real_dt_seconds=1.0)
    for sol_row, shadow_row in fired:
        yield make_sse_event(
            "tick",
            {
                "slot": sol_row.slot,
                "solution": sol_row.model_dump(mode="json"),
                "shadow": shadow_row.model_dump(mode="json"),
            },
        )
    while service.events:
        yield make_sse_event("event", {"message": service.events.pop(0)})
    if fired:
        yield make_sse_event("kpis", service.kpis())
        yield make_sse_event("risk", {"ranking": service.risk_summary()})


def plans_event(service: GridService) -> dict[str, str]:
    plans = service.plan_service.list_plans()
    return make_sse_event("plans", {"plans": [p.model_dump(mode="json") for p in plans]})


__all__ = ["SSE_EVENT_TYPES", "make_sse_event", "tick_events", "plans_event"]
