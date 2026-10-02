from datetime import UTC, datetime, timedelta

import pytest

from app.adapters.beckn import BecknGateway, TradeConfirmRequest
from app.adapters.channels import CHANNEL_NAMES, TEMPLATES, ChannelGateway, MockTransport
from app.adapters.hes import LoadLimitError, MockHes, build_load_limit_command
from app.adapters.ledger import PROTOCOL_NAMES, MessageDirection, ProtocolLedger
from app.adapters.ocpp import ChargingProfileRequest, MockChargePoint, validate_set_charging_profile
from app.adapters.openadr import MockVen, OpenAdrEvent, OpenAdrVtn


def test_protocol_names_has_exactly_seven_wired_protocols() -> None:
    assert len(PROTOCOL_NAMES) == 7


def test_ledger_rejects_unknown_protocol() -> None:
    ledger = ProtocolLedger()
    with pytest.raises(ValueError):
        ledger.record("carrier_pigeon", MessageDirection.OUTBOUND, {})


def test_ledger_records_and_tags_wired() -> None:
    ledger = ProtocolLedger()
    entry = ledger.record("ocpp", MessageDirection.OUTBOUND, {"x": 1})
    assert entry.to_view()["status_tag"] == "WIRED"
    assert ledger.by_protocol("ocpp") == [entry]


def test_ledger_counts_by_protocol() -> None:
    ledger = ProtocolLedger()
    ledger.record("sms", MessageDirection.OUTBOUND, {})
    ledger.record("sms", MessageDirection.OUTBOUND, {})
    counts = ledger.counts_by_protocol()
    assert counts["sms"] == 2
    assert counts["ocpp"] == 0


# -- HES / DLMS -------------------------------------------------------------


def test_load_limit_command_requires_min_notice() -> None:
    issued = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    with pytest.raises(LoadLimitError):
        build_load_limit_command(
            "dt_sn_01", 300.0, issued + timedelta(minutes=10), issued + timedelta(hours=2), issued
        )


def test_load_limit_command_rejects_below_lifeline_floor() -> None:
    issued = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    with pytest.raises(LoadLimitError):
        build_load_limit_command(
            "c_sn_01_0007",
            100.0,
            issued + timedelta(minutes=45),
            issued + timedelta(hours=2),
            issued,
            tier="t1",
        )


def test_load_limit_command_rejects_t0() -> None:
    issued = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    with pytest.raises(LoadLimitError):
        build_load_limit_command(
            "c_sn_01_0001",
            300.0,
            issued + timedelta(minutes=45),
            issued + timedelta(hours=2),
            issued,
            tier="t0",
        )


def test_load_limit_command_requires_expiry_after_effective() -> None:
    issued = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    with pytest.raises(LoadLimitError):
        build_load_limit_command(
            "c_sn_01_0007",
            300.0,
            issued + timedelta(minutes=45),
            issued + timedelta(minutes=40),
            issued,
            tier="t1",
        )


def test_load_limit_command_valid_builds_dlms_payload() -> None:
    issued = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    cmd = build_load_limit_command(
        "c_sn_01_0007",
        300.0,
        issued + timedelta(minutes=45),
        issued + timedelta(hours=2),
        issued,
        tier="t1",
    )
    payload = cmd.to_dlms_payload()
    assert payload["class_id"] == 71
    assert payload["attributes"]["normal_value_w"] == 300.0
    assert "expires_at" in payload["attributes"]


def test_mock_hes_sends_and_acks() -> None:
    ledger = ProtocolLedger()
    hes = MockHes(ledger, ack_probability=1.0)
    issued = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    cmd = build_load_limit_command(
        "c_sn_01_0007",
        300.0,
        issued + timedelta(minutes=45),
        issued + timedelta(hours=2),
        issued,
        tier="t1",
    )
    acked = hes.send_load_limit(cmd, correlation_id="corr_1")
    assert acked is True
    assert len(ledger.by_correlation("corr_1")) == 2


def test_mock_hes_can_fail_ack() -> None:
    ledger = ProtocolLedger()
    hes = MockHes(ledger, ack_probability=0.0)
    issued = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    cmd = build_load_limit_command(
        "c_sn_01_0007",
        300.0,
        issued + timedelta(minutes=45),
        issued + timedelta(hours=2),
        issued,
        tier="t1",
    )
    assert hes.send_load_limit(cmd, correlation_id="corr_2") is False


# -- OCPP --------------------------------------------------------------------


def test_ocpp_payload_validates_against_schema() -> None:
    request = ChargingProfileRequest(
        hub_id="hub_sn_01",
        connector_id=1,
        limit_w=1500.0,
        duration_seconds=3600,
        start_schedule_iso="2026-01-01T18:00:00Z",
    )
    payload = request.to_ocpp_payload()
    validate_set_charging_profile(payload)  # should not raise


def test_ocpp_rejects_malformed_payload() -> None:
    import jsonschema

    with pytest.raises(jsonschema.ValidationError):
        validate_set_charging_profile({"connectorId": "not-an-int"})


def test_mock_charge_point_sets_profile_and_acks() -> None:
    ledger = ProtocolLedger()
    cp = MockChargePoint(ledger)
    request = ChargingProfileRequest(
        hub_id="hub_sn_01",
        connector_id=1,
        limit_w=1500.0,
        duration_seconds=3600,
        start_schedule_iso="2026-01-01T18:00:00Z",
    )
    assert cp.set_charging_profile(request, correlation_id="corr_3") is True
    assert "hub_sn_01" in cp.active_profiles
    assert len(ledger.by_protocol("ocpp")) == 2


# -- OpenADR ------------------------------------------------------------------


def test_openadr_ven_polls_and_pauses() -> None:
    ledger = ProtocolLedger()
    vtn = OpenAdrVtn(ledger)
    ven = MockVen(vtn, target_id="pump_sn_01")
    event = OpenAdrEvent(
        event_id="evt_1",
        program_id="prog_1",
        target_ids=["pump_sn_01"],
        start=datetime(2026, 1, 1, 13, 0, tzinfo=UTC),
        duration_minutes=60,
        value=0.0,
    )
    vtn.publish_event("prog_1", event, correlation_id="corr_4")
    assert ven.poll("prog_1") is True


def test_openadr_ven_not_targeted_stays_unpaused() -> None:
    ledger = ProtocolLedger()
    vtn = OpenAdrVtn(ledger)
    ven = MockVen(vtn, target_id="pump_other")
    event = OpenAdrEvent(
        event_id="evt_2",
        program_id="prog_1",
        target_ids=["pump_sn_01"],
        start=datetime(2026, 1, 1, 13, 0, tzinfo=UTC),
        duration_minutes=60,
        value=0.0,
    )
    vtn.publish_event("prog_1", event, correlation_id="corr_5")
    assert ven.poll("prog_1") is False


# -- Beckn --------------------------------------------------------------------


def test_beckn_confirm_trade_logs_both_legs() -> None:
    ledger = ProtocolLedger()
    gateway = BecknGateway(ledger)
    request = TradeConfirmRequest(
        seller_asset_id="battery_sn_01", buyer_dt_id="dt_sn_01", energy_kwh=5.0
    )
    on_confirm = gateway.confirm_trade(request)
    assert on_confirm["message"]["order"]["state"] == "Completed"
    assert len(ledger.by_protocol("beckn")) == 2


def test_beckn_trade_total_uses_p2p_rate() -> None:
    request = TradeConfirmRequest(
        seller_asset_id="battery_sn_01", buyer_dt_id="dt_sn_01", energy_kwh=10.0
    )
    assert request.total_rs == pytest.approx(4.2, abs=1e-6)


# -- Channels -----------------------------------------------------------------


def test_channel_names_match_spec() -> None:
    assert CHANNEL_NAMES == ("whatsapp", "ivr", "sms")


def test_templates_are_bilingual() -> None:
    for name, variants in TEMPLATES.items():
        assert "hi" in variants, name
        assert "en" in variants, name


def test_channel_gateway_send_one_renders_and_logs() -> None:
    ledger = ProtocolLedger()
    gateway = ChannelGateway(ledger, transport=MockTransport())
    ok = gateway.send_one(
        "whatsapp",
        "c_sn_01_0007",
        "dr_ask",
        "hi",
        start_time="19:00",
        end_time="21:00",
        rebate="2",
    )
    assert ok is True
    entries = ledger.by_protocol("whatsapp")
    assert len(entries) == 1
    assert "LifelineGrid" in entries[0].payload["text"]


def test_channel_gateway_rejects_unknown_channel() -> None:
    ledger = ProtocolLedger()
    gateway = ChannelGateway(ledger)
    with pytest.raises(ValueError):
        gateway.send_one("telegram", "x", "dr_ask", "hi", start_time="1", end_time="2", rebate="2")


def test_channel_gateway_broadcast_sends_to_all() -> None:
    ledger = ProtocolLedger()
    gateway = ChannelGateway(ledger)
    results = gateway.broadcast(
        "sms",
        ["c_1", "c_2", "c_3"],
        "outage_notice",
        "en",
        start_time="20:00",
        end_time="22:00",
    )
    assert all(results.values())
    assert len(ledger.by_protocol("sms")) == 3


def test_channel_gateway_reply_logged_inbound() -> None:
    ledger = ProtocolLedger()
    gateway = ChannelGateway(ledger)
    gateway.reply("ivr", "c_sn_01_0007", "haan, theek hai")
    entries = ledger.by_protocol("ivr")
    assert entries[0].direction == MessageDirection.INBOUND
