import pytest

from app.services.deps import reset_grid_service
from app.services.service import GridService
from app.tools.consumer_tools import build_consumer_tool_functions
from app.tools.grid_tools import build_tool_functions
from app.tools.resolve import fuzzy_resolve, fuzzy_resolve_many
from app.tools.schemas import CONSUMER_TOOL_SCHEMAS, TOOL_SCHEMAS


@pytest.fixture
def service() -> GridService:
    reset_grid_service()
    svc = GridService(seed=1)
    svc.boot()
    return svc


def test_tool_schemas_has_fifteen_tools() -> None:
    assert len(TOOL_SCHEMAS) == 15


def test_consumer_tool_schemas_has_four_tools() -> None:
    assert len(CONSUMER_TOOL_SCHEMAS) == 4


def test_tool_schema_names_match_dispatch_table(service: GridService) -> None:
    functions = build_tool_functions(service)
    schema_names = {s["name"] for s in TOOL_SCHEMAS}
    assert schema_names == set(functions.keys())


def test_fuzzy_resolve_exact_match() -> None:
    candidates = {"sd_subhashnagar": "Subhash Nagar", "sd_izzatnagar": "Izzatnagar"}
    result = fuzzy_resolve("Subhash Nagar", candidates)
    assert result is not None
    assert result[0] == "sd_subhashnagar"


def test_fuzzy_resolve_typo_tolerant() -> None:
    candidates = {"sd_subhashnagar": "Subhash Nagar", "sd_izzatnagar": "Izzatnagar"}
    result = fuzzy_resolve("subash ngar", candidates)
    assert result is not None
    assert result[0] == "sd_subhashnagar"


def test_fuzzy_resolve_empty_query_returns_none() -> None:
    assert fuzzy_resolve("", {"a": "Alpha"}) is None
    assert fuzzy_resolve("alpha", {}) is None


def test_fuzzy_resolve_many_returns_ranked_list() -> None:
    candidates = {
        "sd_subhashnagar": "Subhash Nagar",
        "sd_izzatnagar": "Izzatnagar",
        "sd_faridpur": "Faridpur",
    }
    results = fuzzy_resolve_many("nagar", candidates, limit=5)
    assert len(results) >= 1
    assert all(score >= 60.0 for _id, score in results)


def test_resolve_entity_tool_found(service: GridService) -> None:
    functions = build_tool_functions(service)
    result = functions["resolve_entity"](query="Subhash Nagar")
    assert result["found"] is True


def test_resolve_entity_tool_not_found(service: GridService) -> None:
    functions = build_tool_functions(service)
    result = functions["resolve_entity"](query="zzz_totally_unknown_place_xyz")
    assert result["found"] is False


def test_list_subdivisions_tool(service: GridService) -> None:
    functions = build_tool_functions(service)
    rows = functions["list_subdivisions"]()
    assert len(rows) > 0


def test_list_transformers_and_get_transformer_tools(service: GridService) -> None:
    functions = build_tool_functions(service)
    transformers = functions["list_transformers"]()
    dt_id = transformers[0]["id"]
    detail = functions["get_transformer"](dt_id=dt_id)
    assert detail["id"] == dt_id


def test_get_forecast_tool(service: GridService) -> None:
    functions = build_tool_functions(service)
    sub_id = service.scenario.network.subdivision_ids[0]
    bundle = functions["get_forecast"](subdivision_id=sub_id)
    assert bundle["subdivision_id"] == sub_id


def test_get_kpis_and_risk_tools(service: GridService) -> None:
    functions = build_tool_functions(service)
    assert "slot" in functions["get_kpis"]()
    assert isinstance(functions["get_risk_ranking"](), list)


def test_get_protocol_summary_lever_status_economics_scenarios_tools(service: GridService) -> None:
    functions = build_tool_functions(service)
    assert "counts" in functions["get_protocol_summary"]()
    assert "levers" in functions["get_lever_status"]()
    assert "monthly_net_benefit_rs" in functions["get_unit_economics"]()
    assert "heatwave_evening" in functions["get_scenario_names"]()


def test_list_plans_and_get_plan_tool_roundtrip(service: GridService) -> None:
    functions = build_tool_functions(service)
    import numpy as np

    plans = service.plan_service.refresh_from_series(
        subdivision_id="sd_subhashnagar",
        dt_ids=["dt_a"],
        gap_kw_series={"dt_a": np.array([0.0, 10.0, 10.0, 0.0])},
        dt_limit_kw={"dt_a": 100.0},
        dr_potential_kw={"dt_a": 1.0},
        hub_potential_kw={"dt_a": 1.0},
        storage_energy_kwh={"dt_a": 1.0},
        shift_potential_kw={"dt_a": 1.0},
    )
    plan_id = plans[0].id
    assert functions["get_plan"](plan_id=plan_id)["id"] == plan_id
    assert any(p["id"] == plan_id for p in functions["list_plans"]())


# -- consumer tools -------------------------------------------------------


def test_consumer_tools_scoped_to_one_consumer(service: GridService) -> None:
    network = service.scenario.network
    consumer_id = str(network.consumers.consumer_ids[0])
    tools = build_consumer_tool_functions(service, consumer_id)
    assert set(tools.keys()) == {
        "get_my_connection_status",
        "get_my_cap_status",
        "get_my_dr_history",
        "get_my_messages",
    }
    status = tools["get_my_connection_status"]()
    assert status["consumer_id"] == consumer_id


def test_consumer_tools_unknown_consumer_reports_not_found(service: GridService) -> None:
    tools = build_consumer_tool_functions(service, "c_does_not_exist")
    status = tools["get_my_connection_status"]()
    assert status["found"] is False


def test_consumer_cap_status_defaults_to_uncapped(service: GridService) -> None:
    network = service.scenario.network
    consumer_id = str(network.consumers.consumer_ids[0])
    tools = build_consumer_tool_functions(service, consumer_id)
    cap_status = tools["get_my_cap_status"]()
    assert cap_status["capped"] is False


def test_consumer_messages_tool_returns_list(service: GridService) -> None:
    network = service.scenario.network
    consumer_id = str(network.consumers.consumer_ids[0])
    tools = build_consumer_tool_functions(service, consumer_id)
    assert isinstance(tools["get_my_messages"](), list)
