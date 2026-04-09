# Personal Workout Tracker

Modern full-stack app for individual workout logging, progression analytics, body metric tracking, and reusable training plans.

## Tech Stack

- Frontend: React + TypeScript + TailwindCSS + Framer Motion + Recharts
- Backend: Node.js + Express + Prisma
- Database: PostgreSQL
- Auth: JWT (HttpOnly cookie transport, Bearer fallback)
- Realtime: Socket.IO (rest timer sync)

## Core Features

- Workout Tracking: sets, reps, weight, rest time, session history by date
- Progress Tracking: bench progression by week, PR per exercise, volume/frequency charts
- Body Metrics: weight, optional body fat %, optional muscle mass, trend charts
- Training Plan: create, edit, duplicate, and reuse weekly schedules (Push/Pull/Legs etc.)
- Rest Timer: built-in countdown per set with optional socket sync
- Offline-First PWA: service worker app-shell cache + IndexedDB workout sync queue

## Quick Start

1. Copy environment variables:
   - Copy `.env.example` values into `apps/api/.env`
   - For IPv4-only networks, use Supabase Session Pooler string from Dashboard > Connect > Session mode
2. Optional (local DB only):
   - `docker compose up -d`
3. Install dependencies:
   - `npm install`
   - Optional for E2E tests: `npm exec --workspace web playwright install chromium`
4. Generate Prisma client and run migrations:
   - `npm run prisma:generate`
   - `npm run prisma:migrate --workspace @gymhelper/api`
5. Start both apps:
   - `npm run dev`

- Web: `http://localhost:5173`
- API: `http://localhost:4000`

## Pages

1. Dashboard
2. Workout Session
3. Progress
4. Body Metrics
5. Training Plan

## Workspace

```txt
apps/web       React app (dashboard, session, progress, metrics, plan)
apps/api       Express API (auth, workout, body-metrics, progress, plan, dashboard)
packages/types Shared DTO and domain types
docs/          Architecture, ERD, API, UI, key code examples
```

## API Surface

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/workouts`
- `GET /api/v1/workouts/history?limit=&offset=&from=&to=`
- `GET /api/v1/workouts/prs`
- `POST /api/v1/body-metrics`
- `GET /api/v1/body-metrics/history?limit=&offset=&from=&to=`
- `GET /api/v1/progress/overview`
- `GET /api/v1/progress/exercise/:exerciseName`
- `GET /api/v1/dashboard/overview`
- `POST /api/v1/plans`
- `PUT /api/v1/plans/:planId`
- `POST /api/v1/plans/:planId/duplicate`

## Step-by-Step Deliverables

1. System architecture: `docs/01-architecture.md`
2. Database schema + ERD: `docs/02-database-erd.md`
3. REST API design: `docs/03-api-design.md`
4. UI layout + component breakdown: `docs/04-ui-layout.md`
5. Key code examples: `docs/05-key-code-examples.md`

## Available Scripts

- Root:
  - `npm run dev`
  - `npm run build`
  - `npm run lint`
- API:
  - `npm run dev --workspace @gymhelper/api`
  - `npm run test --workspace @gymhelper/api`
  - `npm run prisma:migrate --workspace @gymhelper/api`
- Web:
  - `npm run dev --workspace web`
  - `npm run test:e2e --workspace web`

## Debug / Launch

- VS Code task: `Run Gymhelper Dev`
- VS Code launch config: `API: Debug`
- VS Code compound launch: `Fullstack: API Debug + Web`
