export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// Неделя с понедельника
export function getWeekdayIndexMonFirst(date: Date): number {
  const d = date.getDay(); // 0..6, где 0 = воскресенье
  return d === 0 ? 6 : d - 1; // 0..6, где 0 = понедельник
}

export function buildMonthMatrix(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const last = endOfMonth(anchor);
  const leading = getWeekdayIndexMonFirst(first);
  const result: Date[] = [];
  // предшествующие дни из предыдущего месяца
  for (let i = leading; i > 0; i--) {
    result.push(new Date(anchor.getFullYear(), anchor.getMonth(), 1 - i));
  }
  // дни текущего месяца
  for (let d = 1; d <= last.getDate(); d++) {
    result.push(new Date(anchor.getFullYear(), anchor.getMonth(), d));
  }
  // добиваем до 6 недель (42 клетки) за счёт следующего месяца
  while (result.length < 42) {
    const lastDate = result[result.length - 1];
    result.push(new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + 1));
  }
  return result;
}

export function formatISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const WEEKDAY_SHORT_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];


