"""The 15 read-only grid tools (B11) -- thin wrappers around the B8 ``views``
and ``GridService``, matching ``schemas.TOOL_SCHEMAS`` name-for-name.
``build_tool_functions`` returns the ``{name: callable}`` dispatch table the
typed Ask agent (and the voice pipeline) actually calls.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from app.grid.models import LeverKey
from app.grid.views import (
    critical_facilities_view,
    feeders_view,
    plan_view,
    plans_view,
    protocol_ledger_view,
    subdivisions_view,
    transformer_detail_view,
    transformers_view,
)
from app.services.economics import unit_economics
from app.services.scenario import BUILTIN_SCENARIO_NAMES
from app.services.service import GridService
from app.tools.resolve import fuzzy_resolve


def _entity_names(service: GridService) -> dict[str, str]:
    names: dict[str, str] = {}
    for sub_id in service.scenario.network.subdivision_ids:
        names[sub_id] = sub_id.replace("sd_", "").replace("_", " ").title()
    for dt_id in service.scenario.network.dt_ids:
        names[dt_id] = dt_id
    return names


def resolve_entity(service: GridService, query: str) -> dict[str, Any]:
    match = fuzzy_resolve(query, _entity_names(service))
    if match is None:
        return {"found": False, "query": query}
    entity_id, score = match
    return {"found": True, "query": query, "entity_id": entity_id, "score": score}


def list_subdivisions(service: GridService) -> list[dict]:
    return subdivisions_view(service.scenario.network)


def list_feeders(service: GridService, subdivision_id: str | None = None) -> list[dict]:
    return feeders_view(service.scenario.network, subdivision_id=subdivision_id)


def list_transformers(service: GridService, subdivision_id: str | None = None) -> list[dict]:
    return transformers_view(service.scenario.network, subdivision_id=subdivision_id)


def get_transformer(service: GridService, dt_id: str) -> dict | None:
    return transformer_detail_view(service.scenario.network, dt_id)


def list_critical_facilities(service: GridService) -> list[dict]:
    return critical_facilities_view(service.scenario.network)


def get_forecast(service: GridService, subdivision_id: str) -> dict:
    import numpy as np

    from app.grid.planner import DtForecastInput, build_forecast_bundle

    network = service.scenario.network
    dt_inputs = []
    for dt_id in network.dt_ids:
        if network.dt_subdivision[dt_id] != subdivision_id:
            continue
        gross = service.scenario.dt_gross_kw[dt_id]
        rated_kw = next(d.rated_kw for d in service.dt_statics if d.dt_id == dt_id)
        p50_pu = np.clip(gross / rated_kw, 0.0, None)
        dt_inputs.append(
            DtForecastInput(
                dt_id=dt_id,
                bottom_up_kw=gross,
                p10_pu=p50_pu * 0.8,
                p50_pu=p50_pu,
                p90_pu=p50_pu * 1.2,
                rated_kw=rated_kw,
                available_kw=service.scenario.dt_available_kw[dt_id],
            )
        )
    return build_forecast_bundle(subdivision_id, dt_inputs).model_dump(mode="json")


def list_plans(service: GridService, subdivision_id: str | None = None) -> list[dict]:
    return plans_view(service.plan_service.list_plans(subdivision_id))


def get_plan(service: GridService, plan_id: str) -> dict:
    return plan_view(service.plan_service.get(plan_id))


def get_kpis(service: GridService) -> dict:
    return service.kpis()


def get_risk_ranking(service: GridService) -> list[dict]:
    return service.risk_summary()


def get_protocol_summary(service: GridService) -> dict:
    return {
        "counts": service.ledger.counts_by_protocol(),
        "recent": protocol_ledger_view(service.ledger.all()[-10:]),
    }


def get_lever_status(service: GridService) -> dict:
    from app.grid.models import PlanStatus

    active = [
        p
        for p in service.plan_service.list_plans()
        if p.status in (PlanStatus.APPROVED, PlanStatus.DISPATCHED)
    ]
    return {
        "active_plan_count": len(active),
        "levers": [lever.value for lever in LeverKey],
    }


def get_unit_economics(service: GridService) -> dict:
    n_meters = len(service.scenario.network.consumers)
    return unit_economics(n_meters, 500.0, 2000.0).to_view()


def get_scenario_names(service: GridService) -> list[str]:  # noqa: ARG001
    return list(BUILTIN_SCENARIO_NAMES)


def build_tool_functions(service: GridService) -> dict[str, Callable[..., Any]]:
    """Bind every tool function to ``service``, returning the dispatch table
    the Ask agent calls by name (matching ``schemas.TOOL_SCHEMAS``).
    """
    return {
        "resolve_entity": lambda query: resolve_entity(service, query),
        "list_subdivisions": lambda: list_subdivisions(service),
        "list_feeders": lambda subdivision_id=None: list_feeders(service, subdivision_id),
        "list_transformers": lambda subdivision_id=None: list_transformers(service, subdivision_id),
        "get_transformer": lambda dt_id: get_transformer(service, dt_id),
        "list_critical_facilities": lambda: list_critical_facilities(service),
        "get_forecast": lambda subdivision_id: get_forecast(service, subdivision_id),
        "list_plans": lambda subdivision_id=None: list_plans(service, subdivision_id),
        "get_plan": lambda plan_id: get_plan(service, plan_id),
        "get_kpis": lambda: get_kpis(service),
        "get_risk_ranking": lambda: get_risk_ranking(service),
        "get_protocol_summary": lambda: get_protocol_summary(service),
        "get_lever_status": lambda: get_lever_status(service),
        "get_unit_economics": lambda: get_unit_economics(service),
        "get_scenario_names": lambda: get_scenario_names(service),
    }


__all__ = [
    "resolve_entity",
    "list_subdivisions",
    "list_feeders",
    "list_transformers",
    "get_transformer",
    "list_critical_facilities",
    "get_forecast",
    "list_plans",
    "get_plan",
    "get_kpis",
    "get_risk_ranking",
    "get_protocol_summary",
    "get_lever_status",
    "get_unit_economics",
    "get_scenario_names",
    "build_tool_functions",
]
