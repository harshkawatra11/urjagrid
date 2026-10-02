"""``/api/v1/{subdivisions,feeders,transformers,critical,geo}`` (B9)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.exceptions import NotFoundError
from app.grid.views import (
    DtTelemetry,
    critical_facilities_view,
    feeders_view,
    geo_view,
    subdivisions_view,
    transformer_detail_view,
    transformers_view,
)
from app.services.deps import get_grid_service
from app.services.service import GridService

router = APIRouter(prefix="/api/v1", tags=["grid"])


@router.get("/subdivisions")
async def list_subdivisions(service: GridService = Depends(get_grid_service)) -> list[dict]:
    return subdivisions_view(service.scenario.network)


@router.get("/feeders")
async def list_feeders(
    subdivision_id: str | None = None, service: GridService = Depends(get_grid_service)
) -> list[dict]:
    return feeders_view(service.scenario.network, subdivision_id=subdivision_id)


def _telemetry(service: GridService) -> DtTelemetry:
    return DtTelemetry(
        loading_pu=service.latest_dt_loading_pu,
        hotspot_c=service.latest_dt_hotspot_c,
        voltage_pu=service.latest_dt_voltage_pu,
        served_kw=service.latest_dt_served_kw,
        demand_kw=service.latest_dt_demand_kw,
        loss_of_life_hours=service.world.solution.cumulative_loss_of_life_hours,
    )


@router.get("/transformers")
async def list_transformers(
    subdivision_id: str | None = None, service: GridService = Depends(get_grid_service)
) -> list[dict]:
    return transformers_view(
        service.scenario.network,
        subdivision_id=subdivision_id,
        telemetry=_telemetry(service),
        with_polygons=True,
    )


@router.get("/transformers/{dt_id}")
async def get_transformer(dt_id: str, service: GridService = Depends(get_grid_service)) -> dict:
    detail = transformer_detail_view(
        service.scenario.network, dt_id, telemetry=_telemetry(service)
    )
    if detail is None:
        raise NotFoundError("Transformer", dt_id)
    return detail


@router.get("/critical")
async def list_critical_facilities(service: GridService = Depends(get_grid_service)) -> list[dict]:
    return critical_facilities_view(service.scenario.network)


@router.get("/geo")
async def get_geo(service: GridService = Depends(get_grid_service)) -> dict:
    return geo_view(service.scenario.network)


__all__ = ["router"]
