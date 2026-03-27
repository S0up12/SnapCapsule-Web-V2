# SnapCapsule Web

SnapCapsule Web is a development-first, worker-driven Snapchat archive service built around FastAPI, Celery, PostgreSQL, Redis, and a React/Vite gallery frontend.

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
  backend/
    Dockerfile
  worker/
    app/
      worker.py
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

- `db`: PostgreSQL for archive metadata, timestamps, relationships, and file paths
- `redis`: Redis broker/result backend for Celery
- `backend`: FastAPI service running with `uvicorn --reload` against the mounted source tree
- `worker`: Celery worker using the same shared Python image and mounted codebase
- `frontend`: Vite development server with live React/Tailwind hot reload

## Storage Model

The compose stack maps permanent host storage into the Python services:

- `raw` for original Snapchat media files
- `thumbnails` for web-ready derivatives
- `ingest` for upload archives and extraction workspaces
- `postgres` for database persistence

That keeps media serving simple and fast: the API reads metadata from Postgres, while both the API and worker can access the same files without copying blobs through Redis or the database.

## Quick Start

1. Copy `.env.example` to `.env`.
2. Adjust the host storage paths if needed.
3. Start the full development stack:

```bash
docker compose up --build
```

4. Open the apps:

```bash
http://localhost:3000
http://localhost:8000/health
```

The frontend runs through Vite on port `3000`, the API runs on port `8000`, and both backend and frontend reload automatically when you save local files.

## Tests

Backend tests run against a dedicated Postgres test database so they do not touch the live archive metadata.

```powershell
.\scripts\run-backend-tests.ps1
```

## Phase Scope

This repo currently includes:

- the monorepo folder structure for `api`, `worker`, and `web`
- a development-oriented Docker Compose stack for Postgres, Redis, FastAPI, Celery, and Vite
- SQLAlchemy 2.0 models for assets, chats, memories, and stories
- FastAPI ingestion, timeline, and media-serving routes
- Celery ingestion and media-processing workers
- a virtualized React gallery frontend with a lightbox viewer
