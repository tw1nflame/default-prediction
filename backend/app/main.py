from __future__ import annotations

import asyncio

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.models import router as models_router
from api.predict import router as predict_router
from services.errors import AppError
from services.runtime_cleanup import run_daily_runtime_cleanup, stop_runtime_cleanup
from settings import (
    API_PREFIX,
    CORS_ALLOW_CREDENTIALS,
    CORS_ALLOW_HEADERS,
    CORS_ALLOW_METHODS,
    CORS_ALLOW_ORIGINS,
    RUNTIME_ROOT,
)


def create_app() -> FastAPI:
    app = FastAPI(title="Default prediction API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ALLOW_ORIGINS,
        allow_credentials=CORS_ALLOW_CREDENTIALS,
        allow_methods=CORS_ALLOW_METHODS,
        allow_headers=CORS_ALLOW_HEADERS,
    )

    app.include_router(models_router, prefix=API_PREFIX)
    app.include_router(predict_router, prefix=API_PREFIX)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.on_event("startup")
    async def start_runtime_cleanup():
        app.state.runtime_cleanup_task = asyncio.create_task(run_daily_runtime_cleanup(RUNTIME_ROOT))

    @app.on_event("shutdown")
    async def shutdown_runtime_cleanup():
        task = getattr(app.state, "runtime_cleanup_task", None)
        if task is not None:
            await stop_runtime_cleanup(task)

    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError):
        return JSONResponse(status_code=400, content={"error": {"message": exc.message, "code": exc.code}})

    return app


app = create_app()
