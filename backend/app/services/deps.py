"""FastAPI dependency injection for the singleton ``GridService`` (B5)."""

from __future__ import annotations

from app.core.config import get_settings
from app.services.service import GridService

_singleton: GridService | None = None


def get_grid_service() -> GridService:
    global _singleton
    if _singleton is None:
        settings = get_settings()
        _singleton = GridService(time_scale=settings.time_scale)
        _singleton.boot()
    return _singleton


def reset_grid_service() -> GridService:
    """Used by the admin reset endpoint and by tests that need a clean slate."""
    global _singleton
    _singleton = None
    return get_grid_service()


__all__ = ["get_grid_service", "reset_grid_service"]
