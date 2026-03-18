from __future__ import annotations

import mimetypes
import re
import uuid
from pathlib import Path
from typing import Iterator

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import FileResponse, Response, StreamingResponse

from apps.api.app.api.schemas import (
    AssetMutationResponse,
    AssetTagsUpdateRequest,
    DashboardStatsResponse,
    ErrorResponse,
    TimelinePageResponse,
    TimelineTagsResponse,
)
from snapcapsule_core.db import SessionLocal, session_scope
from snapcapsule_core.models.enums import MediaType
from snapcapsule_core.services.asset_queries import (
    TimelineFilters,
    get_asset_file_record,
    get_dashboard_stats,
    get_timeline_summary,
    list_available_tags,
    list_timeline_assets,
    toggle_asset_favorite,
    update_asset_tags,
)

router = APIRouter(prefix="/api")

_RANGE_RE = re.compile(r"bytes=(?P<start>\d*)-(?P<end>\d*)$")
_DEFAULT_PAGE_SIZE = 100
_MAX_PAGE_SIZE = 100


@router.get(
    "/stats",
    response_model=DashboardStatsResponse,
    tags=["Dashboard"],
    summary="Get dashboard asset statistics",
    responses={200: {"description": "Summary counts used to render the import flow or the populated dashboard."}},
)
def get_stats() -> DashboardStatsResponse:
    """Return lightweight processed-media counts so the dashboard can decide whether to show onboarding or stats."""
    with SessionLocal() as session:
        stats = get_dashboard_stats(session)

    return DashboardStatsResponse(
        total_assets=stats.total_assets,
        total_memories=stats.total_assets,
        total_photos=stats.total_photos,
        total_videos=stats.total_videos,
    )


@router.get(
    "/timeline",
    response_model=TimelinePageResponse,
    tags=["Timeline"],
    summary="List timeline assets",
    responses={200: {"description": "Paginated list of assets ordered newest first."}},
)
def get_timeline(
    limit: int = Query(_DEFAULT_PAGE_SIZE, ge=1, le=_MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
    sort: str = Query("desc", pattern="^(asc|desc)$"),
    media_type: str = Query("all", pattern="^(all|image|video)$"),
    favorite: bool = Query(False),
    tags: list[str] | None = Query(default=None),
) -> TimelinePageResponse:
    """Return a paginated slice of processed assets for infinite-scroll gallery views."""
    filters = TimelineFilters(
        sort_direction=sort,
        media_type=MediaType(media_type) if media_type in {"image", "video"} else None,
        favorite_only=favorite,
        tags=tuple(tag.strip() for tag in (tags or []) if tag.strip()),
    )

    with SessionLocal() as session:
        items = list_timeline_assets(session, limit=limit, offset=offset, filters=filters)
        summary = get_timeline_summary(session, filters)

    return {
        "items": [
            {
                "id": str(item.id),
                "taken_at": item.taken_at.isoformat() if item.taken_at else None,
                "media_type": item.media_type.value,
                "is_favorite": item.is_favorite,
                "tags": list(item.tags),
                "has_overlay": item.has_overlay,
            }
            for item in items
        ],
        "limit": limit,
        "offset": offset,
        "total": summary.total_assets,
        "has_more": offset + len(items) < summary.total_assets,
        "summary": {
            "total_assets": summary.total_assets,
            "total_photos": summary.total_photos,
            "total_videos": summary.total_videos,
        },
    }


@router.get(
    "/timeline/tags",
    response_model=TimelineTagsResponse,
    tags=["Timeline"],
    summary="List available timeline tags",
)
def get_timeline_tags() -> TimelineTagsResponse:
    """Return distinct asset tags so the memories filter bar can offer a data-driven tag dropdown."""
    with SessionLocal() as session:
        return TimelineTagsResponse(tags=list_available_tags(session))


@router.post(
    "/asset/{asset_id}/favorite",
    response_model=AssetMutationResponse,
    tags=["Timeline"],
    summary="Toggle asset favorite status",
    responses={404: {"model": ErrorResponse, "description": "Asset not found."}},
)
def post_asset_favorite(asset_id: uuid.UUID) -> AssetMutationResponse:
    """Toggle the favorite flag for a single asset used by the memories context menu and hover indicators."""
    with session_scope() as session:
        updated = toggle_asset_favorite(session, asset_id)
        if updated is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")

    return AssetMutationResponse(id=updated.id, is_favorite=updated.is_favorite, tags=list(updated.tags))


@router.post(
    "/asset/{asset_id}/tags",
    response_model=AssetMutationResponse,
    tags=["Timeline"],
    summary="Update asset tags",
    responses={404: {"model": ErrorResponse, "description": "Asset not found."}},
)
def post_asset_tags(asset_id: uuid.UUID, payload: AssetTagsUpdateRequest) -> AssetMutationResponse:
    """Replace the text tag list for a single asset so memories can be filtered and organized by custom labels."""
    with session_scope() as session:
        updated = update_asset_tags(session, asset_id, payload.tags)
        if updated is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")

    return AssetMutationResponse(id=updated.id, is_favorite=updated.is_favorite, tags=list(updated.tags))


@router.get(
    "/asset/{asset_id}/thumbnail",
    response_class=FileResponse,
    tags=["Media Server"],
    summary="Serve an asset thumbnail",
    responses={
        200: {
            "description": "Small web-optimized thumbnail image.",
            "content": {
                "image/jpeg": {},
                "image/png": {},
                "image/webp": {},
            },
        },
        404: {"model": ErrorResponse, "description": "Asset or thumbnail file was not found."},
    },
)
def get_asset_thumbnail(asset_id: uuid.UUID) -> FileResponse:
    """Serve the compressed thumbnail file used by the virtualized gallery grid."""
    with SessionLocal() as session:
        asset = get_asset_file_record(session, asset_id)

    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    if not asset.thumbnail_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thumbnail not available.")

    thumbnail_path = _existing_file(asset.thumbnail_path, "Thumbnail file is missing.")
    media_type = mimetypes.guess_type(thumbnail_path.name)[0] or "image/jpeg"
    return FileResponse(
        path=thumbnail_path,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.get(
    "/asset/{asset_id}/overlay",
    response_class=FileResponse,
    tags=["Media Server"],
    summary="Serve an asset overlay image",
    responses={
        200: {
            "description": "Original Snapchat overlay image used to composite edited memories in the viewer.",
            "content": {"image/png": {}, "image/webp": {}, "application/octet-stream": {}},
        },
        404: {"model": ErrorResponse, "description": "Asset or overlay file was not found."},
    },
)
def get_asset_overlay(asset_id: uuid.UUID) -> FileResponse:
    with SessionLocal() as session:
        asset = get_asset_file_record(session, asset_id)

    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    if not asset.overlay_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Overlay not available.")

    overlay_path = _existing_file(asset.overlay_path, "Overlay file is missing.")
    media_type = mimetypes.guess_type(overlay_path.name)[0] or "application/octet-stream"
    return FileResponse(
        path=overlay_path,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get(
    "/asset/{asset_id}/original",
    response_class=FileResponse,
    tags=["Media Server"],
    summary="Serve original media",
    responses={
        200: {
            "description": "Original image or full file response when no range header is provided.",
            "content": {
                "image/jpeg": {},
                "image/png": {},
                "video/mp4": {},
                "application/octet-stream": {},
            },
        },
        206: {
            "description": "Partial content response for ranged video playback.",
            "content": {"video/mp4": {}, "video/webm": {}, "video/quicktime": {}},
        },
        404: {"model": ErrorResponse, "description": "Asset or original media file was not found."},
        416: {"description": "Requested byte range was invalid for the media file."},
    },
)
def get_asset_original(asset_id: uuid.UUID, request: Request):
    """Serve the original image or video file, including HTTP range support for video scrubbing."""
    with SessionLocal() as session:
        asset = get_asset_file_record(session, asset_id)

    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")

    original_path = _existing_file(asset.original_path, "Original media file is missing.")
    media_type = mimetypes.guess_type(original_path.name)[0] or "application/octet-stream"

    if asset.media_type not in {MediaType.VIDEO, MediaType.AUDIO}:
        return FileResponse(
            path=original_path,
            media_type=media_type,
            headers={"Cache-Control": "public, max-age=3600"},
        )

    file_size = original_path.stat().st_size
    headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
    }
    range_header = request.headers.get("range")
    if not range_header:
        headers["Content-Length"] = str(file_size)
        return FileResponse(path=original_path, media_type=media_type, headers=headers)

    byte_range = _parse_range_header(range_header, file_size)
    if byte_range is None:
        headers["Content-Range"] = f"bytes */{file_size}"
        return Response(status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE, headers=headers)

    start, end = byte_range
    content_length = end - start + 1
    headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"
    headers["Content-Length"] = str(content_length)
    return StreamingResponse(
        _iter_file_range(original_path, start, end),
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        media_type=media_type,
        headers=headers,
    )


def _existing_file(path_value: str, not_found_detail: str) -> Path:
    path = Path(path_value)
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=not_found_detail)
    return path


def _parse_range_header(range_header: str, file_size: int) -> tuple[int, int] | None:
    match = _RANGE_RE.fullmatch(range_header.strip())
    if not match:
        return None

    start_text = match.group("start")
    end_text = match.group("end")
    if not start_text and not end_text:
        return None

    if not start_text:
        suffix_length = int(end_text)
        if suffix_length <= 0:
            return None
        start = max(file_size - suffix_length, 0)
        return start, file_size - 1

    start = int(start_text)
    if start >= file_size:
        return None

    end = int(end_text) if end_text else file_size - 1
    end = min(end, file_size - 1)
    if end < start:
        return None
    return start, end


def _iter_file_range(path: Path, start: int, end: int, chunk_size: int = 1024 * 1024) -> Iterator[bytes]:
    remaining = end - start + 1
    with path.open("rb") as handle:
        handle.seek(start)
        while remaining > 0:
            chunk = handle.read(min(chunk_size, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk
