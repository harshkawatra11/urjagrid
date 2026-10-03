"""SSE event framing for ``/api/v1/stream`` (Lane B, B5).

Event types: ``tick`` (per-interval DT telemetry), ``event`` (world events --
trips, shedding, rebound), ``plan``/``plans`` (single/all Flex Plan updates),
``risk`` (a DT risk-level transition), ``kpis`` (aggregate KPIs). Kept
framework-light (plain dicts in, ``ServerSentEvent``-shaped dicts out) so it
is unit-testable without starting a real ASGI server; ``api/v1/stream.py``
wraps ``sse_events`` in an ``sse_starlette.EventSourceResponse``.

Payload shapes are camelCase and match the frontend's hand-written wire
contract in ``frontend/src/lib/live/types.ts`` exactly (``TickPayload``,
``EventStreamPayload``, ``RiskStreamPayload``, ``KpisStreamPayload``) --
*not* a raw dump of the backend's internal Pydantic models, which is what
this module did before and why the live layer's offline banner showed
"offline" even with a fully working backend: ``stream.ts`` parses specific
fields (``p.dts``, `p.simNowIso`, `p.dtId`, ...) that the old payloads never
had.
"""

from __future__ import annotations

import itertools
import json
from collections.abc import Iterator
from typing import Any

from app.services.service import GridService

SSE_EVENT_TYPES = ("tick", "event", "plan", "plans", "risk", "kpis")

# Monotonic id source for `event` frames (`EventStreamPayload.id`); unique per
# process, which is all an SSE client needs it for (de-duplication/keys).
_event_id_counter = itertools.count(1)


def make_sse_event(event_type: str, data: dict[str, Any]) -> dict[str, str]:
    if event_type not in SSE_EVENT_TYPES:
        raise ValueError(f"unknown SSE event type {event_type!r}; must be one of {SSE_EVENT_TYPES}")
    return {"event": event_type, "data": json.dumps(data, default=str)}


def _dt_telemetry(result: Any, dt_id: str) -> tuple[str, float, float, float, float]:
    """One DT's ``DtTelemetry`` tuple -- ``[dtId, loadingPu, hotspotC,
    voltagePu, servedFraction]`` (frontend/src/lib/live/types.ts) -- from a
    raw solution-track ``IntervalResult``.
    """
    demand = result.dt_demand_kw.get(dt_id, 0.0)
    served = result.dt_served_kw.get(dt_id, 0.0)
    served_fraction = served / demand if demand > 1e-9 else 1.0
    return (
        dt_id,
        result.dt_loading_pu.get(dt_id, 0.0),
        result.dt_hotspot_c.get(dt_id, 0.0),
        result.dt_voltage_pu.get(dt_id, 1.0),
        served_fraction,
    )


def _event_payload(service: GridService, message: str) -> dict[str, Any]:
    """Wrap one of the world's raw event strings (e.g. ``"dt_sn_01 thermal
    trip triggered (loading 1.32pu)"``) into an ``EventStreamPayload``.
    """
    dt_id = message.split(" ", 1)[0] if message else None
    if "thermal" in message and "trip" in message:
        kind = "trip"
    elif "shed" in message:
        kind = "shed"
    else:
        kind = "info"
    subdivision_id = None
    if dt_id is not None:
        network = service.scenario.network
        subdivision_id = network.dt_subdivision.get(dt_id)
    return {
        "id": f"evt_{next(_event_id_counter)}",
        "kind": kind,
        "subdivisionId": subdivision_id,
        "dtId": dt_id,
        "planId": None,
        "message": message,
    }


def tick_events(service: GridService) -> Iterator[dict[str, str]]:
    """Fire one real-time tick and yield every SSE event it produces."""
    fired = service.tick(real_dt_seconds=1.0)
    raw_results = service.drain_interval_results()
    for (sol_row, _shadow_row), (sol_result, _shadow_result) in zip(
        fired, raw_results, strict=True
    ):
        dts = [_dt_telemetry(sol_result, dt_id) for dt_id in sol_result.dt_demand_kw]
        yield make_sse_event(
            "tick",
            {"simNowIso": sol_row.timestamp.isoformat(), "dts": dts},
        )
    while service.events:
        yield make_sse_event("event", _event_payload(service, service.events.pop(0)))
    if fired:
        yield make_sse_event("kpis", service.live_kpis())
        for transition in service.drain_risk_transitions():
            yield make_sse_event("risk", transition)


def plans_event(service: GridService) -> dict[str, str]:
    plans = service.plan_service.list_plans()
    return make_sse_event("plans", {"plans": [p.model_dump(mode="json") for p in plans]})


__all__ = ["SSE_EVENT_TYPES", "make_sse_event", "tick_events", "plans_event"]
