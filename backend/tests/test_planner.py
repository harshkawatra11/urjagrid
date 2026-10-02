import numpy as np
import pytest

from app.core.exceptions import InvalidTransitionError, NotFoundError
from app.grid.models import LeverKey, PlanOverrides, PlanStatus
from app.grid.planner import (
    DtForecastInput,
    FlexPlanService,
    build_forecast_bundle,
    reconcile_bottom_up_to_top_down,
)


def test_reconcile_scales_bottom_up_total_to_match_top_down() -> None:
    bottom_up = np.array([1.0, 2.0, 3.0, 4.0])
    top_down = np.array([2.0, 2.0, 2.0, 2.0])  # total 8 vs bottom-up total 10
    reconciled = reconcile_bottom_up_to_top_down(bottom_up, top_down)
    assert reconciled.sum() == pytest.approx(top_down.sum())
    # shape preserved (still monotone increasing like bottom_up)
    assert np.all(np.diff(reconciled) > 0)


def test_reconcile_handles_zero_bottom_up() -> None:
    bottom_up = np.zeros(4)
    top_down = np.array([1.0, 1.0, 1.0, 1.0])
    reconciled = reconcile_bottom_up_to_top_down(bottom_up, top_down)
    assert np.allclose(reconciled, top_down)


def test_build_forecast_bundle_aggregates_dts() -> None:
    horizon = 8
    dt1 = DtForecastInput(
        dt_id="dt_a",
        bottom_up_kw=np.full(horizon, 50.0),
        p10_pu=np.full(horizon, 0.2),
        p50_pu=np.full(horizon, 0.3),
        p90_pu=np.full(horizon, 0.4),
        rated_kw=200.0,
        available_kw=np.full(horizon, 40.0),
    )
    bundle = build_forecast_bundle("sd_subhashnagar", [dt1])
    assert bundle.subdivision_id == "sd_subhashnagar"
    assert bundle.horizon_slots == horizon
    assert len(bundle.gross_kw) == horizon
    assert all(g >= 0 for g in bundle.gap_kw)
    # top-down p50 total for dt1 = 0.3*200=60kW per slot; available=40 -> gap=20
    assert bundle.gap_kw[0] == pytest.approx(20.0, abs=1e-6)


def test_build_forecast_bundle_empty_inputs() -> None:
    bundle = build_forecast_bundle("sd_subhashnagar", [])
    assert bundle.horizon_slots == 0
    assert bundle.gross_kw == []


def _make_service_with_plan() -> tuple[FlexPlanService, str]:
    service = FlexPlanService()
    gap_series = {"dt_a": np.array([0.0, 5.0, 10.0, 8.0, 0.0])}
    plans = service.refresh_from_series(
        subdivision_id="sd_subhashnagar",
        dt_ids=["dt_a"],
        gap_kw_series=gap_series,
        dt_limit_kw={"dt_a": 100.0},
        dr_potential_kw={"dt_a": 2.0},
        hub_potential_kw={"dt_a": 3.0},
        storage_energy_kwh={"dt_a": 5.0},
        shift_potential_kw={"dt_a": 1.0},
    )
    assert len(plans) == 1
    return service, plans[0].id


def test_refresh_from_series_creates_draft_plan() -> None:
    service, plan_id = _make_service_with_plan()
    plan = service.get(plan_id)
    assert plan.status == PlanStatus.DRAFT
    assert plan.lever_sequence[0] == LeverKey.DR


def test_refresh_from_series_no_deficit_returns_no_plans() -> None:
    service = FlexPlanService()
    plans = service.refresh_from_series(
        subdivision_id="sd_subhashnagar",
        dt_ids=["dt_a"],
        gap_kw_series={"dt_a": np.zeros(5)},
        dt_limit_kw={"dt_a": 100.0},
        dr_potential_kw={"dt_a": 0.0},
        hub_potential_kw={"dt_a": 0.0},
        storage_energy_kwh={"dt_a": 0.0},
        shift_potential_kw={"dt_a": 0.0},
    )
    assert plans == []


def test_approve_requires_named_approver() -> None:
    service, plan_id = _make_service_with_plan()
    with pytest.raises(ValueError):
        service.approve(plan_id, "")


def test_approve_transitions_draft_to_approved() -> None:
    service, plan_id = _make_service_with_plan()
    plan = service.approve(plan_id, "je_rakesh_kumar")
    assert plan.status == PlanStatus.APPROVED
    assert plan.approved_by == "je_rakesh_kumar"


def test_cannot_approve_twice() -> None:
    service, plan_id = _make_service_with_plan()
    service.approve(plan_id, "je_rakesh_kumar")
    with pytest.raises(InvalidTransitionError):
        service.approve(plan_id, "je_rakesh_kumar")


def test_reject_sets_reason() -> None:
    service, plan_id = _make_service_with_plan()
    plan = service.reject(plan_id, "load estimate looks wrong")
    assert plan.status == PlanStatus.REJECTED
    assert plan.rejected_reason == "load estimate looks wrong"


def test_cancel_approved_plan() -> None:
    service, plan_id = _make_service_with_plan()
    service.approve(plan_id, "je_rakesh_kumar")
    plan = service.cancel(plan_id)
    assert plan.status == PlanStatus.CANCELLED


def test_cannot_cancel_rejected_plan() -> None:
    service, plan_id = _make_service_with_plan()
    service.reject(plan_id, "no")
    with pytest.raises(InvalidTransitionError):
        service.cancel(plan_id)


def test_dispatch_and_complete_lifecycle() -> None:
    service, plan_id = _make_service_with_plan()
    service.approve(plan_id, "je_rakesh_kumar")
    service.mark_dispatched(plan_id)
    plan = service.mark_completed(plan_id)
    assert plan.status == PlanStatus.COMPLETED


def test_get_missing_plan_raises_not_found() -> None:
    service = FlexPlanService()
    with pytest.raises(NotFoundError):
        service.get("fp_doesnotexist")


def test_list_plans_filters_by_subdivision() -> None:
    service, plan_id = _make_service_with_plan()
    assert service.list_plans("sd_subhashnagar") != []
    assert service.list_plans("sd_izzatnagar") == []


def test_simulate_does_not_mutate_stored_plan() -> None:
    service, plan_id = _make_service_with_plan()
    original_solution = service.get(plan_id).solution
    service.simulate(plan_id, PlanOverrides(disabled_levers=[LeverKey.HUB]))
    assert service.get(plan_id).solution == original_solution


def test_sensitivity_reports_lever_contribution() -> None:
    service, plan_id = _make_service_with_plan()
    report = service.sensitivity(plan_id, LeverKey.HUB)
    assert "lever_contribution_kw" in report
    assert report["lever_contribution_kw"] >= 0.0


def test_apply_overrides_only_allowed_while_draft() -> None:
    service, plan_id = _make_service_with_plan()
    service.apply_overrides(plan_id, PlanOverrides(notes="trim window"))
    assert service.get(plan_id).overrides.notes == "trim window"
    service.approve(plan_id, "je_rakesh_kumar")
    with pytest.raises(InvalidTransitionError):
        service.apply_overrides(plan_id, PlanOverrides(notes="too late"))
