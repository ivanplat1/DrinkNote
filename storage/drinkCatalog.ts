import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PresetDrink } from '../types/preset';
import { getSuggestedPresets } from './presets';
import { getCurrentLanguageUnsafe } from '../i18n/I18nContext';

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
  const language = getCurrentLanguageUnsafe();
  return getSuggestedPresets(language).map((p) => ({
    ...p,
    id: makeId(p.id),
  }));
}

function maybeLocalizeSeededCatalog(list: PresetDrink[]): { next: PresetDrink[]; changed: boolean } {
  const language = getCurrentLanguageUnsafe();
  // Catalog IDs are catalog_<seedId>.
  const seedIds = new Set(
    getSuggestedPresets('ru').map((p) => p.id)
  );
  let changed = false;
  const next = list.map((p) => {
    if (!p.id.startsWith('catalog_')) return p;
    const seedId = p.id.slice('catalog_'.length);
    if (!seedIds.has(seedId)) return p;
    // Reconstruct the seed record to get its nameKey through translation table.
    // We can safely localize only when the name equals the seeded RU/EN names for this seedId.
    const ruSeed = getSuggestedPresets('ru').find((x) => x.id === seedId);
    const enSeed = getSuggestedPresets('en').find((x) => x.id === seedId);
    const curSeed = getSuggestedPresets(language).find((x) => x.id === seedId);
    if (!ruSeed || !enSeed || !curSeed) return p;
    if (p.name !== ruSeed.name && p.name !== enSeed.name) return p; // user edited
    if (p.name === curSeed.name) return p;
    changed = true;
    return { ...p, name: curSeed.name };
  });
  return { next, changed };
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
    const { next, changed } = maybeLocalizeSeededCatalog(parsed);
    if (changed) {
      await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(next));
      return next;
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

