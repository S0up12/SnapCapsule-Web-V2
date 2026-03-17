FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

COPY pyproject.toml README.md ./
COPY apps ./apps
COPY packages ./packages

RUN pip install --upgrade pip \
    && pip install .

CMD ["sh", "-c", "celery -A apps.worker.app.worker:celery_app worker --loglevel=INFO --concurrency=${WORKER_CONCURRENCY:-2}"]
