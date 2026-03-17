# SnapCapsule Web Frontend

React, Vite, and Tailwind frontend for the SnapCapsule media timeline.

Key pieces:

- Virtualized timeline grid backed by `/api/timeline`
- Infinite scrolling with TanStack Query
- Lightweight thumbnail loading from `/api/asset/{id}/thumbnail`
- Full-screen viewer with direct image loading and streamed video playback from `/api/asset/{id}/original`
