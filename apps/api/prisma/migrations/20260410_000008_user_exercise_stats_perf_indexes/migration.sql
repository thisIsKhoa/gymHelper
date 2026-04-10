-- Add denormalized per-user exercise stats table for fast dashboard lookups.
CREATE TABLE IF NOT EXISTS "UserExerciseStat"
(
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "firstWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latestWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bestWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstLiftAt" TIMESTAMP(3),
    "latestLiftAt" TIMESTAMP(3),
    "bestLiftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserExerciseStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserExerciseStat_userId_exerciseName_key"
ON "UserExerciseStat"("userId", "exerciseName");

CREATE INDEX IF NOT EXISTS "UserExerciseStat_userId_updatedAt_idx"
ON "UserExerciseStat"("userId", "updatedAt");

CREATE INDEX IF NOT EXISTS "WorkoutEntry_exerciseName_sessionId_idx"
ON "WorkoutEntry"("exerciseName", "sessionId");

CREATE INDEX IF NOT EXISTS "WorkoutEntry_weightKg_idx"
ON "WorkoutEntry"("weightKg");

CREATE INDEX IF NOT EXISTS "WorkoutSession_userId_sessionDate_desc_idx"
ON "WorkoutSession"("userId", "sessionDate" DESC);

ALTER TABLE "UserExerciseStat"
ADD CONSTRAINT "UserExerciseStat_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
