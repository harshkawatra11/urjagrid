"""``/api/v1/admin`` -- sim-clock/scenario controls, gated by
``LIFELINE_ADMIN_ENABLED`` (B9/B5)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.auth import AUDIT_LOG, AuthenticatedUser, Role, require_roles
from app.core.config import get_settings
from app.core.exceptions import ApiError
from app.services.deps import get_grid_service, reset_grid_service
from app.services.service import GridService

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _ensure_admin_enabled() -> None:
    if not get_settings().admin_enabled:
        raise ApiError(403, "admin endpoints are disabled (LIFELINE_ADMIN_ENABLED=false)")


@router.post("/reset")
async def reset(user: AuthenticatedUser = Depends(require_roles(Role.ADMIN))) -> dict:
    _ensure_admin_enabled()
    service = reset_grid_service()
    AUDIT_LOG.record(user.username, "reset", "GridService", "singleton")
    return {"slot": service.state.slot}


@router.post("/jump")
async def jump(
    n_intervals: int,
    service: GridService = Depends(get_grid_service),
    user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
) -> dict:
    _ensure_admin_enabled()
    service.jump(n_intervals)
    AUDIT_LOG.record(user.username, "jump", "GridService", "singleton", n_intervals=n_intervals)
    return {"slot": service.state.slot}


@router.post("/autopilot")
async def autopilot(
    enabled: bool,
    service: GridService = Depends(get_grid_service),
    user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
) -> dict:
    _ensure_admin_enabled()
    service.set_autopilot(enabled)
    AUDIT_LOG.record(user.username, "autopilot", "GridService", "singleton", enabled=enabled)
    return {"autopilot_enabled": service.state.autopilot_enabled}


@router.get("/audit")
async def audit_log(
    user: AuthenticatedUser = Depends(require_roles(Role.ADMIN, Role.REGULATOR)),
) -> list[dict]:
    return [row.to_view() for row in AUDIT_LOG.all()]


__all__ = ["router"]
