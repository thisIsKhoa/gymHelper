-- CreateSchema
CREATE SCHEMA
IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."ExerciseType" AS ENUM
('COMPOUND', 'ISOLATION');

-- CreateEnum
CREATE TYPE "public"."MuscleGroup" AS ENUM
('CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS', 'CORE', 'GLUTES', 'FULL_BODY');

-- CreateEnum
CREATE TYPE "public"."UserGoal" AS ENUM
('MUSCLE_GAIN', 'FAT_LOSS', 'STRENGTH');

-- CreateEnum
CREATE TYPE "public"."UserLevel" AS ENUM
('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateTable
CREATE TABLE "public"."BodyMetric"
(
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loggedAt" DATE NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "bodyFatPct" DOUBLE PRECISION,
    "muscleMassKg" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomExercise"
(
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "muscleGroup" "public"."MuscleGroup" NOT NULL,
    "exerciseType" "public"."ExerciseType" NOT NULL,
    "defaultRestSeconds" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PersonalRecord"
(
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "bestWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bestVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrainingPlan"
(
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" "public"."UserGoal" NOT NULL,
    "level" "public"."UserLevel" NOT NULL,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrainingPlanDay"
(
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "focus" TEXT NOT NULL,
    "exercises" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User"
(
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "public"."UserLevel" NOT NULL DEFAULT 'BEGINNER',
    "goal" "public"."UserGoal" NOT NULL DEFAULT 'MUSCLE_GAIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WeeklyWorkoutStat"
(
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isoWeek" TEXT NOT NULL,
    "totalVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sessionsCount" INTEGER NOT NULL DEFAULT 0,
    "strongestLiftKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyWorkoutStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkoutEntry"
(
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "durationSec" INTEGER,
    "restSeconds" INTEGER,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estimated1Rm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT true,
    "rpe" DOUBLE PRECISION,

    CONSTRAINT "WorkoutEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkoutSession"
(
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionDate" DATE NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "notes" TEXT,
    "totalVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BodyMetric_userId_loggedAt_idx" ON "public"."BodyMetric"("userId" ASC, "loggedAt" ASC);

-- CreateIndex
CREATE INDEX "CustomExercise_userId_muscleGroup_idx" ON "public"."CustomExercise"("userId" ASC, "muscleGroup" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CustomExercise_userId_name_key" ON "public"."CustomExercise"("userId" ASC, "name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PersonalRecord_userId_exerciseName_key" ON "public"."PersonalRecord"("userId" ASC, "exerciseName" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingPlanDay_planId_dayOfWeek_key" ON "public"."TrainingPlanDay"("planId" ASC, "dayOfWeek" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE INDEX "WeeklyWorkoutStat_userId_isoWeek_idx" ON "public"."WeeklyWorkoutStat"("userId" ASC, "isoWeek" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyWorkoutStat_userId_isoWeek_key" ON "public"."WeeklyWorkoutStat"("userId" ASC, "isoWeek" ASC);

-- CreateIndex
CREATE INDEX "WorkoutEntry_sessionId_exerciseName_idx" ON "public"."WorkoutEntry"("sessionId" ASC, "exerciseName" ASC);

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_sessionDate_idx" ON "public"."WorkoutSession"("userId" ASC, "sessionDate" ASC);

-- AddForeignKey
ALTER TABLE "public"."BodyMetric" ADD CONSTRAINT "BodyMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomExercise" ADD CONSTRAINT "CustomExercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PersonalRecord" ADD CONSTRAINT "PersonalRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingPlan" ADD CONSTRAINT "TrainingPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingPlanDay" ADD CONSTRAINT "TrainingPlanDay_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeeklyWorkoutStat" ADD CONSTRAINT "WeeklyWorkoutStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutEntry" ADD CONSTRAINT "WorkoutEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
