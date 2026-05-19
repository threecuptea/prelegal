"""Tests for document CRUD endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import db as db_module
from main import app
from services.auth_service import get_current_account

client = TestClient(app)

_SAMPLE_FIELDS = {
    "purpose": "Testing partnership",
    "effectiveDate": "2025-01-01",
    "governingLaw": "California",
}


@pytest.fixture(autouse=True)
def _setup(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(db_module, "DATABASE_URL", "postgresql://prelegal:prelegal@localhost:5432/prelegal")
    db_module.init_db()
    with db_module.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE document, account RESTART IDENTITY CASCADE")
    yield
    app.dependency_overrides.pop(get_current_account, None)


def _insert_account(clerk_sub: str, email: str = "test@example.com") -> dict:
    with db_module.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO account (clerk_sub, email) VALUES (%s, %s) RETURNING id, clerk_sub, email",
                (clerk_sub, email),
            )
            return dict(cur.fetchone())


def _auth_as(account: dict) -> None:
    app.dependency_overrides[get_current_account] = lambda: account


def test_create_document() -> None:
    account = _insert_account("user_abc")
    _auth_as(account)
    res = client.post(
        "/api/documents",
        json={"title": "My NDA", "document_type": "mutual-nda", "fields": _SAMPLE_FIELDS},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["title"] == "My NDA"
    assert body["document_type"] == "mutual-nda"
    assert body["fields"]["purpose"] == "Testing partnership"
    assert "id" in body


def test_list_documents() -> None:
    account = _insert_account("user_abc")
    _auth_as(account)
    client.post("/api/documents", json={"title": "Doc A", "document_type": "mutual-nda", "fields": {}})
    client.post("/api/documents", json={"title": "Doc B", "document_type": "csa", "fields": {}})
    res = client.get("/api/documents")
    assert res.status_code == 200
    docs = res.json()
    assert len(docs) == 2
    assert {d["title"] for d in docs} == {"Doc A", "Doc B"}


def test_get_document() -> None:
    account = _insert_account("user_abc")
    _auth_as(account)
    create_res = client.post(
        "/api/documents",
        json={"title": "My NDA", "document_type": "mutual-nda", "fields": _SAMPLE_FIELDS},
    )
    doc_id = create_res.json()["id"]
    res = client.get(f"/api/documents/{doc_id}")
    assert res.status_code == 200
    assert res.json()["fields"]["governingLaw"] == "California"


def test_update_document() -> None:
    account = _insert_account("user_abc")
    _auth_as(account)
    create_res = client.post(
        "/api/documents",
        json={"title": "Old Title", "document_type": "mutual-nda", "fields": {}},
    )
    doc_id = create_res.json()["id"]
    res = client.put(f"/api/documents/{doc_id}", json={"title": "New Title", "fields": _SAMPLE_FIELDS})
    assert res.status_code == 200
    body = res.json()
    assert body["title"] == "New Title"
    assert body["fields"]["purpose"] == "Testing partnership"


def test_delete_document() -> None:
    account = _insert_account("user_abc")
    _auth_as(account)
    create_res = client.post(
        "/api/documents",
        json={"title": "To Delete", "document_type": "mutual-nda", "fields": {}},
    )
    doc_id = create_res.json()["id"]
    res = client.delete(f"/api/documents/{doc_id}")
    assert res.status_code == 204
    get_res = client.get(f"/api/documents/{doc_id}")
    assert get_res.status_code == 404


def test_ownership_guard_returns_404() -> None:
    account_a = _insert_account("user_aaa", "a@example.com")
    account_b = _insert_account("user_bbb", "b@example.com")

    _auth_as(account_a)
    create_res = client.post(
        "/api/documents",
        json={"title": "Private Doc", "document_type": "mutual-nda", "fields": {}},
    )
    doc_id = create_res.json()["id"]

    _auth_as(account_b)
    res = client.get(f"/api/documents/{doc_id}")
    assert res.status_code == 404


def test_unauthenticated_returns_403() -> None:
    # No override — Clerk guard is active and rejects missing token
    res = client.get("/api/documents")
    assert res.status_code == 403


def test_invalid_token_returns_403() -> None:
    # No override — Clerk guard rejects unparseable JWT
    res = client.get("/api/documents", headers={"Authorization": "Bearer not.a.real.token"})
    assert res.status_code == 403
