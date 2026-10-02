"""``/api/v1/auth`` endpoints (Lane B, task B6)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import (
    DEMO_PASSWORD,
    DEMO_USERS,
    AuthenticatedUser,
    authenticate,
    create_access_token,
    get_current_user,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class DemoLoginRequest(BaseModel):
    username: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    subdivision_id: str | None
    display_name: str


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    user = authenticate(body.username, body.password)
    token = create_access_token(user)
    return TokenResponse(
        access_token=token,
        role=user.role.value,
        subdivision_id=user.subdivision_id,
        display_name=user.display_name,
    )


@router.post("/demo-login", response_model=TokenResponse)
async def demo_login(body: DemoLoginRequest) -> TokenResponse:
    """Shortcut for the demo: logs in as any ``DEMO_USERS`` key using the
    well-known ``DEMO_PASSWORD``.
    """
    user = authenticate(body.username, DEMO_PASSWORD)
    token = create_access_token(user)
    return TokenResponse(
        access_token=token,
        role=user.role.value,
        subdivision_id=user.subdivision_id,
        display_name=user.display_name,
    )


@router.get("/me", response_model=TokenResponse)
async def me(user: AuthenticatedUser = Depends(get_current_user)) -> TokenResponse:
    return TokenResponse(
        access_token="",
        role=user.role.value,
        subdivision_id=user.subdivision_id,
        display_name=user.display_name,
    )


@router.get("/demo-users")
async def demo_users() -> list[dict]:
    return [
        {
            "username": u.username,
            "role": u.role.value,
            "subdivision_id": u.subdivision_id,
            "display_name": u.display_name,
        }
        for u in DEMO_USERS.values()
    ]


__all__ = ["router"]
