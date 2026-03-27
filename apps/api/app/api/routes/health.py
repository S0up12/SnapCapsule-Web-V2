from fastapi import APIRouter
from fastapi.responses import JSONResponse
from snapcapsule_core.db import SessionLocal
from snapcapsule_core.queue import get_redis_client
from sqlalchemy import text

from apps.api.app.api.schemas import HealthResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="Check API dependencies",
    responses={503: {"model": HealthResponse, "description": "One or more backing services are unavailable."}},
)
def healthcheck() -> dict[str, object]:
    """Check PostgreSQL and Redis connectivity so the UI and local tooling can detect degraded startup states."""
    database_status = "ok"
    redis_status = "ok"
    database_error = None
    redis_error = None

    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
    except Exception as exc:
        database_status = "error"
        database_error = str(exc)

    try:
        get_redis_client().ping()
    except Exception as exc:
        redis_status = "error"
        redis_error = str(exc)

    status = "ok" if database_status == "ok" and redis_status == "ok" else "degraded"
    payload = {
        "status": status,
        "services": {
            "database": {"status": database_status, "error": database_error},
            "redis": {"status": redis_status, "error": redis_error},
        },
    }

    if status != "ok":
        return JSONResponse(status_code=503, content=payload)

    return payload
