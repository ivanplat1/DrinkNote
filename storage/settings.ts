import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllDrinks } from './drinks';
import { Drink } from '../types/drink';

const SETTINGS_KEY = 'app_settings_v1';
const DAILY_GOAL_KEY = 'daily_goal_units';

export interface AppSettings {
  dailyGoalUnits?: number;
}

export async function getDailyGoal(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(DAILY_GOAL_KEY);
  if (!raw) return null;
  try {
    const value = parseFloat(raw);
    return isNaN(value) ? null : value;
  } catch {
    return null;
  }
}

export async function setDailyGoal(units: number | null): Promise<void> {
  if (units === null) {
    await AsyncStorage.removeItem(DAILY_GOAL_KEY);
  } else {
    await AsyncStorage.setItem(DAILY_GOAL_KEY, units.toString());
  }
}

export async function exportData(): Promise<string> {
  const drinks = await getAllDrinks();
  const settings = await getDailyGoal();
  
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    drinks,
    settings: {
      dailyGoalUnits: settings,
    },
  };
  
  return JSON.stringify(exportData, null, 2);
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.removeItem('drinks_entries_v1');
  await AsyncStorage.removeItem('user_presets_v1');
  await AsyncStorage.removeItem(DAILY_GOAL_KEY);
}

