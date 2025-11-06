import { Drink } from '../types/drink';
import { startOfMonth, endOfMonth, formatISO } from './date';

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

