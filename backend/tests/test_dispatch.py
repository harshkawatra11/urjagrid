from datetime import UTC, datetime, timedelta

import numpy as np
import pytest

from app.adapters.channels import ChannelGateway
from app.adapters.hes import MockHes
from app.adapters.ledger import ProtocolLedger
from app.adapters.ocpp import MockChargePoint
from app.adapters.openadr import OpenAdrVtn
from app.grid.constants import (
    HES_LEAD_MIN,
    NOTICE_MIN_CAPS,
    NOTIFY_LEAD_MIN,
    SIGNAL_LEAD_MIN,
    VERIFY_DELAY_MIN,
)
from app.grid.planner import FlexPlanService
from app.services.dispatch import Dispatcher, DispatcherError, DispatchStep, build_timeline


def _make_dispatcher() -> tuple[Dispatcher, FlexPlanService]:
    ledger = ProtocolLedger()
    plan_service = FlexPlanService()
    dispatcher = Dispatcher(
        plan_service=plan_service,
        channels=ChannelGateway(ledger),
        hes=MockHes(ledger, ack_probability=1.0),
        charge_point=MockChargePoint(ledger),
        openadr_vtn=OpenAdrVtn(ledger),
    )
    return dispatcher, plan_service


def _approved_plan(plan_service: FlexPlanService):
    gap_series = {"dt_a": np.array([0.0, 20.0, 20.0, 20.0, 0.0])}
    plans = plan_service.refresh_from_series(
        subdivision_id="sd_subhashnagar",
        dt_ids=["dt_a"],
        gap_kw_series=gap_series,
        dt_limit_kw={"dt_a": 100.0},
        dr_potential_kw={"dt_a": 2.0},
        hub_potential_kw={"dt_a": 3.0},
        storage_energy_kwh={"dt_a": 5.0},
        shift_potential_kw={"dt_a": 1.0},
    )
    plan = plans[0]
    return plan_service.approve(plan.id, "je_rakesh_kumar")


def test_build_timeline_uses_exact_spec_constants() -> None:
    start = datetime(2026, 1, 1, 19, 0, tzinfo=UTC)
    end = start + timedelta(hours=1)
    timeline = build_timeline("fp_abc", start, end)
    assert timeline.notify_at == start - timedelta(minutes=NOTIFY_LEAD_MIN)
    assert timeline.signal_at == start - timedelta(minutes=SIGNAL_LEAD_MIN)
    assert timeline.hes_at == start - timedelta(minutes=HES_LEAD_MIN)
    assert timeline.start_at == start
    assert timeline.end_at == end
    assert timeline.verify_at == end + timedelta(minutes=VERIFY_DELAY_MIN)


def test_notify_to_start_notice_exceeds_minimum_cap_notice() -> None:
    start = datetime(2026, 1, 1, 19, 0, tzinfo=UTC)
    timeline = build_timeline("fp_abc", start, start + timedelta(hours=1))
    notice_minutes = (timeline.start_at - timeline.notify_at).total_seconds() / 60
    assert notice_minutes >= NOTICE_MIN_CAPS


def test_cannot_schedule_unapproved_plan() -> None:
    dispatcher, plan_service = _make_dispatcher()
    gap_series = {"dt_a": np.array([0.0, 20.0, 20.0, 20.0, 0.0])}
    plans = plan_service.refresh_from_series(
        subdivision_id="sd_subhashnagar",
        dt_ids=["dt_a"],
        gap_kw_series=gap_series,
        dt_limit_kw={"dt_a": 100.0},
        dr_potential_kw={"dt_a": 2.0},
        hub_potential_kw={"dt_a": 3.0},
        storage_energy_kwh={"dt_a": 5.0},
        shift_potential_kw={"dt_a": 1.0},
    )
    start = datetime(2026, 1, 1, 19, 0, tzinfo=UTC)
    with pytest.raises(DispatcherError):
        dispatcher.schedule_plan(plans[0], start, start + timedelta(hours=1))


def test_schedule_and_fire_full_timeline_in_order() -> None:
    dispatcher, plan_service = _make_dispatcher()
    plan = _approved_plan(plan_service)
    start = datetime(2026, 1, 1, 19, 0, tzinfo=UTC)
    end = start + timedelta(hours=1)
    dispatcher.schedule_plan(plan, start, end)

    all_fired: list[DispatchStep] = []
    now = start - timedelta(hours=3)
    for _ in range(8):
        fired = dispatcher.fire_due_steps(plan.id, now, affected_consumer_ids=["c_sn_01_0007"])
        all_fired.extend(fired)
        now += timedelta(minutes=45)

    assert all_fired == [
        DispatchStep.NOTIFY,
        DispatchStep.SIGNAL,
        DispatchStep.HES,
        DispatchStep.START,
        DispatchStep.END,
        DispatchStep.VERIFY,
    ]
    assert plan_service.get(plan.id).status.value == "completed"


def test_fire_due_steps_is_idempotent() -> None:
    dispatcher, plan_service = _make_dispatcher()
    plan = _approved_plan(plan_service)
    start = datetime(2026, 1, 1, 19, 0, tzinfo=UTC)
    dispatcher.schedule_plan(plan, start, start + timedelta(hours=1))
    far_future = start + timedelta(days=1)
    first = dispatcher.fire_due_steps(plan.id, far_future)
    second = dispatcher.fire_due_steps(plan.id, far_future)
    assert len(first) == 6
    assert second == []


def test_fire_due_steps_unknown_plan_raises() -> None:
    dispatcher, _ = _make_dispatcher()
    with pytest.raises(DispatcherError):
        dispatcher.fire_due_steps("fp_missing", datetime.now(UTC))


def test_hes_step_records_acknowledgements_for_capped_dts() -> None:
    dispatcher, plan_service = _make_dispatcher()
    plan = _approved_plan(plan_service)
    start = datetime(2026, 1, 1, 19, 0, tzinfo=UTC)
    dispatcher.schedule_plan(plan, start, start + timedelta(hours=1))
    dispatcher.fire_due_steps(plan.id, start)  # fires notify/signal/hes/start
    timeline = dispatcher.timelines[plan.id]
    if any(level > 0 for level in plan.solution.cap_level_by_dt.values()):
        assert timeline.acknowledgements


def test_record_realised_relief() -> None:
    dispatcher, plan_service = _make_dispatcher()
    plan = _approved_plan(plan_service)
    start = datetime(2026, 1, 1, 19, 0, tzinfo=UTC)
    dispatcher.schedule_plan(plan, start, start + timedelta(hours=1))
    dispatcher.record_realised_relief(plan.id, 12.5)
    assert dispatcher.timelines[plan.id].realised_relief_kw == 12.5
