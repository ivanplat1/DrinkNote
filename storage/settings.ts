import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllDrinks } from './drinks';
import { Drink } from '../types/drink';

const SETTINGS_KEY = 'app_settings_v1';
const DAILY_GOAL_KEY = 'daily_goal_units';
const USER_WEIGHT_KEY = 'user_weight';
const USER_GENDER_KEY = 'user_gender';
const USER_BIRTH_YEAR_KEY = 'user_birth_year';

export type Gender = 'male' | 'female' | 'genderless';

export interface AppSettings {
  dailyGoalUnits?: number;
  weight?: number;
  gender?: Gender;
  birthYear?: number;
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
  const weight = await getUserWeight();
  const gender = await getUserGender();
  const birthYear = await getBirthYear();
  
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    drinks,
    settings: {
      dailyGoalUnits: settings,
      weight: weight,
      gender: gender,
      birthYear: birthYear,
    },
  };
  
  return JSON.stringify(exportData, null, 2);
}

export async function getUserWeight(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(USER_WEIGHT_KEY);
  if (!raw) return null;
  try {
    const value = parseFloat(raw);
    return isNaN(value) || value <= 0 ? null : value;
  } catch {
    return null;
  }
}

export async function setUserWeight(weight: number | null): Promise<void> {
  if (weight === null || weight <= 0) {
    await AsyncStorage.removeItem(USER_WEIGHT_KEY);
  } else {
    await AsyncStorage.setItem(USER_WEIGHT_KEY, weight.toString());
  }
}

export async function getUserGender(): Promise<Gender | null> {
  const raw = await AsyncStorage.getItem(USER_GENDER_KEY);
  if (raw === 'male' || raw === 'female' || raw === 'genderless') {
    return raw;
  }
  return null;
}

export async function setUserGender(gender: Gender | null): Promise<void> {
  if (gender === null) {
    await AsyncStorage.removeItem(USER_GENDER_KEY);
  } else {
    await AsyncStorage.setItem(USER_GENDER_KEY, gender);
  }
}

export async function getBirthYear(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(USER_BIRTH_YEAR_KEY);
  if (!raw) return null;
  try {
    const value = parseInt(raw, 10);
    const currentYear = new Date().getFullYear();
    // Проверяем, что год в разумных пределах (1900 - текущий год)
    if (isNaN(value) || value < 1900 || value > currentYear) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export async function setBirthYear(year: number | null): Promise<void> {
  if (year === null) {
    await AsyncStorage.removeItem(USER_BIRTH_YEAR_KEY);
  } else {
    const currentYear = new Date().getFullYear();
    if (year >= 1900 && year <= currentYear) {
      await AsyncStorage.setItem(USER_BIRTH_YEAR_KEY, year.toString());
    }
  }
}

// Рассчитывает возраст на основе года рождения
export function calculateAge(birthYear: number | null): number | null {
  if (birthYear === null) return null;
  const currentYear = new Date().getFullYear();
  return currentYear - birthYear;
}

// Рассчитывает смертельную дозу в единицах на основе веса и пола
export function calculateLethalDose(weight: number, gender: Gender): number {
  // Для женщин и genderless: примерно 0.3 единицы на кг веса
  // Для мужчин: примерно 0.4 единицы на кг веса
  const multiplier = gender === 'male' ? 0.4 : 0.3;
  return Math.round(weight * multiplier * 10) / 10; // Округляем до 1 знака
}

// Получает смертельную дозу из настроек или использует дефолт (женщина 50кг)
export async function getLethalDose(): Promise<number> {
  const weight = await getUserWeight();
  const gender = await getUserGender();
  
  // Дефолт: genderless 50кг (используем показатели как у женского)
  const defaultWeight = 50;
  const defaultGender: Gender = 'genderless';
  
  const finalWeight = weight || defaultWeight;
  const finalGender = gender || defaultGender;
  
  return calculateLethalDose(finalWeight, finalGender);
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.removeItem('drinks_entries_v1');
  await AsyncStorage.removeItem('user_presets_v1');
  await AsyncStorage.removeItem(DAILY_GOAL_KEY);
  await AsyncStorage.removeItem(USER_WEIGHT_KEY);
  await AsyncStorage.removeItem(USER_GENDER_KEY);
  await AsyncStorage.removeItem(USER_BIRTH_YEAR_KEY);
}

