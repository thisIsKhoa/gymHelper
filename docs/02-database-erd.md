# 2) Database Schema (ERD)

```mermaid
erDiagram
    User ||--o{ WorkoutSession : has
    WorkoutSession ||--o{ WorkoutEntry : contains
    User ||--o{ PersonalRecord : tracks
    User ||--o{ BodyMetric : logs
    User ||--o{ TrainingPlan : owns
    TrainingPlan ||--o{ TrainingPlanDay : schedules
  User ||--o{ WeeklyWorkoutStat : aggregates
  User ||--o{ CustomExercise : customizes

    User {
      string id PK
      string email UK
      string passwordHash
      string name
      enum level
      enum goal
      datetime createdAt
      datetime updatedAt
    }

    WorkoutSession {
      string id PK
      string userId FK
      date sessionDate
      datetime startedAt
      datetime endedAt
      float totalVolume
      string notes
    }

    WorkoutEntry {
      string id PK
      string sessionId FK
      string exerciseName
      int sets
      int reps
      float weightKg
      float rpe
      bool isCompleted
      int restSeconds
      float volume
      float estimated1Rm
    }

    PersonalRecord {
      string id PK
      string userId FK
      string exerciseName
      float bestWeightKg
      float bestVolume
      datetime achievedAt
    }

    BodyMetric {
      string id PK
      string userId FK
      date loggedAt
      float weightKg
      float bodyFatPct
      float muscleMassKg
    }

    TrainingPlan {
      string id PK
      string userId FK
      string name
      enum goal
      enum level
      bool isTemplate
    }

    TrainingPlanDay {
      string id PK
      string planId FK
      int dayOfWeek
      string focus
      json exercises
    }

    WeeklyWorkoutStat {
      string id PK
      string userId FK
      string isoWeek
      float totalVolume
      int sessionsCount
      float strongestLiftKg
    }

    CustomExercise {
      string id PK
      string userId FK
      string name
      enum muscleGroup
      enum exerciseType
      int defaultRestSeconds
    }
```

Schema source of truth: `apps/api/prisma/schema.prisma`.

## Notes

- PR detection uses `PersonalRecord` (`bestWeightKg`, `bestVolume`).
- Estimated 1RM uses Epley formula per workout entry.
- `WeeklyWorkoutStat` is pre-aggregated for fast dashboard/progress charts.
