"""Tests for signup, signin, and forgot/reset password endpoints."""

from __future__ import annotations
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from main import app
from services import auth_service as auth_module

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


# ── Forgot / Reset password ───────────────────────────────────────────────────

def _stub_send_email(monkeypatch: pytest.MonkeyPatch) -> None:
    """Prevent real Resend API calls in tests."""
    monkeypatch.setattr(auth_module, "_send_reset_email_sync", lambda *_: None)


def test_forgot_password_known_email_returns_200(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_send_email(monkeypatch)
    client.post("/api/auth/signup", json={"email": "frank@example.com", "password": "password123"})
    res = client.post("/api/auth/forgot-password", json={"email": "frank@example.com"})
    assert res.status_code == 200
    assert "reset link" in res.json()["message"].lower()


def test_forgot_password_unknown_email_returns_200(monkeypatch: pytest.MonkeyPatch) -> None:
    """Unknown email must return the same 200 response to prevent enumeration."""
    _stub_send_email(monkeypatch)
    res = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert res.status_code == 200
    assert "reset link" in res.json()["message"].lower()


def test_reset_password_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_send_email(monkeypatch)
    client.post("/api/auth/signup", json={"email": "grace@example.com", "password": "oldpassword"})
    client.post("/api/auth/forgot-password", json={"email": "grace@example.com"})

    # Retrieve the token directly from the DB
    import db as db_module
    with db_module.get_db() as conn:
        row = conn.execute(
            "SELECT reset_token FROM account WHERE email = ?", ("grace@example.com",)
        ).fetchone()
    token = row["reset_token"]

    res = client.post(
        "/api/auth/reset-password", json={"token": token, "new_password": "newpassword99"}
    )
    assert res.status_code == 200
    # Can now sign in with the new password
    signin = client.post(
        "/api/auth/signin", json={"email": "grace@example.com", "password": "newpassword99"}
    )
    assert signin.status_code == 200


def test_reset_password_invalid_token_returns_400(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_send_email(monkeypatch)
    res = client.post(
        "/api/auth/reset-password", json={"token": "bogus-token", "new_password": "newpassword99"}
    )
    assert res.status_code == 400


def test_reset_password_expired_token_returns_400(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_send_email(monkeypatch)
    client.post("/api/auth/signup", json={"email": "henry@example.com", "password": "password123"})
    client.post("/api/auth/forgot-password", json={"email": "henry@example.com"})

    # Back-date the expiry in the DB to simulate an expired token
    import db as db_module
    with db_module.get_db() as conn:
        row = conn.execute(
            "SELECT reset_token FROM account WHERE email = ?", ("henry@example.com",)
        ).fetchone()
        token = row["reset_token"]
        expired = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        conn.execute(
            "UPDATE account SET reset_token_expires_at = ? WHERE email = ?",
            (expired, "henry@example.com"),
        )

    res = client.post(
        "/api/auth/reset-password", json={"token": token, "new_password": "newpassword99"}
    )
    assert res.status_code == 400


def test_reset_password_clears_lockout(monkeypatch: pytest.MonkeyPatch) -> None:
    """Successful reset unlocks a locked account."""
    _stub_send_email(monkeypatch)
    client.post("/api/auth/signup", json={"email": "iris@example.com", "password": "password123"})
    # Lock the account
    for _ in range(5):
        client.post("/api/auth/signin", json={"email": "iris@example.com", "password": "wrong"})
    assert client.post(
        "/api/auth/signin", json={"email": "iris@example.com", "password": "password123"}
    ).status_code == 423

    client.post("/api/auth/forgot-password", json={"email": "iris@example.com"})
    import db as db_module
    with db_module.get_db() as conn:
        token = conn.execute(
            "SELECT reset_token FROM account WHERE email = ?", ("iris@example.com",)
        ).fetchone()["reset_token"]

    client.post(
        "/api/auth/reset-password", json={"token": token, "new_password": "brandnewpw"}
    )
    # Account should be unlocked
    assert client.post(
        "/api/auth/signin", json={"email": "iris@example.com", "password": "brandnewpw"}
    ).status_code == 200


def test_reset_password_short_password_returns_422(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_send_email(monkeypatch)
    res = client.post(
        "/api/auth/reset-password", json={"token": "anytoken", "new_password": "short"}
    )
    assert res.status_code == 422
