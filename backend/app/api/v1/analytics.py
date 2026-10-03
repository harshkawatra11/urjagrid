"""``/api/v1/analytics`` -- governance views (D23): audit log, role/
permission matrix, usage stats. All three compose real backend state
(``AUDIT_LOG``, the live ``GridService``) rather than returning placeholders.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.auth import AUDIT_LOG, DEMO_USERS, Role
from app.services.deps import get_grid_service
from app.services.service import GridService

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])

_USERNAME_ROLE = {u.username: u.role.value for u in DEMO_USERS.values()}

# Mirrors the actual `require_roles(...)` dependencies wired into the routers
# (plans.py: approve/reject/cancel/refresh -> JE, AE; field.py: registry ->
# FIELD, AE, ADMIN; admin.py: all admin endpoints -> ADMIN; admin.py audit ->
# ADMIN, REGULATOR). This table documents what's actually enforced, it does
# not invent a separate policy.
_ROLE_MATRIX: dict[Role, dict[str, bool]] = {
    Role.JE: {
        "canApprovePlans": True,
        "canEditScenario": False,
        "canViewConsumerData": True,
        "canDispatch": False,
        "canSeeRegulatorAggregates": False,
    },
    Role.AE: {
        "canApprovePlans": True,
        "canEditScenario": False,
        "canViewConsumerData": True,
        "canDispatch": False,
        "canSeeRegulatorAggregates": True,
    },
    Role.ADMIN: {
        "canApprovePlans": False,
        "canEditScenario": True,
        "canViewConsumerData": True,
        "canDispatch": True,
        "canSeeRegulatorAggregates": True,
    },
    Role.REGULATOR: {
        "canApprovePlans": False,
        "canEditScenario": False,
        "canViewConsumerData": False,
        "canDispatch": False,
        "canSeeRegulatorAggregates": True,
    },
    Role.FIELD: {
        "canApprovePlans": False,
        "canEditScenario": False,
        "canViewConsumerData": False,
        "canDispatch": False,
        "canSeeRegulatorAggregates": False,
    },
    Role.CONSUMER: {
        "canApprovePlans": False,
        "canEditScenario": False,
        "canViewConsumerData": False,
        "canDispatch": False,
        "canSeeRegulatorAggregates": False,
    },
}


@router.get("/audit")
async def audit_log(subdivision_id: str | None = None) -> dict:  # noqa: ARG001
    """Real audit rows from ``AUDIT_LOG`` -- the same log every mutating
    endpoint in this API writes to (plan approve/reject/cancel/refresh,
    field registration, admin reset/jump/autopilot). ``subdivision_id`` isn't
    filterable: the audit log doesn't carry one (actions are keyed by
    entity/entity_id, not sub-division).
    """
    rows = AUDIT_LOG.all()
    return {
        "entries": [
            {
                "id": f"audit_{i}",
                "timestampIso": row.timestamp.isoformat(),
                "actorName": row.actor,
                "actorRole": _USERNAME_ROLE.get(row.actor, "unknown"),
                "action": row.action,
                "targetType": row.entity,
                "targetId": row.entity_id,
            }
            for i, row in enumerate(rows)
        ]
    }


@router.get("/roles")
async def role_matrix() -> dict:
    return {
        "roles": [{"role": role.value, **perms} for role, perms in _ROLE_MATRIX.items()]
    }


@router.get("/usage")
async def usage_stats(service: GridService = Depends(get_grid_service)) -> dict:
    plans = service.plan_service.list_plans()
    return {
        "stats": [
            {"metric": "simIntervalsElapsed", "value": service.state.slot, "unit": "intervals"},
            {"metric": "totalFlexPlans", "value": len(plans), "unit": "plans"},
            {
                "metric": "approvedFlexPlans",
                "value": sum(1 for p in plans if p.status.value == "approved"),
                "unit": "plans",
            },
            {
                "metric": "protocolMessagesSent",
                "value": len(service.ledger.all()),
                "unit": "messages",
            },
            {"metric": "auditedActions", "value": len(AUDIT_LOG.all()), "unit": "actions"},
        ]
    }


__all__ = ["router"]
