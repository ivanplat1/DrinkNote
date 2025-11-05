import AsyncStorage from '@react-native-async-storage/async-storage';
import { PresetDrink } from '../types/preset';
import { formatTotalVolume } from '../utils/units';

const PRESETS_KEY = 'user_presets_v1';

// Предопределенные напитки для предложения при добавлении
export const suggestedPresets: PresetDrink[] = [
  { id: 'beer_500_5', name: 'Пиво 500 мл (5%)', beverageType: 'beer', volumeMl: 500, abvPercent: 5 },
  { id: 'wine_150_12', name: 'Вино 150 мл (12%)', beverageType: 'wine', volumeMl: 150, abvPercent: 12 },
  { id: 'shot_50_40', name: 'Шот 50 мл (40%)', beverageType: 'spirit', volumeMl: 50, abvPercent: 40 },
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
  // Автоматически добавляем объем и % в название
  let finalName = preset.name.trim();
  const volumeStr = formatTotalVolume(preset.volumeMl, 1);
  const abvStr = `${preset.abvPercent}%`;
  
  // Проверяем, есть ли уже объем и % в названии (примерные паттерны)
  const hasVolume = /\d+\s*(мл|л)/i.test(finalName);
  const hasAbv = /\d+%/.test(finalName);
  
  // Если нет обоих - добавляем в конец
  if (!hasVolume || !hasAbv) {
    finalName = `${finalName} ${volumeStr} (${abvStr})`;
  }
  
  const withId: PresetDrink = { ...preset, name: finalName, id: `preset_${Date.now()}` };
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


