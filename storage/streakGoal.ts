import AsyncStorage from '@react-native-async-storage/async-storage';

const STREAK_GOAL_KEY = 'streak_goal_v1';

/**
 * Получить цель по серии (дней без алкоголя). null = цель не задана.
 */
export async function getStreakGoal(): Promise<number | null> {
  try {
    const value = await AsyncStorage.getItem(STREAK_GOAL_KEY);
    if (value === null) return null;
    const num = parseInt(value, 10);
    return num > 0 ? num : null;
  } catch {
    return null;
  }
}

/**
 * Сохранить цель по серии. null или 0 = сбросить цель.
 */
export async function setStreakGoal(days: number | null): Promise<void> {
  try {
    if (days == null || days <= 0) {
      await AsyncStorage.removeItem(STREAK_GOAL_KEY);
    } else {
      await AsyncStorage.setItem(STREAK_GOAL_KEY, String(Math.round(days)));
    }
  } catch (error) {
    console.error('Failed to set streak goal:', error);
  }
}
