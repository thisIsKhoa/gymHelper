import { AchievementCode, MuscleSkill } from '@prisma/client';

export const MUSCLE_SKILL_ORDER: ReadonlyArray<MuscleSkill> = [
  MuscleSkill.CHEST,
  MuscleSkill.BACK,
  MuscleSkill.LATS,
  MuscleSkill.LEGS,
  MuscleSkill.ARMS,
  MuscleSkill.CORE,
];

export const MUSCLE_SKILL_LABEL: Readonly<Record<MuscleSkill, string>> = {
  [MuscleSkill.CHEST]: 'Chest',
  [MuscleSkill.BACK]: 'Back',
  [MuscleSkill.LATS]: 'Lats',
  [MuscleSkill.LEGS]: 'Legs',
  [MuscleSkill.ARMS]: 'Arms',
  [MuscleSkill.CORE]: 'Core',
};

export type AchievementCategory = 'volume' | 'consistency' | 'pr' | 'hidden';

export interface AchievementDefinition {
  code: AchievementCode;
  title: string;
  description: string;
  category: AchievementCategory;
  hidden: boolean;
  targetValue: number;
  progressUnit: string;
  iconKey: string;
}

export const ACHIEVEMENT_DEFINITIONS: ReadonlyArray<AchievementDefinition> = [
  {
    code: AchievementCode.VOLUME_SESSION_1000,
    title: 'Rookie Mover',
    description: 'Reach 1,000kg total volume in a single workout session.',
    category: 'volume',
    hidden: false,
    targetValue: 1_000,
    progressUnit: 'kg',
    iconKey: 'volume-1000',
  },
  {
    code: AchievementCode.LIFETIME_VOLUME_5000000,
    title: 'World Lifter',
    description: 'Accumulate 5,000,000kg lifetime volume.',
    category: 'volume',
    hidden: false,
    targetValue: 5_000_000,
    progressUnit: 'kg',
    iconKey: 'volume-lifetime',
  },
  {
    code: AchievementCode.DAWN_WARRIOR,
    title: 'Dawn Warrior',
    description: 'Start a workout between 04:30 and 06:00 local time.',
    category: 'consistency',
    hidden: false,
    targetValue: 1,
    progressUnit: 'session',
    iconKey: 'dawn-warrior',
  },
  {
    code: AchievementCode.STREAK_30_DAYS,
    title: 'Steel Discipline',
    description: 'Maintain a 30-day workout streak without missing a day.',
    category: 'consistency',
    hidden: false,
    targetValue: 30,
    progressUnit: 'days',
    iconKey: 'streak-30',
  },
  {
    code: AchievementCode.PR_STREAK_3_IN_3_WEEKS,
    title: 'Breakthrough Pact',
    description: 'Hit PRs in 3 consecutive weeks.',
    category: 'pr',
    hidden: false,
    targetValue: 3,
    progressUnit: 'weeks',
    iconKey: 'pr-streak',
  },
  {
    code: AchievementCode.CLUB_100,
    title: 'Club 100',
    description: 'Lift 100kg on any exercise for the first time.',
    category: 'pr',
    hidden: false,
    targetValue: 100,
    progressUnit: 'kg',
    iconKey: 'club-100',
  },
  {
    code: AchievementCode.OPEN_APP_7_DAYS_NO_WORKOUT,
    title: 'Question Mark?',
    description: 'Open the app for 7 straight days without logging a workout.',
    category: 'hidden',
    hidden: true,
    targetValue: 7,
    progressUnit: 'days',
    iconKey: 'hidden-question',
  },
  {
    code: AchievementCode.REST_MONSTER,
    title: 'Rest Beast',
    description: 'Average more than 5 minutes of rest per set in one session.',
    category: 'hidden',
    hidden: true,
    targetValue: 300,
    progressUnit: 'sec',
    iconKey: 'rest-monster',
  },
];

export const LEVEL_EXP_BASE = 900;
export const LEVEL_EXP_GROWTH = 1.16;
export const BODYWEIGHT_REP_EXP = 9;
export const SECOND_SESSION_WEEKLY_COMBO = 1.1;

export const RPE_MULTIPLIERS = {
  high: 1.5,
  mediumHigh: 1.3,
  medium: 1.15,
  base: 1,
} as const;
