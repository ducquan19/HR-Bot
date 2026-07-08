# HR Bot

AI-powered assistant for technical hiring. HR Bot helps recruiters manage recruitment campaigns, collect CVs, parse and screen candidates with AI, run virtual interviews, search candidate profiles, and export evaluation reports.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Useful Commands](#useful-commands)
- [Default Accounts](#default-accounts)
- [Main URLs](#main-urls)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)

## Features

- Recruiter/admin authentication with JWT.
- Recruitment campaign CRUD with job description, skills, public application link, and candidate count.
- Public application form for candidates to submit profile information and CV files.
- CV upload, storage, parsing worker, and AI screening workflow.
- Candidate list with filters, stage updates, detail modal, AI screening report, and PDF report export.
- Semantic candidate search with pgvector support and keyword fallback.
- Virtual interview creation, email invite, public interview workspace, answer submission, and local draft saving.
- Dashboard summary for campaigns, candidates, funnel, score distribution, and top skills.
- PostgreSQL schema designed for campaigns, candidates, CVs, AI extraction, screening, interviews, talent pools, and audit logs.

## Tech Stack

**Frontend**

- React 18
- Vite
- TypeScript
- Tailwind CSS
- Zustand
- React Router
- Lucide icons

**Backend**

- NestJS
- Prisma ORM
- PostgreSQL with optional pgvector
- Redis and BullMQ
- MinIO/S3-compatible object storage
- MailHog/Nodemailer
- WebSocket gateway for realtime events
- Gemini CV extraction with mock fallback for local development

## Project Structure

```text
HR-Bot/
  backend/                 NestJS API, Prisma schema, workers, services
  frontend/                React/Vite web app
  docs/                    Project documentation and implementation tracking
  docker-compose.yml       Local PostgreSQL, Redis, MinIO, MailHog, backend
  README.md                Root setup and usage guide
```

## Prerequisites

- Node.js 20+
- npm 10+
- pnpm 9+ for the frontend
- Docker Desktop or Docker Engine
- Git
- Optional: `psql` client if you want to apply `pgvector.sql` manually

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd HR-Bot
```

### 2. Create environment files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

When running the backend directly on your machine while PostgreSQL and Redis run from Docker, make sure these values are set in `backend/.env`:

```env
DATABASE_URL=postgresql://hrbot:hrbot@localhost:5433/hrbot?schema=public
REDIS_HOST=localhost
REDIS_PORT=6380
S3_ENDPOINT=http://localhost:9000
MAIL_HOST=localhost
MAIL_PORT=1025
AI_PROVIDER=mock
```

For real CV extraction with Gemini, create a free API key in Google AI Studio, then set:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_google_ai_studio_api_key
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
```

If `GEMINI_API_KEY` is set and `AI_PROVIDER` is omitted, the backend automatically uses Gemini. Without a Gemini key, the backend falls back to the mock parser so local development still works.

For production, the backend requires `AI_PROVIDER=gemini` and `GEMINI_API_KEY`; startup fails if production is configured to use the mock parser.

The frontend should point to the backend API:

```env
VITE_API_URL=http://localhost:3000/api
```

### 3. Start local infrastructure

```bash
docker compose up -d postgres redis minio mailhog
```

Services exposed to your host machine:

- PostgreSQL: `localhost:5433`
- Redis: `localhost:6380`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`
- MailHog UI: `http://localhost:8025`

### 4. Setup the backend database

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Optional pgvector objects for semantic search:

```bash
psql "postgresql://hrbot:hrbot@localhost:5433/hrbot?schema=public" -f prisma/sql/pgvector.sql
```

If you skip this step, semantic search still works through the backend keyword fallback.

### 5. Run the backend

```bash
cd backend
npm run start:dev
```

The API runs at:

```text
http://localhost:3000/api
```

Health check:

```text
http://localhost:3000/api/health
```

### 6. Run the frontend

Open a second terminal:

```bash
cd frontend
pnpm install
pnpm dev
```

The app runs at:

```text
http://localhost:5173
```

## Running With Docker

The compose file includes PostgreSQL, Redis, MinIO, MailHog, and the backend service.

```bash
docker compose up -d --build
```

The frontend is not included in `docker-compose.yml`; run it locally with:

```bash
cd frontend
pnpm install
pnpm dev
```

For first-time backend database setup, run migrations and seed from your host:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## Environment Variables

Backend variables are documented in [backend/.env.example](backend/.env.example).

Important local defaults:

| Variable | Local value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://hrbot:hrbot@localhost:5433/hrbot?schema=public` | Use `5433` when backend runs on host. |
| `REDIS_HOST` | `localhost` | Use `redis` only inside Docker network. |
| `REDIS_PORT` | `6380` | Use `6379` only inside Docker network. |
| `S3_ENDPOINT` | `http://localhost:9000` | MinIO API endpoint. |
| `MAIL_HOST` | `localhost` | MailHog SMTP host. |
| `MAIL_PORT` | `1025` | MailHog SMTP port. |
| `AI_PROVIDER` | `mock` or `gemini` | Use `gemini` for real CV extraction, `mock` for offline local development. |
| `GEMINI_API_KEY` | empty | Required when `AI_PROVIDER=gemini`; create one at `https://aistudio.google.com/app/apikey`. |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Gemini model used for CV extraction. |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-2` | Gemini model used for candidate semantic-search embeddings. |

Frontend variables are documented in [frontend/.env.example](frontend/.env.example).

## Useful Commands

Backend:

```bash
cd backend
npm run start:dev
npm run build
npm test
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Frontend:

```bash
cd frontend
pnpm dev
pnpm build
pnpm preview
```

Docker:

```bash
docker compose up -d postgres redis minio mailhog
docker compose up -d --build backend
docker compose logs -f backend
docker compose down
```

## Default Accounts

After seeding:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@hrbot.com` | `password` |
| Recruiter | `recruiter@hrbot.com` | `password` |

## Main URLs

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Backend API | `http://localhost:3000/api` |
| API health | `http://localhost:3000/api/health` |
| MinIO console | `http://localhost:9001` |
| MailHog | `http://localhost:8025` |

## Key API Endpoints

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `GET /api/campaigns`
- `POST /api/campaigns`
- `POST /api/campaigns/:id/application-form`
- `GET /api/application-forms/public/:token`
- `GET /api/candidates`
- `GET /api/candidates/:id`
- `POST /api/candidates/upload`
- `POST /api/candidates/public/upload`
- `PATCH /api/candidates/:id/stage`
- `POST /api/candidates/score`
- `GET /api/candidates/:id/report.pdf`
- `GET /api/search/candidates?q=...`
- `GET /api/interviews`
- `POST /api/interviews`
- `GET /api/interviews/public/:token`
- `POST /api/interviews/public/:token/submit`
- `GET /api/dashboard/summary`

## Troubleshooting

### Prisma authentication fails with `P1000`

Check that the host port matches your runtime:

- Backend on host: `localhost:5433`
- Backend inside Docker: `postgres:5432`

For host development, `backend/.env` should contain:

```env
DATABASE_URL=postgresql://hrbot:hrbot@localhost:5433/hrbot?schema=public
```

### Redis connection fails

Use:

```env
REDIS_HOST=localhost
REDIS_PORT=6380
```

when running backend on the host. Inside Docker, use `REDIS_HOST=redis` and `REDIS_PORT=6379`.

### Public application links do not open

Make sure the campaign is active and not expired. Public application URLs use:

```text
http://localhost:5173/apply/:token
```

### Emails are not visible

Open MailHog:

```text
http://localhost:8025
```

### Semantic search returns keyword-like results

Apply the optional pgvector SQL:

```bash
cd backend
psql "postgresql://hrbot:hrbot@localhost:5433/hrbot?schema=public" -f prisma/sql/pgvector.sql
```

Gemini is used for CV extraction and candidate semantic-search embeddings when `AI_PROVIDER=gemini`. If you run with `AI_PROVIDER=mock`, embeddings are generated by the local mock fallback.

### Gemini CV extraction does not run

Check `backend/.env`:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_google_ai_studio_api_key
GEMINI_MODEL=gemini-3.1-flash-lite
```

Restart the backend after changing `.env`. If the key is missing, invalid, or quota-limited, the CV processing worker will fail the job and BullMQ will retry it according to the queue retry policy.

<!-- ## Documentation

- [Backend README](backend/README.md)
- [Backend database design](docs/backend-database-design.md)
- [Implementation status](docs/implementation-status.md) -->

<!-- ## Current Notes

- CV extraction and candidate embeddings support Gemini through `GEMINI_API_KEY`; screening and question generation still use local mock/heuristic logic.
- Automated tests are intentionally behind feature work at the current project stage.
- Some planned modules such as Talent Pool, full Admin UI, OAuth, and richer realtime UI are still tracked in `docs/implementation-status.md`. -->
