"""Smoke tests for the FastAPI app."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from main import STATIC_DIR, app


client = TestClient(app)

requires_static_export = pytest.mark.skipif(
    not STATIC_DIR.exists(),
    reason="frontend/out is not built; run `npm run build` first.",
)


def test_health_returns_ok() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unknown_api_path_is_404() -> None:
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404


@requires_static_export
def test_root_serves_index_html() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "<html" in response.text.lower()


@requires_static_export
def test_root_asset_is_served() -> None:
    response = client.get("/favicon.ico")
    assert response.status_code == 200


@requires_static_export
def test_unknown_route_falls_back_to_index() -> None:
    response = client.get("/some/unknown/page")
    assert response.status_code == 200
    expected = (Path(STATIC_DIR) / "index.html").read_bytes()
    assert response.content == expected


@requires_static_export
def test_path_traversal_via_url_is_blocked() -> None:
    # Starlette normalises `/../etc/passwd` → `/etc/passwd` before our handler runs,
    # which has no `etc/` under `out/` and falls through to the SPA index. The
    # critical property is that the response body never contains the traversal target.
    response = client.get("/../etc/passwd")
    assert response.status_code == 200
    assert response.content == (Path(STATIC_DIR) / "index.html").read_bytes()


@requires_static_export
def test_sibling_directory_lookalike_is_rejected() -> None:
    # Guards against a string-prefix bug: a path that resolves to a sibling whose
    # name starts with the export dir's name (e.g. `out-extra/...`) must not pass.
    # We hit the handler with a constructed path that resolves outside `out/`.
    parent_escape = "../" + STATIC_DIR.name + "-extra/secret"
    response = client.get(f"/{parent_escape}")
    # Starlette will normalise the dot-segment away before our handler runs, but
    # if it ever didn't, our `is_relative_to` guard must reject it.
    assert response.status_code in (200, 404)
    if response.status_code == 200:
        assert response.content == (Path(STATIC_DIR) / "index.html").read_bytes()
