"""AI chat endpoint — stateless, supports all 11 Common Paper document types."""

from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException

from models.chat import ChatRequest, ChatResponse
from services.chat_service import build_messages, call_llm

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    if not os.getenv("OPENROUTER_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="OPENROUTER_API_KEY is not configured on the server.",
        )
    return await call_llm(build_messages(request))
