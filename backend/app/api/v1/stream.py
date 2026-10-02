"""``GET /api/v1/stream`` -- SSE endpoint (B5/B9)."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from app.services.deps import get_grid_service
from app.services.service import GridService
from app.services.stream import plans_event, tick_events

router = APIRouter(prefix="/api/v1", tags=["stream"])


async def _event_generator(service: GridService) -> AsyncIterator[dict]:
    yield plans_event(service)
    while True:
        for event in tick_events(service):
            yield event
        await asyncio.sleep(1.0)


@router.get("/stream")
async def stream(service: GridService = Depends(get_grid_service)) -> EventSourceResponse:
    return EventSourceResponse(_event_generator(service))


__all__ = ["router"]
