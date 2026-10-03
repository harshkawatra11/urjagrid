import json

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


def test_tick_events_yields_tick_kpis_on_boundary() -> None:
    service = GridService(seed=1, time_scale=60)
    service.boot()
    # Force the accumulator past one interval directly.
    service.state.sim_seconds_accumulated = 900.0
    events = list(tick_events(service))
    types = [e["event"] for e in events]
    assert "tick" in types
    assert "kpis" in types


def test_tick_event_payload_matches_frontend_dt_telemetry_tuple_contract() -> None:
    """frontend/src/lib/live/types.ts: TickPayload = {simNowIso, dts}, each dt
    a 5-tuple [dtId, loadingPu, hotspotC, voltagePu, servedFraction].
    """
    service = GridService(seed=1, time_scale=60)
    service.boot()
    service.state.sim_seconds_accumulated = 900.0
    events = list(tick_events(service))
    tick = next(e for e in events if e["event"] == "tick")
    payload = json.loads(tick["data"])
    assert set(payload.keys()) == {"simNowIso", "dts"}
    assert isinstance(payload["simNowIso"], str)
    assert payload["dts"], "expected at least one DT's telemetry tuple"
    dt_ids = {d.dt_id for d in service.dt_statics}
    for dt in payload["dts"]:
        assert len(dt) == 5
        dt_id, loading_pu, hotspot_c, voltage_pu, served_fraction = dt
        assert dt_id in dt_ids
        assert isinstance(loading_pu, (int, float))
        assert isinstance(hotspot_c, (int, float))
        assert isinstance(voltage_pu, (int, float))
        assert isinstance(served_fraction, (int, float))


def test_event_payload_matches_frontend_event_stream_payload_contract() -> None:
    """frontend/src/lib/live/types.ts: EventStreamPayload = {id, kind,
    subdivisionId, dtId, planId, message}.
    """
    service = GridService(seed=1, time_scale=60)
    service.boot()
    # Force a deterministic world event rather than relying on a real deficit
    # to trip/shed within one interval (the `while service.events:` drain in
    # `tick_events` runs regardless of whether an interval actually fired).
    dt_id = service.dt_statics[0].dt_id
    service.events.append(f"{dt_id} thermal trip triggered (loading 1.32pu)")
    events = list(tick_events(service))
    event_frames = [e for e in events if e["event"] == "event"]
    assert event_frames, "expected the forced world event to come through as an `event` frame"
    for frame in event_frames:
        payload = json.loads(frame["data"])
        assert set(payload.keys()) == {"id", "kind", "subdivisionId", "dtId", "planId", "message"}
        assert isinstance(payload["id"], str) and payload["id"]
        assert isinstance(payload["message"], str) and payload["message"]
        assert payload["dtId"] == dt_id
        assert payload["kind"] == "trip"
        assert payload["subdivisionId"] == service.dt_statics[0].subdivision_id


def test_kpis_event_payload_matches_frontend_kpis_stream_payload_contract() -> None:
    """frontend/src/lib/live/types.ts: KpisStreamPayload = {subdivisionId,
    servedFraction, activePlanCount, dtAtRiskCount}.
    """
    service = GridService(seed=1, time_scale=60)
    service.boot()
    service.state.sim_seconds_accumulated = 900.0
    events = list(tick_events(service))
    kpis_frame = next(e for e in events if e["event"] == "kpis")
    payload = json.loads(kpis_frame["data"])
    assert set(payload.keys()) == {
        "subdivisionId",
        "servedFraction",
        "activePlanCount",
        "dtAtRiskCount",
    }
    assert payload["subdivisionId"] == "all"
    assert isinstance(payload["servedFraction"], (int, float))
    assert isinstance(payload["activePlanCount"], int)
    assert isinstance(payload["dtAtRiskCount"], int)


def test_risk_event_payload_matches_frontend_risk_stream_payload_contract() -> None:
    """frontend/src/lib/live/types.ts: RiskStreamPayload = {dtId,
    subdivisionId, from, to, reason} -- a level *transition*, not a ranking.
    """
    service = GridService(seed=1, time_scale=60)
    service.boot()
    # Prime `_prev_risk_levels` with a first observation, then force a drop
    # in cumulative loss-of-life so at least one DT's bucket changes.
    service.state.sim_seconds_accumulated = 900.0
    list(tick_events(service))
    for dt_id in service.world.solution.cumulative_loss_of_life_hours:
        service.world.solution.cumulative_loss_of_life_hours[dt_id] = 1000.0
    service.state.sim_seconds_accumulated = 900.0
    events = list(tick_events(service))
    risk_frames = [e for e in events if e["event"] == "risk"]
    assert risk_frames, "expected at least one risk-level transition"
    for frame in risk_frames:
        payload = json.loads(frame["data"])
        assert set(payload.keys()) == {"dtId", "subdivisionId", "from", "to", "reason"}
        assert payload["from"] != payload["to"]


def test_plans_event_lists_current_plans() -> None:
    service = GridService(seed=1)
    service.boot()
    event = plans_event(service)
    assert event["event"] == "plans"
    assert "plans" in event["data"]


def test_all_sse_event_types_documented() -> None:
    assert set(SSE_EVENT_TYPES) == {"tick", "event", "plan", "plans", "risk", "kpis"}
