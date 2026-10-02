from app.grid.constants import FORECAST_HORIZON_SLOTS, SUBDIVISION_IDS
from app.grid.models import (
    Actions,
    CapLevel,
    FlexPlan,
    ForecastBundle,
    IntervalResult,
    LeverKey,
    LogRow,
    MeterState,
    PlanInputs,
    PlanOverrides,
    PlanSolution,
    PlanStatus,
    RiskLevel,
)


def test_subdivision_ids_reexported() -> None:
    from app.grid.models import SUBDIVISION_IDS as m_ids

    assert m_ids == SUBDIVISION_IDS


def test_enums_have_expected_members() -> None:
    assert {e.value for e in RiskLevel} == {"low", "medium", "high", "critical"}
    assert {e.value for e in PlanStatus} == {
        "draft",
        "approved",
        "rejected",
        "cancelled",
        "dispatched",
        "completed",
        "expired",
    }
    assert {e.value for e in MeterState} == {
        "normal",
        "dr_active",
        "capped",
        "shed",
        "critical_backup",
    }
    assert {e.value for e in LeverKey} == {"dr", "hub", "shift", "storage", "cap", "shed"}
    assert {e.value for e in CapLevel} == {0, 1, 2, 3}
    assert CapLevel.LIFELINE == 3


def test_actions_default_construction() -> None:
    actions = Actions()
    assert actions.cap_kw == {}
    actions = Actions(cap_kw={"dt_sn_01": 2.0}, cap_started={"dt_sn_01": True})
    assert actions.cap_kw["dt_sn_01"] == 2.0


def test_interval_result_shape() -> None:
    result = IntervalResult(slot=5, dt_demand_kw={"dt_sn_01": 10.0})
    assert result.slot == 5
    assert result.dt_demand_kw["dt_sn_01"] == 10.0
    assert isinstance(result.actions, Actions)


def test_log_row_round_trip() -> None:
    row = LogRow(
        slot=0,
        timestamp="2026-10-02T12:00:00Z",
        subdivision_id="sd_subhashnagar",
        gross_kw=100.0,
        net_kw=90.0,
        available_kw=80.0,
        served_kw=80.0,
        unserved_kw=10.0,
    )
    dumped = row.model_dump(mode="json")
    assert dumped["subdivision_id"] == "sd_subhashnagar"
    assert LogRow.model_validate(dumped).slot == 0


def test_forecast_bundle_defaults_horizon() -> None:
    bundle = ForecastBundle(subdivision_id="sd_izzatnagar")
    assert bundle.horizon_slots == FORECAST_HORIZON_SLOTS
    assert bundle.gross_kw == []


def test_plan_inputs_and_solution_and_overrides() -> None:
    inputs = PlanInputs(
        window_id="dw_00000001",
        subdivision_id="sd_faridpur",
        slots=[0, 1, 2],
        dt_ids=["dt_fp_01"],
        gap_kw={"dt_fp_01": [1.0, 2.0, 3.0]},
    )
    solution = PlanSolution(window_id="dw_00000001", status="optimal", objective_value=12.5)
    overrides = PlanOverrides(cap_level_overrides={"dt_fp_01": 2})
    assert inputs.gap_kw["dt_fp_01"][1] == 2.0
    assert solution.status == "optimal"
    assert overrides.cap_level_overrides["dt_fp_01"] == 2


def test_flex_plan_assembly_and_wire_round_trip() -> None:
    inputs = PlanInputs(window_id="dw_0000000a", subdivision_id="sd_kosikalan")
    solution = PlanSolution(window_id="dw_0000000a", status="optimal")
    plan = FlexPlan(
        id="fp_0000000a",
        subdivision_id="sd_kosikalan",
        window_id="dw_0000000a",
        lever_sequence=[LeverKey.DR, LeverKey.CAP],
        inputs=inputs,
        solution=solution,
    )
    assert plan.status == PlanStatus.DRAFT
    dumped = plan.model_dump(mode="json")
    restored = FlexPlan.model_validate(dumped)
    assert restored.id == "fp_0000000a"
    assert restored.lever_sequence == [LeverKey.DR, LeverKey.CAP]
