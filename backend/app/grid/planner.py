"""``ForecastBundle`` builder + ``FlexPlanService`` plan state machine
(Lane B, task B2).

``build_forecast_bundle`` reconciles Lane A's bottom-up per-consumer demand
(``loadgen.LoadModel``) against the top-down per-DT quantile forecast
(``forecaster.QuantileForecaster``) using the standard top-down/bottom-up
reconciliation trick: scale the (more granular, but noisier in aggregate)
bottom-up curve per slot so its *total* matches the (less granular, but
calibrated) top-down P50 total, then carries the top-down P10/P90 band
through unscaled (the band width is a property of the top-down model's
calibration, not of the bottom-up shape).

``FlexPlanService`` owns the ``FlexPlan`` state machine described in
docs/SPEC.md B2: ``refresh`` builds draft plans from deficit windows (lever 1
behavioural DR is applied first as a flat accepted-population discount, then
the residual gap is handed to Lane A's optimiser for levers 2-5, with Lane
A's rotational-shedding baseline only ever invoked implicitly as the
optimiser's own last-resort unserved/overload slack -- never pre-empting the
earlier levers), ``approve``/``reject``/``cancel`` transition an existing
plan, and ``simulate``/``sensitivity`` are read-only what-if helpers that
never mutate the stored plan.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

import numpy as np

from app.core.exceptions import InvalidTransitionError, NotFoundError
from app.grid.constants import LEVER_ORDER
from app.grid.deficits import find_deficit_windows
from app.grid.models import (
    FlexPlan,
    ForecastBundle,
    LeverKey,
    PlanInputs,
    PlanOverrides,
    PlanSolution,
    PlanStatus,
)
from app.grid.optimizer import solve_plan

# ---------------------------------------------------------------------------
# ForecastBundle builder
# ---------------------------------------------------------------------------


def reconcile_bottom_up_to_top_down(
    bottom_up_kw: np.ndarray, top_down_p50_kw: np.ndarray
) -> np.ndarray:
    """Scale ``bottom_up_kw`` per-slot so its total matches ``top_down_p50_kw``'s
    total, preserving the bottom-up curve's relative shape slot-to-slot.
    """
    bottom_total = float(np.sum(bottom_up_kw))
    top_total = float(np.sum(top_down_p50_kw))
    if bottom_total <= 0:
        return np.array(top_down_p50_kw, dtype=float)
    ratio = top_total / bottom_total if top_total > 0 else 1.0
    return bottom_up_kw * ratio


@dataclass
class DtForecastInput:
    """One DT's inputs to ``build_forecast_bundle``."""

    dt_id: str
    bottom_up_kw: np.ndarray
    p10_pu: np.ndarray
    p50_pu: np.ndarray
    p90_pu: np.ndarray
    rated_kw: float
    available_kw: np.ndarray


def build_forecast_bundle(subdivision_id: str, dt_inputs: list[DtForecastInput]) -> ForecastBundle:
    """Reconcile every DT's bottom-up/top-down demand and aggregate to the
    sub-division level expected by ``ForecastBundle``.
    """
    if not dt_inputs:
        return ForecastBundle(subdivision_id=subdivision_id, horizon_slots=0)

    horizon = len(dt_inputs[0].bottom_up_kw)
    gross_kw = np.zeros(horizon)
    available_kw = np.zeros(horizon)
    p10_kw = np.zeros(horizon)
    p50_kw = np.zeros(horizon)
    p90_kw = np.zeros(horizon)

    for dt in dt_inputs:
        top_down_p50_kw = dt.p50_pu * dt.rated_kw
        reconciled = reconcile_bottom_up_to_top_down(dt.bottom_up_kw, top_down_p50_kw)
        gross_kw += reconciled
        available_kw += np.asarray(dt.available_kw, dtype=float)
        p10_kw += dt.p10_pu * dt.rated_kw
        p50_kw += top_down_p50_kw
        p90_kw += dt.p90_pu * dt.rated_kw

    net_kw = gross_kw  # no separate behind-the-meter PV netting modelled at this layer
    gap_kw = np.maximum(net_kw - available_kw, 0.0)

    return ForecastBundle(
        subdivision_id=subdivision_id,
        horizon_slots=horizon,
        dt_ids=[dt.dt_id for dt in dt_inputs],
        gross_kw=gross_kw.tolist(),
        net_kw=net_kw.tolist(),
        available_kw=available_kw.tolist(),
        gap_kw=gap_kw.tolist(),
        p10_kw=p10_kw.tolist(),
        p50_kw=p50_kw.tolist(),
        p90_kw=p90_kw.tolist(),
    )


# ---------------------------------------------------------------------------
# FlexPlanService
# ---------------------------------------------------------------------------

# Lever 1 (behavioural DR) is applied as a flat fraction of each DT's peak
# gap *before* the gap is handed to the optimiser for levers 2-5, per the
# spec's lever ordering ("applying voluntary DR (lever 1) first then
# optimizing the residual via Lane A's optimizer for levers 2-5").
VOLUNTARY_DR_FRACTION = 0.15


def new_plan_id() -> str:
    return f"fp_{uuid.uuid4().hex[:8]}"


def new_window_id() -> str:
    return f"dw_{uuid.uuid4().hex[:8]}"


class FlexPlanService:
    """In-memory Flex Plan state machine (``PlanStatus`` transitions)."""

    _VALID_TRANSITIONS: dict[PlanStatus, set[PlanStatus]] = {
        PlanStatus.DRAFT: {PlanStatus.APPROVED, PlanStatus.REJECTED, PlanStatus.CANCELLED},
        PlanStatus.APPROVED: {PlanStatus.DISPATCHED, PlanStatus.CANCELLED},
        PlanStatus.DISPATCHED: {PlanStatus.COMPLETED, PlanStatus.CANCELLED},
        PlanStatus.REJECTED: set(),
        PlanStatus.CANCELLED: set(),
        PlanStatus.COMPLETED: set(),
        PlanStatus.EXPIRED: set(),
    }

    def __init__(self) -> None:
        self._plans: dict[str, FlexPlan] = {}

    # -- read ---------------------------------------------------------------

    def get(self, plan_id: str) -> FlexPlan:
        plan = self._plans.get(plan_id)
        if plan is None:
            raise NotFoundError("FlexPlan", plan_id)
        return plan

    def list_plans(self, subdivision_id: str | None = None) -> list[FlexPlan]:
        plans = list(self._plans.values())
        if subdivision_id is not None:
            plans = [p for p in plans if p.subdivision_id == subdivision_id]
        return sorted(plans, key=lambda p: p.created_at)

    # -- build ----------------------------------------------------------------

    def build_plan_inputs(
        self,
        subdivision_id: str,
        dt_ids: list[str],
        slots: list[int],
        gap_kw: dict[str, list[float]],
        dt_limit_kw: dict[str, float],
        dr_potential_kw: dict[str, float],
        hub_potential_kw: dict[str, float],
        storage_energy_kwh: dict[str, float],
        shift_potential_kw: dict[str, float],
    ) -> PlanInputs:
        """Apply voluntary DR (lever 1) to the raw gap first, then package the
        residual as optimiser input for levers 2-5.
        """
        residual_gap: dict[str, list[float]] = {}
        for dt_id in dt_ids:
            series = gap_kw.get(dt_id, [])
            dr_relief = dr_potential_kw.get(dt_id, 0.0) + VOLUNTARY_DR_FRACTION * (
                max(series) if series else 0.0
            )
            residual_gap[dt_id] = [max(g - dr_relief, 0.0) for g in series]

        return PlanInputs(
            window_id=new_window_id(),
            subdivision_id=subdivision_id,
            slots=list(slots),
            dt_ids=list(dt_ids),
            gap_kw=residual_gap,
            dt_limit_kw=dict(dt_limit_kw),
            dr_potential_kw=dict(dr_potential_kw),
            hub_potential_kw=dict(hub_potential_kw),
            storage_energy_kwh=dict(storage_energy_kwh),
            shift_potential_kw=dict(shift_potential_kw),
        )

    def refresh(self, inputs: PlanInputs) -> FlexPlan:
        """Build (or rebuild) a DRAFT plan for one deficit window's inputs."""
        solution = solve_plan(inputs)
        plan = FlexPlan(
            id=new_plan_id(),
            subdivision_id=inputs.subdivision_id,
            window_id=inputs.window_id,
            status=PlanStatus.DRAFT,
            lever_sequence=[LeverKey(k) for k in LEVER_ORDER],
            inputs=inputs,
            solution=solution,
        )
        self._plans[plan.id] = plan
        return plan

    def refresh_from_series(
        self,
        subdivision_id: str,
        dt_ids: list[str],
        gap_kw_series: dict[str, np.ndarray],
        dt_limit_kw: dict[str, float],
        dr_potential_kw: dict[str, float],
        hub_potential_kw: dict[str, float],
        storage_energy_kwh: dict[str, float],
        shift_potential_kw: dict[str, float],
    ) -> list[FlexPlan]:
        """Detect deficit windows per DT, union them into shared windows across
        the sub-division, and build one draft ``FlexPlan`` per resulting window.
        """
        all_windows: set[tuple[int, int]] = set()
        for dt_id in dt_ids:
            series = gap_kw_series.get(dt_id)
            if series is None or len(series) == 0:
                continue
            for start, end in find_deficit_windows(np.asarray(series)):
                all_windows.add((start, end))
        if not all_windows:
            return []

        merged = _merge_overlapping(sorted(all_windows))
        plans: list[FlexPlan] = []
        for start, end in merged:
            slots = list(range(start, end))
            gap_kw = {
                dt_id: [float(gap_kw_series.get(dt_id, np.zeros(end))[s]) for s in slots]
                for dt_id in dt_ids
            }
            inputs = self.build_plan_inputs(
                subdivision_id=subdivision_id,
                dt_ids=dt_ids,
                slots=slots,
                gap_kw=gap_kw,
                dt_limit_kw=dt_limit_kw,
                dr_potential_kw=dr_potential_kw,
                hub_potential_kw=hub_potential_kw,
                storage_energy_kwh=storage_energy_kwh,
                shift_potential_kw=shift_potential_kw,
            )
            plans.append(self.refresh(inputs))
        return plans

    # -- state machine --------------------------------------------------------

    def _transition(self, plan: FlexPlan, to_status: PlanStatus) -> None:
        allowed = self._VALID_TRANSITIONS.get(plan.status, set())
        if to_status not in allowed:
            raise InvalidTransitionError("FlexPlan", plan.status.value, to_status.value)

    def approve(self, plan_id: str, approver: str) -> FlexPlan:
        """Approve a DRAFT plan. ``approver`` must be a named human (JE/AE) --
        this is the only way a plan may ever move past DRAFT (hard safety
        invariant #5: no autonomous dispatcher action without a named approver).
        """
        if not approver or not approver.strip():
            raise ValueError("approve() requires a named human approver")
        plan = self.get(plan_id)
        self._transition(plan, PlanStatus.APPROVED)
        plan.status = PlanStatus.APPROVED
        plan.approved_by = approver
        plan.updated_at = _now()
        return plan

    def reject(self, plan_id: str, reason: str) -> FlexPlan:
        plan = self.get(plan_id)
        self._transition(plan, PlanStatus.REJECTED)
        plan.status = PlanStatus.REJECTED
        plan.rejected_reason = reason
        plan.updated_at = _now()
        return plan

    def cancel(self, plan_id: str) -> FlexPlan:
        plan = self.get(plan_id)
        self._transition(plan, PlanStatus.CANCELLED)
        plan.status = PlanStatus.CANCELLED
        plan.updated_at = _now()
        return plan

    def mark_dispatched(self, plan_id: str) -> FlexPlan:
        plan = self.get(plan_id)
        self._transition(plan, PlanStatus.DISPATCHED)
        plan.status = PlanStatus.DISPATCHED
        plan.updated_at = _now()
        return plan

    def mark_completed(self, plan_id: str) -> FlexPlan:
        plan = self.get(plan_id)
        self._transition(plan, PlanStatus.COMPLETED)
        plan.status = PlanStatus.COMPLETED
        plan.updated_at = _now()
        return plan

    def expire_stale(self, plan_id: str) -> FlexPlan:
        plan = self.get(plan_id)
        plan.status = PlanStatus.EXPIRED
        plan.updated_at = _now()
        return plan

    def apply_overrides(self, plan_id: str, overrides: PlanOverrides) -> FlexPlan:
        plan = self.get(plan_id)
        if plan.status != PlanStatus.DRAFT:
            raise InvalidTransitionError("FlexPlan", plan.status.value, "edit")
        plan.overrides = overrides
        plan.updated_at = _now()
        return plan

    # -- what-if --------------------------------------------------------------

    def simulate(self, plan_id: str, overrides: PlanOverrides) -> PlanSolution:
        """Re-solve a plan's inputs with ``overrides`` applied, WITHOUT mutating
        the stored plan (what-if preview for the JE/AE decision desk).
        """
        plan = self.get(plan_id)
        return self._solve_with_overrides(plan.inputs, overrides)

    def sensitivity(self, plan_id: str, lever: LeverKey) -> dict[str, float]:
        """Disable a single lever and report how total unserved/overload kW
        changes, to show the JE/AE how much that lever is contributing.
        """
        plan = self.get(plan_id)
        baseline_unserved = sum(plan.solution.unserved_kw_by_dt.values())
        baseline_overload = sum(plan.solution.overload_kw_by_dt.values())

        without_lever = self._solve_with_overrides(
            plan.inputs, PlanOverrides(disabled_levers=[lever])
        )
        with_unserved = sum(without_lever.unserved_kw_by_dt.values())
        with_overload = sum(without_lever.overload_kw_by_dt.values())

        return {
            "baseline_unserved_kw": baseline_unserved,
            "baseline_overload_kw": baseline_overload,
            "without_lever_unserved_kw": with_unserved,
            "without_lever_overload_kw": with_overload,
            "lever_contribution_kw": max(with_unserved - baseline_unserved, 0.0),
        }

    def _solve_with_overrides(self, inputs: PlanInputs, overrides: PlanOverrides) -> PlanSolution:
        adjusted = inputs.model_copy(deep=True)
        if LeverKey.DR in overrides.disabled_levers:
            adjusted.dr_potential_kw = dict.fromkeys(adjusted.dr_potential_kw, 0.0)
        if LeverKey.HUB in overrides.disabled_levers:
            adjusted.hub_potential_kw = dict.fromkeys(adjusted.hub_potential_kw, 0.0)
        if LeverKey.SHIFT in overrides.disabled_levers:
            adjusted.shift_potential_kw = dict.fromkeys(adjusted.shift_potential_kw, 0.0)
        if LeverKey.STORAGE in overrides.disabled_levers:
            adjusted.storage_energy_kwh = dict.fromkeys(adjusted.storage_energy_kwh, 0.0)
        for dt_id, _level in overrides.cap_level_overrides.items():
            # cap overrides are informational for the optimiser's starting point;
            # the greedy/MILP solve still determines final feasibility.
            adjusted.dt_limit_kw[dt_id] = adjusted.dt_limit_kw.get(dt_id, 0.0)
        return solve_plan(adjusted)


def _merge_overlapping(windows: list[tuple[int, int]]) -> list[tuple[int, int]]:
    if not windows:
        return []
    merged = [windows[0]]
    for start, end in windows[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


def _now():
    from datetime import UTC, datetime

    return datetime.now(UTC)


__all__ = [
    "DtForecastInput",
    "build_forecast_bundle",
    "reconcile_bottom_up_to_top_down",
    "FlexPlanService",
    "new_plan_id",
    "new_window_id",
]
