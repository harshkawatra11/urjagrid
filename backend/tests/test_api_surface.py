import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.deps import reset_grid_service


@pytest.fixture
def client() -> TestClient:
    reset_grid_service()
    return TestClient(create_app())


@pytest.fixture
def je_token(client: TestClient) -> str:
    resp = client.post("/api/v1/auth/demo-login", json={"username": "je_subhashnagar"})
    return resp.json()["access_token"]


@pytest.fixture
def admin_token(client: TestClient) -> str:
    resp = client.post("/api/v1/auth/demo-login", json={"username": "admin_demo"})
    return resp.json()["access_token"]


def test_health(client: TestClient) -> None:
    assert client.get("/health").status_code == 200


def test_subdivisions(client: TestClient) -> None:
    resp = client.get("/api/v1/subdivisions")
    assert resp.status_code == 200
    assert len(resp.json()) > 0


def test_feeders(client: TestClient) -> None:
    resp = client.get("/api/v1/feeders")
    assert resp.status_code == 200


def test_transformers_list_and_detail(client: TestClient) -> None:
    resp = client.get("/api/v1/transformers")
    assert resp.status_code == 200
    dt_id = resp.json()[0]["id"]
    detail = client.get(f"/api/v1/transformers/{dt_id}")
    assert detail.status_code == 200
    missing = client.get("/api/v1/transformers/dt_does_not_exist")
    assert missing.status_code == 404


def test_critical(client: TestClient) -> None:
    assert client.get("/api/v1/critical").status_code == 200


def test_geo(client: TestClient) -> None:
    resp = client.get("/api/v1/geo")
    assert resp.status_code == 200
    assert "transformers" in resp.json()


def test_forecast(client: TestClient) -> None:
    sub_id = client.get("/api/v1/subdivisions").json()[0]["id"]
    resp = client.get(f"/api/v1/forecast/{sub_id}")
    assert resp.status_code == 200
    assert resp.json()["subdivision_id"] == sub_id


def test_plans_list_empty_initially(client: TestClient) -> None:
    resp = client.get("/api/v1/plans")
    assert resp.status_code == 200
    assert resp.json() == []


def test_plans_approve_requires_role(client: TestClient) -> None:
    resp = client.post("/api/v1/plans/fp_nonexistent/approve")
    assert resp.status_code == 401


def test_plans_approve_with_je_role_on_missing_plan_404s(client: TestClient, je_token: str) -> None:
    resp = client.post(
        "/api/v1/plans/fp_nonexistent/approve", headers={"Authorization": f"Bearer {je_token}"}
    )
    assert resp.status_code == 404


def test_flex_overview(client: TestClient) -> None:
    for path in (
        "/api/v1/flex",
        "/api/v1/flex/chargers",
        "/api/v1/flex/storage",
        "/api/v1/flex/dr",
        "/api/v1/flex/lifeline",
    ):
        assert client.get(path).status_code == 200, path


def test_consumers_list(client: TestClient) -> None:
    resp = client.get("/api/v1/consumers?limit=5")
    assert resp.status_code == 200
    assert len(resp.json()) <= 5


def test_consumer_message_audio(client: TestClient) -> None:
    resp = client.get("/api/v1/consumers/messages/msg_unknown/audio")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/wav"
    assert resp.content[:4] == b"RIFF"


def test_field_registry_requires_role(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/field/registry",
        json={
            "consumer_id": "c_sn_01_0007",
            "subdivision_id": "sd_subhashnagar",
            "category": "critical_facility",
        },
    )
    assert resp.status_code == 401


def test_field_registry_with_admin_role(client: TestClient, admin_token: str) -> None:
    resp = client.post(
        "/api/v1/field/registry",
        json={
            "consumer_id": "c_sn_01_0007",
            "subdivision_id": "sd_subhashnagar",
            "category": "critical_facility",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    reg_id = resp.json()["id"]
    verify = client.post(
        f"/api/v1/field/registry/{reg_id}/verify",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert verify.status_code == 200
    assert verify.json()["verified"] is True


def test_protocols(client: TestClient) -> None:
    resp = client.get("/api/v1/protocols")
    assert resp.status_code == 200
    assert "protocol_names" in resp.json()


def test_federation(client: TestClient) -> None:
    resp = client.get("/api/v1/federation")
    assert resp.status_code == 200
    assert resp.json()["status_tag"] == "WIRED"


def test_scenario_list_and_run(client: TestClient) -> None:
    names = client.get("/api/v1/scenario").json()
    assert "heatwave_evening" in names
    run = client.post("/api/v1/scenario/heatwave_evening/run?n_intervals=4")
    assert run.status_code == 200
    assert run.json()["n_intervals"] == 4


def test_scenario_unknown_name_404s(client: TestClient) -> None:
    resp = client.post("/api/v1/scenario/not_a_scenario/run")
    assert resp.status_code == 404


def test_economics(client: TestClient) -> None:
    assert client.get("/api/v1/economics/unit").status_code == 200
    assert client.get("/api/v1/economics/national").status_code == 200


def test_openadr(client: TestClient) -> None:
    resp = client.get("/api/v1/openadr/programs")
    assert resp.status_code == 200
    resp2 = client.get("/api/v1/openadr/programs/nonexistent/events")
    assert resp2.status_code == 200
    assert resp2.json() == []


def test_admin_requires_role(client: TestClient) -> None:
    assert client.post("/api/v1/admin/reset").status_code == 401


def test_admin_with_admin_role(client: TestClient, admin_token: str) -> None:
    resp = client.post(
        "/api/v1/admin/jump?n_intervals=2", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 200
    assert resp.json()["slot"] == 2
    auto = client.post(
        "/api/v1/admin/autopilot?enabled=true", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert auto.status_code == 200
    audit = client.get("/api/v1/admin/audit", headers={"Authorization": f"Bearer {admin_token}"})
    assert audit.status_code == 200
    assert len(audit.json()) >= 2


def test_admin_rejects_non_admin_role(client: TestClient, je_token: str) -> None:
    resp = client.post("/api/v1/admin/reset", headers={"Authorization": f"Bearer {je_token}"})
    assert resp.status_code == 403


def test_insights(client: TestClient) -> None:
    resp = client.get("/api/v1/insights")
    assert resp.status_code == 200
    assert "kpis" in resp.json()
    assert "risk" in resp.json()


def test_voice_websocket_round_trip(client: TestClient) -> None:
    with client.websocket_connect("/ws/voice") as ws:
        ws.send_json({"text": "What's the risk level right now?", "language": "en"})
        reply = ws.receive_json()
        assert "reply_text" in reply
        assert "audio_url" in reply
