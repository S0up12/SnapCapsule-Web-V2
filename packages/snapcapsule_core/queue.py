from celery import Celery
from redis import Redis

from snapcapsule_core.config import get_settings

settings = get_settings()


def create_celery_app() -> Celery:
    app = Celery(
        "snapcapsule",
        broker=settings.broker_url,
        backend=settings.result_backend,
    )
    app.conf.update(
        task_default_queue="media",
        task_routes={
            "snapcapsule_core.tasks.media.generate_asset_derivatives": {"queue": "media"},
            "snapcapsule_core.tasks.media.ping_worker": {"queue": "media"},
        },
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        task_track_started=True,
        task_acks_late=True,
        worker_prefetch_multiplier=1,
        broker_connection_retry_on_startup=True,
        result_expires=3600,
    )
    return app


celery_app = create_celery_app()


def get_redis_client() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)
