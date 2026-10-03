"""``/api/v1/auth`` endpoints (Lane B, task B6)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.core.auth import (
    DEMO_USERS,
    AuthenticatedUser,
    DemoUser,
    authenticate,
    create_access_token,
    get_current_user,
)
from app.core.config import get_settings
from app.core.exceptions import ApiError

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class CamelModel(BaseModel):
    """Base for request bodies the frontend posts as camelCase JSON (the
    wire format every `lib/api/mutations.ts` call uses); accepts either the
    camelCase alias or the raw snake_case field name.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class LoginRequest(BaseModel):
    username: str
    password: str


class DemoLoginRequest(CamelModel):
    """Demo login (B6 spec: "demo-login by role+subdivision"). Accepts either
    an explicit demo ``username`` (back-compat / curl-friendly) or a
    ``role`` (+ optional ``subdivision_id``) that the frontend's
    `lib/auth.ts#demoLogin(role, subdivisionId)` actually sends.
    """

    username: str | None = None
    role: str | None = None
    subdivision_id: str | None = None


class TokenResponse(BaseModel):
    """Field names mirror `frontend/src/lib/auth.ts`'s `Session` shape
    (`token`/`subdivisionId`/`displayName`/`expiresAt`) once camelCase-aliased
    for the wire, rather than a generic OAuth `access_token` shape nothing in
    this app's frontend ever reads.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    token: str
    token_type: str = "bearer"
    role: str
    subdivision_id: str | None
    display_name: str
    expires_at: str


def _token_response(user: DemoUser | AuthenticatedUser, token: str) -> TokenResponse:
    expires_at = datetime.now(UTC) + timedelta(minutes=get_settings().jwt_expire_minutes)
    return TokenResponse(
        token=token,
        role=user.role.value,
        subdivision_id=user.subdivision_id,
        display_name=user.display_name,
        expires_at=expires_at.isoformat(),
    )


def _resolve_demo_user(body: DemoLoginRequest) -> DemoUser:
    if body.username:
        user = DEMO_USERS.get(body.username)
        if user is None:
            raise ApiError(401, "invalid username or password")
        return user
    if not body.role:
        raise ApiError(422, "either 'username' or 'role' is required")
    candidates = [u for u in DEMO_USERS.values() if u.role.value == body.role]
    if not candidates:
        raise ApiError(401, f"no demo user for role {body.role!r}")
    if body.subdivision_id:
        scoped = [u for u in candidates if u.subdivision_id == body.subdivision_id]
        if scoped:
            return scoped[0]
    return candidates[0]


@router.post("/login", response_model=TokenResponse, response_model_by_alias=True)
async def login(body: LoginRequest) -> TokenResponse:
    user = authenticate(body.username, body.password)
    token = create_access_token(user)
    return _token_response(user, token)


@router.post("/demo-login", response_model=TokenResponse, response_model_by_alias=True)
async def demo_login(body: DemoLoginRequest) -> TokenResponse:
    """Shortcut for the demo: logs in as any ``DEMO_USERS`` entry (by explicit
    username, or by role + optional subdivision) using the well-known
    ``DEMO_PASSWORD``.
    """
    user = _resolve_demo_user(body)
    token = create_access_token(user)
    return _token_response(user, token)


@router.get("/me", response_model=TokenResponse, response_model_by_alias=True)
async def me(user: AuthenticatedUser = Depends(get_current_user)) -> TokenResponse:
    return _token_response(user, "")


@router.get("/demo-users")
async def demo_users() -> list[dict]:
    return [
        {
            "username": u.username,
            "role": u.role.value,
            "subdivisionId": u.subdivision_id,
            "displayName": u.display_name,
        }
        for u in DEMO_USERS.values()
    ]


__all__ = ["router"]
