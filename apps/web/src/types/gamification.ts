export type MuscleSkillCode = 'CHEST' | 'BACK' | 'LATS' | 'LEGS' | 'ARMS' | 'CORE';

export type AchievementCategory = 'volume' | 'consistency' | 'pr' | 'hidden';

export type GamificationNotificationType = 'ACHIEVEMENT_UNLOCKED' | 'MUSCLE_LEVEL_UP';

export interface MuscleSkillProgress {
  skill: MuscleSkillCode;
  label: string;
  totalExp: number;
  level: number;
  expIntoLevel: number;
  expToNextLevel: number;
  progressPct: number;
}

export interface MuscleSkillRadarPoint {
  muscle: string;
  skill: MuscleSkillCode;
  value: number;
  level: number;
}

export interface AchievementItem {
  code: string;
  category: AchievementCategory;
  isHidden: boolean;
  isUnlocked: boolean;
  title: string;
  description: string;
  progressValue: number;
  targetValue: number;
  progressPct: number;
  progressUnit: string;
  iconKey: string;
  unlockedAt: string | null;
}

export interface GamificationProfileResponse {
  muscleSkills: MuscleSkillProgress[];
  radar: MuscleSkillRadarPoint[];
  achievements: AchievementItem[];
  summary: {
    unlockedAchievements: number;
    totalAchievements: number;
    unreadNotifications: number;
  };
}

export interface GamificationNotificationItem {
  id: string;
  type: GamificationNotificationType;
  title: string;
  message: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface GamificationNotificationsResponse {
  items: GamificationNotificationItem[];
  count: number;
}
