# Sahbi Trip — MoroccoAI Travel

An AI travel planner focused on Morocco. A user describes a trip (dates, budget,
number of travelers, interests — or just a free-text sentence in FR/EN) and the
app searches a curated dataset of real activities and restaurants, ranks them,
and has an LLM assemble a day-by-day itinerary with a live budget. Once the
user validates their selection, the AI auto-fills a full trip dashboard
(timeline, map, budget breakdown, checklist, tips).

## Stack

**Backend** — NestJS (TypeScript)
- MongoDB Atlas (Mongoose) + **Atlas Vector Search** for semantic retrieval over activities/restaurants
- Redis + BullMQ for background jobs (email queue)
- JWT auth (access + refresh tokens), argon2 password hashing, OTP email verification via Nodemailer/Handlebars templates
- Zod for validating every AI-generated JSON payload; class-validator for DTOs
- Swagger/OpenAPI docs, Helmet, rate limiting (`@nestjs/throttler`)
- Vitest for unit + e2e tests, oxlint for linting

**AI layer** (`backend/src/app/ai`)
- **Anthropic Claude** (`claude-haiku-4-5` by default) for profile extraction, tool-calling, itinerary generation, replace/optimize/chat actions, and dashboard text
- **Voyage AI** for embeddings (`voyage-4`, pinned to 1024 dimensions) and reranking (`rerank-3`)
- Both providers are called directly over `fetch` (no OpenAI account/key involved anywhere) — `LlmClient` translates between Anthropic's Messages API and an OpenAI-shaped `ChatCompletion` object so the rest of the module (`ai.orchestrator.ts`, `ai.tools.ts`) is written against one familiar vocabulary
- Retrieval pipeline: embed the query → `$vectorSearch` on MongoDB (pre-filtered by city/budget/season) → Voyage rerank → deterministic scoring → Claude + tools build the itinerary → Zod validates the output

**Frontend** — React 19 + TypeScript + Vite
- Redux Toolkit + RTK Query for state and API calls
- React Router for routing, React Hook Form + Zod for form validation
- Tailwind CSS v4 for styling, `lucide-react` for icons
- SSE/polling to follow long-running AI generation jobs

**Infra**
- Docker Compose: `redis`, `backend` (Node/NestJS), `frontend` (static build served by nginx)
- MongoDB is **not** containerized — it points at a MongoDB Atlas cluster (needed for Vector Search)

## How it works

1. **Trip Wizard** — the user fills a form or types a free-text request (e.g. *"I'm in Marrakech now, 1500 DH, 2 days, food and culture, not too touristy"*). `POST /trips/extract-profile` uses Claude to turn that into a structured `TripProfile`.
2. **Generation** — `POST /trips/:id/generate` kicks off the pipeline: embed the request, run Atlas `$vectorSearch` over `activities`/`restaurants` (filtered by city, budget, free-only, season, opening hours), rerank the candidates with Voyage, score them, then let Claude (with tool-calling: `searchActivities`, `getDistance`, `calculateBudget`, …) assemble a day-by-day itinerary. The result is validated against a Zod schema before being persisted. This step is async — the endpoint returns immediately and the frontend polls `GET /trips/:id/dashboard-status`.
3. **Draft review** — the user sees the proposed itinerary and can add/replace/reorder activities before committing to anything.
4. **Confirm** — `POST /trips/:id/confirm` freezes the validated selection and triggers `DashboardFillerService`, which builds the full dashboard: budget breakdown and timeline are computed in **deterministic code** (never invented by the LLM), while summaries/tips/checklist text are written by Claude from the validated data only.
5. **Live editing** — from the dashboard the user can replace an activity, reorder/optimize a day, adapt the plan to a remaining budget, or chat with the assistant about their trip; each action re-runs only the affected part of the dashboard.

Guiding rule baked into the whole pipeline: **the LLM reasons over real, sourced data — it never invents a price, opening hour, or venue.** Anything not in `data/morocco_dataset.json` doesn't exist in an itinerary; missing data is shown as "unknown" rather than guessed.

### API surface (all routes under `/api/v1`)

| Area | Routes |
|---|---|
| `auth` | register, login, verify-email, resend-otp, forgot/reset password, refresh-token, change-password, me (get/patch), logout |
| `trips` | extract-profile, create/list/get, view, generate, confirm, dashboard-status, activities (add/replace/remove/transport), optimize, adapt-budget, chat |
| `chat` | contextual chat endpoint |
| `activities` / `restaurants` | list, stats, get by id (read-only catalog browsing) |
| `ai` | health check for the AI providers |

Full interactive docs are served by the backend itself at `/api-docs` (Swagger).

## Prerequisites

- Node.js ≥ 18 and npm
- Docker + Docker Compose (for the full containerized launch)
- A MongoDB Atlas cluster (free tier works) — Atlas Vector Search requires Atlas, a local/self-hosted MongoDB won't support the `$vectorSearch` stage
- An Anthropic API key (https://console.anthropic.com)
- A Voyage AI API key (https://www.voyageai.com)
- An SMTP account for transactional email (OTP, welcome, password reset) — e.g. a Gmail app password or Mailtrap for testing

## 1. Configure environment variables

The project uses **one shared `.env` file at the repo root** — read by the backend, the frontend build, and `docker-compose.yml`.

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Notes |
|---|---|
| `JWT_SECRET` | generate with `npm --prefix backend run generate:secret` |
| `MONGODB_URI` | your Atlas connection string (`mongodb+srv://...`) |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_USER` / `MAIL_PASSWORD` / `MAIL_FROM` | SMTP credentials |
| `ANTHROPIC_API_KEY` | from console.anthropic.com |
| `ANTHROPIC_MODEL` | defaults to `claude-haiku-4-5` |
| `VOYAGE_API_KEY` | from voyageai.com |
| `VOYAGE_EMBED_MODEL` / `VOYAGE_RERANK_MODEL` | defaults `voyage-4` / `rerank-3` — do not roll back to `voyage-3.x`/`rerank-2.x`, they're deprecated and quota-less |
| `CORS_ORIGINS` | `http://localhost:5173` for local dev |
| `VITE_API_URL` | `http://localhost:3000` for local dev |

`REDIS_HOST`/`REDIS_PORT` default to `localhost:6379` for local dev, and are overridden to the `redis` service name automatically inside Docker Compose.

## 2. Seed the database

This step populates MongoDB with the Morocco activities/restaurants dataset, generates their embeddings via Voyage, and **creates the Atlas Vector Search index** (`activities_vector`, 1024 dimensions) if it doesn't already exist.

```bash
cd backend
npm install
npm run seed
```

Re-running `npm run seed` is safe — it's idempotent and will upsert rows and recompute embeddings if `data/morocco_dataset.json` changes.

Optional sanity check that both AI providers (Anthropic + Voyage) and the DB are reachable:

```bash
npm run verify:ai
```

## 3. Launch — Option A: Docker Compose (recommended, full stack)

From the repo root, with `.env` filled in:

```bash
docker compose up --build
```

This starts:
- **Redis** on `localhost:6379`
- **Backend** (NestJS) on `http://localhost:3000` — Swagger docs at `http://localhost:3000/api-docs`
- **Frontend** (built React app served by nginx) on `http://localhost:5173`

Run the seed step (§2) once beforehand — Docker Compose doesn't run it automatically, and it also needs your local Node install to talk to Atlas/Voyage directly.

Stop everything with `docker compose down` (add `-v` to also drop the Redis volume).

## 4. Launch — Option B: run locally without Docker

Needs a local Redis instance running on `localhost:6379` (e.g. `docker run -p 6379:6379 redis:7-alpine`) plus the same `.env` at the repo root.

**Backend:**
```bash
cd backend
npm install
npm run start:dev       # http://localhost:3000, watch mode
```

**Frontend** (in a second terminal):
```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

Open `http://localhost:5173` — sign up, verify the emailed OTP (check your SMTP inbox / Mailtrap), and go through the trip wizard.

## Useful backend scripts

Run from `backend/`:

| Command | Purpose |
|---|---|
| `npm run seed` | Load `data/morocco_dataset.json` into MongoDB + build embeddings + create the vector index |
| `npm run verify:ai` | Smoke-test the Anthropic and Voyage connections |
| `npm run test:itinerary` | Exercise the itinerary generation pipeline standalone |
| `npm run test:trip-view` | Exercise the trip dashboard view standalone |
| `npm run test` / `test:e2e` / `test:cov` | Vitest unit / e2e / coverage |
| `npm run lint` | oxlint |
| `npm run generate:secret` | Print a random 64-byte hex string for `JWT_SECRET` |

## Project layout

```
backend/
  src/app/          feature modules: auth, users, tokens, mail, trips, activities,
                     restaurants, budget, ai (LLM orchestration, retrieval, scoring, tools)
  src/core/          config validation, redis, filters, shared DTOs/utils
  scripts/           seed.ts, verify-ai-providers.ts, one-off test/debug scripts
frontend/
  src/pages/         route-level screens (wizard, dashboard, auth, trip views)
  src/features/      RTK Query slices per domain (auth, trips, chat)
  src/components/    shared UI (wizard steps, dashboard widgets, chat widget)
  src/store/         Redux store setup
data/
  morocco_dataset.json   sourced catalog of activities & restaurants (Casablanca, Marrakech, Rabat)
docs/
  MoroccoAI_Travel_Hackathon_Guide.md   original hackathon design doc (NVIDIA NIM/Brev plan — superseded
                                        in this codebase by Anthropic + Voyage, see backend/src/app/ai/llm.client.ts)
```
