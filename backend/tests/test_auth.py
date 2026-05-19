"""Tests for Clerk-based auth: account provisioning and JWT guard behavior."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from fastapi_clerk_auth import HTTPAuthorizationCredentials as ClerkCreds

import db as db_module
from main import app
from services import auth_service as auth_module
from services.auth_service import clerk_guard, get_current_account

client = TestClient(app)


@pytest.fixture(autouse=True)
def _setup(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(db_module, "DATABASE_URL", "postgresql://prelegal:prelegal@localhost:5432/prelegal")
    db_module.init_db()
    with db_module.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE document, account RESTART IDENTITY CASCADE")
    yield
    app.dependency_overrides.pop(clerk_guard, None)
    app.dependency_overrides.pop(get_current_account, None)


# ── Old auth routes are gone ──────────────────────────────────────────────────

def test_signup_route_is_gone() -> None:
    res = client.post("/api/auth/signup", json={"email": "x@example.com", "password": "secret123"})
    assert res.status_code in (404, 405)


def test_signin_route_is_gone() -> None:
    res = client.post("/api/auth/signin", json={"email": "x@example.com", "password": "secret123"})
    assert res.status_code in (404, 405)


def test_forgot_password_route_is_gone() -> None:
    res = client.post("/api/auth/forgot-password", json={"email": "x@example.com"})
    assert res.status_code in (404, 405)


def test_reset_password_route_is_gone() -> None:
    res = client.post("/api/auth/reset-password", json={"token": "tok", "new_password": "newpass1"})
    assert res.status_code in (404, 405)


# ── Account upsert logic ──────────────────────────────────────────────────────

def test_upsert_creates_account_on_first_call() -> None:
    account = auth_module._upsert_account_sync("user_abc123", "alice@example.com")
    assert account["clerk_sub"] == "user_abc123"
    assert account["email"] == "alice@example.com"
    assert "id" in account


def test_upsert_returns_same_id_on_duplicate_sub() -> None:
    a1 = auth_module._upsert_account_sync("user_abc123", "alice@example.com")
    a2 = auth_module._upsert_account_sync("user_abc123", "alice-updated@example.com")
    assert a1["id"] == a2["id"]
    assert a2["email"] == "alice-updated@example.com"


def test_upsert_two_different_subs_creates_two_accounts() -> None:
    a1 = auth_module._upsert_account_sync("user_aaa", "a@example.com")
    a2 = auth_module._upsert_account_sync("user_bbb", "b@example.com")
    assert a1["id"] != a2["id"]


# ── get_current_account via Clerk guard ──────────────────────────────────────

def _fake_guard_with(clerk_sub: str, email: str = ""):
    """Return a dependency override that injects a decoded Clerk token."""
    fake_creds = ClerkCreds(
        scheme="bearer",
        credentials="fake-token",
        decoded={"sub": clerk_sub, "email": email},
    )

    def _override():
        return fake_creds

    return _override


def test_valid_clerk_token_provisions_account_and_allows_access() -> None:
    app.dependency_overrides[clerk_guard] = _fake_guard_with("user_new123", "bob@example.com")
    res = client.get("/api/documents")
    assert res.status_code == 200

    # Verify the account was lazily created in the DB
    with db_module.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT clerk_sub, email FROM account WHERE clerk_sub = %s", ("user_new123",))
            row = cur.fetchone()
    assert row is not None
    assert row["email"] == "bob@example.com"


def test_missing_token_returns_403() -> None:
    # No override — Clerk guard rejects missing Authorization header
    res = client.get("/api/documents")
    assert res.status_code == 403


def test_invalid_token_returns_403() -> None:
    # No override — Clerk guard rejects unparseable JWT
    res = client.get("/api/documents", headers={"Authorization": "Bearer not.a.valid.token"})
    assert res.status_code == 403
