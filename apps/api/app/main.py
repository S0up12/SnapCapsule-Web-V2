from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.app.api.routes.assets import router as assets_router
from apps.api.app.api.routes.health import router as health_router
from apps.api.app.api.routes.ingestion import router as ingestion_router
from apps.api.app.api.routes.settings import router as settings_router
from apps.api.app.api.schemas import RootResponse
from snapcapsule_core.config import get_settings
from snapcapsule_core.db import init_database

settings = get_settings()

OPENAPI_TAGS = [
    {
        "name": "System",
        "description": "Platform metadata and health endpoints used to validate the development stack.",
    },
    {
        "name": "Ingestion",
        "description": "Endpoints for queueing Snapchat exports and tracking background ingestion progress.",
    },
    {
        "name": "Timeline",
        "description": "Lightweight, paginated asset listings optimized for virtualized gallery views.",
    },
    {
        "name": "Dashboard",
        "description": "Summary endpoints used by the web dashboard to decide between import onboarding and stats views.",
    },
    {
        "name": "Settings",
        "description": "User preferences and developer-friendly runtime configuration for the web workspace.",
    },
    {
        "name": "Media Server",
        "description": "Fast file-serving endpoints for thumbnails and originals, including HTTP range support for videos.",
    },
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.ensure_storage_dirs()
    init_database()
    yield


app = FastAPI(
    title="SnapCapsule Web API",
    description=(
        "SnapCapsule Web API exposes ingestion, timeline, and media-serving endpoints for a "
        "high-performance Snapchat archive viewer. The platform is designed around background "
        "Celery workers, PostgreSQL metadata, Redis queueing, and direct filesystem media access "
        "for fast thumbnail grids and video streaming."
    ),
    version="0.7.0",
    lifespan=lifespan,
    openapi_tags=OPENAPI_TAGS,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets_router)
app.include_router(health_router)
app.include_router(ingestion_router)
app.include_router(settings_router)


@app.get(
    "/",
    response_model=RootResponse,
    tags=["System"],
    summary="Get API service metadata",
)
def root() -> RootResponse:
    """Return a small service summary used by local smoke tests and operator checks."""
    return {
        "service": "SnapCapsule Web API",
        "status": "ok",
        "healthcheck": "/health",
        "storage": {
            "raw_media_dir": settings.raw_media_dir,
            "thumbnail_dir": settings.thumbnail_dir,
        },
    }
