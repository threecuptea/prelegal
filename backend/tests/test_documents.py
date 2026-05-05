"""Tests for document CRUD endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

_SAMPLE_FIELDS = {
    "purpose": "Testing partnership",
    "effectiveDate": "2025-01-01",
    "governingLaw": "California",
}


@pytest.fixture(autouse=True)
def _setup(tmp_path: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", "test-jwt-secret-key")
    import db as db_module

    monkeypatch.setattr(db_module, "DB_PATH", str(tmp_path / "test.db"))
    db_module.init_db()


def _make_token(email: str = "user@example.com", password: str = "testpassword") -> str:
    client.post("/api/auth/signup", json={"email": email, "password": password})
    res = client.post("/api/auth/signin", json={"email": email, "password": password})
    return res.json()["access_token"]


def test_create_document() -> None:
    token = _make_token()
    res = client.post(
        "/api/documents",
        json={"title": "My NDA", "document_type": "mutual-nda", "fields": _SAMPLE_FIELDS},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["title"] == "My NDA"
    assert body["document_type"] == "mutual-nda"
    assert body["fields"]["purpose"] == "Testing partnership"
    assert "id" in body


def test_list_documents() -> None:
    token = _make_token()
    client.post(
        "/api/documents",
        json={"title": "Doc A", "document_type": "mutual-nda", "fields": {}},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.post(
        "/api/documents",
        json={"title": "Doc B", "document_type": "csa", "fields": {}},
        headers={"Authorization": f"Bearer {token}"},
    )
    res = client.get("/api/documents", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    docs = res.json()
    assert len(docs) == 2
    titles = {d["title"] for d in docs}
    assert titles == {"Doc A", "Doc B"}


def test_get_document() -> None:
    token = _make_token()
    create_res = client.post(
        "/api/documents",
        json={"title": "My NDA", "document_type": "mutual-nda", "fields": _SAMPLE_FIELDS},
        headers={"Authorization": f"Bearer {token}"},
    )
    doc_id = create_res.json()["id"]
    res = client.get(
        f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    assert res.json()["fields"]["governingLaw"] == "California"


def test_update_document() -> None:
    token = _make_token()
    create_res = client.post(
        "/api/documents",
        json={"title": "Old Title", "document_type": "mutual-nda", "fields": {}},
        headers={"Authorization": f"Bearer {token}"},
    )
    doc_id = create_res.json()["id"]
    res = client.put(
        f"/api/documents/{doc_id}",
        json={"title": "New Title", "fields": _SAMPLE_FIELDS},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["title"] == "New Title"
    assert body["fields"]["purpose"] == "Testing partnership"


def test_delete_document() -> None:
    token = _make_token()
    create_res = client.post(
        "/api/documents",
        json={"title": "To Delete", "document_type": "mutual-nda", "fields": {}},
        headers={"Authorization": f"Bearer {token}"},
    )
    doc_id = create_res.json()["id"]
    res = client.delete(
        f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 204
    get_res = client.get(
        f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert get_res.status_code == 404


def test_ownership_guard_returns_404() -> None:
    token_a = _make_token("a@example.com")
    token_b = _make_token("b@example.com", "otherpassword")
    create_res = client.post(
        "/api/documents",
        json={"title": "Private Doc", "document_type": "mutual-nda", "fields": {}},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    doc_id = create_res.json()["id"]
    res = client.get(
        f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token_b}"}
    )
    assert res.status_code == 404


def test_unauthenticated_returns_401() -> None:
    res = client.get("/api/documents")
    assert res.status_code == 401


def test_expired_token_returns_401() -> None:
    res = client.get(
        "/api/documents", headers={"Authorization": "Bearer not.a.real.token"}
    )
    assert res.status_code == 401
