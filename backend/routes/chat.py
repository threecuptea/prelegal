"""AI chat endpoint for drafting a Mutual NDA.

POST /api/chat takes the full conversation history plus the current field
snapshot and returns the assistant's next reply, any field updates extracted
from the latest user turn, and a `done` flag the assistant only sets after the
user explicitly confirms they have nothing else to add.

The endpoint is stateless — the frontend keeps the conversation and resends it
each turn. Persistence (SQLite, sessions) is deferred to a later ticket.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Literal

from fastapi import APIRouter, HTTPException
from litellm import acompletion
from pydantic import BaseModel, ConfigDict, Field

# Defensive bounds on per-request payload size — keep token cost predictable
# even if a malicious or buggy client sends an enormous history.
MAX_MESSAGE_CHARS = 4000
MAX_MESSAGES = 100

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=MAX_MESSAGE_CHARS)


class FieldUpdates(BaseModel):
    """Subset of NDAData. Every field optional; only keys the user just
    answered should be populated. Mirrors `frontend/app/lib/nda-document.ts`."""

    model_config = ConfigDict(extra="forbid")

    purpose: str | None = None
    effectiveDate: str | None = None
    mndaTerm: Literal["expires", "continues"] | None = None
    mndaTermYears: str | None = None
    termOfConfidentiality: Literal["years", "perpetuity"] | None = None
    termOfConfidentialityYears: str | None = None
    governingLaw: str | None = None
    jurisdiction: str | None = None
    modifications: str | None = None
    party1Name: str | None = None
    party1Title: str | None = None
    party1Company: str | None = None
    party1Address: str | None = None
    party2Name: str | None = None
    party2Title: str | None = None
    party2Company: str | None = None
    party2Address: str | None = None


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., max_length=MAX_MESSAGES)
    fields: FieldUpdates


class ChatResponse(BaseModel):
    reply: str
    field_updates: FieldUpdates
    done: bool


SYSTEM_PROMPT = """You are an assistant that helps a user draft a Common Paper Mutual Non-Disclosure Agreement (Mutual NDA) by chatting with them. You only help with this one document — politely decline anything off-topic.

# Fields you must collect

Each field is a key in the JSON object you return as `field_updates`. Use exactly these keys and value formats:

- `purpose` (string): How the parties may use each other's confidential information. A short sentence, e.g. "Evaluating whether to enter into a business relationship with the other party."
- `effectiveDate` (string): ISO date `YYYY-MM-DD`.
- `mndaTerm` (string): one of `"expires"` or `"continues"`. `"expires"` means the MNDA expires after a fixed number of years; `"continues"` means it continues until terminated.
- `mndaTermYears` (string): integer 1-99 as a string, only relevant when `mndaTerm` is `"expires"`. Default `"1"`.
- `termOfConfidentiality` (string): one of `"years"` or `"perpetuity"`. How long confidentiality obligations survive after the MNDA ends.
- `termOfConfidentialityYears` (string): integer 1-99 as a string, only relevant when `termOfConfidentiality` is `"years"`. Default `"1"`.
- `governingLaw` (string): a US state name, e.g. "California" or "Delaware".
- `jurisdiction` (string): city/county and state, e.g. "San Francisco, CA".
- `modifications` (string): any modifications to the standard terms, or empty string `""` if none.
- `party1Name`, `party1Title`, `party1Company`, `party1Address` (strings): full name, job title, company, notice address (email or postal) for party 1.
- `party2Name`, `party2Title`, `party2Company`, `party2Address` (strings): same for party 2.

# How to converse

- Be warm, brief, and concrete. Ask one or two questions per turn — never more.
- ALWAYS end your reply with a follow-on question until you have collected everything and the user has confirmed they are done. Never leave the user waiting.
- Only put a key in `field_updates` if the user gave you that value in their most recent message (or you are normalizing what they just said). NEVER invent values. NEVER repeat values that are already in the current snapshot unless the user is changing them.
- Normalize values to the formats above (ISO dates, lowercase enum strings, integer year strings).
- When the user gives ambiguous input, ask a clarifying question rather than guessing.
- Do not re-ask fields that already have values in the current snapshot. Acknowledge what you have and move on to what is missing.

# Finishing

When every field has a value, do NOT immediately set `done: true`. Instead, summarize what you have and ASK the user to confirm: "Have I got everything right? Should I finalize the document?" Only set `done: true` in a later turn after the user explicitly confirms (e.g. says "yes", "looks good", "finalize", "done"). Until that explicit confirmation, keep `done: false`.

After confirmation, set `done: true`, give a short closing message, and DO ask one final follow-on like "Want to tweak anything else, or are you ready to download?" so the user is never left without a prompt.

# Output

You MUST return a single JSON object matching this schema (a `reply` string, a `field_updates` object containing only fields you are setting this turn, and a `done` boolean).
"""


def _snapshot_summary(fields: FieldUpdates) -> str:
    """Render the current field snapshot for the system message so the
    assistant can see what is filled and what is still missing."""
    populated = {
        k: v
        for k, v in fields.model_dump().items()
        if v not in (None, "")
    }
    if not populated:
        return "No fields have been filled yet."
    return "Current field snapshot:\n" + json.dumps(populated, indent=2)


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    if not os.getenv("OPENROUTER_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="OPENROUTER_API_KEY is not configured on the server.",
        )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": _snapshot_summary(request.fields)},
        *(m.model_dump() for m in request.messages),
    ]

    try:
        response = await acompletion(
            model=MODEL,
            messages=messages,
            response_format=ChatResponse,
            reasoning_effort="low",
            extra_body=EXTRA_BODY,
        )
    except Exception as exc:
        logger.exception("LLM call failed")
        raise HTTPException(status_code=502, detail="Upstream model error") from exc

    raw = response.choices[0].message.content
    try:
        return ChatResponse.model_validate_json(raw)
    except Exception as exc:
        logger.exception("Model returned invalid structured output: %r", raw)
        raise HTTPException(
            status_code=502,
            detail="Model returned invalid structured output",
        ) from exc
