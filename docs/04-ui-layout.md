# 4) Frontend Component Structure

## Pages

1. Dashboard
2. Workout Session
3. Progress
4. Profile (Skill Trees + Trophy Room)
5. Body Metrics
6. Training Plan
7. Exercise Library

## Shared Layout

- `components/layout/AppShell.tsx`
  - top bar, dark/light toggle, responsive navigation
- `components/ui/Card.tsx`
  - reusable glass card container

## Workout Session

- `components/workout/RestTimer.tsx`
  - auto-start countdown support
  - alert tone + vibration support
  - optional socket sync
- `pages/WorkoutSessionPage.tsx`
  - set logging with RPE and completion flag
  - smart overload + rest suggestion panel
  - IndexedDB offline queue + manual sync
  - paginated history compare with load-older actions
  - workout history comparison
  - CSV export action

## Progress

- `pages/ProgressPage.tsx`
  - exercise selector + weeks selector
  - max weight + estimated 1RM line chart
  - volume and weekly frequency bars
  - PR cards

## Profile (Gamification)

- `pages/ProfilePage.tsx`
  - muscle balance radar chart (Recharts)
  - muscle branch cards with level + EXP progress bars
  - Trophy Room with unlock state, silhouette cards, and progress indicators
  - level-up celebratory popup (Framer Motion) fed by unread notifications

## Body Metrics

- `pages/BodyMetricsPage.tsx`
  - metric entry form (weight + optional body-fat + optional muscle-mass + notes)
  - weight/composition trend chart and latest snapshot cards
  - paginated history loading for long-term tracking

## Training Plan

- `pages/TrainingPlanPage.tsx`
  - custom schedule editor
  - drag-drop exercise ordering
  - template apply
  - duplicate/reuse actions

## Exercise Library

- `pages/ExerciseLibraryPage.tsx`
  - browse predefined + custom exercises
  - search by name
  - create custom exercises with muscle-group/type tags

## Mobile-First UX Notes

- compact cards and stacked forms on small screens
- bottom floating nav for thumb reach
- includes Profile tab for quick trophy and level-up checks
- dark mode as primary visual theme with light mode support
- large action buttons for quick set logging
- keyboard shortcuts for desktop speed (`L` = log set)
