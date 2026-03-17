from snapcapsule_core.queue import celery_app
from snapcapsule_core.tasks import media as _media  # noqa: F401

__all__ = ["celery_app"]
