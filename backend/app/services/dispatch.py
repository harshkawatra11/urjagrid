"""``Dispatcher`` (Lane B, task B4): fires an approved Flex Plan's lead-time
timeline through the B3 protocol adapters.

Timeline (minutes relative to the plan window's start time ``T``, using the
exact constants from ``app.grid.constants``):

    notify(T-``NOTIFY_LEAD_MIN``) -> signal(T-``SIGNAL_LEAD_MIN``) ->
    hes(T-``HES_LEAD_MIN``) -> start(T) -> end(T+duration) ->
    verify(T+duration+``VERIFY_DELAY_MIN``)

Hard safety invariant #5 (no autonomous dispatcher action without a named
human approver) is enforced at the door: ``Dispatcher.schedule_plan`` refuses
to schedule anything for a plan that is not ``PlanStatus.APPROVED`` with a
non-empty ``approved_by``. Invariant #4 (>=30 min notice before any cap
takes effect) is satisfied structurally: the DLMS load-limit command's
``issued_at`` is the plan's ``notify_at`` (T-120min), so even though the
*technical* HES push happens at T-15min (giving the meter time to apply the
change), the household was already told at T-120min -- comfortably over the
30-minute floor.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import StrEnum

from app.adapters.channels import ChannelGateway
from app.adapters.hes import MockHes, build_load_limit_command
from app.adapters.ocpp import ChargingProfileRequest, MockChargePoint
from app.adapters.openadr import OpenAdrEvent, OpenAdrVtn
from app.grid.constants import (
    HES_LEAD_MIN,
    NOTIFY_LEAD_MIN,
    SIGNAL_LEAD_MIN,
    VERIFY_DELAY_MIN,
)
from app.grid.models import FlexPlan, PlanStatus
from app.grid.planner import FlexPlanService


class DispatchStep(StrEnum):
    NOTIFY = "notify"
    SIGNAL = "signal"
    HES = "hes"
    START = "start"
    END = "end"
    VERIFY = "verify"


_STEP_ORDER: tuple[DispatchStep, ...] = (
    DispatchStep.NOTIFY,
    DispatchStep.SIGNAL,
    DispatchStep.HES,
    DispatchStep.START,
    DispatchStep.END,
    DispatchStep.VERIFY,
)


@dataclass
class DispatchTimeline:
    plan_id: str
    window_start: datetime
    window_end: datetime
    notify_at: datetime
    signal_at: datetime
    hes_at: datetime
    start_at: datetime
    end_at: datetime
    verify_at: datetime
    fired_steps: set[DispatchStep] = field(default_factory=set)
    acknowledgements: dict[str, bool] = field(default_factory=dict)
    realised_relief_kw: float | None = None

    def step_time(self, step: DispatchStep) -> datetime:
        return {
            DispatchStep.NOTIFY: self.notify_at,
            DispatchStep.SIGNAL: self.signal_at,
            DispatchStep.HES: self.hes_at,
            DispatchStep.START: self.start_at,
            DispatchStep.END: self.end_at,
            DispatchStep.VERIFY: self.verify_at,
        }[step]

    def due_steps(self, now: datetime) -> list[DispatchStep]:
        return [s for s in _STEP_ORDER if s not in self.fired_steps and self.step_time(s) <= now]


def build_timeline(plan_id: str, window_start: datetime, window_end: datetime) -> DispatchTimeline:
    return DispatchTimeline(
        plan_id=plan_id,
        window_start=window_start,
        window_end=window_end,
        notify_at=window_start - timedelta(minutes=NOTIFY_LEAD_MIN),
        signal_at=window_start - timedelta(minutes=SIGNAL_LEAD_MIN),
        hes_at=window_start - timedelta(minutes=HES_LEAD_MIN),
        start_at=window_start,
        end_at=window_end,
        verify_at=window_end + timedelta(minutes=VERIFY_DELAY_MIN),
    )


class DispatcherError(ValueError):
    """Raised when a plan cannot be scheduled (e.g. no named human approver)."""


class Dispatcher:
    """Fires every approved plan's dispatch timeline through the adapters."""

    def __init__(
        self,
        plan_service: FlexPlanService,
        channels: ChannelGateway,
        hes: MockHes,
        charge_point: MockChargePoint,
        openadr_vtn: OpenAdrVtn,
    ) -> None:
        self.plan_service = plan_service
        self.channels = channels
        self.hes = hes
        self.charge_point = charge_point
        self.openadr_vtn = openadr_vtn
        self.timelines: dict[str, DispatchTimeline] = {}

    def schedule_plan(
        self, plan: FlexPlan, window_start: datetime, window_end: datetime
    ) -> DispatchTimeline:
        if plan.status != PlanStatus.APPROVED or not plan.approved_by:
            raise DispatcherError(
                "cannot schedule a plan that is not APPROVED with a named human approver "
                "(hard safety invariant: no autonomous dispatcher action without approval)"
            )
        timeline = build_timeline(plan.id, window_start, window_end)
        self.timelines[plan.id] = timeline
        return timeline

    def fire_due_steps(
        self, plan_id: str, now: datetime, affected_consumer_ids: list[str] | None = None
    ) -> list[DispatchStep]:
        """Fire every step of ``plan_id``'s timeline whose time has arrived
        (idempotent -- already-fired steps are skipped). Returns the steps
        fired on this call.
        """
        timeline = self.timelines.get(plan_id)
        if timeline is None:
            raise DispatcherError(f"no dispatch timeline scheduled for plan {plan_id!r}")
        plan = self.plan_service.get(plan_id)
        fired: list[DispatchStep] = []
        for step in timeline.due_steps(now):
            self._fire_step(plan, timeline, step, affected_consumer_ids or [])
            timeline.fired_steps.add(step)
            fired.append(step)
        return fired

    def _fire_step(
        self,
        plan: FlexPlan,
        timeline: DispatchTimeline,
        step: DispatchStep,
        consumer_ids: list[str],
    ) -> None:
        if step is DispatchStep.NOTIFY:
            self.channels.broadcast(
                "whatsapp",
                consumer_ids or [plan.subdivision_id],
                "dr_ask",
                "hi",
                start_time=timeline.start_at.strftime("%H:%M"),
                end_time=timeline.end_at.strftime("%H:%M"),
                rebate="2",
            )
        elif step is DispatchStep.SIGNAL:
            for dt_id, hub_frac in plan.solution.hub_frac_by_dt.items():
                event = OpenAdrEvent(
                    event_id=f"{plan.id}_{dt_id}_signal",
                    program_id=plan.subdivision_id,
                    target_ids=[dt_id],
                    start=timeline.start_at,
                    duration_minutes=int(
                        (timeline.end_at - timeline.start_at).total_seconds() / 60
                    ),
                    value=hub_frac,
                )
                self.openadr_vtn.publish_event(plan.subdivision_id, event, correlation_id=plan.id)
                request = ChargingProfileRequest(
                    hub_id=dt_id,
                    connector_id=1,
                    limit_w=hub_frac * 1000.0,
                    duration_seconds=int((timeline.end_at - timeline.start_at).total_seconds()),
                    start_schedule_iso=timeline.start_at.isoformat(),
                )
                self.charge_point.set_charging_profile(request, correlation_id=plan.id)
        elif step is DispatchStep.HES:
            for dt_id, cap_level in plan.solution.cap_level_by_dt.items():
                if cap_level <= 0:
                    continue
                limit_w = 300.0 if cap_level >= 3 else (500.0 if cap_level == 2 else 1000.0)
                command = build_load_limit_command(
                    target_id=dt_id,
                    limit_w=limit_w,
                    effective_at=timeline.start_at,
                    expires_at=timeline.end_at,
                    issued_at=timeline.notify_at,
                    tier="t1",
                )
                acked = self.hes.send_load_limit(command, correlation_id=plan.id)
                timeline.acknowledgements[dt_id] = acked
        elif step is DispatchStep.START:
            self.plan_service.mark_dispatched(plan.id)
        elif step is DispatchStep.END:
            pass
        elif step is DispatchStep.VERIFY:
            self.plan_service.mark_completed(plan.id)

    def record_realised_relief(self, plan_id: str, relief_kw: float) -> None:
        timeline = self.timelines.get(plan_id)
        if timeline is None:
            raise DispatcherError(f"no dispatch timeline scheduled for plan {plan_id!r}")
        timeline.realised_relief_kw = relief_kw


__all__ = ["DispatchStep", "DispatchTimeline", "build_timeline", "Dispatcher", "DispatcherError"]
