-- Speed up recent PR lookups used by dashboard highlights.
CREATE INDEX
IF NOT EXISTS "PersonalRecord_userId_updatedAt_idx"
ON "PersonalRecord"
("userId", "updatedAt");
