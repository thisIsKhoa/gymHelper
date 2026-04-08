# 5) Key Code Examples

## Logging Workout Session

- API: `apps/api/src/modules/workout/workout.service.ts`
- UI: `apps/web/src/pages/WorkoutSessionPage.tsx`

Highlights:

- stores session and entries in one transaction
- computes volume per entry (`sets * reps * weight`)
- stores optional `rpe` + completion status
- updates PR row if new best weight or best volume is reached
- updates weekly pre-aggregated stats (`WeeklyWorkoutStat`)

## PR Tracking Logic

- `apps/api/src/modules/workout/workout.service.ts`
- helper path: `upsertPersonalRecord(...)`

Highlights:

- single source for PR updates during every workout save
- prevents stale PR data by max comparison

## 1RM Calculation (Epley)

- API: `apps/api/src/modules/workout/workout.service.ts`
- UI helper: `apps/web/src/lib/workout-utils.ts`

Formula:

- `1RM = weight * (1 + reps / 30)`

Usage:

- stored as `estimated1Rm` on each workout entry
- used for progression chart overlays

## Chart Rendering (Progress)

- API aggregation: `apps/api/src/modules/progress/progress.service.ts`
- UI chart: `apps/web/src/pages/ProgressPage.tsx`

Highlights:

- groups exercise points by ISO week
- returns chart-ready points: `week`, `avgWeightKg`, `maxWeightKg`, `totalVolume`, `maxEstimated1Rm`

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
- auto-start support from workout logging screen
- sound + vibration alert when timer ends

## Progressive Overload Suggestion

- API: `apps/api/src/modules/workout/workout.service.ts` (`getWorkoutSuggestion`)
- UI: `apps/web/src/pages/WorkoutSessionPage.tsx`

Highlights:

- if last session entry was completed, suggested next weight is `lastWeight + 2.5kg`
- if not completed, keep same load
- rest suggestion defaults by exercise type:
  - compound: ~150 seconds
  - isolation: ~90 seconds
