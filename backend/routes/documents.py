"""Document routes: CRUD for saved documents, all auth-protected."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from models.documents import DocumentCreate, DocumentDetail, DocumentSummary, DocumentUpdate
from services import auth_service, document_service

router = APIRouter(prefix="/api/documents", tags=["documents"])

_auth = Depends(auth_service.get_current_account)


@router.get("", response_model=list[DocumentSummary])
async def list_documents(account: dict = _auth) -> list[DocumentSummary]:
    docs = await document_service.list_documents(account["id"])
    return [DocumentSummary(**d) for d in docs]


@router.post("", response_model=DocumentDetail, status_code=201)
async def create_document(body: DocumentCreate, account: dict = _auth) -> DocumentDetail:
    doc = await document_service.create_document(
        account["id"], body.title, body.document_type, body.fields
    )
    return DocumentDetail(**doc)


@router.get("/{doc_id}", response_model=DocumentDetail)
async def get_document(doc_id: int, account: dict = _auth) -> DocumentDetail:
    doc = await document_service.get_document(doc_id, account["id"])
    return DocumentDetail(**doc)


@router.put("/{doc_id}", response_model=DocumentDetail)
async def update_document(
    doc_id: int, body: DocumentUpdate, account: dict = _auth
) -> DocumentDetail:
    doc = await document_service.update_document(
        doc_id, account["id"], body.title, body.fields
    )
    return DocumentDetail(**doc)


@router.delete("/{doc_id}", status_code=204)
async def delete_document(doc_id: int, account: dict = _auth) -> Response:
    await document_service.delete_document(doc_id, account["id"])
    return Response(status_code=204)
