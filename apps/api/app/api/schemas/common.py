from __future__ import annotations

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    detail: str = Field(
        ...,
        description="Human-readable error message returned by the API.",
        examples=["Asset not found."],
    )


class StorageDirectories(BaseModel):
    raw_media_dir: str = Field(
        ...,
        description="Mounted directory used to store original Snapchat media files.",
        examples=["/srv/snapcapsule/raw"],
    )
    thumbnail_dir: str = Field(
        ...,
        description="Mounted directory used to store web-optimized thumbnail files.",
        examples=["/srv/snapcapsule/thumbnails"],
    )


class RootResponse(BaseModel):
    service: str = Field(..., description="Display name of the running API service.", examples=["SnapCapsule Web API"])
    status: str = Field(..., description="Top-level service status.", examples=["ok"])
    healthcheck: str = Field(..., description="Path to the machine-readable health endpoint.", examples=["/health"])
    storage: StorageDirectories


class ServiceHealth(BaseModel):
    status: str = Field(..., description="Status reported by a dependency check.", examples=["ok"])
    error: str | None = Field(
        default=None,
        description="Dependency error details when the service is degraded.",
        examples=[None],
    )


class HealthServices(BaseModel):
    database: ServiceHealth
    redis: ServiceHealth


class HealthResponse(BaseModel):
    status: str = Field(..., description="Aggregated platform health status.", examples=["ok"])
    services: HealthServices
