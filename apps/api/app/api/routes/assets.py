from __future__ import annotations

import mimetypes
import re
import uuid
from pathlib import Path
from typing import Iterator

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import FileResponse, Response, StreamingResponse

from snapcapsule_core.db import SessionLocal
from snapcapsule_core.models.enums import MediaType
from snapcapsule_core.services.asset_queries import count_timeline_assets, get_asset_file_record, list_timeline_assets

router = APIRouter(prefix="/api", tags=["assets"])

_RANGE_RE = re.compile(r"bytes=(?P<start>\d*)-(?P<end>\d*)$")
_DEFAULT_PAGE_SIZE = 100
_MAX_PAGE_SIZE = 100


@router.get("/timeline")
def get_timeline(
    limit: int = Query(_DEFAULT_PAGE_SIZE, ge=1, le=_MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
) -> dict[str, object]:
    with SessionLocal() as session:
        items = list_timeline_assets(session, limit=limit, offset=offset)
        total = count_timeline_assets(session)

    return {
        "items": [
            {
                "id": str(item.id),
                "taken_at": item.taken_at.isoformat() if item.taken_at else None,
                "media_type": item.media_type.value,
            }
            for item in items
        ],
        "limit": limit,
        "offset": offset,
        "total": total,
        "has_more": offset + len(items) < total,
    }


@router.get("/asset/{asset_id}/thumbnail")
def get_asset_thumbnail(asset_id: uuid.UUID) -> FileResponse:
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


@router.get("/asset/{asset_id}/original")
def get_asset_original(asset_id: uuid.UUID, request: Request):
    with SessionLocal() as session:
        asset = get_asset_file_record(session, asset_id)

    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")

    original_path = _existing_file(asset.original_path, "Original media file is missing.")
    media_type = mimetypes.guess_type(original_path.name)[0] or "application/octet-stream"

    if asset.media_type != MediaType.VIDEO:
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
