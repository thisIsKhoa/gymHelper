import { apiRequest } from './api.ts';
import type {
  GamificationNotificationsResponse,
  GamificationProfileResponse,
} from '../types/gamification.ts';

export async function loadGamificationProfile(): Promise<GamificationProfileResponse> {
  return apiRequest<GamificationProfileResponse>('/gamification/profile', 'GET');
}

export async function consumeGamificationNotifications(
  limit = 10,
): Promise<GamificationNotificationsResponse> {
  return apiRequest<GamificationNotificationsResponse>(
    '/gamification/notifications/consume',
    'POST',
    { limit },
  );
}

export async function pingGamificationActivity(): Promise<void> {
  await apiRequest('/gamification/activity/ping', 'POST', {});
}
