-- Improve PR history lookups by user + exercise timeline.
CREATE INDEX
IF NOT EXISTS "PersonalRecordEvent_userId_exerciseName_achievedAt_idx"
ON "PersonalRecordEvent"
("userId", "exerciseName", "achievedAt");
