import type { Drink } from '../types/drink';

/**
 * Демо-напитки для отображения на экранах Календарь и Статистика во время онбординга.
 * Не сохраняются в память — только для визуала.
 */
function buildDemoDrinks(): Drink[] {
  const today = new Date();
  const list: Drink[] = [];
  const names = [
    { name: 'Пиво 500мл', beverageType: 'beer' as const, volumeMl: 500, abvPercent: 5 },
    { name: 'Вино', beverageType: 'wine' as const, volumeMl: 150, abvPercent: 12 },
    { name: 'Коньяк', beverageType: 'spirit' as const, volumeMl: 50, abvPercent: 40 },
    { name: 'Виски кола', beverageType: 'cocktail' as const, volumeMl: 250, abvPercent: 16 },
  ];
  let id = 0;
  // Последние ~3 недели: по 1–3 напитка в разные дни
  for (let dayOffset = 0; dayOffset < 22; dayOffset++) {
    const d = new Date(today);
    d.setDate(d.getDate() - dayOffset);
    const dateISO =
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0');
    const count = dayOffset % 4 === 0 ? 2 : dayOffset % 3 === 0 ? 1 : 0;
    for (let i = 0; i < count; i++) {
      const t = names[dayOffset % names.length];
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
  }
  return list;
}

let cached: Drink[] | null = null;

export function getDemoDrinksForOnboarding(): Drink[] {
  if (!cached) cached = buildDemoDrinks();
  return cached;
}
