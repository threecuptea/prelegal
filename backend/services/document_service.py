"""Document CRUD service. All DB operations run via asyncio.to_thread."""

from __future__ import annotations

import asyncio
import json

from fastapi import HTTPException

from db import get_db


def _list_sync(account_id: int) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, title, document_type, created_at, updated_at "
            "FROM document WHERE account_id = ? ORDER BY updated_at DESC",
            (account_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def _create_sync(
    account_id: int, title: str, document_type: str, fields: dict
) -> dict:
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO document (account_id, title, document_type, fields_json) "
            "VALUES (?, ?, ?, ?)",
            (account_id, title, document_type, json.dumps(fields)),
        )
        row = conn.execute(
            "SELECT id, title, document_type, fields_json, created_at, updated_at "
            "FROM document WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        d = dict(row)
        d["fields"] = json.loads(d.pop("fields_json"))
        return d


def _get_sync(doc_id: int, account_id: int) -> dict:
    result = None
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, title, document_type, fields_json, created_at, updated_at "
            "FROM document WHERE id = ? AND account_id = ?",
            (doc_id, account_id),
        ).fetchone()
        if row:
            d = dict(row)
            d["fields"] = json.loads(d.pop("fields_json"))
            result = d
    if result is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return result


def _update_sync(
    doc_id: int, account_id: int, title: str | None, fields: dict | None
) -> dict:
    result = None
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, title, fields_json FROM document WHERE id = ? AND account_id = ?",
            (doc_id, account_id),
        ).fetchone()
        if row:
            new_title = title if title is not None else row["title"]
            new_fields_json = (
                json.dumps(fields) if fields is not None else row["fields_json"]
            )
            conn.execute(
                "UPDATE document SET title = ?, fields_json = ?, updated_at = datetime('now') "
                "WHERE id = ?",
                (new_title, new_fields_json, doc_id),
            )
            updated = conn.execute(
                "SELECT id, title, document_type, fields_json, created_at, updated_at "
                "FROM document WHERE id = ?",
                (doc_id,),
            ).fetchone()
            d = dict(updated)
            d["fields"] = json.loads(d.pop("fields_json"))
            result = d
    if result is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return result


def _delete_sync(doc_id: int, account_id: int) -> None:
    deleted = False
    with get_db() as conn:
        cursor = conn.execute(
            "DELETE FROM document WHERE id = ? AND account_id = ?",
            (doc_id, account_id),
        )
        deleted = cursor.rowcount > 0
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")


async def list_documents(account_id: int) -> list[dict]:
    return await asyncio.to_thread(_list_sync, account_id)


async def create_document(
    account_id: int, title: str, document_type: str, fields: dict
) -> dict:
    return await asyncio.to_thread(_create_sync, account_id, title, document_type, fields)


async def get_document(doc_id: int, account_id: int) -> dict:
    return await asyncio.to_thread(_get_sync, doc_id, account_id)


async def update_document(
    doc_id: int, account_id: int, title: str | None, fields: dict | None
) -> dict:
    return await asyncio.to_thread(_update_sync, doc_id, account_id, title, fields)


async def delete_document(doc_id: int, account_id: int) -> None:
    await asyncio.to_thread(_delete_sync, doc_id, account_id)
