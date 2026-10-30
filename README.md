# Content Creator Studio

A web workspace for short-form video creators that replaces a content spreadsheet: a production
pipeline for ideas, an audio library, a quick-reference library of production rules, and an AI
brainstorm that drafts a version of each idea for every platform you post to.

React + Vite frontend, FastAPI backend, Supabase (PostgreSQL + Auth) for data, deployed as a single
Render web service.

## Features

- **Pipeline**: Kanban board and an inline-edit table. Ideas move through five stages
  (idea → script → filming → editing → published), with concept, priority, publish date, hook,
  hashtags and the platforms each idea targets.
- **Multi-platform**: each idea can target TikTok, Instagram Reels, YouTube Shorts, Facebook Reels,
  LinkedIn and X, with a publish date and link per platform.
- **AI brainstorm**: describe a topic, pick format, length and platforms; the backend calls an
  OpenAI-compatible Responses API and returns structured ideas with per-platform adaptations.
  Brainstorm history is saved. The browser never sees the API key.
- **Audio library and quick reference**: background tracks, editing shortcuts, export presets and
  filming SOPs in one place.
- **JSON import**: upload or paste JSON, preview counts and sample rows, then import (1 MB / 500
  rows per request, validated server-side).
- **Workspaces**: Supabase Auth, workspaces with `owner` / `admin` / `editor` / `viewer` roles and
  row-level security. A simpler single-password mode exists for local prototypes.
- **8 UI languages**: Vietnamese, English, Korean, Japanese, Indonesian, Thai, Malay, Filipino.

## Run locally

Requires Node.js 20+ and Python 3.11+.

```bash
cp .env.example .env            # fill in what you need; see below
python3 -m venv .venv && . .venv/bin/activate
pip install -r backend/requirements.txt
npm --prefix frontend install
npm --prefix frontend run build
set -a; . ./.env; set +a
uvicorn backend.app.main:app --reload --port 4173
```

Open http://localhost:4173. For frontend hot reload, run `npm --prefix frontend run dev` and proxy
`/api` to the FastAPI port.

Without Supabase settings the backend uses an in-memory store loaded from `sheet-data.json`
(sample data), which is enough to try the UI. Local password mode needs `AUTH_MODE=legacy`,
`APP_PASSWORD` and a long random `APP_SESSION_SECRET`.

## Configuration

| Variable | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | backend | Supabase project and public key |
| `SUPABASE_SECRET_KEY` | backend only | service-role access; never expose to the browser |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | frontend build | Supabase Auth in the browser |
| `ADMIN_USER_IDS` | backend | comma-separated Supabase user IDs with admin access |
| `LLM_API_KEY` | backend only | key for the AI brainstorm |
| `LLM_BASE_URL` | backend | any OpenAI-compatible endpoint (default `https://api.openai.com/v1`) |
| `LLM_MODEL` | backend | model name (default `gpt-4.1-mini`) |

## Database

1. Create a Supabase project.
2. Apply the schema: run `supabase/schema.sql` in the SQL editor, or `supabase db push` with the
   migrations in `supabase/migrations/`.
3. Optional: load the sample data with `supabase/seed.sql` (regenerate it from `sheet-data.json`
   with `python3 supabase/seed.py`).
4. Run `supabase/import.sql` once to enable the JSON import RPC.

Rollback scripts live in `supabase/rollback/` and are applied manually. Never edit a migration that
has already run; add a new one.

## Deploy

`render.yaml` defines one Render web service: it builds the React app into `frontend/dist`, and
FastAPI serves those files and `/api/*` from the same origin. Set the variables above in the Render
dashboard.

## Tests

```bash
python3 -m unittest discover -s backend/tests
node --test tests/*.test.mjs
```

## Project layout

- `frontend/`: React + Vite client
- `backend/app/`: FastAPI routes, validation, Supabase repository, in-memory fallback, AI proxy
- `supabase/`: schema, migrations, rollbacks, seed and import SQL
- `tests/`, `backend/tests/`: frontend data and backend behavior tests
- `SPEC.md`, `PAIN_POINTS.md`: product spec and backlog notes
