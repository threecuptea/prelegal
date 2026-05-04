"""Prelegal V1 backend.

Serves the Next.js static export from ``frontend/out`` and exposes API
routes under ``/api``. Feature routes will be registered from
``backend/routes/`` in subsequent tickets.
"""

from __future__ import annotations

import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

load_dotenv()

from routes.chat import router as chat_router  # noqa: E402  (env must load first)

logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).parent.parent / "frontend" / "out"

app = FastAPI(title="Prelegal API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(chat_router)


if STATIC_DIR.exists():
    next_dir = STATIC_DIR / "_next"
    if next_dir.exists():
        app.mount("/_next", StaticFiles(directory=next_dir), name="next_static")

    static_root = STATIC_DIR.resolve()

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
    def serve_frontend(full_path: str) -> FileResponse:
        # /api/* must surface as 404 here so future API routes aren't shadowed.
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404)

        if not full_path:
            return FileResponse(STATIC_DIR / "index.html")

        candidate = (STATIC_DIR / full_path).resolve()
        # Reject anything that escapes the export directory.
        if not candidate.is_relative_to(static_root):
            raise HTTPException(status_code=404)

        if candidate.is_file():
            return FileResponse(candidate)

        html_candidate = candidate.with_suffix(".html")
        if html_candidate.is_file():
            return FileResponse(html_candidate)

        # SPA-style fallback for unknown routes.
        return FileResponse(STATIC_DIR / "index.html")
else:
    logger.warning(
        "Frontend export not found at %s; only /api routes are available.",
        STATIC_DIR,
    )
