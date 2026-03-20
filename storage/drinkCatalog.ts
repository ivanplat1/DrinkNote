import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PresetDrink } from '../types/preset';
import { suggestedPresets } from './presets';

const CATALOG_KEY = 'drink_catalog_v1';

function normalizeName(name: string): string {
  return (name || '').trim();
}

function makeId(seed?: string) {
  return `catalog_${seed ?? Date.now().toString()}`;
}

function seedCatalog(): PresetDrink[] {
  // Seed catalog with the built-in suggestions, but as editable user data.
  // IDs are re-mapped to avoid clashing with other lists.
  return suggestedPresets.map((p) => ({
    ...p,
    id: makeId(p.id),
  }));
}

export async function getDrinkCatalog(): Promise<PresetDrink[]> {
  const raw = await AsyncStorage.getItem(CATALOG_KEY);
  if (!raw) {
    const seeded = seedCatalog();
    await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw) as PresetDrink[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = seedCatalog();
      await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return parsed;
  } catch {
    const seeded = seedCatalog();
    await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

export async function addDrinkToCatalog(preset: Omit<PresetDrink, 'id'>): Promise<PresetDrink[]> {
  const current = await getDrinkCatalog();
  const name = normalizeName(preset.name);
  const withId: PresetDrink = { ...preset, name, id: makeId() };
  const next = [withId, ...current];
  await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(next));
  return next;
}

export async function updateCatalogDrink(id: string, preset: Omit<PresetDrink, 'id'>): Promise<PresetDrink[]> {
  const current = await getDrinkCatalog();
  const name = normalizeName(preset.name);
  const next = current.map((p) => (p.id === id ? { ...preset, name, id } : p));
  await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(next));
  return next;
}

export async function removeCatalogDrink(id: string): Promise<PresetDrink[]> {
  const current = await getDrinkCatalog();
  const next = current.filter((p) => p.id !== id);
  await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(next));
  return next;
}

