# SnapCapsule Web

SnapCapsule Web is a worker-driven Snapchat archive service built around FastAPI, Celery, PostgreSQL, Redis, and a React gallery frontend.

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
docker-compose.dev.yml
pyproject.toml
```

## Services

- `db`: PostgreSQL for archive metadata, timestamps, relationships, and file paths
- `redis`: Redis broker/result backend for Celery
- `migrate`: one-shot Alembic migration service that runs before the app starts
- `backend`: FastAPI API, internal only
- `worker`: Celery ingestion and media-processing worker, internal only
- `web`: Nginx gateway serving the optimized React build and proxying `/api/*` plus `/health`

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
3. Start the application:

```bash
docker compose up -d --build
```

4. Open the app:

```bash
http://localhost:3000
```

The default Compose stack is the production-style install path used for local testing and Portainer. Only `web` publishes a host port; the API remains available through the same origin at `/api/*`, and health checks are available through `/health`.

## ZimaOS / Portainer

Use [docker-compose.zimaos.yml](C:/Users/Sammy/Documents/GitHub/SnapCapsule-Web-V2/docker-compose.zimaos.yml) for ZimaOS custom app imports or Portainer stacks that should run from prebuilt images instead of local `build:` steps.

Important constraints:

- Portainer Git stacks are a poor fit for this repo's source-build compose file. Portainer documents Git-based image builds as not fully implemented.
- ZimaOS dashboard metadata comes from the `x-casaos` block, so importing the ZimaOS compose file through ZimaOS is the path that gives you the app icon and Web UI metadata.
- The ZimaOS compose file expects published images. Set `SNAPCAPSULE_BACKEND_IMAGE` and `SNAPCAPSULE_WEB_IMAGE` first.

Suggested flow:

1. Copy [.env.zimaos.example](C:/Users/Sammy/Documents/GitHub/SnapCapsule-Web-V2/.env.zimaos.example) to your server and fill in the image references plus password.
2. Deploy [docker-compose.zimaos.yml](C:/Users/Sammy/Documents/GitHub/SnapCapsule-Web-V2/docker-compose.zimaos.yml) with those environment values.
3. If you want the app to appear on the ZimaOS dashboard, import it as a custom app in ZimaOS instead of creating it only as a Portainer-managed stack.

Useful checks:

```bash
docker compose ps
curl http://localhost:3000/health
curl http://localhost:3000/api/stats
```

## Hot-Reload Development

Use the dev Compose file only when you specifically want Vite and Uvicorn hot reload:

```bash
docker compose -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.dev.yml run --rm backend alembic upgrade head
```

The dev frontend runs on `http://localhost:3000`, and the API is also published on `http://localhost:8000/health`.

If you want to run the Python app directly from your IDE, keep only the dev database and Redis running:

```bash
docker compose -f docker-compose.dev.yml up -d db redis
python -m uvicorn apps.api.app.main:app --reload
```

The default host configuration uses `127.0.0.1` for Postgres and Redis and stores local data under `./data`, so the same checkout works cleanly across different PCs without editing source files. If you already have the backend dependencies installed locally, `alembic upgrade head` also works from the repo root.
Postgres now defaults to a Docker named volume instead of `./data/postgres`, which avoids stale machine-specific database clusters breaking startup when you switch computers. If you already have an old `./data/postgres` folder from a previous setup, stop the stack and remove it before recreating the database container.

## Tests

Backend tests run against a dedicated Postgres test database so they do not touch the live archive metadata.

```powershell
.\scripts\run-backend-tests.ps1
```

## Phase Scope

This repo currently includes:

- the monorepo folder structure for `api`, `worker`, and `web`
- a production-style Docker Compose stack with a single public web gateway
- an optional hot-reload Docker Compose stack for local development
- SQLAlchemy 2.0 models for assets, chats, memories, and stories
- FastAPI ingestion, timeline, and media-serving routes
- Celery ingestion and media-processing workers
- a virtualized React gallery frontend with a lightbox viewer
