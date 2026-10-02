from fastapi.testclient import TestClient

from app.core.exceptions import ApiError, InvalidTransitionError, NotFoundError
from app.main import create_app


def test_health_endpoint_returns_ok() -> None:
    client = TestClient(create_app())
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_security_headers_present() -> None:
    client = TestClient(create_app())
    resp = client.get("/health")
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert resp.headers["x-frame-options"] == "DENY"


def test_cors_configured() -> None:
    app = create_app()
    middlewares = [m.cls.__name__ for m in app.user_middleware]
    assert "CORSMiddleware" in middlewares


def test_not_found_error_maps_to_404() -> None:
    app = create_app()

    @app.get("/_boom_404")
    async def _boom() -> None:
        raise NotFoundError("dt", "dt_sn_99")

    client = TestClient(app, raise_server_exceptions=False)
    resp = client.get("/_boom_404")
    assert resp.status_code == 404


def test_invalid_transition_maps_to_409() -> None:
    app = create_app()

    @app.get("/_boom_409")
    async def _boom() -> None:
        raise InvalidTransitionError("plan", "dispatched", "draft")

    client = TestClient(app, raise_server_exceptions=False)
    resp = client.get("/_boom_409")
    assert resp.status_code == 409


def test_api_error_maps_to_custom_status() -> None:
    app = create_app()

    @app.get("/_boom_418")
    async def _boom() -> None:
        raise ApiError(418, "teapot")

    client = TestClient(app, raise_server_exceptions=False)
    resp = client.get("/_boom_418")
    assert resp.status_code == 418
    assert resp.json()["detail"] == "teapot"
