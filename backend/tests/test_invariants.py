"""The 6 hard safety invariants (docs/SPEC.md, cross-cutting rules + B7).

These tests must NEVER be skipped, marked xfail, or relaxed. If a change to
any engine/service/adapter would break one of these, the change is wrong,
not the test.
"""

from __future__ import annotations

import ast
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import pytest

from app.adapters.channels import ChannelGateway
from app.adapters.hes import LoadLimitError, MockHes, build_load_limit_command
from app.adapters.ledger import ProtocolLedger
from app.adapters.ocpp import MockChargePoint
from app.adapters.openadr import OpenAdrVtn
from app.grid.constants import LIFELINE_FLOOR_W, NOTICE_MIN_CAPS
from app.grid.models import Actions
from app.grid.planner import FlexPlanService
from app.grid.world import DtStatic, GridWorld
from app.services.dispatch import Dispatcher, DispatcherError

GRID_DIR = Path(__file__).resolve().parents[1] / "app" / "grid"

# Any import whose dotted module path contains one of these tokens is treated
# as an LLM/AI-SDK import for invariant #6.
FORBIDDEN_IMPORT_TOKENS = (
    "google.genai",
    "google_genai",
    "genai",
    "openai",
    "anthropic",
    "sarvam",
    "gemini",
    "langchain",
)


# ---------------------------------------------------------------------------
# Invariant 1: T0 critical/life-support consumers are never capped or
# asked for DR.
# ---------------------------------------------------------------------------


def test_invariant_1_t0_consumers_can_never_be_capped() -> None:
    issued = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    with pytest.raises(LoadLimitError):
        build_load_limit_command(
            target_id="c_sn_01_0001",  # a T0 life-support consumer
            limit_w=1000.0,
            effective_at=issued + timedelta(minutes=45),
            expires_at=issued + timedelta(hours=2),
            issued_at=issued,
            tier="t0",
        )


def test_invariant_1_world_always_fully_serves_the_critical_fraction() -> None:
    """Even an aggressive cap_kw=0 request must still fully serve the
    DT's T0 critical/life-support share every interval.
    """
    dt = DtStatic(dt_id="dt_sn_01", subdivision_id="sd_subhashnagar", rating_kva=160.0)
    n = 5
    world = GridWorld(
        [dt],
        {"dt_sn_01": np.full(n, 100.0)},
        {"dt_sn_01": np.full(n, 30.0)},
        {"dt_sn_01": np.full(n, 100.0)},
    )
    critical_kw = 100.0 * dt.critical_fraction
    for slot in range(n):
        sol, _shadow = world.advance_interval(slot, {"dt_sn_01": Actions(cap_kw={"dt_sn_01": 0.0})})
        assert sol.dt_served_kw["dt_sn_01"] >= critical_kw - 1e-6


# ---------------------------------------------------------------------------
# Invariant 2: no cap ever goes below the 300 W lifeline floor.
# ---------------------------------------------------------------------------


def test_invariant_2_cap_below_lifeline_floor_is_rejected_for_t1() -> None:
    issued = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    with pytest.raises(LoadLimitError):
        build_load_limit_command(
            target_id="c_sn_01_0007",
            limit_w=LIFELINE_FLOOR_W - 1,
            effective_at=issued + timedelta(minutes=45),
            expires_at=issued + timedelta(hours=2),
            issued_at=issued,
            tier="t1",
        )


def test_invariant_2_cap_at_exactly_lifeline_floor_is_allowed() -> None:
    issued = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    command = build_load_limit_command(
        target_id="c_sn_01_0007",
        limit_w=float(LIFELINE_FLOOR_W),
        effective_at=issued + timedelta(minutes=45),
        expires_at=issued + timedelta(hours=2),
        issued_at=issued,
        tier="t1",
    )
    assert command.limit_w == LIFELINE_FLOOR_W


# ---------------------------------------------------------------------------
# Invariant 3: every cap command carries an expiry.
# ---------------------------------------------------------------------------


def test_invariant_3_every_dlms_payload_has_an_expiry() -> None:
    issued = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    command = build_load_limit_command(
        target_id="c_sn_01_0007",
        limit_w=500.0,
        effective_at=issued + timedelta(minutes=45),
        expires_at=issued + timedelta(hours=2),
        issued_at=issued,
        tier="t1",
    )
    payload = command.to_dlms_payload()
    assert payload["attributes"]["expires_at"]


def test_invariant_3_expiry_before_effective_is_rejected() -> None:
    issued = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    with pytest.raises(LoadLimitError):
        build_load_limit_command(
            target_id="c_sn_01_0007",
            limit_w=500.0,
            effective_at=issued + timedelta(minutes=45),
            expires_at=issued + timedelta(minutes=44),  # before effective_at
            issued_at=issued,
            tier="t1",
        )


# ---------------------------------------------------------------------------
# Invariant 4: minimum 30-minute notice before any cap takes effect.
# ---------------------------------------------------------------------------


def test_invariant_4_sub_30_minute_notice_is_rejected() -> None:
    issued = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    with pytest.raises(LoadLimitError):
        build_load_limit_command(
            target_id="c_sn_01_0007",
            limit_w=500.0,
            effective_at=issued + timedelta(minutes=NOTICE_MIN_CAPS - 1),
            expires_at=issued + timedelta(hours=2),
            issued_at=issued,
            tier="t1",
        )


def test_invariant_4_exactly_30_minute_notice_is_allowed() -> None:
    issued = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    command = build_load_limit_command(
        target_id="c_sn_01_0007",
        limit_w=500.0,
        effective_at=issued + timedelta(minutes=NOTICE_MIN_CAPS),
        expires_at=issued + timedelta(hours=2),
        issued_at=issued,
        tier="t1",
    )
    assert command.effective_at - command.issued_at == timedelta(minutes=NOTICE_MIN_CAPS)


# ---------------------------------------------------------------------------
# Invariant 5: no autonomous dispatcher action without a named human approver.
# ---------------------------------------------------------------------------


def _dispatcher() -> tuple[Dispatcher, FlexPlanService]:
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


def test_invariant_5_draft_plan_cannot_be_scheduled() -> None:
    dispatcher, plan_service = _dispatcher()
    plans = plan_service.refresh_from_series(
        subdivision_id="sd_subhashnagar",
        dt_ids=["dt_a"],
        gap_kw_series={"dt_a": np.array([0.0, 10.0, 10.0, 0.0])},
        dt_limit_kw={"dt_a": 100.0},
        dr_potential_kw={"dt_a": 1.0},
        hub_potential_kw={"dt_a": 1.0},
        storage_energy_kwh={"dt_a": 1.0},
        shift_potential_kw={"dt_a": 1.0},
    )
    start = datetime(2026, 1, 1, 19, 0, tzinfo=UTC)
    with pytest.raises(DispatcherError):
        dispatcher.schedule_plan(plans[0], start, start + timedelta(hours=1))


def test_invariant_5_approval_requires_non_empty_named_approver() -> None:
    plan_service = FlexPlanService()
    plans = plan_service.refresh_from_series(
        subdivision_id="sd_subhashnagar",
        dt_ids=["dt_a"],
        gap_kw_series={"dt_a": np.array([0.0, 10.0, 10.0, 0.0])},
        dt_limit_kw={"dt_a": 100.0},
        dr_potential_kw={"dt_a": 1.0},
        hub_potential_kw={"dt_a": 1.0},
        storage_energy_kwh={"dt_a": 1.0},
        shift_potential_kw={"dt_a": 1.0},
    )
    with pytest.raises(ValueError):
        plan_service.approve(plans[0].id, "")
    with pytest.raises(ValueError):
        plan_service.approve(plans[0].id, "   ")


def test_invariant_5_approved_plan_with_named_approver_can_be_scheduled() -> None:
    dispatcher, plan_service = _dispatcher()
    plans = plan_service.refresh_from_series(
        subdivision_id="sd_subhashnagar",
        dt_ids=["dt_a"],
        gap_kw_series={"dt_a": np.array([0.0, 10.0, 10.0, 0.0])},
        dt_limit_kw={"dt_a": 100.0},
        dr_potential_kw={"dt_a": 1.0},
        hub_potential_kw={"dt_a": 1.0},
        storage_energy_kwh={"dt_a": 1.0},
        shift_potential_kw={"dt_a": 1.0},
    )
    plan = plan_service.approve(plans[0].id, "je_rakesh_kumar")
    start = datetime(2026, 1, 1, 19, 0, tzinfo=UTC)
    timeline = dispatcher.schedule_plan(plan, start, start + timedelta(hours=1))
    assert timeline.plan_id == plan.id


# ---------------------------------------------------------------------------
# Invariant 6: no engine module (app/grid/*.py) imports any LLM/AI SDK.
# ---------------------------------------------------------------------------


def _imported_module_names(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                names.add(alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module:
            names.add(node.module)
    return names


def test_invariant_6_no_grid_engine_module_imports_an_llm_sdk() -> None:
    grid_files = sorted(GRID_DIR.glob("*.py"))
    assert len(grid_files) > 10, "sanity check: expected Lane A's grid/ modules to be present"

    violations: dict[str, set[str]] = {}
    for path in grid_files:
        imports = _imported_module_names(path)
        bad = {
            name
            for name in imports
            if any(token in name.lower() for token in FORBIDDEN_IMPORT_TOKENS)
        }
        if bad:
            violations[path.name] = bad

    assert violations == {}, f"engine modules importing LLM/AI SDKs: {violations}"


def test_invariant_6_forbidden_token_list_is_not_accidentally_empty() -> None:
    assert len(FORBIDDEN_IMPORT_TOKENS) >= 5
