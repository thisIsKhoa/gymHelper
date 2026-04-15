# GymHelper

GymHelper is a full-stack monorepo for personal workout tracking, progression analytics, body metrics, reusable plans, and gamification.

## Highlights

- Workout logging with sets, reps, weight, rest timer, and history
- Progress analytics (weekly trends, PR tracking, estimated strength indicators)
- Body metrics tracking with trend-ready data
- Training plans (create, update, duplicate, session templates)
- Exercise library (built-in + custom)
- Gamification (skill trees, achievements, realtime level-up notifications)
- Offline-first web app with queued workout sync

## Tech Stack

- Frontend: React 19 + TypeScript + Vite + Tailwind CSS + Framer Motion + Recharts + React Query + Zustand
- Backend: Node.js + Express + Prisma + Zod
- Database: PostgreSQL
- Queue: BullMQ + Redis
- Realtime: Socket.IO
- Testing: Vitest (API), Playwright (Web E2E)

## Monorepo Structure

```txt
apps/
   api/           Express API, Prisma schema/migrations, gamification worker
   web/           React web app (PWA, offline queue, dashboard/session pages)
packages/
   types/         Shared DTO/domain types
docs/            Architecture, ERD, API design, UI layout, code examples
```

## Prerequisites

- Node.js 20+
- npm 10+
- Optional for local infrastructure: Docker Desktop

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Create API environment file

PowerShell:

```powershell
Copy-Item .env.example apps/api/.env
```

macOS/Linux:

```bash
cp .env.example apps/api/.env
```

3. Choose database and cache strategy

- Option A (local): use Docker Postgres + Redis

```bash
docker compose up -d
```

Then set in `apps/api/.env`:

```env
DATABASE_URL=postgresql://gymhelper:gymhelper@localhost:5432/gymhelper?schema=public
REDIS_URL=redis://localhost:6379
```

- Option B (remote DB): use Supabase Session Pooler URL in `DATABASE_URL`

4. Generate Prisma client and apply migrations

```bash
npm run prisma:generate
npm run prisma:migrate --workspace @gymhelper/api
```

5. Start web + API

```bash
npm run dev
```

6. Start gamification worker (recommended when `REDIS_URL` is set)

```bash
npm run dev:worker --workspace @gymhelper/api
```

Local URLs:

- Web: http://localhost:5173
- API: http://localhost:4000
- Health check: http://localhost:4000/health

## Environment Variables (API)

Defined in `apps/api/src/config/env.ts`.

| Variable                 | Required | Description                              |
| ------------------------ | -------- | ---------------------------------------- |
| `PORT`                   | No       | API port (default: `4000`)               |
| `NODE_ENV`               | No       | `development`, `test`, or `production`   |
| `RATE_LIMIT_WINDOW_MS`   | No       | Rate-limit window in milliseconds        |
| `AUTH_RATE_LIMIT_MAX`    | No       | Max auth requests per window             |
| `WORKOUT_RATE_LIMIT_MAX` | No       | Max workout requests per window          |
| `HTTP_SLOW_REQUEST_MS`   | No       | Slow-request warning threshold in ms     |
| `DATABASE_URL`           | Yes      | PostgreSQL connection string             |
| `REDIS_URL`              | Optional | Enables BullMQ queue + worker            |
| `REDIS_KEY_PREFIX`       | No       | Redis key namespace prefix               |
| `JWT_SECRET`             | Yes      | JWT signing key (min 16 chars)           |
| `JWT_EXPIRES_IN`         | No       | JWT expiration (default `7d`)            |
| `CORS_ORIGIN`            | Yes      | Allowed web origin                       |
| `AUTH_COOKIE_SAME_SITE`  | Optional | Set `none` for cross-site cookies        |
| `AUTH_COOKIE_SECURE`     | Optional | Set `true` with HTTPS/cross-site cookies |
| `ADMIN_EMAILS`           | Optional | Comma-separated admin account list       |

## Scripts

Root (`package.json`):

- `npm run dev` - run API and web together
- `npm run dev:api` - run API only
- `npm run dev:web` - run web only
- `npm run dev:worker` - run gamification worker
- `npm run build` - build all workspaces
- `npm run lint` - lint all workspaces
- `npm run prisma:generate` - generate Prisma client for API

API workspace (`apps/api`):

- `npm run dev --workspace @gymhelper/api`
- `npm run dev:worker --workspace @gymhelper/api`
- `npm run worker:gamification --workspace @gymhelper/api`
- `npm run test --workspace @gymhelper/api`
- `npm run prisma:migrate --workspace @gymhelper/api`
- `npm run prisma:studio --workspace @gymhelper/api`

Web workspace (`apps/web`):

- `npm run dev --workspace apps/web`
- `npm run build --workspace apps/web`
- `npm run lint --workspace apps/web`
- `npm run test:e2e --workspace apps/web`

Install Playwright browser (optional):

```bash
npm exec --workspace apps/web playwright install chromium
```

## API Modules and Key Endpoints

All API routes are prefixed with `/api/v1`.

- Auth: `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`
- Workouts: `/workouts`, `/workouts/history`, `/workouts/history/:sessionId`, `/workouts/compare`, `/workouts/suggestion`, `/workouts/analytics`, `/workouts/export/csv`, `/workouts/prs`
- Exercise Library: `/exercises` (GET, POST)
- Body Metrics: `/body-metrics`, `/body-metrics/history`, `/body-metrics/latest`
- Plans: `/plans`, `/plans/session-template`, `/plans/:planId`, `/plans/:planId/duplicate`
- Progress: `/progress/overview`, `/progress/exercise/:exerciseName`
- `GET /progress/overview` returns bench trend, personal records, and workout analytics.
- Dashboard: `/dashboard/overview` (`?weeks=4..52`, default `16`)
- Gamification: `/gamification/profile`, `/gamification/notifications/consume`, `/gamification/activity/ping`

## Realtime Events

- Client emit: `timer:start`, `timer:stop` (socket auth is handshake-based)
- Server emit: `timer:tick`, `timer:done`, `timer:stopped`, `achievement:unlocked`, `muscle:levelup`

## Testing

- API unit/integration tests:

```bash
npm run test --workspace @gymhelper/api
```

- Web E2E tests:

```bash
npm run test:e2e --workspace apps/web
```

## Documentation

- Architecture: `docs/01-architecture.md`
- Database + ERD: `docs/02-database-erd.md`
- API design: `docs/03-api-design.md`
- UI layout: `docs/04-ui-layout.md`
- Key code examples: `docs/05-key-code-examples.md`

## Troubleshooting

- `prisma migrate` cannot find `DATABASE_URL`:
  - Run migration commands in API workspace (`--workspace @gymhelper/api`) so the correct env file is loaded.
- Supabase connection fails with pooler user/tenant errors:
  - Copy the full Session Pooler URL from Supabase dashboard, do not manually compose segments.
- Login works locally but fails in cross-domain production:
  - Set `AUTH_COOKIE_SAME_SITE=none` and `AUTH_COOKIE_SECURE=true`.
- Gamification worker does not process jobs:
  - Ensure `REDIS_URL` is configured and reachable.

## VS Code Run/Debug

- Task: `Run Gymhelper Dev`
- Task: `Run Web Dev`
