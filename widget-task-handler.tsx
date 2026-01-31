import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { getAllDrinks, getDrinksByDate, addOrMergeDrink } from './storage/drinks';
import { getRecords } from './utils/stats';
import { getUserPresets } from './storage/presets';
import { isPremiumUser } from './storage/premium';
import { calculateStandardUnits } from './utils/units';
import { formatISO } from './utils/date';
import type { Drink } from './types/drink';
import { StreakWidget } from './widgets/StreakWidget';
import { FavoritesWidget } from './widgets/FavoritesWidget';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetAction, widgetInfo, renderWidget } = props;

  if (widgetAction === 'WIDGET_DELETED') return;

  if (widgetInfo.widgetName === 'Streak') {
    const drinks = await getAllDrinks();
    const { currentStreak, longestStreak } = getRecords(drinks);
    switch (widgetAction) {
      case 'WIDGET_ADDED':
      case 'WIDGET_UPDATE':
      case 'WIDGET_RESIZED':
        renderWidget(
          <StreakWidget currentStreak={currentStreak} bestStreak={longestStreak} />
        );
        break;
      case 'WIDGET_CLICK':
        break;
      default:
        break;
    }
    return;
  }

  if (widgetInfo.widgetName === 'Favorites') {
    const getFavoritesWidgetData = async () => {
      const todayStr = formatISO(new Date());
      const [presets, todayDrinks] = await Promise.all([
        getUserPresets(),
        getDrinksByDate(todayStr),
      ]);
      return { presets, todayDrinks };
    };

    switch (widgetAction) {
      case 'WIDGET_ADDED':
      case 'WIDGET_UPDATE':
      case 'WIDGET_RESIZED': {
        const { presets, todayDrinks } = await getFavoritesWidgetData();
        renderWidget(<FavoritesWidget presets={presets} todayDrinks={todayDrinks} />);
        break;
      }
      case 'WIDGET_CLICK': {
        const clickAction = props.clickAction;
        const clickActionData = (props.clickActionData ?? {}) as Record<string, unknown>;
        if (clickAction === 'ADD_DRINK' && typeof clickActionData.presetId === 'string') {
          const presetId = clickActionData.presetId;
          const presets = await getUserPresets();
          const preset = presets.find((p) => p.id === presetId);
          if (preset) {
            const today = formatISO(new Date());
            const units = calculateStandardUnits(preset.volumeMl, preset.abvPercent);
            const isPremium = await isPremiumUser();
            const price = isPremium && preset.defaultPrice != null && preset.defaultPrice > 0 ? preset.defaultPrice : undefined;
            const entry: Drink = {
              id: `drink_${Date.now()}`,
              dateISO: today,
              name: preset.name,
              beverageType: preset.beverageType,
              volumeMl: preset.volumeMl,
              abvPercent: preset.abvPercent,
              standardUnits: units,
              quantity: 1,
              ...(price != null && { price }),
            };
            await addOrMergeDrink(entry);
          }
        }
        const { presets, todayDrinks } = await getFavoritesWidgetData();
        renderWidget(<FavoritesWidget presets={presets} todayDrinks={todayDrinks} />);
        break;
      }
      default:
        break;
    }
  }
}
