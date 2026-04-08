-- CreateIndex
CREATE INDEX "PersonalRecord_userId_bestWeightKg_bestVolume_idx" ON "PersonalRecord"("userId", "bestWeightKg", "bestVolume");

-- CreateIndex
CREATE INDEX "WorkoutEntry_sessionId_createdAt_idx" ON "WorkoutEntry"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkoutEntry_exerciseName_createdAt_idx" ON "WorkoutEntry"("exerciseName", "createdAt");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_sessionDate_createdAt_idx" ON "WorkoutSession"("userId", "sessionDate", "createdAt");
