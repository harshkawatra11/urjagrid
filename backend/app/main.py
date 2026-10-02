"""FastAPI app factory for the LifelineGrid backend.

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
from app.core.exceptions import ApiError, InvalidTransitionError, LifelineGridError, NotFoundError

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "X-XSS-Protection": "0",
}


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="LifelineGrid API", version="0.1.0")

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

    @app.exception_handler(LifelineGridError)
    async def lifelinegrid_error_handler(
        _request: Request, exc: LifelineGridError
    ) -> JSONResponse:
        return JSONResponse(status_code=500, content={"detail": str(exc)})

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "env": settings.env}

    # ROUTERS

    return app


app = create_app()
