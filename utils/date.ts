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

/** YYYY-MM-DD по локальной дате (для календаря и меток — без сдвига по поясу). */
export function formatISO(date: Date): string {
  return (
    date.getFullYear() +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0')
  );
}

export const WEEKDAY_SHORT_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WEEKDAY_SHORT_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Короткие названия месяцев (3 буквы) для подписей под столбцами графика */
export const MONTH_SHORT_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const MONTH_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Дата в формате DD/MM для подписи недель (например 20/01) */
export function formatDDMM(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}


