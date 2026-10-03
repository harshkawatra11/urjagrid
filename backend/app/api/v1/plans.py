"""``/api/v1/plans`` -- Flex Plan decision-desk endpoints (B9)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import AUDIT_LOG, AuthenticatedUser, Role, require_roles
from app.grid.models import LeverKey, PlanOverrides
from app.grid.views import plan_view, plans_view
from app.services.deps import get_grid_service
from app.services.service import GridService

router = APIRouter(prefix="/api/v1/plans", tags=["plans"])


class RejectRequest(BaseModel):
    reason: str


class OverridesRequest(BaseModel):
    cap_level_overrides: dict[str, int] = {}
    disabled_levers: list[LeverKey] = []
    window_start_slot: int | None = None
    window_end_slot: int | None = None
    notes: str = ""

    def to_overrides(self) -> PlanOverrides:
        return PlanOverrides(**self.model_dump())


@router.get("")
async def list_plans(
    subdivision_id: str | None = None, service: GridService = Depends(get_grid_service)
) -> list[dict]:
    return plans_view(service.plan_service.list_plans(subdivision_id), service.scenario.network)


@router.get("/{plan_id}")
async def get_plan(plan_id: str, service: GridService = Depends(get_grid_service)) -> dict:
    return plan_view(service.plan_service.get(plan_id), service.scenario.network)


@router.post("/{plan_id}/approve")
async def approve_plan(
    plan_id: str,
    service: GridService = Depends(get_grid_service),
    user: AuthenticatedUser = Depends(require_roles(Role.JE, Role.AE)),
) -> dict:
    # The approver is always the authenticated JE/AE from the bearer token --
    # never a client-supplied name -- per the B7 safety invariant "no
    # autonomous action without a named human approver".
    plan = service.plan_service.approve(plan_id, user.display_name)
    AUDIT_LOG.record(user.username, "approve", "FlexPlan", plan_id)
    return plan_view(plan, service.scenario.network)


@router.post("/{plan_id}/reject")
async def reject_plan(
    plan_id: str,
    body: RejectRequest,
    service: GridService = Depends(get_grid_service),
    user: AuthenticatedUser = Depends(require_roles(Role.JE, Role.AE)),
) -> dict:
    plan = service.plan_service.reject(plan_id, body.reason)
    AUDIT_LOG.record(user.username, "reject", "FlexPlan", plan_id, reason=body.reason)
    return plan_view(plan, service.scenario.network)


@router.post("/{plan_id}/cancel")
async def cancel_plan(
    plan_id: str,
    service: GridService = Depends(get_grid_service),
    user: AuthenticatedUser = Depends(require_roles(Role.JE, Role.AE)),
) -> dict:
    plan = service.plan_service.cancel(plan_id)
    AUDIT_LOG.record(user.username, "cancel", "FlexPlan", plan_id)
    return plan_view(plan, service.scenario.network)


@router.post("/{plan_id}/refresh")
async def refresh_plan(
    plan_id: str,
    service: GridService = Depends(get_grid_service),
    user: AuthenticatedUser = Depends(require_roles(Role.JE, Role.AE)),
) -> dict:
    """Re-solve a DRAFT plan's optimiser input in place (same id, same window)
    -- used by the decision desk's "refresh" action when the JE wants an
    up-to-date solve without discarding the plan.
    """
    plan = service.plan_service.refresh_plan(plan_id)
    AUDIT_LOG.record(user.username, "refresh", "FlexPlan", plan_id)
    return plan_view(plan, service.scenario.network)


@router.post("/{plan_id}/simulate")
async def simulate_plan(
    plan_id: str, body: OverridesRequest, service: GridService = Depends(get_grid_service)
) -> dict:
    solution = service.plan_service.simulate(plan_id, body.to_overrides())
    return solution.model_dump(mode="json")


@router.get("/{plan_id}/sensitivity")
async def plan_sensitivity(
    plan_id: str, lever: LeverKey, service: GridService = Depends(get_grid_service)
) -> dict:
    return service.plan_service.sensitivity(plan_id, lever)


__all__ = ["router"]
