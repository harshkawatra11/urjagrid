import pytest
from fastapi.testclient import TestClient

from app.core.auth import (
    DEMO_PASSWORD,
    DEMO_USERS,
    Role,
    authenticate,
    create_access_token,
    decode_access_token,
    ensure_scope,
    require_roles,
)
from app.core.exceptions import ApiError
from app.main import create_app


def test_demo_users_cover_all_six_roles() -> None:
    roles = {u.role for u in DEMO_USERS.values()}
    assert roles == set(Role)


def test_authenticate_rejects_wrong_password() -> None:
    with pytest.raises(ApiError):
        authenticate("je_subhashnagar", "wrong-password")


def test_authenticate_accepts_demo_password() -> None:
    user = authenticate("je_subhashnagar", DEMO_PASSWORD)
    assert user.role == Role.JE


def test_token_roundtrip() -> None:
    user = authenticate("ae_bareilly", DEMO_PASSWORD)
    token = create_access_token(user)
    decoded = decode_access_token(token)
    assert decoded.username == "ae_bareilly"
    assert decoded.role == Role.AE


def test_decode_rejects_garbage_token() -> None:
    with pytest.raises(ApiError):
        decode_access_token("not-a-real-jwt")


def test_require_roles_dependency_blocks_wrong_role() -> None:
    user = decode_access_token(create_access_token(authenticate("consumer_sn_0007", DEMO_PASSWORD)))
    dependency = require_roles(Role.JE, Role.AE)
    with pytest.raises(ApiError):
        dependency(user)


def test_require_roles_dependency_allows_right_role() -> None:
    user = decode_access_token(create_access_token(authenticate("je_subhashnagar", DEMO_PASSWORD)))
    dependency = require_roles(Role.JE, Role.AE)
    assert dependency(user) is user


def test_ensure_scope_blocks_je_from_other_subdivision() -> None:
    user = decode_access_token(create_access_token(authenticate("je_subhashnagar", DEMO_PASSWORD)))
    dependency = ensure_scope("sd_izzatnagar")
    with pytest.raises(ApiError):
        dependency(user)


def test_ensure_scope_allows_ae_everywhere() -> None:
    user = decode_access_token(create_access_token(authenticate("ae_bareilly", DEMO_PASSWORD)))
    dependency = ensure_scope("sd_kosikalan")
    assert dependency(user) is user


# -- API endpoints ------------------------------------------------------------


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


def test_demo_login_endpoint(client: TestClient) -> None:
    resp = client.post("/api/v1/auth/demo-login", json={"username": "je_subhashnagar"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["role"] == "je"
    assert body["token"]


def test_login_endpoint_wrong_password(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/auth/login", json={"username": "je_subhashnagar", "password": "nope"}
    )
    assert resp.status_code == 401


def test_demo_users_endpoint_lists_seven_users(client: TestClient) -> None:
    resp = client.get("/api/v1/auth/demo-users")
    assert resp.status_code == 200
    assert len(resp.json()) == len(DEMO_USERS)


def test_me_requires_bearer_token(client: TestClient) -> None:
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_me_with_valid_token(client: TestClient) -> None:
    login = client.post("/api/v1/auth/demo-login", json={"username": "admin_demo"})
    token = login.json()["token"]
    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["role"] == "admin"
