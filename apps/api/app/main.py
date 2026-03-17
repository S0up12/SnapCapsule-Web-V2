from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.app.api.routes.health import router as health_router
from snapcapsule_core.config import get_settings
from snapcapsule_core.db import init_database

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.ensure_storage_dirs()
    init_database()
    yield


app = FastAPI(
    title=settings.project_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)


@app.get("/")
def root() -> dict[str, object]:
    return {
        "service": settings.project_name,
        "status": "ok",
        "healthcheck": "/health",
        "storage": {
            "raw_media_dir": settings.raw_media_dir,
            "thumbnail_dir": settings.thumbnail_dir,
        },
    }
