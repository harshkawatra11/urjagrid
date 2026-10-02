import json

from app.adapters.ledger import MessageDirection, ProtocolLedger
from app.grid.network import synthetic_network
from app.grid.planner import FlexPlanService
from app.grid.risk import compute_dt_risk
from app.grid.views import (
    consumers_sample_view,
    critical_facilities_view,
    feeders_view,
    geo_view,
    plan_view,
    plans_view,
    protocol_ledger_view,
    risk_view,
    subdivisions_view,
    transformer_detail_view,
    transformers_view,
)


def _net():
    return synthetic_network(seed=1)


def _assert_json_serialisable(obj) -> None:
    json.dumps(obj)  # raises if numpy/datetime leaks through


def test_subdivisions_view_is_json_ready() -> None:
    rows = subdivisions_view(_net())
    _assert_json_serialisable(rows)
    assert all(
        {"id", "discom_id", "feeder_count", "transformer_count"} <= row.keys() for row in rows
    )


def test_feeders_view_filters_by_subdivision() -> None:
    net = _net()
    all_rows = feeders_view(net)
    filtered = feeders_view(net, subdivision_id=net.subdivision_ids[0])
    assert len(filtered) <= len(all_rows)
    assert all(r["subdivision_id"] == net.subdivision_ids[0] for r in filtered)


def test_transformers_view_includes_live_telemetry_when_given() -> None:
    net = _net()
    dt_id = net.dt_ids[0]
    rows = transformers_view(net, live_loading_pu={dt_id: 0.87}, live_hotspot_c={dt_id: 95.0})
    row = next(r for r in rows if r["id"] == dt_id)
    assert row["loading_pu"] == 0.87
    assert row["hotspot_c"] == 95.0
    _assert_json_serialisable(rows)


def test_transformer_detail_view_returns_none_for_missing() -> None:
    net = _net()
    assert transformer_detail_view(net, "dt_does_not_exist") is None
    assert transformer_detail_view(net, net.dt_ids[0]) is not None


def test_geo_view_has_point_geometry_only() -> None:
    net = _net()
    geo = geo_view(net)
    _assert_json_serialisable(geo)
    assert len(geo["transformers"]) == len(net.dt_ids)


def test_risk_view_is_json_ready() -> None:
    risk = compute_dt_risk(
        "dt_a", hot_spot_c=100.0, forecast_gap_kw=5.0, dt_limit_kw=50.0, ageing_factor=1.0
    )
    rows = risk_view([risk])
    _assert_json_serialisable(rows)
    assert rows[0]["dt_id"] == "dt_a"


def test_plan_view_has_no_raw_datetime() -> None:
    service = FlexPlanService()
    import numpy as np

    plans = service.refresh_from_series(
        subdivision_id="sd_subhashnagar",
        dt_ids=["dt_a"],
        gap_kw_series={"dt_a": np.array([0.0, 10.0, 10.0, 0.0])},
        dt_limit_kw={"dt_a": 100.0},
        dr_potential_kw={"dt_a": 1.0},
        hub_potential_kw={"dt_a": 1.0},
        storage_energy_kwh={"dt_a": 1.0},
        shift_potential_kw={"dt_a": 1.0},
    )
    view = plan_view(plans[0])
    _assert_json_serialisable(view)
    assert isinstance(view["created_at"], str)


def test_plans_view_is_a_list_of_plan_views() -> None:
    service = FlexPlanService()
    import numpy as np

    plans = service.refresh_from_series(
        subdivision_id="sd_subhashnagar",
        dt_ids=["dt_a"],
        gap_kw_series={"dt_a": np.array([0.0, 10.0, 10.0, 0.0])},
        dt_limit_kw={"dt_a": 100.0},
        dr_potential_kw={"dt_a": 1.0},
        hub_potential_kw={"dt_a": 1.0},
        storage_energy_kwh={"dt_a": 1.0},
        shift_potential_kw={"dt_a": 1.0},
    )
    views = plans_view(plans)
    assert len(views) == 1


def test_protocol_ledger_view_tags_wired() -> None:
    ledger = ProtocolLedger()
    ledger.record("sms", MessageDirection.OUTBOUND, {"x": 1})
    rows = protocol_ledger_view(ledger.all())
    assert rows[0]["status_tag"] == "WIRED"
    _assert_json_serialisable(rows)


def test_consumers_sample_view_respects_limit_and_scope() -> None:
    net = _net()
    rows = consumers_sample_view(net, limit=5)
    assert len(rows) <= 5
    _assert_json_serialisable(rows)
    sub_id = net.subdivision_ids[0]
    scoped = consumers_sample_view(net, subdivision_id=sub_id, limit=1000)
    assert all(r["subdivision_id"] == sub_id for r in scoped)


def test_critical_facilities_view_only_returns_t0() -> None:
    net = _net()
    rows = critical_facilities_view(net)
    assert all(r["tier"] == "t0" for r in rows)
