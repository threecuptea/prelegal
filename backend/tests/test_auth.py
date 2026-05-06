"""Tests for signup and signin endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _setup(tmp_path: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", "test-jwt-secret-key")
    import db as db_module

    monkeypatch.setattr(db_module, "DB_PATH", str(tmp_path / "test.db"))
    db_module.init_db()


def test_signup_happy_path() -> None:
    res = client.post(
        "/api/auth/signup", json={"email": "alice@example.com", "password": "password123"}
    )
    assert res.status_code == 201
    body = res.json()
    assert body["token_type"] == "bearer"
    assert body["email"] == "alice@example.com"
    assert len(body["access_token"]) > 10


def test_signup_duplicate_email_returns_409() -> None:
    client.post(
        "/api/auth/signup", json={"email": "alice@example.com", "password": "password123"}
    )
    res = client.post(
        "/api/auth/signup", json={"email": "alice@example.com", "password": "different123"}
    )
    assert res.status_code == 409


def test_signup_short_password_returns_422() -> None:
    res = client.post(
        "/api/auth/signup", json={"email": "alice@example.com", "password": "short"}
    )
    assert res.status_code == 422


def test_signin_happy_path() -> None:
    client.post(
        "/api/auth/signup", json={"email": "bob@example.com", "password": "mypassword"}
    )
    res = client.post(
        "/api/auth/signin", json={"email": "bob@example.com", "password": "mypassword"}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == "bob@example.com"
    assert "access_token" in body


def test_signin_wrong_password_returns_401() -> None:
    client.post(
        "/api/auth/signup", json={"email": "carol@example.com", "password": "rightpassword"}
    )
    res = client.post(
        "/api/auth/signin", json={"email": "carol@example.com", "password": "wrongpassword"}
    )
    assert res.status_code == 401


def test_signin_nonexistent_email_returns_401() -> None:
    res = client.post(
        "/api/auth/signin", json={"email": "nobody@example.com", "password": "password123"}
    )
    assert res.status_code == 401


def test_account_locks_after_five_failed_attempts() -> None:
    client.post(
        "/api/auth/signup", json={"email": "dave@example.com", "password": "correctpassword"}
    )
    for _ in range(5):
        client.post(
            "/api/auth/signin", json={"email": "dave@example.com", "password": "wrongpassword"}
        )
    res = client.post(
        "/api/auth/signin", json={"email": "dave@example.com", "password": "correctpassword"}
    )
    assert res.status_code == 423


def test_failed_attempts_reset_on_success() -> None:
    client.post(
        "/api/auth/signup", json={"email": "eve@example.com", "password": "correctpassword"}
    )
    for _ in range(3):
        client.post(
            "/api/auth/signin", json={"email": "eve@example.com", "password": "wrongpassword"}
        )
    # Correct password resets counter
    res = client.post(
        "/api/auth/signin", json={"email": "eve@example.com", "password": "correctpassword"}
    )
    assert res.status_code == 200
    # Should be able to sign in again without lock
    res2 = client.post(
        "/api/auth/signin", json={"email": "eve@example.com", "password": "correctpassword"}
    )
    assert res2.status_code == 200
