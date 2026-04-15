-- Add optional description for training plans.
ALTER TABLE "TrainingPlan"
ADD COLUMN
IF NOT EXISTS "description" TEXT;

-- Enforce one session per user per date.
CREATE UNIQUE INDEX
IF NOT EXISTS "WorkoutSession_userId_sessionDate_key"
ON "WorkoutSession"
("userId", "sessionDate");

-- Add request-level idempotency log for workout write retries.
CREATE TABLE
IF NOT EXISTS "WorkoutRequestLog"
(
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP
(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutRequestLog_pkey" PRIMARY KEY
("id")
);

CREATE UNIQUE INDEX
IF NOT EXISTS "WorkoutRequestLog_userId_idempotencyKey_key"
ON "WorkoutRequestLog"
("userId", "idempotencyKey");

CREATE INDEX
IF NOT EXISTS "WorkoutRequestLog_userId_createdAt_idx"
ON "WorkoutRequestLog"
("userId", "createdAt");

CREATE INDEX
IF NOT EXISTS "WorkoutRequestLog_sessionId_createdAt_idx"
ON "WorkoutRequestLog"
("sessionId", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WorkoutRequestLog_userId_fkey'
  ) THEN
    ALTER TABLE "WorkoutRequestLog"
      ADD CONSTRAINT "WorkoutRequestLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END
IF;

  IF NOT EXISTS (
    SELECT 1
FROM pg_constraint
WHERE conname = 'WorkoutRequestLog_sessionId_fkey'
  ) THEN
ALTER TABLE "WorkoutRequestLog"
      ADD CONSTRAINT "WorkoutRequestLog_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END
IF;
END $$;
