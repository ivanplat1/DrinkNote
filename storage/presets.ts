import AsyncStorage from '@react-native-async-storage/async-storage';
import { PresetDrink } from '../types/preset';

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
export const suggestedPresets: PresetDrink[] = [
  // Пиво и сидр
  { id: 'beer_500_5', name: 'Пиво', beverageType: 'beer', volumeMl: 500, abvPercent: 5 },
  { id: 'beer_330_5', name: 'Пиво', beverageType: 'beer', volumeMl: 330, abvPercent: 5 },
  { id: 'cider_500_5', name: 'Сидр', beverageType: 'beer', volumeMl: 500, abvPercent: 5 },
  
  // Вино и шампанское
  { id: 'wine_150_12', name: 'Вино', beverageType: 'wine', volumeMl: 150, abvPercent: 12 },
  { id: 'wine_200_12', name: 'Вино', beverageType: 'wine', volumeMl: 200, abvPercent: 12 },
  { id: 'champagne_150_12', name: 'Шампанское', beverageType: 'wine', volumeMl: 150, abvPercent: 12 },
  { id: 'prosecco_150_11', name: 'Просекко', beverageType: 'wine', volumeMl: 150, abvPercent: 11 },
  
  // Крепкие напитки
  { id: 'shot_50_40', name: 'Шот', beverageType: 'spirit', volumeMl: 50, abvPercent: 40 },
  { id: 'whiskey_50_40', name: 'Виски', beverageType: 'spirit', volumeMl: 50, abvPercent: 40 },
  { id: 'cognac_50_40', name: 'Коньяк', beverageType: 'spirit', volumeMl: 50, abvPercent: 40 },
  { id: 'vodka_50_40', name: 'Водка', beverageType: 'spirit', volumeMl: 50, abvPercent: 40 },
  { id: 'gin_50_40', name: 'Джин', beverageType: 'spirit', volumeMl: 50, abvPercent: 40 },
  { id: 'rum_50_40', name: 'Ром', beverageType: 'spirit', volumeMl: 50, abvPercent: 40 },
  { id: 'tequila_50_40', name: 'Текила', beverageType: 'spirit', volumeMl: 50, abvPercent: 40 },
  
  // Коктейли
  { id: 'mojito_250_12', name: 'Мохито', beverageType: 'cocktail', volumeMl: 250, abvPercent: 12 },
  { id: 'bloody_mary_200_15', name: 'Кровавая Мэри', beverageType: 'cocktail', volumeMl: 200, abvPercent: 15 },
  { id: 'margarita_150_20', name: 'Маргарита', beverageType: 'cocktail', volumeMl: 150, abvPercent: 20 },
  { id: 'long_island_250_22', name: 'Лонг Айленд', beverageType: 'cocktail', volumeMl: 250, abvPercent: 22 },
  { id: 'cosmopolitan_150_18', name: 'Космополитен', beverageType: 'cocktail', volumeMl: 150, abvPercent: 18 },
  { id: 'daiquiri_150_18', name: 'Дайкири', beverageType: 'cocktail', volumeMl: 150, abvPercent: 18 },
  { id: 'pina_colada_250_12', name: 'Пина Колада', beverageType: 'cocktail', volumeMl: 250, abvPercent: 12 },
  { id: 'negroni_150_24', name: 'Негрони', beverageType: 'cocktail', volumeMl: 150, abvPercent: 24 },
  { id: 'old_fashioned_150_32', name: 'Олд Фешн', beverageType: 'cocktail', volumeMl: 150, abvPercent: 32 },
  { id: 'whiskey_sour_150_18', name: 'Виски Сауэр', beverageType: 'cocktail', volumeMl: 150, abvPercent: 18 },
  { id: 'gin_tonic_250_11', name: 'Джин-тоник', beverageType: 'cocktail', volumeMl: 250, abvPercent: 11 },
  { id: 'aperol_spritz_200_11', name: 'Апероль Шприц', beverageType: 'cocktail', volumeMl: 200, abvPercent: 11 },
  { id: 'bellini_150_11', name: 'Беллини', beverageType: 'cocktail', volumeMl: 150, abvPercent: 11 },
  { id: 'sex_on_beach_250_13', name: 'Секс на пляже', beverageType: 'cocktail', volumeMl: 250, abvPercent: 13 },
  { id: 'manhattan_150_28', name: 'Манхэттен', beverageType: 'cocktail', volumeMl: 150, abvPercent: 28 },
  { id: 'whiskey_cola_250_16', name: 'Виски Кола', beverageType: 'cocktail', volumeMl: 250, abvPercent: 16 },
  { id: 'rum_cola_250_16', name: 'Ром Кола', beverageType: 'cocktail', volumeMl: 250, abvPercent: 16 },
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
  // Проверяем, нет ли уже такого пресета (по объему, крепости и типу)
  const isDuplicate = current.some((p) => 
    p.volumeMl === preset.volumeMl &&
    p.abvPercent === preset.abvPercent &&
    p.beverageType === preset.beverageType
  );
  
  // Если дубликат найден, возвращаем текущий список без изменений
  if (isDuplicate) {
    return current;
  }
  
  // Извлекаем чистое название без объема и крепости
  const cleanName = extractCleanName(preset.name);
  const withId: PresetDrink = { ...preset, name: cleanName, id: `preset_${Date.now()}` };
  const next = [...current, withId];
  await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(next));
  // Эмитим событие об изменении списка
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


