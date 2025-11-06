import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getAllDrinks } from '../storage/drinks';
import { Drink } from '../types/drink';
import { colors } from '../theme/colors';
import { formatTotalVolume } from '../utils/units';
import {
  getOverallStats,
  getWeekStats,
  getMonthStats,
  getLastNWeeks,
  getLastNMonths,
  startOfWeek,
  startOfMonth,
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

  // Данные для графика (последние 8 недель или месяцев)
  const chartData = useMemo(() => {
    if (period === 'week') {
      return getLastNWeeks(allDrinks, 8);
    } else if (period === 'month') {
      return getLastNMonths(allDrinks, 8);
    }
    return [];
  }, [allDrinks, period]);

  const maxChartValue = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map(d => d.stats.totalUnits), 1);
  }, [chartData]);

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
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Статистика</Text>

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
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{currentStats.averagePerDay.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Среднее в день</Text>
            </View>
          </View>
        </View>

        {/* График тренда */}
        {chartData.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Тренд ({period === 'week' ? 'недели' : 'месяцы'})</Text>
            <View style={styles.chartContainer}>
              {chartData.map((item, index) => {
                const height = maxChartValue > 0 ? (item.stats.totalUnits / maxChartValue) * 100 : 0;
                return (
                  <View key={index} style={styles.chartBarContainer}>
                    <View style={styles.chartBarWrapper}>
                      <View style={[styles.chartBar, { height: `${height}%` }]} />
                    </View>
                    <Text style={styles.chartLabel}>
                      {period === 'week' 
                        ? `Н${index + 1}`
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
    marginBottom: 24,
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
});
