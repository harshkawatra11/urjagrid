"""FastAPI app factory for the UrjaGrid backend.

Lane A owns this file only to the extent of bootstrapping (A1); the actual
`/api/v1` route surface belongs to Lane B (B9), which mounts its routers at
the ``# ROUTERS`` marker below. Keep this module minimal: CORS, security
headers, exception handling, and a health check only.
"""

from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.exceptions import ApiError, InvalidTransitionError, NotFoundError, UrjaGridError

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "X-XSS-Protection": "0",
}


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="UrjaGrid API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def security_headers_middleware(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        for key, value in SECURITY_HEADERS.items():
            response.headers[key] = value
        return response

    @app.exception_handler(NotFoundError)
    async def not_found_handler(_request: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(InvalidTransitionError)
    async def invalid_transition_handler(
        _request: Request, exc: InvalidTransitionError
    ) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": str(exc)})

    @app.exception_handler(ApiError)
    async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    @app.exception_handler(UrjaGridError)
    async def urjagrid_error_handler(_request: Request, exc: UrjaGridError) -> JSONResponse:
        return JSONResponse(status_code=500, content={"detail": str(exc)})

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "env": settings.env}

    # ROUTERS
    from app.api.v1.admin import router as admin_router
    from app.api.v1.analytics import router as analytics_router
    from app.api.v1.auth import router as auth_router
    from app.api.v1.consumers import router as consumers_router
    from app.api.v1.economics import router as economics_router
    from app.api.v1.events import router as events_router
    from app.api.v1.fairness import router as fairness_router
    from app.api.v1.field import router as field_router
    from app.api.v1.flex import router as flex_router
    from app.api.v1.forecast import router as forecast_router
    from app.api.v1.grid import router as grid_router
    from app.api.v1.insights import router as insights_router
    from app.api.v1.openadr import router as openadr_router
    from app.api.v1.plans import router as plans_router
    from app.api.v1.protocols import router as protocols_router
    from app.api.v1.reliability import router as reliability_router
    from app.api.v1.scenario import router as scenario_router
    from app.api.v1.stream import router as stream_router
    from app.voice.router import router as voice_router

    for r in (
        auth_router,
        grid_router,
        forecast_router,
        plans_router,
        flex_router,
        consumers_router,
        field_router,
        protocols_router,
        scenario_router,
        economics_router,
        openadr_router,
        admin_router,
        insights_router,
        reliability_router,
        fairness_router,
        events_router,
        analytics_router,
        stream_router,
        voice_router,
    ):
        app.include_router(r)

    return app


app = create_app()
