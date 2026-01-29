import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getRecords, compareCurrentWeekWithPrevious, compareCurrentMonthWithPreviousAdjusted } from '../utils/stats';
import { Drink } from '../types/drink';

// В Expo Go (SDK 53+) expo-notifications на Android удалён — не подключаем модуль вообще, чтобы не было ошибки
const isExpoGo = Constants.executionEnvironment === 'storeClient';
let Notifications: typeof import('expo-notifications') | null = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch {
    // Модуль недоступен — уведомления отключены
  }
}

function getNotifications(): typeof import('expo-notifications') | null {
  return Notifications;
}

function ensureNotificationHandler(): void {
  const N = getNotifications();
  if (N) {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        priority: N.AndroidNotificationPriority.DEFAULT,
      }),
    });
  }
}

const MILESTONE_DAYS = [7, 30, 60, 90, 180, 365] as const;
const MILESTONE_TITLES: Record<number, string> = {
  7: 'Неделя без алкоголя! 🎉',
  30: 'Месяц без алкоголя! 🏆',
  60: '2 месяца без алкоголя! 🌟',
  90: '3 месяца без алкоголя! 💪',
  180: 'Полгода без алкоголя! 👑',
  365: 'Год без алкоголя! 🎊',
};
const MILESTONE_BODIES: Record<number, string> = {
  7: 'Поздравляем! Целых 7 дней. Так держать!',
  30: 'Целый месяц! Вы отлично справляетесь.',
  60: 'Два месяца подряд. Невероятный результат!',
  90: 'Три месяца без алкоголя. Вы молодец!',
  180: 'Полгода! Ваше здоровье благодарит вас.',
  365: 'Целый год! Это огромное достижение.',
};

const STORAGE_MILESTONES = 'notif_milestones_sent_v1';
const STORAGE_TREND_WEEK_COOLDOWN = 'notif_trend_week_cooldown_v1';
const STORAGE_TREND_MONTH_COOLDOWN = 'notif_trend_month_cooldown_v1';
const TREND_WEEK_COOLDOWN_DAYS = 7;
const TREND_MONTH_COOLDOWN_DAYS = 14;
const TREND_THRESHOLD_PERCENT = 20;
const MONTH_MIN_DAYS = 7; // не уведомляем по месяцу, пока не прошло 7 дней

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const N = getNotifications();
  if (!N) return false;
  ensureNotificationHandler();
  const { status: existing } = await N.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await N.requestPermissionsAsync();
  return status === 'granted';
}

async function getMilestonesSent(): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_MILESTONES);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

async function setMilestoneSent(days: number): Promise<void> {
  const sent = await getMilestonesSent();
  sent.add(days);
  await AsyncStorage.setItem(STORAGE_MILESTONES, JSON.stringify([...sent]));
}

async function getTrendCooldownEnd(key: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return parseInt(raw, 10);
  } catch {
    return null;
  }
}

async function setTrendCooldown(key: string, days: number): Promise<void> {
  const end = Date.now() + days * 24 * 60 * 60 * 1000;
  await AsyncStorage.setItem(key, String(end));
}

async function sendLocalNotification(title: string, body: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const N = getNotifications();
  if (!N) return;
  try {
    await N.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: { seconds: 2 },
    });
  } catch (e) {
    console.warn('[notifications] sendLocalNotification failed:', e);
  }
}

/** Проверяет вехи (7, 30, 60, 90, 180, 365 дней) и отправляет поздравление один раз на веху */
export async function checkMilestoneNotifications(drinks: Drink[]): Promise<void> {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const { currentStreak } = getRecords(drinks);
  if (currentStreak <= 0) return;

  const sent = await getMilestonesSent();
  for (const days of MILESTONE_DAYS) {
    if (currentStreak >= days && !sent.has(days)) {
      const title = MILESTONE_TITLES[days] ?? `${days} дней без алкоголя!`;
      const body = MILESTONE_BODIES[days] ?? 'Поздравляем с достижением!';
      await sendLocalNotification(title, body);
      await setMilestoneSent(days);
      break;
    }
  }
}

const formatUnits = (u: number) => (u >= 10 ? u.toFixed(0) : u.toFixed(1));
const daysWord = (n: number) => (n === 1 ? 'день' : n < 5 ? 'дня' : 'дней');

function buildTrendBody(
  prevUnits: number,
  prevDays: number,
  currUnits: number,
  currDays: number,
  pct: number,
  isImprovement: boolean
): string {
  const was = `было ${formatUnits(prevUnits)} ед. за ${prevDays} ${daysWord(prevDays)}`;
  const now = `стало ${formatUnits(currUnits)} ед. за ${currDays} ${daysWord(currDays)}`;
  const tail = isImprovement
    ? `Минус ${Math.abs(pct).toFixed(0)}%. Так держать!`
    : `Плюс ${pct.toFixed(0)}%. Можно чуть сбавить.`;
  return `Потребление алкоголя ${isImprovement ? 'снизилось' : 'выросло'}: ${was}, ${now}. ${tail}`;
}

/** Тренд по неделе: эта неделя vs прошлая. Кулдаун 7 дней. */
export async function checkTrendWeekNotification(drinks: Drink[]): Promise<void> {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const cooldownEnd = await getTrendCooldownEnd(STORAGE_TREND_WEEK_COOLDOWN);
  if (cooldownEnd != null && Date.now() < cooldownEnd) return;

  const { period1, period2, change } = compareCurrentWeekWithPrevious(drinks);
  const prevUnits = period1.totalUnits;
  const currUnits = period2.totalUnits;
  const pct = change.unitsPercent;
  const prevDays = period1.daysWithDrinks;
  const currDays = period2.daysWithDrinks;

  if (prevUnits === 0 && currUnits === 0) return;

  if (prevUnits > 0 && pct <= -TREND_THRESHOLD_PERCENT) {
    await sendLocalNotification(
      'На этой неделе вы пили меньше 🍃',
      buildTrendBody(prevUnits, prevDays, currUnits, currDays, pct, true)
    );
    await setTrendCooldown(STORAGE_TREND_WEEK_COOLDOWN, TREND_WEEK_COOLDOWN_DAYS);
  } else if (currUnits > prevUnits && pct >= TREND_THRESHOLD_PERCENT) {
    await sendLocalNotification(
      'На этой неделе вы пили больше',
      buildTrendBody(prevUnits, prevDays, currUnits, currDays, pct, false)
    );
    await setTrendCooldown(STORAGE_TREND_WEEK_COOLDOWN, TREND_WEEK_COOLDOWN_DAYS);
  }
}

/** Тренд по месяцу: этот месяц (за те же дни) vs прошлый месяц. Кулдаун 14 дней. Считаем только после 7 дней месяца. */
export async function checkTrendMonthNotification(drinks: Drink[]): Promise<void> {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const dayOfMonth = new Date().getDate();
  if (dayOfMonth < MONTH_MIN_DAYS) return;

  const cooldownEnd = await getTrendCooldownEnd(STORAGE_TREND_MONTH_COOLDOWN);
  if (cooldownEnd != null && Date.now() < cooldownEnd) return;

  const { period1, period2, change } = compareCurrentMonthWithPreviousAdjusted(drinks);
  const prevUnits = period1.totalUnits;
  const currUnits = period2.totalUnits;
  const pct = change.unitsPercent;
  const prevDays = period1.daysWithDrinks;
  const currDays = period2.daysWithDrinks;

  if (prevUnits === 0 && currUnits === 0) return;

  if (prevUnits > 0 && pct <= -TREND_THRESHOLD_PERCENT) {
    await sendLocalNotification(
      'В этом месяце вы пили меньше, чем в прошлом 🍃',
      buildTrendBody(prevUnits, prevDays, currUnits, currDays, pct, true)
    );
    await setTrendCooldown(STORAGE_TREND_MONTH_COOLDOWN, TREND_MONTH_COOLDOWN_DAYS);
  } else if (currUnits > prevUnits && pct >= TREND_THRESHOLD_PERCENT) {
    await sendLocalNotification(
      'В этом месяце вы пили больше, чем в прошлом',
      buildTrendBody(prevUnits, prevDays, currUnits, currDays, pct, false)
    );
    await setTrendCooldown(STORAGE_TREND_MONTH_COOLDOWN, TREND_MONTH_COOLDOWN_DAYS);
  }
}

/** Все проверки трендов (неделя + месяц). */
export async function checkTrendNotification(drinks: Drink[]): Promise<void> {
  await checkTrendWeekNotification(drinks);
  await checkTrendMonthNotification(drinks);
}

/** Вызывать при открытии приложения (например, с TodayScreen): проверяет вехи и тренд */
export async function runNotificationChecks(drinks: Drink[]): Promise<void> {
  await checkMilestoneNotifications(drinks);
  await checkTrendNotification(drinks);
}
