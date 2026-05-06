"""Pydantic models for document endpoints."""

from __future__ import annotations

from pydantic import BaseModel


class DocumentCreate(BaseModel):
    title: str
    document_type: str
    fields: dict


class DocumentUpdate(BaseModel):
    title: str | None = None
    fields: dict | None = None


class DocumentSummary(BaseModel):
    id: int
    title: str
    document_type: str
    created_at: str
    updated_at: str


class DocumentDetail(BaseModel):
    id: int
    title: str
    document_type: str
    fields: dict
    created_at: str
    updated_at: str
