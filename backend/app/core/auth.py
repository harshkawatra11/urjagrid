"""Authentication and authorisation (Lane B, task B6).

JWT via ``PyJWT``, password hashing via ``bcrypt``, 6 roles. Reads are
public everywhere in this API; only plan approve/reject and field-registry
writes require a role, and every mutation (anywhere in the backend) should
write an audit row via ``AUDIT_LOG`` -- the in-memory log kept here is
intentionally simple (a JSON-backed log would work equally well for this
prototype; see docs/SPEC.md B6).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any

import bcrypt
import jwt
from fastapi import Depends, Header

from app.core.config import get_settings
from app.core.exceptions import ApiError

DEMO_PASSWORD = "lifeline-demo"


class Role(StrEnum):
    CONSUMER = "consumer"
    FIELD = "field"
    JE = "je"
    AE = "ae"
    REGULATOR = "regulator"
    ADMIN = "admin"


# Roles that are scoped to a single sub-division (JE); AE/regulator/admin are
# cross-sub-division, consumer/field are scoped to their own registration.
_SUBDIVISION_SCOPED_ROLES = {Role.JE, Role.CONSUMER, Role.FIELD}


@dataclass
class DemoUser:
    username: str
    role: Role
    subdivision_id: str | None
    display_name: str
    password_hash: bytes


def _hash(password: str) -> bytes:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())


def verify_password(password: str, password_hash: bytes) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash)


def _build_demo_users() -> dict[str, DemoUser]:
    raw: list[tuple[str, Role, str | None, str]] = [
        ("consumer_sn_0007", Role.CONSUMER, "sd_subhashnagar", "Ramesh (Subhash Nagar)"),
        ("field_sn_01", Role.FIELD, "sd_subhashnagar", "Lineman Suresh"),
        ("je_subhashnagar", Role.JE, "sd_subhashnagar", "JE Priya Sharma"),
        ("je_izzatnagar", Role.JE, "sd_izzatnagar", "JE Anil Verma"),
        ("ae_bareilly", Role.AE, None, "AE Deepak Singh"),
        ("regulator_up", Role.REGULATOR, None, "UPERC Observer"),
        ("admin_demo", Role.ADMIN, None, "Demo Operator"),
    ]
    password_hash = _hash(DEMO_PASSWORD)
    return {
        username: DemoUser(username, role, sub, display_name, password_hash)
        for username, role, sub, display_name in raw
    }


DEMO_USERS: dict[str, DemoUser] = _build_demo_users()


def authenticate(username: str, password: str) -> DemoUser:
    user = DEMO_USERS.get(username)
    if user is None or not verify_password(password, user.password_hash):
        raise ApiError(401, "invalid username or password")
    return user


@dataclass
class AuthenticatedUser:
    username: str
    role: Role
    subdivision_id: str | None
    display_name: str


def create_access_token(user: DemoUser | AuthenticatedUser) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": user.username,
        "role": user.role.value,
        "subdivision_id": user.subdivision_id,
        "display_name": user.display_name,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> AuthenticatedUser:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise ApiError(401, f"invalid or expired token: {exc}") from None
    return AuthenticatedUser(
        username=payload["sub"],
        role=Role(payload["role"]),
        subdivision_id=payload.get("subdivision_id"),
        display_name=payload.get("display_name", payload["sub"]),
    )


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------


@dataclass
class AuditRow:
    actor: str
    action: str
    entity: str
    entity_id: str
    detail: dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))

    def to_view(self) -> dict[str, Any]:
        return {
            "actor": self.actor,
            "action": self.action,
            "entity": self.entity,
            "entity_id": self.entity_id,
            "detail": self.detail,
            "timestamp": self.timestamp.isoformat(),
        }


class AuditLog:
    """Simple in-memory audit log; every mutation in the API should call
    ``record`` with the authenticated actor's username.
    """

    def __init__(self) -> None:
        self._rows: list[AuditRow] = []

    def record(
        self, actor: str, action: str, entity: str, entity_id: str, **detail: Any
    ) -> AuditRow:
        row = AuditRow(
            actor=actor, action=action, entity=entity, entity_id=entity_id, detail=detail
        )
        self._rows.append(row)
        return row

    def all(self) -> list[AuditRow]:
        return list(self._rows)


AUDIT_LOG = AuditLog()


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------


def get_optional_user(authorization: str | None = Header(default=None)) -> AuthenticatedUser | None:
    """Reads are public: this dependency never raises, it just returns ``None``
    when no/invalid credentials are presented.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        return decode_access_token(token)
    except ApiError:
        return None


def get_current_user(
    user: AuthenticatedUser | None = Depends(get_optional_user),
) -> AuthenticatedUser:
    """Use on mutating endpoints: requires a valid bearer token."""
    if user is None:
        raise ApiError(401, "authentication required")
    return user


def require_roles(*roles: Role):
    """FastAPI dependency factory: requires the current user to hold one of ``roles``."""

    def _dependency(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role not in roles:
            allowed = [r.value for r in roles]
            raise ApiError(
                403, f"role {user.role.value!r} is not permitted; requires one of {allowed}"
            )
        return user

    return _dependency


def ensure_scope(subdivision_id: str):
    """FastAPI dependency factory: requires the current user's scope to cover
    ``subdivision_id`` -- JE/consumer/field users are confined to their own
    sub-division, AE/regulator/admin see every sub-division.
    """

    def _dependency(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role in _SUBDIVISION_SCOPED_ROLES and user.subdivision_id != subdivision_id:
            raise ApiError(
                403,
                f"user {user.username!r} is scoped to {user.subdivision_id!r}, "
                f"not {subdivision_id!r}",
            )
        return user

    return _dependency


__all__ = [
    "DEMO_PASSWORD",
    "Role",
    "DemoUser",
    "DEMO_USERS",
    "authenticate",
    "AuthenticatedUser",
    "create_access_token",
    "decode_access_token",
    "AuditRow",
    "AuditLog",
    "AUDIT_LOG",
    "get_optional_user",
    "get_current_user",
    "require_roles",
    "ensure_scope",
    "verify_password",
]
