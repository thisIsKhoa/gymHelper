import { ExerciseType, MuscleGroup } from '@prisma/client';

import { prisma } from '../../db/prisma.js';
import type { CreateCustomExerciseInput } from './exercise-library.schemas.js';

export interface ExerciseLibraryItem {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  exerciseType: ExerciseType;
  defaultRestSeconds: number;
  source: 'system' | 'custom';
}

function systemExercise(
  id: string,
  name: string,
  muscleGroup: MuscleGroup,
  exerciseType: ExerciseType,
  defaultRestSeconds: number,
): ExerciseLibraryItem {
  return {
    id,
    name,
    muscleGroup,
    exerciseType,
    defaultRestSeconds,
    source: 'system',
  };
}

const predefinedExercises: ExerciseLibraryItem[] = [
  // Chest
  systemExercise('sys-bench-press', 'Bench Press', MuscleGroup.CHEST, ExerciseType.COMPOUND, 150),
  systemExercise('sys-incline-bench', 'Incline Bench', MuscleGroup.CHEST, ExerciseType.COMPOUND, 150),
  systemExercise('sys-incline-bench-press', 'Incline Bench Press', MuscleGroup.CHEST, ExerciseType.COMPOUND, 150),
  systemExercise('sys-decline-bench-press', 'Decline Bench Press', MuscleGroup.CHEST, ExerciseType.COMPOUND, 150),
  systemExercise('sys-dumbbell-bench-press', 'Dumbbell Bench Press', MuscleGroup.CHEST, ExerciseType.COMPOUND, 120),
  systemExercise('sys-incline-db-press', 'Incline DB Press', MuscleGroup.CHEST, ExerciseType.COMPOUND, 120),
  systemExercise('sys-close-grip-bench-press', 'Close Grip Bench Press', MuscleGroup.CHEST, ExerciseType.COMPOUND, 135),
  systemExercise('sys-weighted-dip', 'Weighted Dip', MuscleGroup.CHEST, ExerciseType.COMPOUND, 120),
  systemExercise('sys-push-up', 'Push Up', MuscleGroup.CHEST, ExerciseType.COMPOUND, 90),
  systemExercise('sys-cable-chest-fly', 'Cable Chest Fly', MuscleGroup.CHEST, ExerciseType.ISOLATION, 75),
  systemExercise('sys-pec-deck-fly', 'Pec Deck Fly', MuscleGroup.CHEST, ExerciseType.ISOLATION, 75),

  // Back
  systemExercise('sys-deadlift', 'Deadlift', MuscleGroup.BACK, ExerciseType.COMPOUND, 180),
  systemExercise('sys-sumo-deadlift', 'Sumo Deadlift', MuscleGroup.BACK, ExerciseType.COMPOUND, 180),
  systemExercise('sys-barbell-row', 'Barbell Row', MuscleGroup.BACK, ExerciseType.COMPOUND, 150),
  systemExercise('sys-pendlay-row', 'Pendlay Row', MuscleGroup.BACK, ExerciseType.COMPOUND, 150),
  systemExercise('sys-t-bar-row', 'T-Bar Row', MuscleGroup.BACK, ExerciseType.COMPOUND, 135),
  systemExercise('sys-seated-cable-row', 'Seated Cable Row', MuscleGroup.BACK, ExerciseType.COMPOUND, 120),
  systemExercise('sys-row', 'Row', MuscleGroup.BACK, ExerciseType.COMPOUND, 120),
  systemExercise('sys-single-arm-db-row', 'Single Arm Dumbbell Row', MuscleGroup.BACK, ExerciseType.COMPOUND, 120),
  systemExercise('sys-pull-up', 'Pull Up', MuscleGroup.BACK, ExerciseType.COMPOUND, 120),
  systemExercise('sys-chin-up', 'Chin Up', MuscleGroup.BACK, ExerciseType.COMPOUND, 120),
  systemExercise('sys-lat-pulldown', 'Lat Pulldown', MuscleGroup.BACK, ExerciseType.ISOLATION, 90),
  systemExercise('sys-pulldown', 'Pulldown', MuscleGroup.BACK, ExerciseType.ISOLATION, 90),
  systemExercise('sys-straight-arm-pulldown', 'Straight Arm Pulldown', MuscleGroup.BACK, ExerciseType.ISOLATION, 75),

  // Legs
  systemExercise('sys-back-squat', 'Back Squat', MuscleGroup.LEGS, ExerciseType.COMPOUND, 180),
  systemExercise('sys-front-squat', 'Front Squat', MuscleGroup.LEGS, ExerciseType.COMPOUND, 180),
  systemExercise('sys-hack-squat', 'Hack Squat', MuscleGroup.LEGS, ExerciseType.COMPOUND, 150),
  systemExercise('sys-goblet-squat', 'Goblet Squat', MuscleGroup.LEGS, ExerciseType.COMPOUND, 120),
  systemExercise('sys-leg-press', 'Leg Press', MuscleGroup.LEGS, ExerciseType.COMPOUND, 150),
  systemExercise('sys-bulgarian-split-squat', 'Bulgarian Split Squat', MuscleGroup.LEGS, ExerciseType.COMPOUND, 120),
  systemExercise('sys-walking-lunge', 'Walking Lunge', MuscleGroup.LEGS, ExerciseType.COMPOUND, 120),
  systemExercise('sys-lunges', 'Lunges', MuscleGroup.LEGS, ExerciseType.COMPOUND, 120),
  systemExercise('sys-step-up', 'Step Up', MuscleGroup.LEGS, ExerciseType.COMPOUND, 105),
  systemExercise('sys-leg-extension', 'Leg Extension', MuscleGroup.LEGS, ExerciseType.ISOLATION, 75),
  systemExercise('sys-leg-curl', 'Leg Curl', MuscleGroup.LEGS, ExerciseType.ISOLATION, 75),
  systemExercise('sys-ham-curl', 'Ham Curl', MuscleGroup.LEGS, ExerciseType.ISOLATION, 75),
  systemExercise('sys-seated-leg-curl', 'Seated Leg Curl', MuscleGroup.LEGS, ExerciseType.ISOLATION, 75),
  systemExercise('sys-standing-calf-raise', 'Standing Calf Raise', MuscleGroup.LEGS, ExerciseType.ISOLATION, 60),
  systemExercise('sys-seated-calf-raise', 'Seated Calf Raise', MuscleGroup.LEGS, ExerciseType.ISOLATION, 60),

  // Shoulders
  systemExercise('sys-overhead-press', 'Overhead Press', MuscleGroup.SHOULDERS, ExerciseType.COMPOUND, 150),
  systemExercise('sys-shoulder-press', 'Shoulder Press', MuscleGroup.SHOULDERS, ExerciseType.COMPOUND, 135),
  systemExercise('sys-push-press', 'Push Press', MuscleGroup.SHOULDERS, ExerciseType.COMPOUND, 150),
  systemExercise('sys-arnold-press', 'Arnold Press', MuscleGroup.SHOULDERS, ExerciseType.COMPOUND, 120),
  systemExercise('sys-lateral-raise', 'Lateral Raise', MuscleGroup.SHOULDERS, ExerciseType.ISOLATION, 75),
  systemExercise('sys-cable-lateral-raise', 'Cable Lateral Raise', MuscleGroup.SHOULDERS, ExerciseType.ISOLATION, 75),
  systemExercise('sys-front-raise', 'Front Raise', MuscleGroup.SHOULDERS, ExerciseType.ISOLATION, 75),
  systemExercise('sys-rear-delt-fly', 'Rear Delt Fly', MuscleGroup.SHOULDERS, ExerciseType.ISOLATION, 75),
  systemExercise('sys-upright-row', 'Upright Row', MuscleGroup.SHOULDERS, ExerciseType.ISOLATION, 90),
  systemExercise('sys-face-pull', 'Face Pull', MuscleGroup.SHOULDERS, ExerciseType.ISOLATION, 75),

  // Arms
  systemExercise('sys-barbell-curl', 'Barbell Curl', MuscleGroup.ARMS, ExerciseType.ISOLATION, 75),
  systemExercise('sys-dumbbell-curl', 'Dumbbell Curl', MuscleGroup.ARMS, ExerciseType.ISOLATION, 75),
  systemExercise('sys-bicep-curl', 'Bicep Curl', MuscleGroup.ARMS, ExerciseType.ISOLATION, 75),
  systemExercise('sys-hammer-curl', 'Hammer Curl', MuscleGroup.ARMS, ExerciseType.ISOLATION, 75),
  systemExercise('sys-preacher-curl', 'Preacher Curl', MuscleGroup.ARMS, ExerciseType.ISOLATION, 75),
  systemExercise('sys-concentration-curl', 'Concentration Curl', MuscleGroup.ARMS, ExerciseType.ISOLATION, 60),
  systemExercise('sys-tricep-pushdown', 'Tricep Pushdown', MuscleGroup.ARMS, ExerciseType.ISOLATION, 75),
  systemExercise('sys-skull-crusher', 'Skull Crusher', MuscleGroup.ARMS, ExerciseType.ISOLATION, 90),
  systemExercise('sys-overhead-tricep-extension', 'Overhead Tricep Extension', MuscleGroup.ARMS, ExerciseType.ISOLATION, 75),
  systemExercise('sys-tricep-kickback', 'Tricep Kickback', MuscleGroup.ARMS, ExerciseType.ISOLATION, 60),

  // Core
  systemExercise('sys-plank', 'Plank', MuscleGroup.CORE, ExerciseType.ISOLATION, 60),
  systemExercise('sys-side-plank', 'Side Plank', MuscleGroup.CORE, ExerciseType.ISOLATION, 60),
  systemExercise('sys-cable-crunch', 'Cable Crunch', MuscleGroup.CORE, ExerciseType.ISOLATION, 60),
  systemExercise('sys-hanging-leg-raise', 'Hanging Leg Raise', MuscleGroup.CORE, ExerciseType.ISOLATION, 60),
  systemExercise('sys-ab-wheel-rollout', 'Ab Wheel Rollout', MuscleGroup.CORE, ExerciseType.ISOLATION, 60),
  systemExercise('sys-russian-twist', 'Russian Twist', MuscleGroup.CORE, ExerciseType.ISOLATION, 45),

  // Glutes
  systemExercise('sys-hip-thrust', 'Hip Thrust', MuscleGroup.GLUTES, ExerciseType.COMPOUND, 150),
  systemExercise('sys-glute-bridge', 'Glute Bridge', MuscleGroup.GLUTES, ExerciseType.COMPOUND, 120),
  systemExercise('sys-cable-kickback', 'Cable Kickback', MuscleGroup.GLUTES, ExerciseType.ISOLATION, 75),

  // Full body
  systemExercise('sys-clean-and-press', 'Clean and Press', MuscleGroup.FULL_BODY, ExerciseType.COMPOUND, 150),
  systemExercise('sys-thruster', 'Thruster', MuscleGroup.FULL_BODY, ExerciseType.COMPOUND, 120),
  systemExercise('sys-kettlebell-swing', 'Kettlebell Swing', MuscleGroup.FULL_BODY, ExerciseType.COMPOUND, 90),
  systemExercise('sys-burpee', 'Burpee', MuscleGroup.FULL_BODY, ExerciseType.COMPOUND, 60),
];

function byNameAsc<T extends { name: string }>(a: T, b: T) {
  return a.name.localeCompare(b.name);
}

export async function listExerciseLibrary(userId: string, search?: string) {
  const customExercises = await prisma.customExercise.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  });

  const customMapped: ExerciseLibraryItem[] = customExercises.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscleGroup,
    exerciseType: exercise.exerciseType,
    defaultRestSeconds: exercise.defaultRestSeconds,
    source: 'custom',
  }));

  const merged = [...predefinedExercises, ...customMapped].sort(byNameAsc);
  if (!search) {
    return merged;
  }

  const normalizedSearch = search.trim().toLowerCase();
  return merged.filter((item) => item.name.toLowerCase().includes(normalizedSearch));
}

export async function createCustomExercise(userId: string, input: CreateCustomExerciseInput) {
  return prisma.customExercise.create({
    data: {
      userId,
      name: input.name,
      muscleGroup: input.muscleGroup,
      exerciseType: input.exerciseType,
      defaultRestSeconds: input.defaultRestSeconds ?? (input.exerciseType === ExerciseType.COMPOUND ? 150 : 90),
    },
  });
}
