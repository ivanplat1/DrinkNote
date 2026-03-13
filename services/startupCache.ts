import { getAllDrinks } from '../storage/drinks';
import { getDailyGoal, getLethalDose, getAppStartDate } from '../storage/settings';
import { getCalendarLabels, getCalendarLabelRanges } from '../storage/calendarLabels';
import { getStreakGoal } from '../storage/streakGoal';
import { isPremiumUser } from '../storage/premium';
import type { Drink } from '../types/drink';
import type { LabelRange } from '../storage/calendarLabels';

export type StartupSnapshot = {
  allDrinks: Drink[];
  dailyGoal: number | null;
  lethalDose: number;
  appStartDate: string | null;
  labelsMap: Record<string, { text: string; color: string }[]>;
  labelRanges: LabelRange[];
  streakGoal: number | null;
  isPremium: boolean;
};

let snapshot: StartupSnapshot | null = null;
let preloadPromise: Promise<StartupSnapshot> | null = null;

export async function preloadStartupSnapshot(): Promise<StartupSnapshot> {
  if (snapshot) return snapshot;
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    const [
      allDrinks,
      dailyGoal,
      lethalDose,
      appStartDate,
      labelsMap,
      labelRanges,
      streakGoal,
      premium,
    ] = await Promise.all([
      getAllDrinks(),
      getDailyGoal(),
      getLethalDose(),
      getAppStartDate(),
      getCalendarLabels(),
      getCalendarLabelRanges(),
      getStreakGoal(),
      isPremiumUser(),
    ]);

    snapshot = {
      allDrinks,
      dailyGoal,
      lethalDose,
      appStartDate,
      labelsMap,
      labelRanges,
      streakGoal,
      isPremium: premium,
    };
    return snapshot;
  })();

  try {
    return await preloadPromise;
  } finally {
    preloadPromise = null;
  }
}

export function getStartupSnapshot(): StartupSnapshot | null {
  return snapshot;
}

