-- CreateTable
CREATE TABLE "UserGamificationStat"
(
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalVolumeLifted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxSessionVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGamificationStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamificationJobRun"
(
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamificationJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserGamificationStat_userId_key" ON "UserGamificationStat"("userId");

-- CreateIndex
CREATE INDEX "UserGamificationStat_userId_idx" ON "UserGamificationStat"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GamificationJobRun_jobKey_key" ON "GamificationJobRun"("jobKey");

-- CreateIndex
CREATE INDEX "GamificationJobRun_userId_createdAt_idx" ON "GamificationJobRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GamificationJobRun_sessionId_createdAt_idx" ON "GamificationJobRun"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserGamificationStat" ADD CONSTRAINT "UserGamificationStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamificationJobRun" ADD CONSTRAINT "GamificationJobRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamificationJobRun" ADD CONSTRAINT "GamificationJobRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
