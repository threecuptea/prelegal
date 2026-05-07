# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Prelegal is a SaaS product that lets users draft legal agreements by chatting with an AI. The available documents are defined in `catalog.json` (12 Common Paper templates in `templates/`). All 11 document types have a working AI-chat flow. Auth, document persistence, and multi-user support are fully implemented.

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

The database uses SQLite (`backend/db.py`). Schema is created on startup via `init_db()` called from the FastAPI lifespan. In Docker the DB file lives at `/data/prelegal.db` (named volume `prelegal-data` for restart persistence). In local dev it defaults to `./prelegal.db` in the backend directory (override with `PRELEGAL_DB_PATH` env var).

Backend available at http://localhost:8000

## Architecture

### Request flow
1. Browser loads the statically-exported Next.js SPA from FastAPI (`GET /`).
2. Unauthenticated users are redirected to `/auth` (sign in / sign up). JWT is stored in `sessionStorage`.
3. Authenticated users land on `frontend/app/chat.tsx` (two-column: chat left, field summary + live preview right). Loading a saved document appends `?docId=<id>` to the URL; the chat hydrates fields from `GET /api/documents/<id>` on mount.
4. Each user turn `POST /api/chat` sends the full conversation history plus the current `DocumentFields` snapshot (stateless). The `Authorization: Bearer <jwt>` header is sent on all API calls via `authFetch`.
5. `backend/routes/chat.py` calls LiteLLM with `response_format=ChatResponse` (Pydantic structured output). Returns `{response, isComplete, documentType, suggestedDocument, ...fields}`.
6. Frontend applies `mergeDocumentFields` to update state. The explicit **Save** button POSTs/PUTs to `/api/documents`.

### Key files
- `frontend/app/lib/document-types.ts` — `DocumentFields` interface, `DOCUMENT_REGISTRY` (all 11 doc types, each with `templateFile`), `mergeDocumentFields`, `missingRequiredDocumentFields`, `generateCoverPage` (cover page only, kept for tests), `processTemplateContent` (strips spans, removes leading heading), `generateDocument` (full self-contained doc: cover page → standard terms → signatures), escape utilities.
- `frontend/app/lib/auth.ts` — `getToken/setToken/clearToken` (sessionStorage), `authFetch` (injects Bearer header, clears token + redirects on 401).
- `frontend/app/chat.tsx` — unified chat UI with auth guard, Save button, `?docId` hydration, `AppHeader`, disclaimer banner. Fetches `/templates/{templateFile}` when document type is detected; passes `templateContent` to preview and download. No Field Summary — Cover Page in the document preview serves that purpose.
- `frontend/app/auth/page.tsx` — sign in / sign up page (new startup page).
- `frontend/app/documents/page.tsx` — saved documents list with Load/Delete actions.
- `frontend/app/components/app-header.tsx` — shared nav: logo, My Documents link, user email, Sign Out.
- `frontend/app/components/disclaimer-banner.tsx` — "documents are drafts" yellow banner.
- `frontend/app/document-preview.tsx` — `TemplateContent` (inline markdown renderer), `DocumentPreview` (cover page fields → standard terms → signatures), `downloadMarkdown` (uses `generateDocument` when template available; falls back to `generateCoverPage`).
- `frontend/public/templates/` — 11 Common Paper standard-terms `.md` files served as static assets (included in `frontend/out/` at build time).
- `backend/db.py` — `init_db()`, `get_db()` context manager (sqlite3, WAL mode). Schema: `account` + `document` tables.
- `backend/models/chat.py` — `ChatResponse` flat model (LLM schema + API response), `ChatRequest`. `MAX_MESSAGE_CHARS`, `MAX_MESSAGES` constants.
- `backend/models/auth.py` — `SignupRequest`, `SigninRequest`, `TokenResponse`.
- `backend/models/documents.py` — `DocumentCreate`, `DocumentUpdate`, `DocumentSummary`, `DocumentDetail`.
- `backend/services/auth_service.py` — bcrypt hash/verify, JWT create/decode (PyJWT HS256), signup/signin (5-attempt lockout), `get_current_account` FastAPI dependency.
- `backend/services/chat_service.py` — `SYSTEM_PROMPT` (all 11 doc types), `snapshot_summary`, `build_messages`, `call_llm`.
- `backend/services/document_service.py` — document CRUD via `asyncio.to_thread`; ownership enforced by `account_id`.
- `backend/routes/auth.py` — `/api/auth/signup`, `/api/auth/signin`.
- `backend/routes/documents.py` — `/api/documents` CRUD, all JWT-protected.
- `backend/routes/chat.py` — thin adapter: API-key guard + delegates to service.
- `backend/main.py` — loads `.env`, lifespan calls `init_db()`, registers all routers, SPA fallback.

### Routing guard
`/api/*` paths in the catch-all raise 404 so API routers are never shadowed by the static file handler.

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
- **PL-7** — Multi-user auth, document persistence, and UI polish:
  - Auth: `POST /api/auth/signup` and `/signin` (bcrypt + PyJWT HS256, sessionStorage). Account locks after 5 failed attempts (HTTP 423).
  - Documents: `GET/POST /api/documents`, `GET/PUT/DELETE /api/documents/{id}`. All JWT-protected. Fields stored as JSON blob; ownership enforced by `account_id`.
  - Persistence: SQLite DB at `/data/prelegal.db` in Docker (named volume `prelegal-data`).
  - Frontend: `/auth` sign-in/sign-up page (new startup page), `/documents` saved docs list, chat updated with auth guard, Save button, `?docId` hydration, `AppHeader`, disclaimer banner.
  - Tests: 35 backend (added 16), 23 frontend, all passing.
- **PL-8** — Self-contained document generation (PR #10):
  - Full Common Paper standard terms now embedded in the live preview, downloaded `.md`, and print PDF for all 11 document types. Previously only a link to commonpaper.com was shown.
  - Document structure: Cover Page fields → Standard Terms (from `frontend/public/templates/`) → Signatures with "By signing this Cover Page…" statement at the bottom.
  - `processTemplateContent` strips `<span>` tags and the template's own leading heading before embedding. `generateDocument` produces the complete self-contained markdown; `generateCoverPage` kept for backward compatibility.
  - `DocumentPreview` renders standard terms inline (loading / unavailable / content states). Template fetched client-side from `/templates/{templateFile}` with cancellation guard on document type change.
  - `downloadMarkdown` filename drops `-cover` suffix (e.g. `Mutual-NDA.md`). `saveAndPrint` only opens print dialog when save succeeds.
  - Field Summary removed — redundant now that Cover Page is shown inline in the document preview.
  - Tests: 35 backend, 37 frontend (added 13), all passing.
- **PL-9** — Use as Template (PR #11):
  - "Use as Template" button appears at the top of the document preview panel when a saved document is loaded via `?docId`. Clicking it starts a fresh chat session with all existing fields pre-populated as defaults — the original saved document is unchanged.
  - The AI opens with a locally-rendered message naming the document type and hinting at common fields to change (effective date, party 2, governing law). A past-date note is added inline if the template's `effectiveDate` is already in the past.
  - `isTemplateMode` flag sent to backend on every turn; `build_messages` injects a focused system message telling the LLM to ask what to change rather than collect fields from scratch.
  - Today's date injected into `snapshot_summary` for all sessions (template and regular), enabling universal LLM warning when a confirmed `effectiveDate` is in the past.
  - `isEffectiveDateInPast(dateStr)` helper added to `document-types.ts` (with parse guard for malformed input).
  - Tests: 39 backend (added 4), 40 frontend (added 3), all passing.

### Current API Endpoints
- `GET /api/health` → `{"status": "ok"}`
- `POST /api/auth/signup` → `{access_token, token_type, email}` (201)
- `POST /api/auth/signin` → `{access_token, token_type, email}` (401 bad creds, 423 locked)
- `GET /api/documents` → `[{id, title, document_type, created_at, updated_at}]` (auth required)
- `POST /api/documents` → `{id, title, document_type, fields, ...}` (auth required, 201)
- `GET /api/documents/{id}` → `{id, title, document_type, fields, ...}` (auth required)
- `PUT /api/documents/{id}` → updated document (auth required)
- `DELETE /api/documents/{id}` → 204 (auth required)
- `POST /api/chat` → AI chat for all 11 document types. Body: `{messages, fields, isTemplateMode?}`. Response: flat `ChatResponse`.
- `GET /_next/*` → static Next.js bundle assets
- `GET|HEAD /{path}` → static frontend (`/` chat, `/auth`, `/documents`; SPA fallback to `index.html`)
