import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { getAllDrinks, getDrinksByDate } from '../storage/drinks';
import { getRecords } from '../utils/stats';
import { getUserPresets } from '../storage/presets';
import { formatISO } from '../utils/date';
import { StreakWidget } from '../widgets/StreakWidget';
import { FavoritesWidget } from '../widgets/FavoritesWidget';

/** Update the Streak home screen widget with current data. No-op on non-Android. */
export async function updateStreakWidget(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await requestWidgetUpdate({
      widgetName: 'Streak',
      renderWidget: async (_info) => {
        const drinks = await getAllDrinks();
        const { currentStreak, longestStreak } = getRecords(drinks);
        return <StreakWidget currentStreak={currentStreak} bestStreak={longestStreak} />;
      },
    });
  } catch {
    // Widget may not be on home screen or library not available (e.g. Expo Go)
  }
}

/** Update the Favorites (today + presets) home screen widget. No-op on non-Android. */
export async function updateFavoritesWidget(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await requestWidgetUpdate({
      widgetName: 'Favorites',
      renderWidget: async (_info) => {
        const [presets, todayDrinks] = await Promise.all([
          getUserPresets(),
          getDrinksByDate(formatISO(new Date())),
        ]);
        return <FavoritesWidget presets={presets} todayDrinks={todayDrinks} />;
      },
    });
  } catch {
    // Widget may not be on home screen or library not available (e.g. Expo Go)
  }
}

/** Update all home screen widgets. */
export async function updateAllWidgets(): Promise<void> {
  await updateStreakWidget();
  await updateFavoritesWidget();
}
