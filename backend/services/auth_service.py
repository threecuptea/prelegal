"""Auth business logic: password hashing, JWT, signup/signin, auth dependency."""

from __future__ import annotations

import asyncio
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
import psycopg2.errors
import resend
from fastapi import Header, HTTPException

from db import get_db

logger = __import__("logging").getLogger(__name__)

_JWT_ALGORITHM = "HS256"
_JWT_EXPIRE_HOURS = 8
_MAX_FAILED = 5
_RESET_TOKEN_EXPIRE_HOURS = 1

_RESET_EMAIL_SUBJECT = "Prelegal Password Reset Assistance"
_RESET_EMAIL_FROM = "Prelegal <prelegal-no-reply@threecuptea.com>"


def _require_jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET", "")
    if not secret:
        raise RuntimeError("JWT_SECRET env var is required but not set")
    return secret


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(account_id: int, email: str) -> str:
    secret = _require_jwt_secret()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(account_id),
        "email": email,
        "iat": now,
        "exp": now + timedelta(hours=_JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, secret, algorithm=_JWT_ALGORITHM)


def _decode_token(token: str) -> dict:
    secret = _require_jwt_secret()
    try:
        return jwt.decode(token, secret, algorithms=[_JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _signup_sync(email: str, password_hash: str) -> dict:
    email = email.lower()
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO account (email, password_hash) VALUES (%s, %s) RETURNING id",
                    (email, password_hash),
                )
                new_id = cur.fetchone()["id"]
    except psycopg2.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="Email already registered")
    return {"id": new_id, "email": email}


def _signin_sync(email: str, password: str) -> dict:
    email = email.lower()
    not_found = False
    is_locked = False
    wrong_password = False
    account: dict | None = None

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, password_hash, failed_attempts, locked "
                "FROM account WHERE email = %s",
                (email,),
            )
            row = cur.fetchone()
            if not row:
                not_found = True
            elif row["locked"]:
                is_locked = True
            elif not verify_password(password, row["password_hash"]):
                wrong_password = True
                new_attempts = row["failed_attempts"] + 1
                lock_flag = 1 if new_attempts >= _MAX_FAILED else 0
                cur.execute(
                    "UPDATE account SET failed_attempts = %s, locked = %s WHERE id = %s",
                    (new_attempts, lock_flag, row["id"]),
                )
            else:
                cur.execute(
                    "UPDATE account SET failed_attempts = 0 WHERE id = %s", (row["id"],)
                )
                account = {"id": row["id"], "email": row["email"]}

    if is_locked:
        raise HTTPException(
            status_code=423, detail="Account locked due to too many failed login attempts"
        )
    if not_found or wrong_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return account  # type: ignore[return-value]


def _fetch_account_sync(account_id: int) -> dict | None:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, locked FROM account WHERE id = %s", (account_id,)
            )
            row = cur.fetchone()
            return dict(row) if row else None


async def signup(email: str, password: str) -> dict:
    password_hash = hash_password(password)
    return await asyncio.to_thread(_signup_sync, email, password_hash)


async def signin(email: str, password: str) -> dict:
    return await asyncio.to_thread(_signin_sync, email, password)


def _store_reset_token_sync(email: str, token: str, expires_at: datetime) -> bool:
    """Store reset token for the account. Returns True if account found."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE account SET reset_token = %s, reset_token_expires_at = %s "
                "WHERE email = %s",
                (token, expires_at, email.lower()),
            )
            return cur.rowcount > 0


def _send_reset_email_sync(to_email: str, reset_url: str) -> None:
    resend.api_key = os.environ.get("RESEND_API_KEY", "")
    html = (
        "<p>We received a request to reset the password for the Prelegal account "
        f"associated with this e-mail address. Click the link below to reset your password.</p>"
        f'<p><a href="{reset_url}">{reset_url}</a></p>'
        "<p>If clicking the link doesn't work, you can copy and paste the link into your "
        "web browser's address bar. You will be prompted to type in your new password to "
        "update your Prelegal account.</p>"
        "<p>If you did not request to have your password reset, you can safely ignore "
        "this email.</p>"
        "<p>Prelegal account management team</p>"
    )
    resend.Emails.send({
        "from": _RESET_EMAIL_FROM,
        "to": [to_email],
        "subject": _RESET_EMAIL_SUBJECT,
        "html": html,
    })


def _reset_password_sync(token: str, new_password_hash: str) -> None:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, reset_token_expires_at FROM account WHERE reset_token = %s",
                (token,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=400, detail="Invalid or expired reset link")
            if datetime.now(timezone.utc) > row["reset_token_expires_at"]:
                raise HTTPException(status_code=400, detail="Invalid or expired reset link")
            cur.execute(
                "UPDATE account SET password_hash = %s, reset_token = NULL, "
                "reset_token_expires_at = NULL, failed_attempts = 0, locked = 0 "
                "WHERE id = %s",
                (new_password_hash, row["id"]),
            )


async def forgot_password(email: str) -> None:
    """Generate a reset token and email it. Always succeeds to prevent enumeration."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=_RESET_TOKEN_EXPIRE_HOURS)
    found = await asyncio.to_thread(_store_reset_token_sync, email, token, expires_at)
    if found:
        base_url = os.environ.get("APP_BASE_URL", "http://localhost:3000")
        reset_url = f"{base_url}/auth/reset-password?token={token}"
        try:
            await asyncio.to_thread(_send_reset_email_sync, email, reset_url)
        except Exception:
            logger.exception("Failed to send reset email to %s", email)


async def reset_password(token: str, new_password: str) -> None:
    new_hash = hash_password(new_password)
    await asyncio.to_thread(_reset_password_sync, token, new_hash)


async def get_current_account(
    authorization: Optional[str] = Header(default=None),
) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Bearer token required")
    payload = _decode_token(token)
    account_id = int(payload["sub"])
    row = await asyncio.to_thread(_fetch_account_sync, account_id)
    if not row or row["locked"]:
        raise HTTPException(status_code=401, detail="Account not found or locked")
    return row
