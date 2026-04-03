import AsyncStorage from '@react-native-async-storage/async-storage';
import { PresetDrink } from '../types/preset';
import type { AppLanguage } from './language';
import { getAppLanguage } from './language';
import { t as translate } from '../i18n/i18n';
import { detectDefaultLanguage } from '../i18n/i18n';

const PRESETS_KEY = 'user_presets_v1';

// Простая система событий для синхронизации пресетов между экранами
type PresetsChangeListener = (presets: PresetDrink[]) => void;

class PresetsEventEmitter {
  private listeners: Set<PresetsChangeListener> = new Set();

  subscribe(listener: PresetsChangeListener): () => void {
    this.listeners.add(listener);
    // Возвращаем функцию отписки
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(presets: PresetDrink[]): void {
    this.listeners.forEach((listener) => {
      try {
        listener(presets);
      } catch (error) {
        console.error('[PresetsEventEmitter] Error in listener:', error);
      }
    });
  }
}

export const presetsEventEmitter = new PresetsEventEmitter();

// Предопределенные напитки для предложения при добавлении
type SuggestedPresetSeed = Omit<PresetDrink, 'name'> & { nameKey: string };

const SUGGESTED_PRESET_SEEDS: SuggestedPresetSeed[] = [
  // Пиво и сидр
  { id: 'beer_500_5', nameKey: 'presetNames.beer', beverageType: 'beer', volumeMl: 500, abvPercent: 5 },
  { id: 'beer_330_5', nameKey: 'presetNames.beer', beverageType: 'beer', volumeMl: 330, abvPercent: 5 },
  { id: 'cider_500_5', nameKey: 'presetNames.cider', beverageType: 'beer', volumeMl: 500, abvPercent: 5 },
  
  // Вино и шампанское
  { id: 'wine_150_12', nameKey: 'presetNames.wine', beverageType: 'wine', volumeMl: 150, abvPercent: 12 },
  { id: 'wine_200_12', nameKey: 'presetNames.wine', beverageType: 'wine', volumeMl: 200, abvPercent: 12 },
  { id: 'champagne_150_12', nameKey: 'presetNames.champagne', beverageType: 'wine', volumeMl: 150, abvPercent: 12 },
  { id: 'prosecco_150_11', nameKey: 'presetNames.prosecco', beverageType: 'wine', volumeMl: 150, abvPercent: 11 },
  
  // Крепкие напитки
  { id: 'shot_50_40', nameKey: 'presetNames.shot', beverageType: 'spirit', volumeMl: 50, abvPercent: 40 },
  { id: 'whiskey_50_40', nameKey: 'presetNames.whiskey', beverageType: 'spirit', volumeMl: 50, abvPercent: 40 },
  { id: 'cognac_50_40', nameKey: 'presetNames.cognac', beverageType: 'spirit', volumeMl: 50, abvPercent: 40 },
  { id: 'vodka_50_40', nameKey: 'presetNames.vodka', beverageType: 'spirit', volumeMl: 50, abvPercent: 40 },
  { id: 'gin_50_40', nameKey: 'presetNames.gin', beverageType: 'spirit', volumeMl: 50, abvPercent: 40 },
  { id: 'rum_50_40', nameKey: 'presetNames.rum', beverageType: 'spirit', volumeMl: 50, abvPercent: 40 },
  { id: 'tequila_50_40', nameKey: 'presetNames.tequila', beverageType: 'spirit', volumeMl: 50, abvPercent: 40 },
  
  // Коктейли
  { id: 'mojito_250_12', nameKey: 'presetNames.mojito', beverageType: 'cocktail', volumeMl: 250, abvPercent: 12 },
  { id: 'bloody_mary_200_15', nameKey: 'presetNames.bloodyMary', beverageType: 'cocktail', volumeMl: 200, abvPercent: 15 },
  { id: 'margarita_150_20', nameKey: 'presetNames.margarita', beverageType: 'cocktail', volumeMl: 150, abvPercent: 20 },
  { id: 'long_island_250_22', nameKey: 'presetNames.longIsland', beverageType: 'cocktail', volumeMl: 250, abvPercent: 22 },
  { id: 'cosmopolitan_150_18', nameKey: 'presetNames.cosmopolitan', beverageType: 'cocktail', volumeMl: 150, abvPercent: 18 },
  { id: 'daiquiri_150_18', nameKey: 'presetNames.daiquiri', beverageType: 'cocktail', volumeMl: 150, abvPercent: 18 },
  { id: 'pina_colada_250_12', nameKey: 'presetNames.pinaColada', beverageType: 'cocktail', volumeMl: 250, abvPercent: 12 },
  { id: 'negroni_150_24', nameKey: 'presetNames.negroni', beverageType: 'cocktail', volumeMl: 150, abvPercent: 24 },
  { id: 'old_fashioned_150_32', nameKey: 'presetNames.oldFashioned', beverageType: 'cocktail', volumeMl: 150, abvPercent: 32 },
  { id: 'whiskey_sour_150_18', nameKey: 'presetNames.whiskeySour', beverageType: 'cocktail', volumeMl: 150, abvPercent: 18 },
  { id: 'gin_tonic_250_11', nameKey: 'presetNames.ginTonic', beverageType: 'cocktail', volumeMl: 250, abvPercent: 11 },
  { id: 'aperol_spritz_200_11', nameKey: 'presetNames.aperolSpritz', beverageType: 'cocktail', volumeMl: 200, abvPercent: 11 },
  { id: 'bellini_150_11', nameKey: 'presetNames.bellini', beverageType: 'cocktail', volumeMl: 150, abvPercent: 11 },
  { id: 'sex_on_beach_250_13', nameKey: 'presetNames.sexOnTheBeach', beverageType: 'cocktail', volumeMl: 250, abvPercent: 13 },
  { id: 'manhattan_150_28', nameKey: 'presetNames.manhattan', beverageType: 'cocktail', volumeMl: 150, abvPercent: 28 },
  { id: 'whiskey_cola_250_16', nameKey: 'presetNames.whiskeyCola', beverageType: 'cocktail', volumeMl: 250, abvPercent: 16 },
  { id: 'rum_cola_250_16', nameKey: 'presetNames.rumCola', beverageType: 'cocktail', volumeMl: 250, abvPercent: 16 },
];

export function getSuggestedPresets(language: AppLanguage): PresetDrink[] {
  return SUGGESTED_PRESET_SEEDS.map((s) => ({
    id: s.id,
    name: translate(language, s.nameKey),
    beverageType: s.beverageType,
    volumeMl: s.volumeMl,
    abvPercent: s.abvPercent,
  }));
}

async function resolveLanguage(): Promise<AppLanguage> {
  const saved = await getAppLanguage();
  return saved ?? detectDefaultLanguage();
}

function maybeLocalizeSeededPresets(list: PresetDrink[], language: AppLanguage): { next: PresetDrink[]; changed: boolean } {
  // Update seeded items:
  // 1) Stable seeded IDs: preset_<seedId>
  // 2) Also migrate timestamp presets that clearly match a seed (name+type+volume+abv),
  //    so they can be localized on language switch even if they were added from the catalog.
  const seedById = new Map(SUGGESTED_PRESET_SEEDS.map((s) => [s.id, s]));
  const existingIds = new Set(list.map((p) => p.id));
  let changed = false;
  const next = list.map((p) => {
    if (!p.id.startsWith('preset_')) return p;
    const seedId = p.id.slice('preset_'.length);
    const seed = seedById.get(seedId);
    const migrateFromSeed = (seedToUse: SuggestedPresetSeed) => {
      const localized = translate(language, seedToUse.nameKey);
      const targetId = `preset_${seedToUse.id}`;
      // Only rewrite if it still matches *some* seeded language (RU/EN), otherwise treat as user-edited.
      const ru = translate('ru', seedToUse.nameKey);
      const en = translate('en', seedToUse.nameKey);
      if (p.name !== ru && p.name !== en) return p;
      if (targetId !== p.id && existingIds.has(targetId)) return p;
      changed = true;
      existingIds.add(targetId);
      return { ...p, id: targetId, name: localized };
    };

    if (seed) {
      const localized = translate(language, seed.nameKey);
      if (p.name === localized) return p;
      return migrateFromSeed(seed);
    }

    // Not a stable seeded ID: try infer seed by matching payload and name (RU/EN).
    const inferred = SUGGESTED_PRESET_SEEDS.find((s) => {
      if (s.beverageType !== p.beverageType) return false;
      if (s.volumeMl !== p.volumeMl) return false;
      if (s.abvPercent !== p.abvPercent) return false;
      const ru = translate('ru', s.nameKey);
      const en = translate('en', s.nameKey);
      return p.name === ru || p.name === en;
    });
    if (!inferred) return p;
    return migrateFromSeed(inferred);
  });
  return { next, changed };
}

function getDefaultUserPresets(): PresetDrink[] {
  // Default Favorites: pre-seeded so first launch doesn't "build" them in UI.
  // These are normal user presets and can be edited/removed.
  const ids = ['beer_500_5', 'wine_150_12', 'cognac_50_40', 'whiskey_cola_250_16'];
  // Language is resolved by caller.
  const byId = new Map(getSuggestedPresets('ru').map((p) => [p.id, p]));
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((p) => ({ ...p!, id: `preset_${p!.id}` }));
}

export async function getUserPresets(): Promise<PresetDrink[]> {
  const language = await resolveLanguage();
  const raw = await AsyncStorage.getItem(PRESETS_KEY);
  if (!raw) {
    const seeded = getDefaultUserPresets().map((p) => {
      const seedId = p.id.slice('preset_'.length);
      const seed = SUGGESTED_PRESET_SEEDS.find((s) => s.id === seedId);
      if (!seed) return p;
      return { ...p, name: translate(language, seed.nameKey) };
    });
    if (seeded.length) {
      await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(seeded));
      presetsEventEmitter.emit(seeded);
      return seeded;
    }
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as PresetDrink[];
    const list = Array.isArray(parsed) ? parsed : [];
    if (list.length === 0) {
      const seeded = getDefaultUserPresets();
      if (seeded.length) {
        await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(seeded));
        presetsEventEmitter.emit(seeded);
        return seeded;
      }
    }
    const { next, changed } = maybeLocalizeSeededPresets(list, language);
    if (changed) {
      await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(next));
      presetsEventEmitter.emit(next);
      return next;
    }
    return list;
  } catch {
    return [];
  }
}

export async function refreshSeededPresetsLocalization(): Promise<void> {
  await getUserPresets();
}

// Извлекает чистое название напитка без объема и крепости
function extractCleanName(name: string): string {
  if (!name || typeof name !== 'string') {
    return name || '';
  }
  // Удаляем паттерны типа "500 мл (5%)" или "500мл(5%)" и т.д.
  // Ищем числа, затем "мл", затем опционально пробелы, затем число в скобках
  const cleaned = name.replace(/\s*\d+\s*мл\s*\(?\d+%?\)?\s*/gi, '').trim();
  return cleaned || name; // Если ничего не осталось, возвращаем оригинал
}

export async function addPreset(preset: Omit<PresetDrink, 'id'>): Promise<PresetDrink[]> {
  const current = await getUserPresets();
  const language = await resolveLanguage();
  // Извлекаем чистое название без объема и крепости
  const cleanName = extractCleanName(preset.name);
  // Дубликат только если совпадают название, объём, крепость и тип (разные названия — разные пресеты)
  const isDuplicate = current.some((p) =>
    extractCleanName(p.name) === cleanName &&
    p.volumeMl === preset.volumeMl &&
    p.abvPercent === preset.abvPercent &&
    p.beverageType === preset.beverageType
  );
  if (isDuplicate) {
    return current;
  }
  // If it matches a known seed, use a stable seeded id so language switch can localize it.
  const inferred = SUGGESTED_PRESET_SEEDS.find((s) => {
    if (s.beverageType !== preset.beverageType) return false;
    if (s.volumeMl !== preset.volumeMl) return false;
    if (s.abvPercent !== preset.abvPercent) return false;
    const ru = translate('ru', s.nameKey);
    const en = translate('en', s.nameKey);
    const localized = translate(language, s.nameKey);
    return cleanName === ru || cleanName === en || cleanName === localized;
  });
  const stableId = inferred ? `preset_${inferred.id}` : null;
  const withId: PresetDrink = {
    ...preset,
    name: inferred ? translate(language, inferred.nameKey) : cleanName,
    id: stableId ?? `preset_${Date.now()}`,
  };
  const next = [...current, withId];
  await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(next));
  presetsEventEmitter.emit(next);
  return next;
}

export async function removePreset(id: string): Promise<PresetDrink[]> {
  const current = await getUserPresets();
  const next = current.filter((p) => p.id !== id);
  await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(next));
  // Эмитим событие об изменении списка
  presetsEventEmitter.emit(next);
  return next;
}

export async function updatePreset(id: string, preset: Omit<PresetDrink, 'id'>): Promise<PresetDrink[]> {
  const current = await getUserPresets();
  const next = current.map((p) => 
    p.id === id ? { ...preset, name: (preset.name || '').trim(), id } : p
  );
  await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(next));
  // Эмитим событие об изменении списка
  presetsEventEmitter.emit(next);
  return next;
}

// Заменяет все пресеты новым списком (для тестовых данных)
export async function setUserPresets(presets: PresetDrink[]): Promise<void> {
  await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  presetsEventEmitter.emit(presets);
}


