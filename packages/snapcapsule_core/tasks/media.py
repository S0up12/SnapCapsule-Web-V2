import logging

from snapcapsule_core.queue import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="snapcapsule_core.tasks.media.generate_asset_derivatives",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def generate_asset_derivatives(asset_id: str) -> dict[str, str]:
    logger.info("Generating derivatives for asset %s", asset_id)
    return {"asset_id": asset_id, "status": "queued"}


@celery_app.task(name="snapcapsule_core.tasks.media.ping_worker")
def ping_worker() -> dict[str, str]:
    return {"status": "pong"}
