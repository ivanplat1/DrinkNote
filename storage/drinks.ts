import AsyncStorage from '@react-native-async-storage/async-storage';
import { Drink } from '../types/drink';

const DRINKS_KEY = 'drinks_entries_v1';

export async function getAllDrinks(): Promise<Drink[]> {
  const raw = await AsyncStorage.getItem(DRINKS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Drink[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addDrink(entry: Drink): Promise<Drink[]> {
  const current = await getAllDrinks();
  const next = [...current, entry];
  await AsyncStorage.setItem(DRINKS_KEY, JSON.stringify(next));
  return next;
}

// Добавляет запись или объединяет с существующей за тот же день и теми же параметрами
export async function addOrMergeDrink(entry: Drink): Promise<Drink[]> {
  const current = await getAllDrinks();
  const idx = current.findIndex(
    (d) =>
      d.dateISO === entry.dateISO &&
      d.name === entry.name &&
      d.beverageType === entry.beverageType &&
      d.volumeMl === entry.volumeMl &&
      d.abvPercent === entry.abvPercent
  );
  if (idx >= 0) {
    const existing = current[idx];
    const newQuantity = (existing.quantity ?? 1) + (entry.quantity ?? 1);
    const merged: Drink = {
      ...existing,
      quantity: newQuantity,
      // суммируем стандартные единицы
      standardUnits: Math.round((existing.standardUnits + entry.standardUnits) * 100) / 100,
    };
    const next = [...current];
    next[idx] = merged;
    await AsyncStorage.setItem(DRINKS_KEY, JSON.stringify(next));
    return next;
  } else {
    const next = [...current, entry];
    await AsyncStorage.setItem(DRINKS_KEY, JSON.stringify(next));
    return next;
  }
}

export async function getDrinksByDate(dateISO: string): Promise<Drink[]> {
  const all = await getAllDrinks();
  return all.filter((d) => d.dateISO === dateISO);
}

export async function removeDrink(id: string): Promise<Drink[]> {
  const current = await getAllDrinks();
  const next = current.filter((d) => d.id !== id);
  await AsyncStorage.setItem(DRINKS_KEY, JSON.stringify(next));
  return next;
}


