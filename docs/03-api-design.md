# 3) REST API Design

Base URL: `/api/v1`

## Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

## Workout Tracking
- `POST /workouts`
  - Log exercises with sets/reps/weight/rest
  - Updates PR table automatically
- `GET /workouts/history?from&to`
- `GET /workouts/prs`

## Progress Tracking
- `GET /progress/overview`
  - Bench progression by week
  - PR summary list
- `GET /progress/exercise/:exerciseName?weeks=12`
  - Weekly points: avg weight, max weight, total volume

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
  - Volume trend
  - Frequency trend
  - Strength increase
  - Bench weekly max trend
  - Latest body metric

## Timer (Optional Realtime)
- Socket events in API server:
  - `timer:start`
  - `timer:tick`
  - `timer:done`
  - `timer:stop`
