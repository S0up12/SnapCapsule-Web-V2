from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from snapcapsule_core.config import get_settings
from snapcapsule_core.db import SessionLocal
from snapcapsule_core.services.profile_queries import get_profile_snapshot

from apps.api.app.api.schemas import ErrorResponse, ProfileResponse

router = APIRouter(prefix="/api")


@router.get(
    "/profile",
    response_model=ProfileResponse,
    tags=["Profile"],
    summary="Get imported Snapchat profile data",
    responses={
        200: {"description": "Compact profile summary derived from Snapchat account export files."},
        404: {"model": ErrorResponse, "description": "No profile data could be found for the current archive."},
    },
)
def get_profile() -> ProfileResponse:
    settings = get_settings()
    with SessionLocal() as session:
        snapshot = get_profile_snapshot(session, settings)

    if snapshot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Snapchat profile data was found in the current archive.",
        )

    return ProfileResponse.model_validate(snapshot)
