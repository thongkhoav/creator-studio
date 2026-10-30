# Spec: Content Creator Studio

## Objective
Provide a single web workspace that replaces the shared content spreadsheet with a persistent production pipeline, audio library, production reference library, and server-side multi-platform AI brainstorm.

## Tech Stack
- Frontend: React 19, JSX, Vite, CSS theme tokens (light and dark).
- Backend: Python 3.11+, FastAPI, Pydantic, Uvicorn, httpx.
- Database and auth: Supabase PostgreSQL and Auth. The backend verifies each bearer token and calls
  Supabase with the signed-in user's JWT and the publishable key, so row-level security applies to
  every read and write, imports included. The secret key stays on the server and is used only for
  the global admin views and the legacy single-password mode, never for a signed-in user's data.
- Deployment: one Render Free Web Service serving `frontend/dist` and `/api/*`.
- AI: any OpenAI-compatible Responses API (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`).

## Project Structure
- `frontend/` - React/Vite client build.
- `backend/app/main.py` - FastAPI routes, validation, Supabase repository, memory fallback, AI proxy.
- `supabase/migrations/` - schema history; `supabase/setup.sql` concatenates them for a new project.
- `supabase/demo_seed.sql` - English demo workspace; `supabase/seed.sql` - legacy sample data from `sheet-data.json`.
- `tests/` and `backend/tests/` - frontend data and backend behavior tests.

## Success Criteria
- React build produces `frontend/dist` and FastAPI serves it from the same origin.
- Supabase schema stores all five content/reference entities.
- Ideas can be listed, created, filtered client-side, and moved across five statuses through `/api/ideas`.
- AI brainstorm is server-side and returns structured ideas without exposing the API key.
- Missing Supabase or AI configuration produces explicit errors; local memory fallback is available for UI work.
- Sheet data is represented in `supabase/seed.sql` without credentials.

## JSON import
- Import a JSON object containing any subset of `ideas`, `tracks`, and `config_presets` arrays; append records with new IDs. Re-imports append duplicates.
- A workspace toolbar dialog accepts a file or pasted JSON, offers a downloadable example, validates through the authenticated API and previews counts and sample rows before importing.
- Reject unknown fields, blank required strings, invalid dates/status/priority/URLs, empty payloads, more than 500 total rows, and UTF-8 bodies larger than 1 MiB. Normalize missing/empty idea dates to null. No new dependencies.
- Validate the entire payload before writing. Persist mixed imports in one Supabase RPC transaction; provide `supabase/import.sql` for existing and new installations, restricted to the backend service role. Memory mode must have the same all-or-nothing behavior. Optional idea `track_id` refers only to an existing library ID.
- Use `POST /api/import/preview` for validation and `POST /api/import` for writes. Both require the existing session. Show validation locations and errors in Vietnamese; do not expose backend keys or database exception details.
- Validate with `.venv/bin/python -m unittest discover -s backend/tests`, `node --test tests/*.test.mjs`, `npm --prefix frontend run build`, isolated PostgreSQL transaction checks and a browser import flow. Never seed or mutate the live Supabase during tests.

## Multi-platform content
- Ideas store a validated `platforms` array and default to TikTok for legacy records.
- Platform-specific presets are represented in the existing reference table with platform-scoped names.
- The strategist prompt returns channel adaptations without exposing provider keys.

## Multi-user workspace
- Authentication uses Supabase Auth email/password; the backend validates bearer tokens through Supabase Auth before accessing workspace data.
- Users may belong to multiple workspaces with `owner`, `admin`, `editor`, or `viewer` roles.
- Every content record is scoped to a workspace. Calendar entries, platform variants, presets, checklists, and media assets are first-class records.
- The first release manages schedules and publishing state; it does not automatically publish to social networks.
- Supabase RLS policies enforce workspace membership. The server secret remains backend-only.

## Delivery: authenticated workspace application
All eleven requested features are in this delivery. Browser authentication uses
Supabase JS email/password, verification callback, recovery, refresh and logout.
FastAPI verifies each bearer with Auth; ordinary database/storage calls use the
user JWT and publishable key (RLS), never the service key. Workspace header is
validated against membership. Viewer is read-only; editors manage content;
admins manage editors/viewers and presets; only owner manages admins. Owner
cannot be removed or demoted in this release. Invite links are email-bound,
expire after seven days, and can be revoked; no automatic email sending.
Schedules belong to platform variants, store UTC, display in browser timezone.
Media supports private uploads up to 20 MiB or external HTTP(S) links. Backfill
is atomic, previewed and confirmed, and requires a deployment-configured legacy
owner Auth UUID plus ownership of the selected destination workspace. It never
assigns old content automatically. Unconfigured local development fails closed.
Verification: API tests with fake Supabase, isolated PostgreSQL RLS/RPC tests,
frontend tests/build and browser flows if available. Never mutate live data in tests.

## Later additions
- Quick capture: `N` focuses a one-line input above the board; the card is added optimistically and
  rolled back if the save fails.
- `POST /api/brainstorm/expand` turns an idea card into a hook, numbered beats and per-platform
  captions; the client fills the form and saves only when the user confirms.
- Brainstorm results can be saved to a chosen column and concept, one at a time or all at once.
- Board, Calendar and Table are three views of the same filtered ideas.
- Drag and drop updates the card immediately and reverts on failure. The backend caches verified
  sessions (60 s) and workspace roles (30 s), pools its Supabase connection and reads the state
  tables in parallel.
- Light and dark themes from one set of color tokens; a phone layout with a bottom tab bar.
