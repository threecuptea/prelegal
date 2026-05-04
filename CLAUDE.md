# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation supports all 11 document types via AI chat with full user authentication and document persistence.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-120b` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an OPENROUTER_API_KEY in the .env file in the project root.

## Technical design

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.
Please put all FastAPI routes under a subfolder `routes` of `backend` folder.  For example, auth.py for authentication-related routes, chat.py for chat-related routes and documents.py for documents-related routes.
The frontend should be in frontend/  
The database should use SQLLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
Consider statically building the frontend and serving it via FastAPI, if that will work.  
There should be scripts in scripts/ for:  
```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```
Backend available at http://localhost:8000

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

## Implementation Status

### Completed
- **PL-2** — CommonPaper legal document templates and `catalog.json` (12 documents in `templates/`).
- **PL-3** — Next.js 16 + React 19 + Tailwind 4 Mutual NDA Creator under `frontend/app/` (form → live preview → markdown download / print to PDF). Vitest unit tests in `frontend/app/lib/`.
- **PL-4** — V1 technical foundation:
  - `frontend/next.config.ts` set to `output: "export"` so the existing UI builds to a static export at `frontend/out/`.
  - `backend/` uv project (Python 3.12, FastAPI, uvicorn, python-dotenv) with `main.py` mounting `/_next` static assets and a GET/HEAD catch-all that resolves `<path>` → `<path>.html` → SPA fallback to `index.html`. CORS allows `localhost:3000` and `localhost:8000`. `/api/*` is reserved (404 from the catch-all) so future routers in `backend/routes/` are not shadowed. Path traversal is guarded with `Path.is_relative_to`.
  - `backend/routes/__init__.py` placeholder establishes the convention; per-area routers (`auth.py`, `chat.py`, `documents.py`) are deferred to feature tickets.
  - Multi-stage `Dockerfile` (node:20-alpine builds the frontend export → python:3.12-slim runs `uvicorn main:app`).
  - Single-service `docker-compose.yaml` exposing port 8000 and reading `.env` via `env_file`.
  - `scripts/start-{mac,linux}.sh`, `scripts/stop-{mac,linux}.sh`, `scripts/start-windows.ps1`, `scripts/stop-windows.ps1` — thin wrappers over `docker compose up --build -d` / `docker compose down`.
  - 7 backend pytest cases covering health, `/api/*` 404, static index/asset serving, SPA fallback, and path-traversal guards.
- **PL-5** — Replaced the form UX with a freeform AI chat for the Mutual NDA:
  - Frontend: `frontend/app/nda-chat.tsx` (client component) drives a two-column layout (chat on the left, collapsible field summary + live `NDAPreview` on the right). `nda-form.tsx` was removed; `NDAPreview` and `downloadMarkdown` were extracted to `frontend/app/nda-preview.tsx`. `frontend/app/lib/nda-chat-helpers.ts` exposes `mergeFieldUpdates` (drops null/undefined, honors `""` so optional fields like `modifications` can be cleared) and `missingRequiredFields`. Stable per-message ids, `AbortController`-based cancellation on `Start over`, brand-purple submit/Send/Download buttons (`#753991`).
  - Backend: `POST /api/chat` in `backend/routes/chat.py` is stateless — accepts `{messages, fields}`, calls LiteLLM `acompletion` against `openrouter/openai/gpt-oss-120b` via Cerebras with `response_format=ChatResponse` (per `.claude/skills/cerebras/SKILL.md`). System prompt enforces "ask 1–2 questions, always end with a follow-on, never invent values, only set `done: true` after explicit user confirmation". Pydantic models use `typing.Literal` for the discriminated string fields; `Field(max_length=...)` caps message size (4 000 chars) and history length (100). Returns 503 if `OPENROUTER_API_KEY` is unset, 502 on upstream / parse errors. Wired in `backend/main.py` via `app.include_router(chat_router)` after `load_dotenv()`.
  - Deps: `litellm`, `pydantic` added to `backend/pyproject.toml`.
  - Tests: 9 new pytest cases in `backend/tests/test_chat.py` (LiteLLM monkeypatched); new vitest suite in `frontend/app/lib/nda-chat-helpers.test.ts`. Full suite: 16 backend, 45 frontend, all passing; `npm run build` produces a clean static export.

### Deferred (future tickets)
- SQLite + users table created on container startup.
- Auth, document persistence, and remaining per-document-type routes (`auth.py`, `documents.py`).
- Chat for document types beyond Mutual NDA.

### Current API Endpoints
- `GET /api/health` → `{"status": "ok"}`
- `POST /api/chat` → AI chat for Mutual NDA. Body: `{messages: [{role, content}], fields: <NDAData snapshot>}`. Response: `{reply, field_updates, done}`.
- `GET /_next/*` → static Next.js bundle assets (mounted from `frontend/out/_next`)
- `GET|HEAD /{path}` → static frontend (`frontend/out/<path>`, `frontend/out/<path>.html`, or SPA fallback to `index.html`)
