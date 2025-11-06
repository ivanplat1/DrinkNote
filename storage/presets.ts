import AsyncStorage from '@react-native-async-storage/async-storage';
import { PresetDrink } from '../types/preset';

const PRESETS_KEY = 'user_presets_v1';

// Предопределенные напитки для предложения при добавлении
export const suggestedPresets: PresetDrink[] = [
  { id: 'beer_500_5', name: 'Пиво', beverageType: 'beer', volumeMl: 500, abvPercent: 5 },
  { id: 'wine_150_12', name: 'Вино', beverageType: 'wine', volumeMl: 150, abvPercent: 12 },
  { id: 'shot_50_40', name: 'Шот', beverageType: 'spirit', volumeMl: 50, abvPercent: 40 },
];

export async function getUserPresets(): Promise<PresetDrink[]> {
  const raw = await AsyncStorage.getItem(PRESETS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PresetDrink[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addPreset(preset: Omit<PresetDrink, 'id'>): Promise<PresetDrink[]> {
  const current = await getUserPresets();
  const withId: PresetDrink = { ...preset, name: preset.name.trim(), id: `preset_${Date.now()}` };
  const next = [...current, withId];
  await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(next));
  return next;
}

export async function removePreset(id: string): Promise<PresetDrink[]> {
  const current = await getUserPresets();
  const next = current.filter((p) => p.id !== id);
  await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(next));
  return next;
}

export async function updatePreset(id: string, preset: Omit<PresetDrink, 'id'>): Promise<PresetDrink[]> {
  const current = await getUserPresets();
  const next = current.map((p) => 
    p.id === id ? { ...preset, name: preset.name.trim(), id } : p
  );
  await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(next));
  return next;
}


