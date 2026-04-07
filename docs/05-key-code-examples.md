# 5) Key Code Examples

## Logging Workout Session
- API: `apps/api/src/modules/workout/workout.service.ts`
- UI: `apps/web/src/pages/WorkoutSessionPage.tsx`

Highlights:
- stores session and entries in one transaction
- computes volume per entry (`sets * reps * weight`)
- updates PR row if new best weight or best volume is reached

## PR Tracking Logic
- `apps/api/src/modules/workout/workout.service.ts`
- helper path: `upsertPersonalRecord(...)`

Highlights:
- single source for PR updates during every workout save
- prevents stale PR data by max comparison

## Chart Rendering (Bench Progress)
- API aggregation: `apps/api/src/modules/progress/progress.service.ts`
- UI chart: `apps/web/src/pages/ProgressPage.tsx`

Highlights:
- groups exercise points by ISO week
- returns chart-ready points: `week`, `avgWeightKg`, `maxWeightKg`, `totalVolume`

## Body Metrics Tracking
- API: `apps/api/src/modules/body-metrics/body-metrics.service.ts`
- UI: `apps/web/src/pages/BodyMetricsPage.tsx`

Highlights:
- weight/body-fat/muscle-mass entries by date
- supports optional body composition fields
- trend lines for long-term progress

## Rest Timer Logic
- API timer channel: `apps/api/src/index.ts`
- frontend timer: `apps/web/src/components/workout/RestTimer.tsx`

Highlights:
- local countdown fallback
- optional WebSocket tick events for real-time sync
