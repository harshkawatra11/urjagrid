"""``/api/v1/field`` -- field-worker registry (critical facilities / life
support homes), writes gated by role + audited (B9/B6).
"""

from __future__ import annotations

import itertools
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import AUDIT_LOG, AuthenticatedUser, Role, require_roles

router = APIRouter(prefix="/api/v1/field", tags=["field"])

_registrations: list[dict] = []
_counter = itertools.count(1)


class RegistrationRequest(BaseModel):
    consumer_id: str
    subdivision_id: str
    category: str  # "critical_facility" | "life_support_home"
    notes: str = ""


@router.get("/registry")
async def list_registrations(subdivision_id: str | None = None) -> list[dict]:
    rows = _registrations
    if subdivision_id is not None:
        rows = [r for r in rows if r["subdivision_id"] == subdivision_id]
    return rows


@router.post("/registry")
async def register(
    body: RegistrationRequest,
    user: AuthenticatedUser = Depends(require_roles(Role.FIELD, Role.AE, Role.ADMIN)),
) -> dict:
    row = {
        "id": f"reg_{uuid.uuid4().hex[:8]}",
        "consumer_id": body.consumer_id,
        "subdivision_id": body.subdivision_id,
        "category": body.category,
        "notes": body.notes,
        "registered_by": user.username,
        "verified": False,
    }
    _registrations.append(row)
    AUDIT_LOG.record(
        user.username, "register", "FieldRegistration", row["id"], category=body.category
    )
    return row


@router.post("/registry/{registration_id}/verify")
async def verify_registration(
    registration_id: str,
    user: AuthenticatedUser = Depends(require_roles(Role.FIELD, Role.AE, Role.ADMIN)),
) -> dict:
    for row in _registrations:
        if row["id"] == registration_id:
            row["verified"] = True
            AUDIT_LOG.record(user.username, "verify", "FieldRegistration", registration_id)
            return row
    from app.core.exceptions import NotFoundError

    raise NotFoundError("FieldRegistration", registration_id)


def _reset_registry_for_tests() -> None:
    _registrations.clear()


__all__ = ["router"]
