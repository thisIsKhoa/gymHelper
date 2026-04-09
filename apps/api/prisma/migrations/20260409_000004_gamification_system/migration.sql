-- CreateEnum
CREATE TYPE "MuscleSkill" AS ENUM
('CHEST', 'BACK', 'LATS', 'LEGS', 'ARMS', 'CORE');

-- CreateEnum
CREATE TYPE "AchievementCode" AS ENUM
(
  'VOLUME_SESSION_1000',
  'LIFETIME_VOLUME_5000000',
  'DAWN_WARRIOR',
  'STREAK_30_DAYS',
  'PR_STREAK_3_IN_3_WEEKS',
  'CLUB_100',
  'OPEN_APP_7_DAYS_NO_WORKOUT',
  'REST_MONSTER'
);

-- CreateEnum
CREATE TYPE "GamificationNotificationType" AS ENUM
('ACHIEVEMENT_UNLOCKED', 'MUSCLE_LEVEL_UP');

-- CreateTable
CREATE TABLE "MuscleSkillProgress"
(
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skill" "MuscleSkill" NOT NULL,
    "totalExp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuscleSkillProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuscleExpLedger"
(
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "skill" "MuscleSkill" NOT NULL,
    "isoWeek" TEXT NOT NULL,
    "baseExp" DOUBLE PRECISION NOT NULL,
    "rpeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "streakMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "awardedExp" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MuscleExpLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement"
(
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" "AchievementCode" NOT NULL,
    "progressValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetValue" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "unlockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamificationNotification"
(
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "GamificationNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "GamificationNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDailyAppOpen"
(
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDailyAppOpen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalRecordEvent"
(
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "bestWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bestVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isoWeek" TEXT NOT NULL,

    CONSTRAINT "PersonalRecordEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MuscleSkillProgress_userId_skill_key" ON "MuscleSkillProgress"("userId", "skill");

-- CreateIndex
CREATE INDEX "MuscleSkillProgress_userId_skill_idx" ON "MuscleSkillProgress"("userId", "skill");

-- CreateIndex
CREATE UNIQUE INDEX "MuscleExpLedger_sessionId_skill_key" ON "MuscleExpLedger"("sessionId", "skill");

-- CreateIndex
CREATE INDEX "MuscleExpLedger_userId_skill_isoWeek_idx" ON "MuscleExpLedger"("userId", "skill", "isoWeek");

-- CreateIndex
CREATE INDEX "MuscleExpLedger_userId_createdAt_idx" ON "MuscleExpLedger"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_code_key" ON "UserAchievement"("userId", "code");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_isUnlocked_idx" ON "UserAchievement"("userId", "isUnlocked");

-- CreateIndex
CREATE INDEX "GamificationNotification_userId_readAt_createdAt_idx" ON "GamificationNotification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserDailyAppOpen_userId_activityDate_key" ON "UserDailyAppOpen"("userId", "activityDate");

-- CreateIndex
CREATE INDEX "UserDailyAppOpen_userId_activityDate_idx" ON "UserDailyAppOpen"("userId", "activityDate");

-- CreateIndex
CREATE INDEX "PersonalRecordEvent_userId_achievedAt_idx" ON "PersonalRecordEvent"("userId", "achievedAt");

-- CreateIndex
CREATE INDEX "PersonalRecordEvent_userId_isoWeek_idx" ON "PersonalRecordEvent"("userId", "isoWeek");

-- AddForeignKey
ALTER TABLE "MuscleSkillProgress" ADD CONSTRAINT "MuscleSkillProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuscleExpLedger" ADD CONSTRAINT "MuscleExpLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuscleExpLedger" ADD CONSTRAINT "MuscleExpLedger_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamificationNotification" ADD CONSTRAINT "GamificationNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDailyAppOpen" ADD CONSTRAINT "UserDailyAppOpen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalRecordEvent" ADD CONSTRAINT "PersonalRecordEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalRecordEvent" ADD CONSTRAINT "PersonalRecordEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
