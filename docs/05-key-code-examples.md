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

## Muscle Skill Tree Pipeline (Async)

- API module: `apps/api/src/modules/gamification/gamification.service.ts`
- Workout hook: `apps/api/src/modules/workout/workout.service.ts`
- Queue layer: `apps/api/src/modules/gamification/gamification.queue.ts`
- Worker runtime: `apps/api/src/modules/gamification/gamification.worker.ts`

Highlights:

- EXP based on volume (weight x sets x reps), with fallback for bodyweight sets
- RPE multiplier boosts high-effort sets
- second session of the same muscle in a week gets combo bonus
- `POST /workouts` enqueues durable Redis job (BullMQ) and returns immediately
- worker retries failed jobs automatically and continues after process restart
- idempotency table (`GamificationJobRun`) prevents double-processing on retries

## Running Totals (O(1) Checks)

- Prisma model: `UserGamificationStat`
- Updated in: `apps/api/src/modules/gamification/gamification.service.ts`

Highlights:

- lifetime volume milestone reads from precomputed total instead of SUM over all sessions
- max session volume and max lifted weight are updated incrementally per job
- achievement checks for long-horizon milestones become O(1)

## Trophy Room + Level-Up Notifications

- API endpoints: `apps/api/src/modules/gamification/*.ts`
- UI: `apps/web/src/pages/ProfilePage.tsx`
- Session toast integration: `apps/web/src/pages/WorkoutSessionPage.tsx`

Highlights:

- achievement progress is event-driven and persisted per user
- unread notifications are consumed from API and marked read
- unlocked achievements trigger success toasts
- muscle level-ups trigger a Framer Motion popup in Profile
- worker publishes Redis Pub/Sub events and API relays them to Socket.IO user rooms
