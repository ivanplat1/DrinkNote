import { Drink } from '../types/drink';
import { startOfMonth, endOfMonth, formatISO, getWeekdayIndexMonFirst } from './date';

// Начало недели (понедельник)
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = воскресенье, 1 = понедельник, ...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Понедельник
  return new Date(d.setDate(diff));
}

// Конец недели (воскресенье)
export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

export function weekStartISO(date: Date): string {
  return formatISO(startOfWeek(date));
}

export function weekEndISO(date: Date): string {
  return formatISO(endOfWeek(date));
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Статистика за неделю
export function getWeekStats(drinks: Drink[], date: Date): {
  totalUnits: number;
  totalVolumeMl: number;
  daysWithDrinks: number;
  averagePerDay: number;
} {
  const start = startOfWeek(date);
  const end = endOfWeek(date);
  const startISO = formatISO(start);
  const endISO = formatISO(end);
  
  const weekDrinks = drinks.filter(d => {
    return d.dateISO >= startISO && d.dateISO <= endISO;
  });
  
  const totalUnits = weekDrinks.reduce((sum, d) => sum + d.standardUnits, 0);
  const totalVolumeMl = weekDrinks.reduce((sum, d) => sum + d.volumeMl * (d.quantity ?? 1), 0);
  
  const uniqueDates = new Set(weekDrinks.map(d => d.dateISO));
  const daysWithDrinks = uniqueDates.size;
  const averagePerDay = daysWithDrinks > 0 ? totalUnits / daysWithDrinks : 0;
  
  return {
    totalUnits,
    totalVolumeMl,
    daysWithDrinks,
    averagePerDay: Math.round(averagePerDay * 100) / 100,
  };
}

// Статистика за месяц
export function getMonthStats(drinks: Drink[], date: Date): {
  totalUnits: number;
  totalVolumeMl: number;
  daysWithDrinks: number;
  averagePerDay: number;
} {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const startISO = formatISO(start);
  const endISO = formatISO(end);
  
  const monthDrinks = drinks.filter(d => {
    return d.dateISO >= startISO && d.dateISO <= endISO;
  });
  
  const totalUnits = monthDrinks.reduce((sum, d) => sum + d.standardUnits, 0);
  const totalVolumeMl = monthDrinks.reduce((sum, d) => sum + d.volumeMl * (d.quantity ?? 1), 0);
  
  const uniqueDates = new Set(monthDrinks.map(d => d.dateISO));
  const daysWithDrinks = uniqueDates.size;
  const averagePerDay = daysWithDrinks > 0 ? totalUnits / daysWithDrinks : 0;
  
  return {
    totalUnits,
    totalVolumeMl,
    daysWithDrinks,
    averagePerDay: Math.round(averagePerDay * 100) / 100,
  };
}

// Общая статистика
export function getOverallStats(drinks: Drink[]): {
  totalUnits: number;
  totalVolumeMl: number;
  totalDays: number;
  averagePerDay: number;
  firstDate: string | null;
  lastDate: string | null;
} {
  if (drinks.length === 0) {
    return {
      totalUnits: 0,
      totalVolumeMl: 0,
      totalDays: 0,
      averagePerDay: 0,
      firstDate: null,
      lastDate: null,
    };
  }
  
  const totalUnits = drinks.reduce((sum, d) => sum + d.standardUnits, 0);
  const totalVolumeMl = drinks.reduce((sum, d) => sum + d.volumeMl * (d.quantity ?? 1), 0);
  
  const dates = drinks.map(d => d.dateISO).sort();
  const uniqueDates = new Set(dates);
  const totalDays = uniqueDates.size;
  const averagePerDay = totalDays > 0 ? totalUnits / totalDays : 0;
  
  return {
    totalUnits,
    totalVolumeMl,
    totalDays,
    averagePerDay: Math.round(averagePerDay * 100) / 100,
    firstDate: dates[0] || null,
    lastDate: dates[dates.length - 1] || null,
  };
}

// Получить статистику по дням выбранной недели
export function getWeekDaysStats(drinks: Drink[], date: Date): Array<{ day: Date; units: number }> {
  const start = startOfWeek(date);
  const result: Array<{ day: Date; units: number }> = [];
  
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const dayISO = formatISO(day);
    
    const dayDrinks = drinks.filter(d => d.dateISO === dayISO);
    const units = dayDrinks.reduce((sum, d) => sum + d.standardUnits, 0);
    
    result.push({
      day,
      units: Math.round(units * 100) / 100,
    });
  }
  
  return result;
}

// Получить последние N недель
export function getLastNWeeks(drinks: Drink[], n: number): Array<{ weekStart: Date; stats: ReturnType<typeof getWeekStats> }> {
  const result: Array<{ weekStart: Date; stats: ReturnType<typeof getWeekStats> }> = [];
  const today = new Date();
  
  for (let i = n - 1; i >= 0; i--) {
    const weekDate = new Date(today);
    weekDate.setDate(weekDate.getDate() - (i * 7));
    const weekStart = startOfWeek(weekDate);
    result.push({
      weekStart,
      stats: getWeekStats(drinks, weekStart),
    });
  }
  
  return result;
}

// Получить последние N месяцев
export function getLastNMonths(drinks: Drink[], n: number): Array<{ month: Date; stats: ReturnType<typeof getMonthStats> }> {
  const result: Array<{ month: Date; stats: ReturnType<typeof getMonthStats> }> = [];
  const today = new Date();
  
  for (let i = n - 1; i >= 0; i--) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    result.push({
      month: monthDate,
      stats: getMonthStats(drinks, monthDate),
    });
  }
  
  return result;
}

// Статистика по типам напитков
export function getBeverageTypeStats(drinks: Drink[]): Array<{
  type: Drink['beverageType'];
  totalUnits: number;
  totalVolumeMl: number;
  percentage: number;
  count: number;
}> {
  const typeMap = new Map<Drink['beverageType'], { units: number; volume: number; count: number }>();
  
  drinks.forEach(drink => {
    const existing = typeMap.get(drink.beverageType) || { units: 0, volume: 0, count: 0 };
    typeMap.set(drink.beverageType, {
      units: existing.units + drink.standardUnits,
      volume: existing.volume + drink.volumeMl * (drink.quantity ?? 1),
      count: existing.count + 1,
    });
  });
  
  const totalUnits = drinks.reduce((sum, d) => sum + d.standardUnits, 0);
  
  return Array.from(typeMap.entries())
    .map(([type, data]) => ({
      type,
      totalUnits: Math.round(data.units * 100) / 100,
      totalVolumeMl: data.volume,
      percentage: totalUnits > 0 ? Math.round((data.units / totalUnits) * 1000) / 10 : 0,
      count: data.count,
    }))
    .sort((a, b) => b.totalUnits - a.totalUnits);
}

// Статистика по дням недели
export function getWeekdayStats(drinks: Drink[]): Array<{
  weekday: number; // 0 = понедельник, 6 = воскресенье
  totalUnits: number;
  averageUnits: number;
  daysCount: number;
}> {
  const weekdayMap = new Map<number, { units: number; dates: Set<string> }>();
  
  drinks.forEach(drink => {
    const date = new Date(drink.dateISO + 'T00:00:00');
    const weekday = getWeekdayIndexMonFirst(date);
    const existing = weekdayMap.get(weekday) || { units: 0, dates: new Set() };
    existing.units += drink.standardUnits;
    existing.dates.add(drink.dateISO);
    weekdayMap.set(weekday, existing);
  });
  
  const result: Array<{ weekday: number; totalUnits: number; averageUnits: number; daysCount: number }> = [];
  
  for (let i = 0; i < 7; i++) {
    const data = weekdayMap.get(i) || { units: 0, dates: new Set() };
    const daysCount = data.dates.size;
    result.push({
      weekday: i,
      totalUnits: Math.round(data.units * 100) / 100,
      averageUnits: daysCount > 0 ? Math.round((data.units / daysCount) * 100) / 100 : 0,
      daysCount,
    });
  }
  
  return result;
}


// Рекорды и достижения
export function getRecords(drinks: Drink[]): {
  heaviestDay: { date: string; units: number } | null;
  longestStreak: number;
  currentStreak: number;
  lightestDay: { date: string; units: number } | null;
} {
  if (drinks.length === 0) {
    return {
      heaviestDay: null,
      longestStreak: 0,
      currentStreak: 0,
      lightestDay: null,
    };
  }
  
  // Группируем по дням
  const dayMap = new Map<string, number>();
  drinks.forEach(drink => {
    const existing = dayMap.get(drink.dateISO) || 0;
    dayMap.set(drink.dateISO, existing + drink.standardUnits);
  });
  
  // Самый тяжелый и легкий день
  let heaviestDay: { date: string; units: number } | null = null;
  let lightestDay: { date: string; units: number } | null = null;
  
  dayMap.forEach((units, date) => {
    if (!heaviestDay || units > heaviestDay.units) {
      heaviestDay = { date, units: Math.round(units * 100) / 100 };
    }
    if (!lightestDay || units < lightestDay.units) {
      lightestDay = { date, units: Math.round(units * 100) / 100 };
    }
  });
  
  // Серии дней без алкоголя - считаем ТОЛЬКО после первой записи о напитке
  const allDates = Array.from(dayMap.keys()).sort();
  const today = formatISO(new Date());
  
  let longestStreak = 0;
  let currentStreak = 0;
  
  if (allDates.length > 0) {
    const firstDate = new Date(allDates[0] + 'T00:00:00');
    const lastDate = new Date(allDates[allDates.length - 1] + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');
    
    // Проверяем серии между записями (только между существующими записями)
    for (let i = 0; i < allDates.length - 1; i++) {
      const current = new Date(allDates[i] + 'T00:00:00');
      const next = new Date(allDates[i + 1] + 'T00:00:00');
      const diffDays = Math.floor((next.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays > 1) {
        const streak = diffDays - 1;
        if (streak > longestStreak) {
          longestStreak = streak;
        }
      }
    }
    
    // Проверяем текущую серию (от последней записи до сегодня)
    // Считаем только завершенные дни (не включая сегодня)
    const lastRecordDate = new Date(allDates[allDates.length - 1] + 'T00:00:00');
    const daysSinceLastRecord = Math.floor((todayDate.getTime() - lastRecordDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastRecord > 0) {
      // Вычитаем 1, чтобы не считать сегодняшний день (только завершенные дни)
      currentStreak = daysSinceLastRecord - 1;
    }
    
    // НЕ учитываем период до первой записи - серии считаются только после первого употребления
  }
  
  return {
    heaviestDay,
    longestStreak,
    currentStreak,
    lightestDay,
  };
}

// Топ напитков
export function getTopDrinks(drinks: Drink[], limit: number = 5): Array<{
  name: string;
  beverageType: Drink['beverageType'];
  totalUnits: number;
  totalVolumeMl: number;
  count: number;
}> {
  const drinkMap = new Map<string, { units: number; volume: number; count: number; type: Drink['beverageType'] }>();
  
  drinks.forEach(drink => {
    const key = `${drink.name}_${drink.volumeMl}_${drink.abvPercent}`;
    const existing = drinkMap.get(key) || { units: 0, volume: 0, count: 0, type: drink.beverageType };
    drinkMap.set(key, {
      units: existing.units + drink.standardUnits,
      volume: existing.volume + drink.volumeMl * (drink.quantity ?? 1),
      count: existing.count + (drink.quantity ?? 1),
      type: drink.beverageType,
    });
  });
  
  return Array.from(drinkMap.entries())
    .map(([key, data]) => {
      const [name] = key.split('_');
      return {
        name,
        beverageType: data.type,
        totalUnits: Math.round(data.units * 100) / 100,
        totalVolumeMl: data.volume,
        count: data.count,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

