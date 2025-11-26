import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getAllDrinks } from '../storage/drinks';
import { Drink } from '../types/drink';
import { colors } from '../theme/colors';
import { formatTotalVolume } from '../utils/units';
import { WEEKDAY_SHORT_RU } from '../utils/date';
import {
  getOverallStats,
  getWeekStats,
  getMonthStats,
  getLastNWeeks,
  getLastNMonths,
  startOfWeek,
  startOfMonth,
  getBeverageTypeStats,
  getWeekdayStats,
  getRecords,
  getTopDrinks,
  getWeekDaysStats,
} from '../utils/stats';

type PeriodType = 'overall' | 'week' | 'month';

export default function StatsScreen() {
  const [allDrinks, setAllDrinks] = useState<Drink[]>([]);
  const [period, setPeriod] = useState<PeriodType>('overall');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const loadDrinks = useCallback(async () => {
    const drinks = await getAllDrinks();
    setAllDrinks(drinks);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDrinks();
    }, [loadDrinks])
  );

  const overallStats = useMemo(() => getOverallStats(allDrinks), [allDrinks]);
  const weekStats = useMemo(() => getWeekStats(allDrinks, selectedDate), [allDrinks, selectedDate]);
  const monthStats = useMemo(() => getMonthStats(allDrinks, selectedDate), [allDrinks, selectedDate]);

  const currentStats = period === 'overall' ? overallStats : period === 'week' ? weekStats : monthStats;

  // Новая статистика (только для общей статистики)
  const beverageTypeStats = useMemo(() => getBeverageTypeStats(allDrinks), [allDrinks]);
  const weekdayStats = useMemo(() => getWeekdayStats(allDrinks), [allDrinks]);
  const records = useMemo(() => getRecords(allDrinks), [allDrinks]);
  const topDrinks = useMemo(() => getTopDrinks(allDrinks, 5), [allDrinks]);

  // Максимальное значение для графика дней недели
  const maxWeekdayValue = useMemo(() => {
    if (weekdayStats.length === 0) return 1;
    return Math.max(...weekdayStats.map(d => d.averageUnits), 1);
  }, [weekdayStats]);

  // Данные для графика (дни выбранной недели или последние 8 месяцев)
  const chartData = useMemo(() => {
    if (period === 'week') {
      return getWeekDaysStats(allDrinks, selectedDate);
    } else if (period === 'month') {
      return getLastNMonths(allDrinks, 8);
    }
    return [];
  }, [allDrinks, period, selectedDate]);

  const maxChartValue = useMemo(() => {
    if (chartData.length === 0) return 1;
    if (period === 'week') {
      return Math.max(...chartData.map(d => d.units), 1);
    } else {
      return Math.max(...chartData.map(d => d.stats.totalUnits), 1);
    }
  }, [chartData, period]);

  const formatPeriodLabel = (date: Date, type: PeriodType): string => {
    if (type === 'week') {
      const start = startOfWeek(date);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.getDate()}-${end.getDate()} ${start.toLocaleDateString('ru-RU', { month: 'short' })}`;
    } else if (type === 'month') {
      return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    }
    return '';
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Выбор периода */}
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[styles.periodButton, period === 'overall' && styles.periodButtonActive]}
            onPress={() => setPeriod('overall')}
          >
            <Text style={[styles.periodButtonText, period === 'overall' && styles.periodButtonTextActive]}>
              Общая
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, period === 'week' && styles.periodButtonActive]}
            onPress={() => setPeriod('week')}
          >
            <Text style={[styles.periodButtonText, period === 'week' && styles.periodButtonTextActive]}>
              Неделя
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, period === 'month' && styles.periodButtonActive]}
            onPress={() => setPeriod('month')}
          >
            <Text style={[styles.periodButtonText, period === 'month' && styles.periodButtonTextActive]}>
              Месяц
            </Text>
          </TouchableOpacity>
        </View>

        {/* Навигация по периодам */}
        {period !== 'overall' && (
          <View style={styles.periodNavigation}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => {
                const newDate = new Date(selectedDate);
                if (period === 'week') {
                  newDate.setDate(newDate.getDate() - 7);
                } else {
                  newDate.setMonth(newDate.getMonth() - 1);
                }
                setSelectedDate(newDate);
              }}
            >
              <MaterialIcons name="chevron-left" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.periodLabel}>{formatPeriodLabel(selectedDate, period)}</Text>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => {
                const newDate = new Date(selectedDate);
                if (period === 'week') {
                  newDate.setDate(newDate.getDate() + 7);
                } else {
                  newDate.setMonth(newDate.getMonth() + 1);
                }
                // Не позволяем выбирать будущие периоды
                const today = new Date();
                if (newDate <= today) {
                  setSelectedDate(newDate);
                }
              }}
            >
              <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Основная статистика */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{currentStats.totalUnits.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Стандартных единиц</Text>
              <Text style={styles.statSubLabel}>{(currentStats.totalUnits * 10).toFixed(1)} г спирта</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatTotalVolume(currentStats.totalVolumeMl, 1)}</Text>
              <Text style={styles.statLabel}>Объем</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{currentStats.daysWithDrinks || currentStats.totalDays}</Text>
              <Text style={styles.statLabel}>Дней с записями</Text>
              {period !== 'overall' && (
                <Text style={styles.statSubLabel}>
                  {period === 'week' 
                    ? `${Math.round(((currentStats.daysWithDrinks || 0) / 7) * 100)}% недели`
                    : period === 'month' 
                    ? `${Math.round(((currentStats.daysWithDrinks || 0) / new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate()) * 100)}% месяца`
                    : ''
                  }
                </Text>
              )}
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{currentStats.averagePerDay.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Среднее в день</Text>
              <Text style={styles.statSubLabel}>{(currentStats.averagePerDay * 10).toFixed(1)} г спирта</Text>
            </View>
          </View>
        </View>

        {/* График тренда */}
        {chartData.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Тренд ({period === 'week' ? 'дни недели' : 'месяцы'})</Text>
            <View style={styles.chartContainer}>
              {chartData.map((item, index) => {
                const height = period === 'week' 
                  ? (maxChartValue > 0 ? (item.units / maxChartValue) * 100 : 0)
                  : (maxChartValue > 0 ? (item.stats.totalUnits / maxChartValue) * 100 : 0);
                return (
                  <View key={index} style={styles.chartBarContainer}>
                    <View style={styles.chartBarWrapper}>
                      <View style={[styles.chartBar, { height: `${height}%` }]} />
                    </View>
                    <Text style={styles.chartLabel}>
                      {period === 'week' 
                        ? WEEKDAY_SHORT_RU[index]
                        : item.month.toLocaleDateString('ru-RU', { month: 'short' })
                      }
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Дополнительная информация для общей статистики */}
        {period === 'overall' && overallStats.firstDate && overallStats.lastDate && (
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Период: {new Date(overallStats.firstDate).toLocaleDateString('ru-RU')} - {new Date(overallStats.lastDate).toLocaleDateString('ru-RU')}
            </Text>
          </View>
        )}

        {/* Статистика по типам напитков (только для общей статистики) */}
        {period === 'overall' && beverageTypeStats.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>По типам напитков</Text>
            {beverageTypeStats.map((item, index) => {
              const typeColors = colors[item.type] || colors.other;
              const getTypeLabel = (type: Drink['beverageType']) => {
                const labels: Record<Drink['beverageType'], string> = {
                  beer: 'Пиво',
                  wine: 'Вино',
                  spirit: 'Крепкие',
                  cocktail: 'Коктейли',
                  other: 'Другое',
                };
                return labels[type];
              };
              return (
                <View key={item.type} style={styles.typeRow}>
                  <View style={styles.typeLabelRow}>
                    <View style={[styles.typeColorDot, { backgroundColor: typeColors.main }]} />
                    <Text style={styles.typeLabel}>{getTypeLabel(item.type)}</Text>
                  </View>
                  <View style={styles.typeStatsRow}>
                    <Text style={styles.typePercentage}>{item.percentage}%</Text>
                    <View style={styles.typeUnitsContainer}>
                      <Text style={styles.typeUnits}>{item.totalUnits.toFixed(1)} ед.</Text>
                      <Text style={styles.typeUnitsSub}>{Math.round(item.totalUnits * 10)} г</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* График по дням недели (только для общей статистики) */}
        {period === 'overall' && weekdayStats.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>По дням недели (среднее)</Text>
            <View style={styles.chartContainer}>
              {weekdayStats.map((item) => {
                const height = maxWeekdayValue > 0 ? (item.averageUnits / maxWeekdayValue) * 100 : 0;
                return (
                  <View key={item.weekday} style={styles.chartBarContainer}>
                    <View style={styles.chartBarWrapper}>
                      <View style={[styles.chartBar, { height: `${height}%` }]} />
                    </View>
                    <Text style={styles.chartLabel}>{WEEKDAY_SHORT_RU[item.weekday]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Рекорды (только для общей статистики) */}
        {period === 'overall' && records.heaviestDay && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Рекорды</Text>
            <View style={styles.recordsRow}>
              <View style={styles.recordItem}>
                <Text style={styles.recordLabel}>Самый тяжелый день</Text>
                <Text style={styles.recordValue}>{records.heaviestDay.units.toFixed(2)} ед.</Text>
                <Text style={styles.recordSubValue}>{(records.heaviestDay.units * 10).toFixed(1)} г спирта</Text>
                <Text style={styles.recordDate}>
                  {new Date(records.heaviestDay.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
              {records.currentStreak > 0 && (
                <View style={styles.recordItem}>
                  <Text style={styles.recordLabel}>Дней без алкоголя</Text>
                  <Text style={styles.recordValue}>{records.currentStreak}</Text>
                  <Text style={styles.recordDate}>Текущая серия</Text>
                </View>
              )}
            </View>
            {records.longestStreak > 0 && (
              <View style={styles.recordsRow}>
                <View style={styles.recordItem}>
                  <Text style={styles.recordLabel}>Рекордная серия</Text>
                  <Text style={styles.recordValue}>{records.longestStreak} дней</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Топ напитков (только для общей статистики) */}
        {period === 'overall' && topDrinks.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Топ-5 напитков</Text>
            {topDrinks.map((drink, index) => {
              const typeColors = colors[drink.beverageType] || colors.other;
              return (
                <View key={`${drink.name}_${index}`} style={styles.topDrinkRow}>
                  <View style={styles.topDrinkRank}>
                    <Text style={styles.topDrinkRankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.topDrinkInfo}>
                    <Text style={styles.topDrinkName}>{drink.name}</Text>
                    <Text style={styles.topDrinkDetails}>
                      {drink.count} раз · {formatTotalVolume(drink.totalVolumeMl, 1)} · {drink.totalUnits.toFixed(1)} ед. ({Math.round(drink.totalUnits * 10)} г)
                    </Text>
                  </View>
                  <View style={[styles.topDrinkTypeDot, { backgroundColor: typeColors.main }]} />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 16,
    marginHorizontal: 16,
    color: colors.text,
    letterSpacing: -0.5,
  },
  periodSelector: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primary,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  periodButtonTextActive: {
    color: colors.text,
  },
  statsCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  periodNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  navButton: {
    padding: 8,
  },
  periodLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'capitalize',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statSubLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingHorizontal: 4,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
  },
  chartBarWrapper: {
    flex: 1,
    width: '80%',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  chartBar: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
    minHeight: 2,
  },
  chartLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  typeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  typeStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  typePercentage: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    minWidth: 50,
    textAlign: 'right',
  },
  typeUnitsContainer: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  typeUnits: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  typeUnitsSub: {
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'right',
    marginTop: 2,
  },
  recordsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  recordItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
  },
  recordLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  recordValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 2,
  },
  recordSubValue: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  topDrinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topDrinkRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  topDrinkRankText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  topDrinkInfo: {
    flex: 1,
  },
  topDrinkName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  topDrinkDetails: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  topDrinkTypeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
  },
});
