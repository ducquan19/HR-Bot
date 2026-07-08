# HR Bot Backend (NestJS)

NestJS backend for the HR Bot React/Vite app. API responses use the `{ success, data }` wrapper expected by the frontend types.

## Tech Stack

- NestJS REST API + WebSocket Gateway
- PostgreSQL + Prisma ORM + JSONB + pgvector extension
- Redis + BullMQ for asynchronous CV processing
- MinIO/S3-compatible storage for original CV files
- Gemini CV extraction with mock fallback for local development
- Nodemailer/MailHog for password reset and interview invite emails

## Run Local

```bash
cd backend
cp .env.example .env
cd ..
docker compose up -d postgres redis minio mailhog
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run start:dev
```

The API runs at `http://localhost:3000/api`.
The migrations create the pgvector extension and `candidate_embeddings` table used by semantic search.

Seed accounts:

- `admin@hrbot.com` / `password`
- `recruiter@hrbot.com` / `password`

## Gemini API Key For CV Extraction

By default the backend can run with:

```env
AI_PROVIDER=mock
```

To let the CV worker send raw CV text to Gemini and receive real structured JSON extraction, create a free API key in Google AI Studio:

```text
https://aistudio.google.com/app/apikey
```

Then update `backend/.env`:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_google_ai_studio_api_key
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
```

`GEMINI_MODEL` can be omitted if you want to use the code default. If `GEMINI_API_KEY` is set and `AI_PROVIDER` is omitted, the backend automatically uses Gemini. Without a key, it falls back to the mock parser.

For production, the backend requires `AI_PROVIDER=gemini` and `GEMINI_API_KEY`; startup fails if production is configured to use the mock parser.

Restart the backend after changing `.env`.

## Main Endpoints

- `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`
- `GET/POST/PATCH/DELETE /api/campaigns`
- `POST /api/campaigns/:id/application-form`
- `GET /api/candidates`, `POST /api/candidates/upload`, `POST /api/candidates/public/upload`
- `PATCH /api/candidates/:id/stage`, `POST /api/candidates/score`
- `GET/POST /api/interviews`, `POST /api/interviews/:id/send-invite`
- `GET /api/dashboard/summary`
- `GET /api/search/candidates?q=...`

## Deployment Notes

`parseCv` and candidate embeddings support Gemini through `GEMINI_API_KEY`. `screenCandidate` and `generateInterviewQuestions` still use local/mock logic so the project can run without extra API keys.
