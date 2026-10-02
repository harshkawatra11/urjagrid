"""``/api/v1/field`` -- field-worker registry (critical facilities / life
support homes), writes gated by role + audited (B9/B6).
"""

from __future__ import annotations

import itertools
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.core.auth import AUDIT_LOG, AuthenticatedUser, Role, require_roles
from app.core.exceptions import NotFoundError

router = APIRouter(prefix="/api/v1/field", tags=["field"])

_registrations: list[dict] = []
_outages: list[dict] = []
_counter = itertools.count(1)


class CamelModel(BaseModel):
    """Accepts the camelCase JSON body `lib/api/mutations.ts` actually sends."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class RegistrationRequest(CamelModel):
    consumer_id: str
    subdivision_id: str
    category: str  # "critical_facility" | "life_support_home"
    notes: str = ""


class OutageReportRequest(CamelModel):
    subdivision_id: str
    description: str
    dt_id: str | None = None
    consumer_id: str | None = None


def _registration_view(row: dict) -> dict:
    return {
        "id": row["id"],
        "consumerId": row["consumer_id"],
        "subdivisionId": row["subdivision_id"],
        "category": row["category"],
        "notes": row["notes"],
        "registeredBy": row["registered_by"],
        "verified": row["verified"],
        "createdIso": row["created_at"],
    }


def _outage_view(row: dict) -> dict:
    return {
        "id": row["id"],
        "consumerId": row["consumer_id"],
        "dtId": row["dt_id"],
        "subdivisionId": row["subdivision_id"],
        "description": row["description"],
        "status": row["status"],
        "createdIso": row["created_at"],
    }


@router.get("/registry")
async def list_registrations(subdivision_id: str | None = None) -> list[dict]:
    rows = _registrations
    if subdivision_id is not None:
        rows = [r for r in rows if r["subdivision_id"] == subdivision_id]
    return [_registration_view(r) for r in rows]


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
        "created_at": datetime.now(UTC).isoformat(),
    }
    _registrations.append(row)
    AUDIT_LOG.record(
        user.username, "register", "FieldRegistration", row["id"], category=body.category
    )
    return _registration_view(row)


@router.post("/registry/{registration_id}/verify")
async def verify_registration(
    registration_id: str,
    user: AuthenticatedUser = Depends(require_roles(Role.FIELD, Role.AE, Role.ADMIN)),
) -> dict:
    for row in _registrations:
        if row["id"] == registration_id:
            row["verified"] = True
            AUDIT_LOG.record(user.username, "verify", "FieldRegistration", registration_id)
            return _registration_view(row)

    raise NotFoundError("FieldRegistration", registration_id)


@router.get("/outages")
async def list_outages(subdivision_id: str | None = None) -> list[dict]:
    rows = _outages
    if subdivision_id is not None:
        rows = [r for r in rows if r["subdivision_id"] == subdivision_id]
    return [_outage_view(r) for r in rows]


@router.post("/outages")
async def report_outage(body: OutageReportRequest) -> dict:
    """Public write (no role required): any household/shop or field worker
    may report an outage -- this is the backing store for both the field
    app's own report flow and the consumer app's `report-outage` mutation
    (`/consumers/{id}/report-outage`, see ``app.api.v1.consumers``).
    """
    row = {
        "id": f"out_{uuid.uuid4().hex[:8]}",
        "consumer_id": body.consumer_id,
        "dt_id": body.dt_id,
        "subdivision_id": body.subdivision_id,
        "description": body.description,
        "status": "reported",
        "created_at": datetime.now(UTC).isoformat(),
    }
    _outages.append(row)
    return _outage_view(row)


def _reset_registry_for_tests() -> None:
    _registrations.clear()
    _outages.clear()


__all__ = ["router"]
