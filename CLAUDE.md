# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Prelegal is a SaaS product that lets users draft legal agreements by chatting with an AI. The available documents are defined in `catalog.json` (12 Common Paper templates in `templates/`). Currently only the Mutual NDA has a working AI-chat flow; auth, persistence, and the other 11 document types are in future tickets.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## Commands

### Backend (run from `backend/`)
```bash
uv run pytest                        # run all backend tests
uv run pytest tests/test_chat.py     # run a single test file
uv run pytest -k test_chat_happy_path  # run a single test by name
uv run uvicorn main:app --reload     # dev server on :8000
```

### Frontend (run from `frontend/`)
```bash
npm run dev          # dev server on :3000 (hot reload, proxies /api to :8000)
npm run build        # static export to frontend/out/
npm test             # vitest run (single pass)
npm run test:watch   # vitest watch mode
npm run lint         # eslint
```

### Docker (run from repo root)
```bash
scripts/start-mac.sh   # docker compose up --build -d
scripts/stop-mac.sh    # docker compose down
```

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-120b` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an OPENROUTER_API_KEY in the .env file in the project root.

## Technical design

The entire project should be packaged into a Docker container.

The backend is in `backend/` — a `uv` project (Python 3.12) using FastAPI. Put all routes under `backend/routes/` with the prefix convention:
- `auth.py` → `/api/auth`
- `chat.py` → `/api/chat`
- `documents.py` → `/api/documents`

Business logic belongs in `backend/services/` (e.g. `chat_service.py`); route functions call service functions. Pydantic models go in `backend/models/` when needed.

The frontend is in `frontend/` — Next.js 16, React 19, Tailwind 4. It is statically exported (`next.config.ts` → `output: "export"`) to `frontend/out/`, which FastAPI serves at runtime. The `frontend/AGENTS.md` note is important: read `node_modules/next/dist/docs/` before writing Next.js-specific code because this version has breaking API changes.

The database uses SQLite, created from scratch each container startup (deferred to a future ticket — no DB exists yet).

Backend available at http://localhost:8000

## Architecture

### Request flow
1. Browser loads the statically-exported Next.js SPA from FastAPI (`GET /`).
2. User interacts with `frontend/app/nda-chat.tsx` (client component, two-column layout: chat left, field summary + live preview right).
3. Each user turn `POST /api/chat` sends the full conversation history plus the current `NDAData` snapshot (stateless — no server-side session).
4. `backend/routes/chat.py` calls LiteLLM with `response_format=ChatResponse` (Pydantic structured output). Returns `{reply, field_updates, done}`.
5. Frontend applies `mergeFieldUpdates` (from `frontend/app/lib/nda-chat-helpers.ts`) to update the `NDAData` state. `null`/`undefined` values are dropped so a partial response never wipes filled fields; empty strings are honored so optional fields (e.g. `modifications`) can be cleared.

### Key files
- `frontend/app/lib/document-types.ts` — `DocumentFields` interface, `DOCUMENT_REGISTRY` (all 11 doc types), `mergeDocumentFields`, `missingRequiredDocumentFields`, `generateCoverPage`, escape utilities.
- `frontend/app/chat.tsx` — unified chat UI, `DocumentFields` state, `documentType: DocumentType | null` state, AbortController cancellation on "Start over", `FieldSummary` driven by registry.
- `frontend/app/document-preview.tsx` — generic `DocumentPreview` (cover page only), `downloadMarkdown`.
- `backend/models/chat.py` — `ChatResponse` flat model (LLM schema + API response), `ChatRequest`, `PartyInfoExtraction`. `MAX_MESSAGE_CHARS`, `MAX_MESSAGES` constants.
- `backend/services/chat_service.py` — `SYSTEM_PROMPT` (all 11 doc types), `snapshot_summary`, `build_messages`, `call_llm`.
- `backend/routes/chat.py` — thin adapter: API-key guard + delegates to service.
- `backend/main.py` — loads `.env`, mounts `/_next` static assets, registers `chat_router`, catch-all serves `frontend/out/` with SPA fallback.

### Routing guard
`/api/*` paths in the catch-all raise 404 so future API routers are never shadowed by the static file handler.

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

## Implementation Status

### Completed
- **PL-2** — CommonPaper legal document templates and `catalog.json` (12 documents in `templates/`).
- **PL-3** — Next.js 16 + React 19 + Tailwind 4 Mutual NDA Creator. Vitest unit tests in `frontend/app/lib/`.
- **PL-4** — V1 technical foundation: static export, FastAPI backend, Docker, scripts.
- **PL-5** — AI chat for Mutual NDA:
  - Frontend: `nda-chat.tsx` two-column layout (chat + field summary + live preview). `nda-form.tsx` removed; `NDAPreview`/`downloadMarkdown` extracted to `nda-preview.tsx`. `AbortController`-based cancellation on "Start over".
  - Backend: stateless `POST /api/chat` calling LiteLLM with structured output. Returns 503 if `OPENROUTER_API_KEY` unset, 502 on upstream/parse errors.
  - Tests: 9 backend pytest cases (`backend/tests/test_chat.py`, LiteLLM monkeypatched); Vitest suite in `frontend/app/lib/nda-chat-helpers.test.ts`. Full suite: 16 backend, 45 frontend.
- **PL-6** — Expanded AI chat to all 11 Common Paper document types:
  - Single unified chat at `/` — AI detects document type conversationally in the first 1-2 turns.
  - Backend: flat `ChatResponse` Pydantic model (both LLM structured-output schema and API response) with all document-type fields as optionals plus `documentType`, `suggestedDocument`, `isComplete`. Moved to `backend/models/chat.py`. Business logic (system prompt, snapshot summary, LLM call) in `backend/services/chat_service.py`. Route thinned to API-key guard + service delegation.
  - Frontend: `frontend/app/lib/document-types.ts` is the central registry — `DOCUMENT_REGISTRY` keyed by `DocumentType` slug, generic `mergeDocumentFields` (with party shallow-merge), `missingRequiredDocumentFields`, `generateCoverPage` (cover page only; standard terms linked to Common Paper URL). `chat.tsx` replaces `nda-chat.tsx`; state is `DocumentFields = {}` plus `documentType: DocumentType | null`. `document-preview.tsx` replaces `nda-preview.tsx` with generic `DocumentPreview`.
  - Deleted: `nda-chat.tsx`, `nda-preview.tsx`, `lib/nda-document.ts`, `lib/nda-chat-helpers.ts`.
  - Tests: 19 backend, 23 frontend, all passing; clean static export.

### Deferred (future tickets)
- SQLite + users table created on container startup.
- Auth (`backend/routes/auth.py`), document persistence (`backend/routes/documents.py`).

### Current API Endpoints
- `GET /api/health` → `{"status": "ok"}`
- `POST /api/chat` → AI chat for all 11 document types. Body: `{messages: [{role, content}], fields: <ChatResponse snapshot>}`. Response: flat `ChatResponse` with `response`, `isComplete`, `documentType`, `suggestedDocument`, and all document fields.
- `GET /_next/*` → static Next.js bundle assets
- `GET|HEAD /{path}` → static frontend (SPA fallback to `index.html`)
