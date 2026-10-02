import pytest

from app.services.service import GridService
from app.services.stream import SSE_EVENT_TYPES, make_sse_event, plans_event, tick_events


def test_make_sse_event_rejects_unknown_type() -> None:
    with pytest.raises(ValueError):
        make_sse_event("not_a_real_type", {})


def test_make_sse_event_serialises_payload() -> None:
    event = make_sse_event("kpis", {"a": 1})
    assert event["event"] == "kpis"
    assert '"a": 1' in event["data"]


def test_tick_events_yields_nothing_before_interval_boundary() -> None:
    service = GridService(seed=1, time_scale=60)
    service.boot()
    events = list(tick_events(service))
    assert events == []


def test_tick_events_yields_tick_kpis_risk_on_boundary() -> None:
    service = GridService(seed=1, time_scale=60)
    service.boot()
    # Force the accumulator past one interval directly.
    service.state.sim_seconds_accumulated = 900.0
    events = list(tick_events(service))
    types = [e["event"] for e in events]
    assert "tick" in types
    assert "kpis" in types
    assert "risk" in types


def test_plans_event_lists_current_plans() -> None:
    service = GridService(seed=1)
    service.boot()
    event = plans_event(service)
    assert event["event"] == "plans"
    assert "plans" in event["data"]


def test_all_sse_event_types_documented() -> None:
    assert set(SSE_EVENT_TYPES) == {"tick", "event", "plan", "plans", "risk", "kpis"}
