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
  totalSpent: number;
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
  const totalSpent = weekDrinks.reduce((sum, d) => sum + (d.price ?? 0), 0);
  
  const uniqueDates = new Set(weekDrinks.map(d => d.dateISO));
  const daysWithDrinks = uniqueDates.size;
  const averagePerDay = daysWithDrinks > 0 ? totalUnits / daysWithDrinks : 0;
  
  return {
    totalUnits,
    totalVolumeMl,
    totalSpent: Math.round(totalSpent * 100) / 100,
    daysWithDrinks,
    averagePerDay: Math.round(averagePerDay * 100) / 100,
  };
}

// Статистика за месяц
export function getMonthStats(drinks: Drink[], date: Date): {
  totalUnits: number;
  totalVolumeMl: number;
  totalSpent: number;
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
  const totalSpent = monthDrinks.reduce((sum, d) => sum + (d.price ?? 0), 0);
  
  const uniqueDates = new Set(monthDrinks.map(d => d.dateISO));
  const daysWithDrinks = uniqueDates.size;
  const averagePerDay = daysWithDrinks > 0 ? totalUnits / daysWithDrinks : 0;
  
  return {
    totalUnits,
    totalVolumeMl,
    totalSpent: Math.round(totalSpent * 100) / 100,
    daysWithDrinks,
    averagePerDay: Math.round(averagePerDay * 100) / 100,
  };
}

// Общая статистика
export function getOverallStats(drinks: Drink[]): {
  totalUnits: number;
  totalVolumeMl: number;
  totalSpent: number;
  totalDays: number;
  averagePerDay: number;
  firstDate: string | null;
  lastDate: string | null;
} {
  if (drinks.length === 0) {
    return {
      totalUnits: 0,
      totalVolumeMl: 0,
      totalSpent: 0,
      totalDays: 0,
      averagePerDay: 0,
      firstDate: null,
      lastDate: null,
    };
  }
  
  const totalUnits = drinks.reduce((sum, d) => sum + d.standardUnits, 0);
  const totalVolumeMl = drinks.reduce((sum, d) => sum + d.volumeMl * (d.quantity ?? 1), 0);
  const totalSpent = drinks.reduce((sum, d) => sum + (d.price ?? 0), 0);
  
  const dates = drinks.map(d => d.dateISO).sort();
  const uniqueDates = new Set(dates);
  const totalDays = uniqueDates.size;
  const averagePerDay = totalDays > 0 ? totalUnits / totalDays : 0;
  
  return {
    totalUnits,
    totalVolumeMl,
    totalSpent: Math.round(totalSpent * 100) / 100,
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
  totalSpent: number;
  percentage: number;
  count: number;
}> {
  const typeMap = new Map<Drink['beverageType'], { units: number; volume: number; spent: number; count: number }>();
  
  drinks.forEach(drink => {
    const existing = typeMap.get(drink.beverageType) || { units: 0, volume: 0, spent: 0, count: 0 };
    typeMap.set(drink.beverageType, {
      units: existing.units + drink.standardUnits,
      volume: existing.volume + drink.volumeMl * (drink.quantity ?? 1),
      spent: existing.spent + (drink.price ?? 0),
      count: existing.count + 1,
    });
  });
  
  const totalUnits = drinks.reduce((sum, d) => sum + d.standardUnits, 0);
  
  return Array.from(typeMap.entries())
    .map(([type, data]) => ({
      type,
      totalUnits: Math.round(data.units * 100) / 100,
      totalVolumeMl: data.volume,
      totalSpent: Math.round(data.spent * 100) / 100,
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

// ========== PREMIUM: Расширенная статистика ==========

// Сравнение двух периодов (месяц к месяцу, год к году)
export function comparePeriods(
  drinks: Drink[],
  period1Start: Date,
  period1End: Date,
  period2Start: Date,
  period2End: Date
): {
  period1: { totalUnits: number; totalSpent: number; daysWithDrinks: number; averagePerDay: number };
  period2: { totalUnits: number; totalSpent: number; daysWithDrinks: number; averagePerDay: number };
  change: { units: number; unitsPercent: number; spent: number; spentPercent: number; days: number; daysPercent: number };
} {
  const period1ISOStart = formatISO(period1Start);
  const period1ISOEnd = formatISO(period1End);
  const period2ISOStart = formatISO(period2Start);
  const period2ISOEnd = formatISO(period2End);
  
  const period1Drinks = drinks.filter(d => d.dateISO >= period1ISOStart && d.dateISO <= period1ISOEnd);
  const period2Drinks = drinks.filter(d => d.dateISO >= period2ISOStart && d.dateISO <= period2ISOEnd);
  
  const period1Units = period1Drinks.reduce((sum, d) => sum + d.standardUnits, 0);
  const period2Units = period2Drinks.reduce((sum, d) => sum + d.standardUnits, 0);
  const period1Spent = period1Drinks.reduce((sum, d) => sum + (d.price ?? 0), 0);
  const period2Spent = period2Drinks.reduce((sum, d) => sum + (d.price ?? 0), 0);
  
  const period1Dates = new Set(period1Drinks.map(d => d.dateISO));
  const period2Dates = new Set(period2Drinks.map(d => d.dateISO));
  
  const period1Days = period1Dates.size;
  const period2Days = period2Dates.size;
  
  const period1Avg = period1Days > 0 ? period1Units / period1Days : 0;
  const period2Avg = period2Days > 0 ? period2Units / period2Days : 0;
  
  const unitsChange = period2Units - period1Units;
  const unitsPercent = period1Units > 0 ? ((unitsChange / period1Units) * 100) : 0;
  const spentChange = period2Spent - period1Spent;
  const spentPercent = period1Spent > 0 ? ((spentChange / period1Spent) * 100) : 0;
  
  const daysChange = period2Days - period1Days;
  const daysPercent = period1Days > 0 ? ((daysChange / period1Days) * 100) : 0;
  
  return {
    period1: {
      totalUnits: Math.round(period1Units * 100) / 100,
      totalSpent: Math.round(period1Spent * 100) / 100,
      daysWithDrinks: period1Days,
      averagePerDay: Math.round(period1Avg * 100) / 100,
    },
    period2: {
      totalUnits: Math.round(period2Units * 100) / 100,
      totalSpent: Math.round(period2Spent * 100) / 100,
      daysWithDrinks: period2Days,
      averagePerDay: Math.round(period2Avg * 100) / 100,
    },
    change: {
      units: Math.round(unitsChange * 100) / 100,
      unitsPercent: Math.round(unitsPercent * 10) / 10,
      spent: Math.round(spentChange * 100) / 100,
      spentPercent: Math.round(spentPercent * 10) / 10,
      days: daysChange,
      daysPercent: Math.round(daysPercent * 10) / 10,
    },
  };
}

// Тренд по месяцам (для линейного графика)
export function getMonthlyTrend(drinks: Drink[], months: number = 12): Array<{
  month: Date;
  totalUnits: number;
  totalSpent: number;
  daysWithDrinks: number;
  averagePerDay: number;
}> {
  const result: Array<{ month: Date; totalUnits: number; totalSpent: number; daysWithDrinks: number; averagePerDay: number }> = [];
  const today = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const stats = getMonthStats(drinks, monthDate);
    result.push({
      month: monthDate,
      totalUnits: stats.totalUnits,
      totalSpent: stats.totalSpent,
      daysWithDrinks: stats.daysWithDrinks,
      averagePerDay: stats.averagePerDay,
    });
  }
  
  return result;
}

// Тренд по неделям (для линейного графика)
export function getWeeklyTrend(drinks: Drink[], weeks: number = 12): Array<{
  weekStart: Date;
  totalUnits: number;
  totalSpent: number;
  daysWithDrinks: number;
  averagePerDay: number;
}> {
  const result: Array<{ weekStart: Date; totalUnits: number; totalSpent: number; daysWithDrinks: number; averagePerDay: number }> = [];
  const today = new Date();
  
  for (let i = weeks - 1; i >= 0; i--) {
    const weekDate = new Date(today);
    weekDate.setDate(weekDate.getDate() - (i * 7));
    const weekStart = startOfWeek(weekDate);
    const stats = getWeekStats(drinks, weekStart);
    result.push({
      weekStart,
      totalUnits: stats.totalUnits,
      totalSpent: stats.totalSpent,
      daysWithDrinks: stats.daysWithDrinks,
      averagePerDay: stats.averagePerDay,
    });
  }
  
  return result;
}

// Детальная аналитика по дням недели (средние значения и паттерны)
export function getDetailedWeekdayAnalytics(drinks: Drink[]): Array<{
  weekday: number;
  weekdayName: string;
  totalUnits: number;
  averageUnits: number;
  daysCount: number;
  percentageOfTotal: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}> {
  const weekdayStats = getWeekdayStats(drinks);
  const totalUnits = drinks.reduce((sum, d) => sum + d.standardUnits, 0);
  const WEEKDAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  
  // Вычисляем тренд (сравниваем с предыдущим днем)
  return weekdayStats.map((stat, index) => {
    const prevStat = index > 0 ? weekdayStats[index - 1] : weekdayStats[6]; // Сравниваем с предыдущим днем недели
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    
    if (stat.averageUnits > prevStat.averageUnits * 1.1) {
      trend = 'increasing';
    } else if (stat.averageUnits < prevStat.averageUnits * 0.9) {
      trend = 'decreasing';
    }
    
    return {
      weekday: stat.weekday,
      weekdayName: WEEKDAY_NAMES[stat.weekday],
      totalUnits: stat.totalUnits,
      averageUnits: stat.averageUnits,
      daysCount: stat.daysCount,
      percentageOfTotal: totalUnits > 0 ? Math.round((stat.totalUnits / totalUnits) * 1000) / 10 : 0,
      trend,
    };
  });
}

// Прогрессия серий воздержания
export function getStreakProgression(drinks: Drink[]): Array<{
  streakStart: string;
  streakEnd: string;
  length: number;
  completed: boolean;
}> {
  const dayMap = new Map<string, number>();
  drinks.forEach(drink => {
    const existing = dayMap.get(drink.dateISO) || 0;
    dayMap.set(drink.dateISO, existing + drink.standardUnits);
  });
  
  const allDates = Array.from(dayMap.keys()).sort();
  const today = formatISO(new Date());
  const streaks: Array<{ streakStart: string; streakEnd: string; length: number; completed: boolean }> = [];
  
  if (allDates.length === 0) return streaks;
  
  // Находим все серии между записями
  for (let i = 0; i < allDates.length - 1; i++) {
    const current = new Date(allDates[i] + 'T00:00:00');
    const next = new Date(allDates[i + 1] + 'T00:00:00');
    const diffDays = Math.floor((next.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 1) {
      const streakStart = new Date(current);
      streakStart.setDate(streakStart.getDate() + 1);
      const streakEnd = new Date(next);
      streakEnd.setDate(streakEnd.getDate() - 1);
      
      streaks.push({
        streakStart: formatISO(streakStart),
        streakEnd: formatISO(streakEnd),
        length: diffDays - 1,
        completed: true,
      });
    }
  }
  
  // Проверяем текущую серию
  const lastRecordDate = new Date(allDates[allDates.length - 1] + 'T00:00:00');
  const todayDate = new Date(today + 'T00:00:00');
  const daysSinceLastRecord = Math.floor((todayDate.getTime() - lastRecordDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceLastRecord > 0) {
    const currentStreakStart = new Date(lastRecordDate);
    currentStreakStart.setDate(currentStreakStart.getDate() + 1);
    
    streaks.push({
      streakStart: formatISO(currentStreakStart),
      streakEnd: today,
      length: daysSinceLastRecord - 1,
      completed: false,
    });
  }
  
  return streaks.sort((a, b) => b.length - a.length);
}

// Сравнение текущей недели с предыдущей
export function compareCurrentWeekWithPrevious(drinks: Drink[]): ReturnType<typeof comparePeriods> {
  const today = new Date();
  const currentWeekStart = startOfWeek(today);
  const currentWeekEnd = endOfWeek(today);
  
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const previousWeekEnd = new Date(previousWeekStart);
  previousWeekEnd.setDate(previousWeekEnd.getDate() + 6);
  
  return comparePeriods(drinks, previousWeekStart, previousWeekEnd, currentWeekStart, currentWeekEnd);
}

// Сравнение текущей недели с предыдущей за схожий период
export function compareCurrentWeekWithPreviousAdjusted(drinks: Drink[]): ReturnType<typeof comparePeriods> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentWeekStart = startOfWeek(today);
  
  // Вычисляем текущий день недели (0 = понедельник, 6 = воскресенье)
  const dayOfWeek = (today.getDay() + 6) % 7; // Преобразуем к понедельник=0
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekStart.getDate() + dayOfWeek);
  
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const previousWeekEnd = new Date(previousWeekStart);
  previousWeekEnd.setDate(previousWeekStart.getDate() + dayOfWeek);
  
  return comparePeriods(drinks, previousWeekStart, previousWeekEnd, currentWeekStart, currentWeekEnd);
}

// Сравнение текущего месяца с предыдущим
export function compareCurrentMonthWithPrevious(drinks: Drink[]): ReturnType<typeof comparePeriods> {
  const today = new Date();
  const currentMonthStart = startOfMonth(today);
  const currentMonthEnd = endOfMonth(today);
  
  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousMonthStart = startOfMonth(previousMonth);
  const previousMonthEnd = endOfMonth(previousMonth);
  
  return comparePeriods(drinks, previousMonthStart, previousMonthEnd, currentMonthStart, currentMonthEnd);
}

// Сравнение текущего месяца с предыдущим за схожий период
export function compareCurrentMonthWithPreviousAdjusted(drinks: Drink[]): ReturnType<typeof comparePeriods> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonthStart = startOfMonth(today);
  const currentDayOfMonth = today.getDate();
  
  // Текущий месяц: с начала до текущего дня включительно
  const currentMonthEnd = new Date(today);
  
  // Предыдущий месяц: с начала до того же дня месяца
  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousMonthStart = startOfMonth(previousMonth);
  
  // Определяем последний день предыдущего месяца
  const lastDayOfPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  const dayToCompare = Math.min(currentDayOfMonth, lastDayOfPreviousMonth);
  
  const previousMonthEnd = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), dayToCompare);
  
  return comparePeriods(drinks, previousMonthStart, previousMonthEnd, currentMonthStart, currentMonthEnd);
}

// Сравнение текущего года с предыдущим за одинаковый период (1 янв — сегодня vs 1 янв — тот же день в прошлом году)
export function compareCurrentYearWithPrevious(drinks: Drink[]): ReturnType<typeof comparePeriods> {
  const today = new Date();
  const currentYear = today.getFullYear();
  const previousYear = currentYear - 1;

  const currentYearStart = new Date(currentYear, 0, 1);
  const currentYearEnd = new Date(today); // сегодня включительно

  const previousYearStart = new Date(previousYear, 0, 1);
  const previousYearEnd = new Date(previousYear, today.getMonth(), today.getDate()); // тот же день и месяц в прошлом году

  return comparePeriods(drinks, previousYearStart, previousYearEnd, currentYearStart, currentYearEnd);
}

