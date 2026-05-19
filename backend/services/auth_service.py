"""Auth: Clerk JWT validation and lazy account provisioning."""

from __future__ import annotations

import asyncio
import os

from fastapi import Depends, HTTPException
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials

from db import get_db

_jwks_url = os.getenv("CLERK_JWKS_URL", "")
clerk_config = ClerkConfig(jwks_url=_jwks_url or "https://placeholder.invalid/.well-known/jwks.json")
clerk_guard = ClerkHTTPBearer(clerk_config)


def _upsert_account_sync(clerk_sub: str, email: str) -> dict:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO account (clerk_sub, email)
                VALUES (%s, %s)
                ON CONFLICT (clerk_sub) DO UPDATE
                  SET email = CASE WHEN EXCLUDED.email != '' THEN EXCLUDED.email
                                   ELSE account.email END
                RETURNING id, clerk_sub, email
                """,
                (clerk_sub, email),
            )
            return dict(cur.fetchone())


async def get_current_account(
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
) -> dict:
    if not creds or not creds.decoded:
        raise HTTPException(status_code=401, detail="Invalid or missing token")
    clerk_sub: str = creds.decoded.get("sub", "")
    if not clerk_sub:
        raise HTTPException(status_code=401, detail="Invalid token: missing sub")
    email: str = creds.decoded.get("email", "")
    return await asyncio.to_thread(_upsert_account_sync, clerk_sub, email)
