"""Auth business logic: password hashing, JWT, signup/signin, auth dependency."""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Header, HTTPException

from db import get_db

_JWT_ALGORITHM = "HS256"
_JWT_EXPIRE_HOURS = 8
_MAX_FAILED = 5


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
    import sqlite3 as _sqlite3

    new_id = None
    try:
        with get_db() as conn:
            cursor = conn.execute(
                "INSERT INTO account (email, password_hash) VALUES (?, ?)",
                (email, password_hash),
            )
            new_id = cursor.lastrowid
    except _sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Email already registered")
    return {"id": new_id, "email": email}


def _signin_sync(email: str, password: str) -> dict:
    # Accumulate outcome flags so we can raise AFTER the context commits the UPDATE.
    not_found = False
    is_locked = False
    wrong_password = False
    account: dict | None = None

    with get_db() as conn:
        row = conn.execute(
            "SELECT id, email, password_hash, failed_attempts, locked "
            "FROM account WHERE email = ?",
            (email,),
        ).fetchone()
        if not row:
            not_found = True
        elif row["locked"]:
            is_locked = True
        elif not verify_password(password, row["password_hash"]):
            wrong_password = True
            new_attempts = row["failed_attempts"] + 1
            lock_flag = 1 if new_attempts >= _MAX_FAILED else 0
            conn.execute(
                "UPDATE account SET failed_attempts = ?, locked = ? WHERE id = ?",
                (new_attempts, lock_flag, row["id"]),
            )
        else:
            conn.execute(
                "UPDATE account SET failed_attempts = 0 WHERE id = ?", (row["id"],)
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
        row = conn.execute(
            "SELECT id, email, locked FROM account WHERE id = ?", (account_id,)
        ).fetchone()
        return dict(row) if row else None


async def signup(email: str, password: str) -> dict:
    password_hash = hash_password(password)
    return await asyncio.to_thread(_signup_sync, email, password_hash)


async def signin(email: str, password: str) -> dict:
    return await asyncio.to_thread(_signin_sync, email, password)


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
