# [](https://)[](https://)CLAUDE.md

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

- `chat.py` → `/api/chat`
- `documents.py` → `/api/documents`

Business logic belongs in `backend/services/` (e.g. `chat_service.py`); route functions call service functions. Pydantic models go in `backend/models/` when needed.

The frontend is in `frontend/` — Next.js 16, React 19, Tailwind 4. It is statically exported (`next.config.ts` → `output: "export"`) to `frontend/out/`, which FastAPI serves at runtime. The `frontend/AGENTS.md` note is important: read `node_modules/next/dist/docs/` before writing Next.js-specific code because this version has breaking API changes.

The database uses **PostgreSQL** via `psycopg2` (`backend/db.py`). Schema is created on startup via `init_db()` called from the FastAPI lifespan. Connection is configured via `DATABASE_URL` env var (defaults to `postgresql://prelegal:prelegal@localhost:5432/prelegal`). In Docker, the `postgres:15` service in `docker-compose.yaml` provides the database. In production (Cloud Run), Cloud SQL Postgres 15 is used via Unix socket (`?host=/cloudsql/...`). For local dev, start Postgres first: `docker compose up postgres -d`.

Backend available at http://localhost:8000

## Architecture

### Request flow

1. Browser loads the statically-exported Next.js SPA from FastAPI (`GET /`).
2. Unauthenticated users are redirected to `/auth`. Clerk's `SignInButton`/`SignUpButton` open a modal; after sign-in Clerk issues a short-lived JWT stored client-side by the Clerk SDK.
3. Authenticated users land on `frontend/app/chat.tsx` (two-column: chat left, field summary + live preview right). Loading a saved document appends `?docId=<id>` to the URL; the chat hydrates fields from `GET /api/documents/<id>` on mount.
4. Each user turn `POST /api/chat` sends the full conversation history plus the current `DocumentFields` snapshot (stateless). The `Authorization: Bearer <clerk-jwt>` header is sent on all authenticated API calls via `authFetch(url, init, getToken)` where `getToken` comes from Clerk's `useAuth()` hook.
5. `backend/routes/chat.py` calls LiteLLM with `response_format=ChatResponse` (Pydantic structured output). Returns `{response, isComplete, documentType, suggestedDocument, ...fields}`.
6. Frontend applies `mergeDocumentFields` to update state. The **Save** button (first save) opens a naming modal then POSTs to `/api/documents`; **Rename…** (subsequent saves) PUTs with the updated title and latest fields.

### Key files

- `frontend/app/lib/document-types.ts` — `DocumentFields` interface, `DOCUMENT_REGISTRY` (all 11 doc types, each with `templateFile`), `mergeDocumentFields`, `missingRequiredDocumentFields`, `generateCoverPage` (cover page only, kept for tests), `processTemplateContent` (strips spans, removes leading heading), `generateDocument` (full self-contained doc: cover page → standard terms → signatures), escape utilities.
- `frontend/app/providers.tsx` — `'use client'` wrapper that provides `ClerkProvider` (from `@clerk/clerk-react`) to the entire app. Required because `layout.tsx` is a Server Component and cannot directly import client-side providers.
- `frontend/app/lib/auth.ts` — `authFetch(url, init, getToken)`: injects Clerk Bearer token, redirects to `/auth` on 401/403.
- `frontend/app/chat.tsx` — unified chat UI with Clerk auth guard (`useAuth()`), Save/Rename…/Print toolbar, `?docId` hydration, `AppHeader`, disclaimer banner. Fetches `/templates/{templateFile}` when document type is detected; passes `templateContent` to preview. No Field Summary — Cover Page in the document preview serves that purpose.
- `frontend/app/auth/page.tsx` — Clerk sign-in/sign-up page using `SignInButton`/`SignUpButton` in modal mode.
- `frontend/app/documents/page.tsx` — saved documents list with Load/Delete actions.
- `frontend/app/components/app-header.tsx` — shared nav: logo, My Documents link, user email (from `useUser()`), `SignOutButton`.
- `frontend/app/components/disclaimer-banner.tsx` — "documents are drafts" yellow banner.
- `frontend/app/document-preview.tsx` — `TemplateContent` (inline markdown renderer), `DocumentPreview` (cover page fields → standard terms → signatures), `downloadMarkdown` (uses `generateDocument` when template available; falls back to `generateCoverPage`).
- `frontend/public/templates/` — 11 Common Paper standard-terms `.md` files served as static assets (included in `frontend/out/` at build time).
- `backend/db.py` — `init_db()`, `get_db()` context manager (psycopg2, RealDictCursor), `row_to_dict()` (datetime → ISO string), `_connect_kwargs()` (parses `?host=` query param for Cloud SQL Unix socket). Schema: `account` (`id`, `clerk_sub`, `email`, `created_at`) + `document` tables (SERIAL PKs, TIMESTAMPTZ timestamps). Idempotent migrations drop old password-auth columns.
- `backend/models/chat.py` — `ChatResponse` flat model (LLM schema + API response), `ChatRequest`. `MAX_MESSAGE_CHARS`, `MAX_MESSAGES` constants.
- `backend/models/documents.py` — `DocumentCreate`, `DocumentUpdate`, `DocumentSummary`, `DocumentDetail`.
- `backend/services/auth_service.py` — Clerk JWT validation via `fastapi-clerk-auth` (`ClerkHTTPBearer`). `get_current_account` FastAPI dependency: validates Clerk JWT, lazily upserts account by `clerk_sub`. `CLERK_JWKS_URL` env var required.
- `backend/services/chat_service.py` — `SYSTEM_PROMPT` (all 11 doc types), `snapshot_summary`, `build_messages`, `call_llm`.
- `backend/services/document_service.py` — document CRUD via `asyncio.to_thread`; ownership enforced by `account_id`.
- `backend/routes/documents.py` — `/api/documents` CRUD, all Clerk-JWT-protected.
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
- **PL-10** — Forgot and reset password (PR #12):
  - "Forgot password?" link on the Sign In screen switches the auth card inline to an email-entry view (`Tab` extended to `'signin' | 'signup' | 'forgot'`). No new page needed for the forgot step.
  - `POST /api/auth/forgot-password` — generates a `secrets.token_urlsafe(32)` token stored with a 1-hour expiry, sends a Resend email from `prelegal-no-reply@threecuptea.com`. Always returns 200 regardless of whether the email exists (anti-enumeration); email send failures are logged and swallowed.
  - `POST /api/auth/reset-password` — validates token + expiry, updates `password_hash`, clears `reset_token`, resets `failed_attempts` and `locked` so previously-locked accounts regain access.
  - `frontend/app/auth/reset-password/page.tsx` — new page reads `?token` via `useEffect`/`window.location.search` (static-export safe); new password + confirm fields; auto-redirects to `/auth` on success.
  - DB migration: idempotent `ALTER TABLE account ADD COLUMN` adds `reset_token` and `reset_token_expires_at` to existing databases in `init_db()`.
  - Requires `RESEND_API_KEY` and `APP_BASE_URL` in `.env` (`http://localhost:3000` dev, `http://localhost` Docker, production domain for prod).
  - Tests: 46 backend (added 7), 40 frontend, all passing.
- **PL-11** — User-provided document title; split Save / Rename / Print actions (PR #13):
  - **Download .md** removed (legal docs are shared as PDF, not markdown).
  - **"Save & Print PDF"** replaced by three context-aware toolbar buttons:
    - **Save** (visible only before first save, enabled when `isComplete`): opens naming modal → saves to DB → print dialog opens so user can save PDF with the same filename.
    - **Rename…** (replaces Save after first save): opens modal pre-filled with stored title → updates DB title + latest fields → print dialog opens so user can re-save PDF with the new filename. Keeping title consistent between DB and PDF is intentional — user can overwrite the old file.
    - **Print** (always visible when `canDownload`, no DB interaction): opens print dialog with saved title pre-filled as filename via `document.title`; title restored via `afterprint` event.
  - Naming modal: heading reads "Name your document" (first save) or "Rename document" (rename); Enter key confirms; Escape closes; `role="dialog"` + `aria-modal` for accessibility.
  - Smart default title (first match wins): party companies → party names → purpose snippet (≤40 chars, truncated with `…`) → `"<Type> Draft"` fallback.
  - `savedTitle` state tracks the confirmed DB title; populated on successful save and on `?docId` hydration from `doc.title`; cleared by `handleUseAsTemplate` and `reset`.
  - `printWithTitle(title)` helper sets `document.title`, calls `window.print()`, restores via `afterprint`.
  - `generateDocumentTitle(data, docType)` added to `document-types.ts`.
  - Disclaimer banner made more prominent: `text-sm font-semibold`, `bg-yellow-100 border-yellow-300 text-yellow-900`, `py-3`.
  - No backend changes needed (title field already existed in DB).
  - Tests: 39 backend (unchanged), 49 frontend (added 9), all passing.
- **PL-12** Automate the production deployment with Iac Terraform and also add domain to the service url
  - Add Terraform to automate the deployment to Cloud Run in GCP.   Cloud Run is a service for the cost-effective serverless container deployment. Prelegal built as docker image is ready for that.
  - Copy from tf files `terraform/gcp` folder of `cyber` project as the template plus terraform.tfvars so that it can be fully automated.  Make adjustment to project_id and environment variables etc.
  - `terraform apply` created 8 services, including `cloudbuild`, `artifactregistry` and `cloudrun`
    and terraform output servive_url [Prelegal cloud ](https://preleagl-300878348607.us-central1.run.app)
  - For most modern cloud platforms and hosting providers, redeploying an existing service won't change service URL. However, adding a domain to the cloud run service URL make `prelegal` look more professional and can be used in password reset too.
  - `Cloud Run` can not be attached to a static IP address and its associated domain due to its serverless nature. Other than a static IP and a new DNS record, a load balancer and SSL certification are also needed.
  - I reference [Set up a classic Application Load Balancer with Cloud Run, App Engine, or Cloud Run functions](https://docs.cloud.google.com/load-balancing/docs/https/setting-up-https-serverless#creating_the) and [Use Google-managed SSL certificates](https://docs.cloud.google.com/load-balancing/docs/ssl-certificates/google-managed-certs) and tried twice to get it work.
  - There are interdepencies among those 4 components. The key points:
    Load balancer frontend has its own IP address.  A `A` type of DNS record with a prefix (`prelegal` in this case) need to be added to and associated with the Load Balancer IP address instead of the static IP address configured in VPC network.
    Howeverr, the static IP address is need and used by Load balancer frontend forwarding rule.
    a SSL certificate managed by Google is added and required by the load balancer backend HTTPS.  However, the status of the SSL certificate won't become ACTIVE until the link of the specified domain DNS and the IP address of the load balancer is established (proprogated) and it is O.K. to attach a SSL certificate of a PROVISIONING status to a load balacer.  You might see `FAILED-NOT_VISIBLE` error too. That will go away when the link of the specified domain DNS and the IP address of the load balancer is established (proprogated)
  - The correct order: configure a static IP, a SSL certificate, a load balancer in GCP and a DNS record in the domain hosting site following the instructions.
  - The end result is [Prelegal Service](https://prelegal.threecuptea.com/)
- **PL-13** — Migrate from SQLite to Cloud SQL Postgres for persistent GCP storage (PR #15):
  - `backend/db.py`: replaced sqlite3 with psycopg2. `DATABASE_URL` env var. `_connect_kwargs()` manually parses `?host=` query param so Cloud SQL Unix socket works with psycopg2 (which ignores that param in its URL parser). `row_to_dict()` serializes TIMESTAMPTZ datetimes to ISO strings.
  - `backend/services/auth_service.py` + `document_service.py`: explicit cursors, `%s` placeholders, `RETURNING *` on INSERT/UPDATE (no redundant SELECT), `NOW()`, `psycopg2.errors.UniqueViolation`, email lowercased on all inserts and queries.
  - `backend/pyproject.toml`: `psycopg2-binary>=2.9` added.
  - `docker-compose.yaml`: `postgres:15` service with `pg_isready` healthcheck; `prelegal` service `depends_on: condition: service_healthy`; removed `prelegal-data` SQLite volume.
  - `Dockerfile`: removed `ENV PRELEGAL_DB_PATH`.
  - `terraform/gcp/main.tf`: Cloud SQL Postgres 15 (`db-f1-micro`), dedicated Cloud Run service account with `roles/cloudsql.client`, `run.googleapis.com/cloudsql-instances` annotation, `DATABASE_URL` env var, `replace_triggered_by` on IAM member (eliminates 403 window when Cloud Run is replaced).
  - `terraform/gcp/variables.tf`: `db_password` variable added.
  - Backend tests: monkeypatch `DATABASE_URL` + `TRUNCATE … RESTART IDENTITY CASCADE` per test. 46 backend, 49 frontend, all passing.
  - **Deployment note**: when redeploying Cloud Run, always replace `docker_image.app` + `docker_registry_image.app` + `google_cloud_run_service.app` together to ensure the new image is built. A plain `-replace="google_cloud_run_service.app"` reuses the cached image.
- **PL-14** — Replace home-made auth with Clerk user authentication (PR #16):
  - Replaced bcrypt/PyJWT/Resend email/password auth entirely with Clerk. Auth is now handled client-side by `@clerk/clerk-react` (the pure React SDK — `@clerk/nextjs` v7+ uses Server Actions which are incompatible with `output: "export"`).
  - Frontend: `ClerkProvider` added via `app/providers.tsx` wrapper (required because `layout.tsx` is a Server Component). `app/auth/page.tsx` replaced with `SignInButton`/`SignUpButton` modal buttons. `app/auth/reset-password/page.tsx` deleted (Clerk handles password reset). `app/lib/auth.ts` simplified to `authFetch(url, init, getToken)`. `app-header.tsx` uses `useUser()` + `SignOutButton`. `chat.tsx` and `documents/page.tsx` use `useAuth()` for auth guard and token injection.
  - Backend: `auth_service.py` rewritten — Clerk JWT validated via `fastapi-clerk-auth` (`ClerkHTTPBearer` + `CLERK_JWKS_URL`). `get_current_account` lazily upserts account by `clerk_sub`. `routes/auth.py` and `models/auth.py` deleted. `pyproject.toml`: added `fastapi-clerk-auth`, removed `bcrypt`/`PyJWT`/`resend`.
  - DB migration: idempotent `ALTER TABLE` drops old password-auth columns (`password_hash`, `failed_attempts`, `locked`, `reset_token`, `reset_token_expires_at`), adds `clerk_sub TEXT UNIQUE`, drops old `email UNIQUE` constraint.
  - `Dockerfile`: `ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` bakes the Clerk publishable key into the static bundle at build time. `next.config.ts`: dev-only rewrite proxies `/api/*` → `localhost:8000` (excluded from `output: "export"` build).
  - `terraform/gcp`: `clerk_publishable_key` variable added as Docker build arg; `JWT_SECRET`/`RESEND_API_KEY`/`APP_BASE_URL` Cloud Run env vars removed. `variables.tf` cleaned up.
  - Env vars required: `CLERK_JWKS_URL` (backend `.env`); `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (baked into Docker image at build time via `terraform.tfvars`).
  - Tests: 41 backend (rewrote auth tests; document tests use `dependency_overrides` instead of signup/signin), 49 frontend, all passing.
- **PL-15** — Add Clerk user authentication skill for App Router static export (PR #18):
  - Adds `.claude/skills/clerk-user-authentication-app-router-static-output/SKILL.md` — a reusable Claude skill capturing the non-obvious integration choices from PL-14.
  - Covers: why `@clerk/clerk-react` must be used instead of `@clerk/nextjs` (v7+ Server Actions incompatible with `output: "export"`); dev two-service setup + `next.config.ts` dev-only proxy rewrite; `ClerkProvider` in `providers.tsx` + `layout.tsx` wiring; `authFetch` utility; auth page pattern with `SignInButton`/`SignUpButton` in `mode="modal"`; `useUser()` + `SignOutButton` for nav; FastAPI `fastapi-clerk-auth` backend; required Clerk Dashboard session token customization to include `email` claim; `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` as build-time Docker arg vs `CLERK_JWKS_URL` as runtime env var.

  ### Current API Endpoints
- `GET /api/health` → `{"status": "ok"}`
- `GET /api/documents` → `[{id, title, document_type, created_at, updated_at}]` (Clerk JWT required)
- `POST /api/documents` → `{id, title, document_type, fields, ...}` (Clerk JWT required, 201)
- `GET /api/documents/{id}` → `{id, title, document_type, fields, ...}` (Clerk JWT required)
- `PUT /api/documents/{id}` → updated document (Clerk JWT required)
- `DELETE /api/documents/{id}` → 204 (Clerk JWT required)
- `POST /api/chat` → AI chat for all 11 document types. Body: `{messages, fields, isTemplateMode?}`. Response: flat `ChatResponse`.
- `GET /_next/*` → static Next.js bundle assets
- `GET|HEAD /{path}` → static frontend (`/` chat, `/auth`, `/documents`; SPA fallback to `index.html`)
