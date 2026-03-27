from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import HTTPException
from fastapi.responses import FileResponse
from snapcapsule_core.models import IngestionJob
from snapcapsule_core.services.ingestion_diagnostics import list_failed_ingestion_assets

from apps.api.app.api.schemas import IngestionFailedItemsResponse


def build_failed_items_response(session, job: IngestionJob, settings) -> IngestionFailedItemsResponse:
    items = list_failed_ingestion_assets(session, job.id, settings)
    return IngestionFailedItemsResponse(
        items=[
            {
                "asset_id": item.asset_id,
                "filename": item.filename,
                "media_type": item.media_type,
                "processing_state": item.processing_state,
                "error_message": item.error_message,
                "source_path": item.source_path,
                "available_path": item.available_path,
            }
            for item in items
        ],
        total=len(items),
    )


def build_failed_item_file_response(session, job: IngestionJob, settings, asset_id: UUID) -> FileResponse:
    assets = list_failed_ingestion_assets(session, job.id, settings)
    matched = next((item for item in assets if item.asset_id == asset_id), None)
    if matched is None:
        raise HTTPException(status_code=404, detail="Failed ingestion item not found.")
    path = Path(matched.available_path) if matched.available_path else None
    if path is None or not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Failed source file is no longer available.")
    return FileResponse(path=path, filename=path.name)
