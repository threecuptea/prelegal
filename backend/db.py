"""PostgreSQL database module: schema init and connection context manager."""

from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import datetime
from typing import Generator
from urllib.parse import parse_qs, urlparse

import psycopg2
import psycopg2.extras

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://prelegal:prelegal@localhost:5432/prelegal",
)


def _connect_kwargs() -> dict:
    """Build psycopg2.connect() kwargs from DATABASE_URL.

    Handles the Cloud SQL Unix socket form where the host is passed as a
    query parameter: postgresql://user:pass@/dbname?host=/cloudsql/...
    psycopg2's URL parser ignores ?host=, so we extract it manually.
    """
    parsed = urlparse(DATABASE_URL)
    qs = parse_qs(parsed.query)
    host = (qs.get("host") or [parsed.hostname])[0]
    kwargs: dict = {
        "dbname": parsed.path.lstrip("/"),
        "user": parsed.username,
        "password": parsed.password,
        "cursor_factory": psycopg2.extras.RealDictCursor,
    }
    if host:
        kwargs["host"] = host
    if parsed.port:
        kwargs["port"] = parsed.port
    return kwargs

_SCHEMA = """
CREATE TABLE IF NOT EXISTS account (
    id         SERIAL PRIMARY KEY,
    clerk_sub  TEXT NOT NULL UNIQUE,
    email      TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document (
    id            SERIAL PRIMARY KEY,
    account_id    INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    title         TEXT    NOT NULL,
    document_type TEXT    NOT NULL,
    fields_json   TEXT    NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_account ON document(account_id);
"""

# Idempotent migrations for existing databases that still have the old schema.
_MIGRATIONS = [
    "ALTER TABLE account ADD COLUMN IF NOT EXISTS clerk_sub TEXT UNIQUE",
    "ALTER TABLE account ADD COLUMN IF NOT EXISTS email TEXT",
    # Drop columns that belong to the old password-based auth.
    "ALTER TABLE account DROP COLUMN IF EXISTS password_hash",
    "ALTER TABLE account DROP COLUMN IF EXISTS failed_attempts",
    "ALTER TABLE account DROP COLUMN IF EXISTS locked",
    "ALTER TABLE account DROP COLUMN IF EXISTS reset_token",
    "ALTER TABLE account DROP COLUMN IF EXISTS reset_token_expires_at",
    # Give email a default so inserts that omit it don't fail.
    "ALTER TABLE account ALTER COLUMN email SET DEFAULT ''",
    # Drop the old UNIQUE constraint on email (Clerk users share '' when JWT omits email).
    "ALTER TABLE account DROP CONSTRAINT IF EXISTS account_email_key",
]


def init_db() -> None:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(_SCHEMA)
            for stmt in _MIGRATIONS:
                cur.execute(stmt)


def row_to_dict(row) -> dict:
    """Convert a RealDictRow to a plain dict, serializing datetimes to ISO strings."""
    return {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in dict(row).items()}


@contextmanager
def get_db() -> Generator[psycopg2.extensions.connection, None, None]:
    conn = psycopg2.connect(**_connect_kwargs())
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
