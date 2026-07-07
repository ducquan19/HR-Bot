# HR Bot Backend (NestJS)

Backend này được thiết kế theo kiến trúc module hóa cho frontend React/Vite hiện tại của repo. API trả về wrapper `{ success, data }` và shape dữ liệu tương thích với `src/types/index.ts` của frontend.

## Tech stack

- NestJS REST API + WebSocket Gateway
- PostgreSQL + Prisma ORM + JSONB + pgvector extension
- Redis + BullMQ cho xử lý CV bất đồng bộ
- MinIO/S3 cho lưu file CV gốc
- Mock AI provider có thể thay bằng OpenAI/Gemini
- Nodemailer/MailHog cho email reset password và interview invite

## Chạy local

```bash
cd backend
cp .env.example .env
cd ..
docker compose up -d postgres redis minio mailhog
cd backend
npm install
npx prisma generate
npx prisma migrate dev
psql "$DATABASE_URL" -f prisma/sql/pgvector.sql  # optional, for semantic search
npm run prisma:seed
npm run start:dev
```

API chạy tại `http://localhost:3000/api`.

Tài khoản seed:

- `admin@hrbot.com` / `password`
- `recruiter@hrbot.com` / `password`

## Các endpoint chính

- `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`
- `GET/POST/PATCH/DELETE /api/campaigns`
- `POST /api/campaigns/:id/application-form`
- `GET /api/candidates`, `POST /api/candidates/upload`, `POST /api/candidates/public/upload`
- `PATCH /api/candidates/:id/stage`, `POST /api/candidates/score`
- `GET/POST /api/interviews`, `POST /api/interviews/:id/send-invite`
- `GET /api/dashboard/summary`
- `GET /api/search/candidates?q=...`

## Lưu ý triển khai

AI provider hiện tại là mock để project chạy được không cần API key. Khi triển khai thật, thay logic trong `src/ai/ai.service.ts` bằng OpenAI/Gemini và giữ nguyên interface `parseCv`, `screenCandidate`, `generateInterviewQuestions`, `embed`.
