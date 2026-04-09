# 3) REST API Design

Base URL: `/api/v1`

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

## Workout Tracking

- `POST /workouts`
  - Log exercises with sets/reps/weight/rpe/rest/completion
  - Accepts optional `timezoneOffsetMinutes` to resolve local-day boundaries correctly
  - Updates PR table automatically
  - Pushes a durable Redis/BullMQ job for gamification (muscle EXP, level checks, achievements) without delaying response
- `GET /workouts/history?from&to&limit&cursor`
  - Cursor pagination (`nextCursor`) for large session history scroll
  - Returns lightweight session rows with `id`, `sessionDate`, `startedAt`, `endedAt`, `totalVolume`
  - Includes only first 3 entry previews (`exerciseName`, `sets`, `reps`, `weightKg`) to keep payload small
- `GET /workouts/history/:sessionId`
- `GET /workouts/compare?currentSessionId=&previousSessionId=`
- `GET /workouts/suggestion?exerciseName=Bench%20Press`
  - Progressive overload suggestion (+2.5kg when last session was completed)
  - Rest suggestion by exercise type (compound vs isolation)
- `GET /workouts/analytics`
  - Weekly sessions/volume, strongest lift this week, training streak
- `GET /workouts/export/csv`
- `GET /workouts/prs`

## Progress Tracking

- `GET /progress/exercise/:exerciseName?weeks=12`
  - Weekly points: avg weight, max weight, total volume, estimated 1RM

## Exercise Library

- `GET /exercises?search=`
  - Returns predefined + custom exercises
- `POST /exercises`
  - Create custom exercise with muscle group and exercise type

## Body Metrics

- `POST /body-metrics`
- `GET /body-metrics/history?from&to&limit&offset`
- `GET /body-metrics/latest`

## Training Plan

- `POST /plans`
- `GET /plans`
- `PUT /plans/:planId`
- `POST /plans/:planId/duplicate`

## Dashboard

- `GET /dashboard/overview`
  - Daily volume trend
  - Weekly pre-aggregated summary
  - PR highlights
  - Muscle skill radar snapshot (`skill`, `level`, `totalExp`)
  - Strength increase
  - This-week metrics (sessions, strongest lift, streak)
  - Latest body metric

## Gamification

- `GET /gamification/profile`
  - Muscle skill trees with level/EXP/progress
  - Radar-ready muscle balance points
  - Trophy room achievements with unlock state and progress bars
- `POST /gamification/notifications/consume`
  - Returns unread level-up + achievement notifications and marks them as read
- `POST /gamification/activity/ping`
  - Records daily app-open activity for hidden achievement tracking

## Cache (Admin Only)

- `POST /cache/item`
- `PUT /cache/item`
- Protected by auth + `ADMIN_EMAILS` allowlist

## Timer (Optional Realtime)

- Socket events in API server:
  - `timer:start`
  - `timer:tick`
  - `timer:done`
  - `timer:stop`

## Gamification Realtime Events

- Socket events emitted to authenticated user room:
  - `achievement:unlocked`
  - `muscle:levelup`

## Response Design Principles

- Chart-first payloads (avoid heavy frontend reshaping)
- User-isolated datasets (all protected routes require a valid JWT via
  HttpOnly cookie or Bearer token)
- Time-series endpoints return ordered points for direct rendering
