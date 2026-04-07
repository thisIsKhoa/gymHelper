import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { CreateWorkoutInput } from './workout.schemas.js';

function calculateVolume(sets: number, reps: number, weightKg?: number): number {
  if (!weightKg) {
    return 0;
  }
  return Number((sets * reps * weightKg).toFixed(2));
}

async function upsertPersonalRecord(
  tx: Prisma.TransactionClient,
  userId: string,
  exerciseName: string,
  weightKg: number,
  volume: number,
  achievedAt: Date,
): Promise<void> {
  const current = await tx.personalRecord.findUnique({
    where: {
      userId_exerciseName: {
        userId,
        exerciseName,
      },
    },
  });

  if (!current) {
    await tx.personalRecord.create({
      data: {
        userId,
        exerciseName,
        bestWeightKg: weightKg,
        bestVolume: volume,
        achievedAt,
      },
    });
    return;
  }

  const bestWeightKg = Math.max(current.bestWeightKg, weightKg);
  const bestVolume = Math.max(current.bestVolume, volume);

  if (bestWeightKg !== current.bestWeightKg || bestVolume !== current.bestVolume) {
    await tx.personalRecord.update({
      where: { id: current.id },
      data: {
        bestWeightKg,
        bestVolume,
        achievedAt,
      },
    });
  }
}

export async function createWorkoutSession(userId: string, input: CreateWorkoutInput) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.workoutSession.create({
      data: {
        userId,
        sessionDate: input.sessionDate,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        notes: input.notes,
      },
    });

    let totalVolume = 0;
    for (const entry of input.entries) {
      const volume = calculateVolume(entry.sets, entry.reps, entry.weightKg);
      totalVolume += volume;

      await tx.workoutEntry.create({
        data: {
          sessionId: session.id,
          exerciseName: entry.exerciseName,
          sets: entry.sets,
          reps: entry.reps,
          weightKg: entry.weightKg,
          durationSec: entry.durationSec,
          restSeconds: entry.restSeconds,
          volume,
        },
      });

      await upsertPersonalRecord(
        tx,
        userId,
        entry.exerciseName,
        entry.weightKg ?? 0,
        volume,
        input.endedAt ?? new Date(),
      );
    }

    return tx.workoutSession.update({
      where: { id: session.id },
      data: {
        totalVolume,
      },
      include: {
        entries: true,
      },
    });
  });
}

export async function getWorkoutHistory(userId: string, from?: Date, to?: Date) {
  return prisma.workoutSession.findMany({
    where: {
      userId,
      sessionDate: {
        gte: from,
        lte: to,
      },
    },
    include: {
      entries: true,
    },
    orderBy: {
      sessionDate: 'desc',
    },
  });
}

export async function getPersonalRecords(userId: string) {
  return prisma.personalRecord.findMany({
    where: { userId },
    orderBy: [{ bestWeightKg: 'desc' }, { bestVolume: 'desc' }],
  });
}
