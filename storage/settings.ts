import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllDrinks } from './drinks';
import { Drink } from '../types/drink';

const SETTINGS_KEY = 'app_settings_v1';
const DAILY_GOAL_KEY = 'daily_goal_units';
const USER_WEIGHT_KEY = 'user_weight';
const USER_GENDER_KEY = 'user_gender';
const USER_BIRTH_YEAR_KEY = 'user_birth_year';
const USER_BIRTH_DATE_KEY = 'user_birth_date';
const APP_START_DATE_KEY = 'app_start_date';

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

// Дата рождения (формат ГГГГ-ММ-ДД)
export async function getBirthDate(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(USER_BIRTH_DATE_KEY);
  return raw;
}

export async function setBirthDate(dateISO: string | null): Promise<void> {
  if (dateISO === null) {
    await AsyncStorage.removeItem(USER_BIRTH_DATE_KEY);
  } else {
    await AsyncStorage.setItem(USER_BIRTH_DATE_KEY, dateISO);
  }
}

// Рассчитывает точный возраст на основе полной даты рождения
export function calculateAgeFromDate(birthDateISO: string | null): number | null {
  if (!birthDateISO) return null;
  
  const birthDate = new Date(birthDateISO);
  const today = new Date();
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // Если день рождения еще не наступил в этом году, вычитаем 1
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

// Дата первого запуска (для расчета рекордов)
export async function getAppStartDate(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(APP_START_DATE_KEY);
  return raw;
}

export async function setAppStartDate(dateISO: string | null): Promise<void> {
  if (dateISO === null) {
    await AsyncStorage.removeItem(APP_START_DATE_KEY);
  } else {
    await AsyncStorage.setItem(APP_START_DATE_KEY, dateISO);
  }
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

// Рассчитывает рекомендованную дневную норму на основе веса, пола и возраста
export function calculateRecommendedDailyLimit(weight: number, gender: Gender, age: number | null): number {
  // Базовая безопасная норма: 20г чистого спирта = 2 стандартные единицы
  // Для мужчин можно чуть больше, для женщин меньше
  // С возрастом норма снижается
  
  let baseLimit = 2.0; // стандартные единицы
  
  // Корректировка по полу
  if (gender === 'male') {
    baseLimit = 2.5; // Мужчины: 25г чистого спирта
  } else {
    baseLimit = 1.5; // Женщины и другие: 15г чистого спирта
  }
  
  // Корректировка по весу (если вес сильно отличается от среднего)
  const averageWeight = gender === 'male' ? 80 : 65;
  const weightFactor = weight / averageWeight;
  baseLimit *= Math.max(0.7, Math.min(1.3, weightFactor)); // Ограничиваем коэффициент
  
  // Корректировка по возрасту
  if (age !== null) {
    if (age < 25) {
      baseLimit *= 0.8; // Для молодых - меньше
    } else if (age > 50) {
      baseLimit *= 0.85; // Для пожилых - меньше
    } else if (age > 65) {
      baseLimit *= 0.7; // Для очень пожилых - значительно меньше
    }
  }
  
  // Округляем до 0.1
  return Math.round(baseLimit * 10) / 10;
}

// Получает рекомендованную дневную норму из настроек
export async function getRecommendedDailyLimit(): Promise<number> {
  const weight = await getUserWeight();
  const gender = await getUserGender();
  const birthDate = await getBirthDate();
  const age = calculateAgeFromDate(birthDate);
  
  // Дефолт: 50кг, genderless, без возраста
  const defaultWeight = 50;
  const defaultGender: Gender = 'genderless';
  
  const finalWeight = weight || defaultWeight;
  const finalGender = gender || defaultGender;
  
  return calculateRecommendedDailyLimit(finalWeight, finalGender, age);
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.removeItem('drinks_entries_v1');
  await AsyncStorage.removeItem('user_presets_v1');
  await AsyncStorage.removeItem(DAILY_GOAL_KEY);
  await AsyncStorage.removeItem(USER_WEIGHT_KEY);
  await AsyncStorage.removeItem(USER_GENDER_KEY);
  await AsyncStorage.removeItem(USER_BIRTH_YEAR_KEY);
  await AsyncStorage.removeItem(USER_BIRTH_DATE_KEY);
  await AsyncStorage.removeItem(ACHIEVEMENTS_KEY);
  await AsyncStorage.removeItem(APP_START_DATE_KEY);
}

// Достижения
const ACHIEVEMENTS_KEY = 'user_achievements';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string; // ISO date
}

export const ACHIEVEMENT_DEFINITIONS: Achievement[] = [
  { id: 'first_day', title: 'Первый день', description: '1 день без алкоголя', icon: 'star' },
  { id: 'three_days', title: 'Три дня', description: '3 дня подряд без алкоголя', icon: 'star-half-full' },
  { id: 'week', title: 'Неделя', description: '7 дней подряд без алкоголя', icon: 'trophy' },
  { id: 'two_weeks', title: 'Две недели', description: '14 дней подряд без алкоголя', icon: 'trophy' },
  { id: 'month', title: 'Месяц', description: '30 дней подряд без алкоголя', icon: 'medal' },
  { id: 'three_months', title: 'Три месяца', description: '90 дней подряд без алкоголя', icon: 'medal' },
  { id: 'half_year', title: 'Полгода', description: '180 дней подряд без алкоголя', icon: 'crown' },
  { id: 'year', title: 'Год', description: '365 дней подряд без алкоголя', icon: 'crown' },
];

export async function getAchievements(): Promise<Achievement[]> {
  const raw = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function unlockAchievement(achievementId: string): Promise<void> {
  const achievements = await getAchievements();
  const exists = achievements.find(a => a.id === achievementId);
  if (exists) return;

  const definition = ACHIEVEMENT_DEFINITIONS.find(a => a.id === achievementId);
  if (!definition) return;

  const newAchievement: Achievement = {
    ...definition,
    unlockedAt: new Date().toISOString(),
  };

  achievements.push(newAchievement);
  await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));
}

export async function checkAndUnlockAchievements(currentStreak: number): Promise<Achievement[]> {
  const newlyUnlocked: Achievement[] = [];
  
  const thresholds = [
    { days: 1, id: 'first_day' },
    { days: 3, id: 'three_days' },
    { days: 7, id: 'week' },
    { days: 14, id: 'two_weeks' },
    { days: 30, id: 'month' },
    { days: 90, id: 'three_months' },
    { days: 180, id: 'half_year' },
    { days: 365, id: 'year' },
  ];

  const achievements = await getAchievements();
  
  for (const { days, id } of thresholds) {
    if (currentStreak >= days && !achievements.find(a => a.id === id)) {
      await unlockAchievement(id);
      const definition = ACHIEVEMENT_DEFINITIONS.find(a => a.id === id);
      if (definition) {
        newlyUnlocked.push({ ...definition, unlockedAt: new Date().toISOString() });
      }
    }
  }

  return newlyUnlocked;
}

