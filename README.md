# SnapCapsule Web

Phase 1 and 2 establish the container foundation, shared Python package, and initial Postgres schema for a worker-driven Snapchat archive service.

## Architecture Notes

This scaffold is based on three implementation cues from the existing codebases:

- `SnapCapsule_V2` indexes media first, then links chat entries with explicit `Media IDs`, with a conservative date-based fallback when IDs are missing.
- `SnapCapsule_V2` treats `snap_history.json` as a separate source from `chat_history.json`, so the schema keeps chat message source metadata instead of flattening both into one undifferentiated stream.
- `immich` keeps media-serving and heavy processing separated through shared storage plus background workers. This scaffold mirrors that split with a FastAPI API, Redis, and a Celery worker sharing the same raw and thumbnail volumes.

## Project Layout

```text
apps/
  api/
    app/
      api/
        routes/
          health.py
      main.py
    Dockerfile
  worker/
    app/
      worker.py
    Dockerfile
  web/
    README.md
packages/
  snapcapsule_core/
    models/
      __init__.py
      base.py
      entities.py
      enums.py
    tasks/
      __init__.py
      media.py
    __init__.py
    config.py
    db.py
    queue.py
.env.example
docker-compose.yml
pyproject.toml
```

## Services

- `snapcapsule-db`: PostgreSQL for archive metadata, timestamps, relationships, and file paths
- `snapcapsule-redis`: Redis broker/result backend for Celery
- `snapcapsule-api`: FastAPI service for HTTP requests and health checks
- `snapcapsule-worker`: Celery worker for derivative generation and future ingestion/media jobs

## Storage Model

The compose stack maps two host directories into both Python services:

- `raw` for original Snapchat media files
- `thumbnails` for web-ready derivatives

That keeps media serving simple and fast: the API reads metadata from Postgres, while both the API and worker can access the same files without copying blobs through Redis or the database.

## Quick Start

1. Copy `.env.example` to `.env`.
2. Adjust the host storage paths.
3. Start the stack:

```bash
docker compose up --build
```

4. Verify the stack:

```bash
curl http://localhost:8000/health
```

The current health route checks both PostgreSQL and Redis connectivity.

## Phase Scope

This repo currently includes:

- the monorepo folder structure for `api`, `worker`, and `web`
- Docker Compose for Postgres, Redis, FastAPI, and Celery
- SQLAlchemy 2.0 models for assets, chats, memories, and stories
- FastAPI startup with automatic schema creation and a health route
- a Celery app plus placeholder media task wiring

The frontend app itself is intentionally deferred to a later phase.
