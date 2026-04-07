# 4) Frontend Component Structure

## Pages
1. Dashboard
2. Workout Session
3. Progress
4. Body Metrics
5. Training Plan

## Shared Layout
- `components/layout/AppShell.tsx`
  - top bar, dark/light toggle, responsive navigation
- `components/ui/Card.tsx`
  - reusable glass card container

## Workout Session
- `components/workout/ExerciseLogger.tsx`
  - set-by-set logging inputs
- `components/workout/RestTimer.tsx`
  - countdown logic with optional socket sync

## Progress
- `pages/ProgressPage.tsx`
  - Bench line chart
  - Volume and frequency bars
  - PR cards

## Body Metrics
- `pages/BodyMetricsPage.tsx`
  - metric entry form
  - weight/composition line charts

## Training Plan
- `pages/TrainingPlanPage.tsx`
  - custom schedule editor
  - template apply
  - duplicate/reuse actions

## Mobile-First UX Notes
- compact cards and stacked forms on small screens
- bottom floating nav for thumb reach
- dark mode as primary visual theme with light mode support
