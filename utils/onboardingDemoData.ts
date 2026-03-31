import type { Drink } from '../types/drink';

/** Фиксированная дата «сегодня» для онбординга: середина февраля 2026. */
export const ONBOARDING_CALENDAR_ANCHOR = new Date(2026, 1, 15);

/**
 * Демо-напитки для отображения на экранах Календарь и Статистика во время онбординга.
 * Жёстко привязаны к январю–марту 2026, чтобы на 6-м слайде всегда был заполненный февраль и соседние месяцы.
 * Не сохраняются в память — только для визуала.
 */
function buildDemoDrinks(): Drink[] {
  const list: Drink[] = [];
  const names = [
    { name: 'Пиво 500мл', beverageType: 'beer' as const, volumeMl: 500, abvPercent: 5 },
    { name: 'Вино', beverageType: 'wine' as const, volumeMl: 150, abvPercent: 12 },
    { name: 'Коньяк', beverageType: 'spirit' as const, volumeMl: 50, abvPercent: 40 },
    { name: 'Виски кола', beverageType: 'cocktail' as const, volumeMl: 250, abvPercent: 16 },
  ];
  let id = 0;

  // Январь, февраль, март 2026
  const end = new Date(2026, 2, 31);
  const d = new Date(2026, 0, 1);
  while (d <= end) {
    const dateISO =
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0');

    const dayOfMonth = d.getDate();
    const count = dayOfMonth % 4 === 0 ? 2 : dayOfMonth % 3 === 0 ? 1 : 0;

    for (let i = 0; i < count; i++) {
      const t = names[dayOfMonth % names.length];
      const standardUnits = (t.volumeMl * (t.abvPercent / 100) * 0.789) / 10;
      list.push({
        id: `demo-${++id}`,
        dateISO,
        name: t.name,
        beverageType: t.beverageType,
        volumeMl: t.volumeMl,
        abvPercent: t.abvPercent,
        standardUnits: Math.round(standardUnits * 100) / 100,
        quantity: 1,
      });
    }

    d.setDate(d.getDate() + 1);
  }

  return list;
}

let cached: Drink[] | null = null;

export function getDemoDrinksForOnboarding(): Drink[] {
  if (!cached) cached = buildDemoDrinks();
  return cached;
}
