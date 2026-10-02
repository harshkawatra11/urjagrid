"""``/api/v1/openadr`` -- OpenADR 3 VTN REST resources (programs/events), B9."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.services.deps import get_grid_service
from app.services.service import GridService

router = APIRouter(prefix="/api/v1/openadr", tags=["openadr"])


@router.get("/programs")
async def list_programs(service: GridService = Depends(get_grid_service)) -> list[dict]:
    vtn = service.dispatcher.openadr_vtn
    return [
        {"id": program_id, "program_name": program.program_name, "event_count": len(program.events)}
        for program_id, program in vtn.programs.items()
    ]


@router.get("/programs/{program_id}/events")
async def list_events(
    program_id: str, service: GridService = Depends(get_grid_service)
) -> list[dict]:
    vtn = service.dispatcher.openadr_vtn
    program = vtn.programs.get(program_id)
    if program is None:
        return []
    return [event.to_resource() for event in program.events]


__all__ = ["router"]
