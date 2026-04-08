# 3) REST API Design

Base URL: `/api/v1`

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

## Workout Tracking

- `POST /workouts`
  - Log exercises with sets/reps/weight/rpe/rest/completion
  - Updates PR table automatically
- `GET /workouts/history?from&to`
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
- `GET /body-metrics/history?from&to`
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
  - Strength increase
  - This-week metrics (sessions, strongest lift, streak)
  - Latest body metric

## Timer (Optional Realtime)

- Socket events in API server:
  - `timer:start`
  - `timer:tick`
  - `timer:done`
  - `timer:stop`

## Response Design Principles

- Chart-first payloads (avoid heavy frontend reshaping)
- User-isolated datasets (all protected routes require JWT)
- Time-series endpoints return ordered points for direct rendering
