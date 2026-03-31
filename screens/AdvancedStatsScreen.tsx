import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Animated from 'react-native-reanimated';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getAllDrinks } from '../storage/drinks';
import { Drink } from '../types/drink';
import { colors as defaultColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { formatTotalVolume } from '../utils/units';
import { useI18n } from '../i18n/I18nContext';
import {
  getMonthlyTrend,
  getWeeklyTrend,
  getDetailedWeekdayAnalytics,
  getStreakProgression,
  compareCurrentMonthWithPrevious,
  compareCurrentYearWithPrevious,
  startOfMonth,
} from '../utils/stats';
import { isPremiumUser } from '../storage/premium';

export default function AdvancedStatsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, tf } = useI18n();
  const [allDrinks, setAllDrinks] = useState<Drink[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState<'weeks' | 'months'>('months');

  const loadDrinks = useCallback(async () => {
    const drinks = await getAllDrinks();
    setAllDrinks(drinks);
  }, []);

  const checkPremium = useCallback(async () => {
    const premium = await isPremiumUser();
    setIsPremium(premium);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDrinks();
      checkPremium();
    }, [loadDrinks, checkPremium])
  );

  // Данные для графиков
  const monthlyTrend = useMemo(() => getMonthlyTrend(allDrinks, 12), [allDrinks]);
  const weeklyTrend = useMemo(() => getWeeklyTrend(allDrinks, 12), [allDrinks]);
  const weekdayAnalytics = useMemo(() => getDetailedWeekdayAnalytics(allDrinks), [allDrinks]);
  const streakProgression = useMemo(() => getStreakProgression(allDrinks), [allDrinks]);
  const monthComparison = useMemo(() => compareCurrentMonthWithPrevious(allDrinks), [allDrinks]);
  const yearComparison = useMemo(() => compareCurrentYearWithPrevious(allDrinks), [allDrinks]);

  const trendData = trendPeriod === 'months' ? monthlyTrend : weeklyTrend;
  const maxTrendValue = useMemo(() => {
    if (trendData.length === 0) return 1;
    return Math.max(...trendData.map(d => d.totalUnits), 1);
  }, [trendData]);

  // Генерируем значения для шкалы Y (5 делений) - от максимума вверху до 0 внизу
  const yAxisValues = useMemo(() => {
    if (maxTrendValue <= 0) return [0];
    const step = maxTrendValue / 4;
    return [maxTrendValue, step * 3, step * 2, step, 0].map(v => Math.round(v * 10) / 10);
  }, [maxTrendValue]);

  if (!isPremium) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <View style={styles.lockedContainer}>
          <MaterialCommunityIcons name="lock" size={64} color={colors.textSecondary} />
          <Text style={[styles.lockedTitle, { color: colors.text }]}>{t('premium.features.advancedStatsTitle')}</Text>
          <Text style={[styles.lockedText, { color: colors.textSecondary }]}>
            {t('premium.notAvailable')}
          </Text>
          <TouchableOpacity
            style={[styles.premiumButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Premium' as never)}
          >
            <MaterialCommunityIcons name="crown" size={20} color="#f4c430" />
            <Text style={styles.premiumButtonText}>{t('premium.buy')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Animated.ScrollView style={[styles.scrollView, { backgroundColor: colors.background }]} contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]} directionalLockEnabled scrollEventThrottle={32}>
        {/* Переключатель периода тренда */}
        <View style={[styles.periodSelector, { backgroundColor: colors.backgroundSecondary }]}>
          <TouchableOpacity
            style={[styles.periodButton, trendPeriod === 'months' && styles.periodButtonActive, trendPeriod === 'months' && { backgroundColor: colors.primary }]}
            onPress={() => setTrendPeriod('months')}
          >
            <Text style={[styles.periodButtonText, trendPeriod === 'months' && styles.periodButtonTextActive, { color: trendPeriod === 'months' ? '#fff' : colors.textSecondary }]}>
              {t('advancedStats.byMonths')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, trendPeriod === 'weeks' && styles.periodButtonActive, trendPeriod === 'weeks' && { backgroundColor: colors.primary }]}
            onPress={() => setTrendPeriod('weeks')}
          >
            <Text style={[styles.periodButtonText, trendPeriod === 'weeks' && styles.periodButtonTextActive, { color: trendPeriod === 'weeks' ? '#fff' : colors.textSecondary }]}>
              {t('advancedStats.byWeeks')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* График тренда */}
        {trendData.length > 0 && (
          <View style={[styles.chartCard, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>
              {tf('advancedStats.trendTitle', { n: 12, unit: trendPeriod === 'months' ? t('advancedStats.unitMonths12') : t('advancedStats.unitWeeks12') })}
            </Text>
            <View style={styles.chartWithAxis}>
              {/* Шкала Y */}
              <View style={styles.yAxis}>
                {yAxisValues.map((value, index) => (
                  <Text key={index} style={[styles.yAxisLabel, { color: colors.textSecondary }]}>
                    {value === 0 ? '0' : value.toFixed(value >= 10 ? 0 : 1)}
                  </Text>
                ))}
              </View>
              {/* График */}
              <View style={styles.lineChartContainer}>
                {trendData.map((item, index) => {
                  const height = maxTrendValue > 0 ? (item.totalUnits / maxTrendValue) * 100 : 0;
                  // Для месяцев используем номер месяца вместо названия
                  // Для недель показываем номер недели (1-12)
                  const labelText = trendPeriod === 'months'
                    ? `${item.month.getMonth() + 1}`
                    : `${index + 1}`;
                  
                  return (
                    <View key={index} style={styles.lineChartBar}>
                      <View style={[styles.lineChartBarFill, { height: `${height}%`, backgroundColor: colors.primary }]} />
                      <Text style={[styles.lineChartLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                        {labelText}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Сравнение периодов */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('advancedStats.periodComparison')}</Text>

          {/* Текущий месяц vs предыдущий */}
          <View style={[styles.comparisonCard, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.comparisonTitle, { color: colors.text }]}>{t('advancedStats.currentMonthVsPrev')}</Text>
            <View style={styles.comparisonRow}>
              <View style={styles.comparisonItem}>
                <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>{t('advancedStats.previous')}</Text>
                <Text style={[styles.comparisonValue, { color: colors.text }]}>
                  {monthComparison.period1.totalUnits.toFixed(1)} ед.
                </Text>
                <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                  {monthComparison.period1.daysWithDrinks} дней
                </Text>
              </View>
              <View style={styles.comparisonArrow}>
                <MaterialIcons
                  name={monthComparison.change.units >= 0 ? 'arrow-forward' : 'arrow-back'}
                  size={24}
                  color={monthComparison.change.units >= 0 ? colors.error : colors.primary}
                />
              </View>
              <View style={styles.comparisonItem}>
                <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>{t('advancedStats.current')}</Text>
                <Text style={[styles.comparisonValue, { color: colors.text }]}>
                  {monthComparison.period2.totalUnits.toFixed(1)} ед.
                </Text>
                <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                  {monthComparison.period2.daysWithDrinks} дней
                </Text>
              </View>
            </View>
            <View style={styles.comparisonChange}>
              <Text
                style={[
                  styles.comparisonChangeText,
                  monthComparison.change.unitsPercent >= 0
                    ? [styles.comparisonChangePositive, { color: colors.error }]
                    : [styles.comparisonChangeNegative, { color: colors.primary }],
                ]}
              >
                {monthComparison.change.unitsPercent >= 0 ? '+' : ''}
                {monthComparison.change.unitsPercent.toFixed(1)}%
              </Text>
            </View>
          </View>

          {/* Текущий год vs предыдущий (за одинаковый период: 1 янв — сегодня) */}
          <View style={[styles.comparisonCard, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.comparisonTitle, { color: colors.text }]}>{t('advancedStats.currentYearVsPrev')}</Text>
            <View style={styles.comparisonRow}>
              <View style={styles.comparisonItem}>
                <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>{t('advancedStats.previous')}</Text>
                <Text style={[styles.comparisonValue, { color: colors.text }]}>
                  {yearComparison.period1.totalUnits.toFixed(1)} ед.
                </Text>
                <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                  {yearComparison.period1.daysWithDrinks} дней
                </Text>
              </View>
              <View style={styles.comparisonArrow}>
                <MaterialIcons
                  name={yearComparison.change.units >= 0 ? 'arrow-forward' : 'arrow-back'}
                  size={24}
                  color={yearComparison.change.units >= 0 ? colors.error : colors.primary}
                />
              </View>
              <View style={styles.comparisonItem}>
                <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>{t('advancedStats.current')}</Text>
                <Text style={[styles.comparisonValue, { color: colors.text }]}>
                  {yearComparison.period2.totalUnits.toFixed(1)} ед.
                </Text>
                <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                  {yearComparison.period2.daysWithDrinks} дней
                </Text>
              </View>
            </View>
            <View style={styles.comparisonChange}>
              <Text
                style={[
                  styles.comparisonChangeText,
                  yearComparison.change.unitsPercent >= 0
                    ? [styles.comparisonChangePositive, { color: colors.error }]
                    : [styles.comparisonChangeNegative, { color: colors.primary }],
                ]}
              >
                {yearComparison.change.unitsPercent >= 0 ? '+' : ''}
                {yearComparison.change.unitsPercent.toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Детальная аналитика по дням недели */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Аналитика по дням недели</Text>
          <View style={[styles.analyticsCard, { backgroundColor: colors.backgroundCard }]}>
            {weekdayAnalytics.map((day) => (
              <View key={day.weekday} style={[styles.analyticsRow, { borderBottomColor: colors.border }]}>
                <View style={styles.analyticsDay}>
                  <Text style={[styles.analyticsDayName, { color: colors.text }]}>{day.weekdayName}</Text>
                  {day.trend === 'increasing' && (
                    <MaterialIcons name="trending-up" size={16} color={colors.error} />
                  )}
                  {day.trend === 'decreasing' && (
                    <MaterialIcons name="trending-down" size={16} color={colors.primary} />
                  )}
                </View>
                <View style={styles.analyticsValues}>
                  <Text style={[styles.analyticsValue, { color: colors.text }]}>{day.averageUnits.toFixed(1)} ед.</Text>
                  <Text style={[styles.analyticsSubtext, { color: colors.textSecondary }]}>
                    {day.daysCount} дней · {day.percentageOfTotal.toFixed(1)}% от общего
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Прогрессия серий */}
        {streakProgression.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Прогрессия серий воздержания</Text>
            <View style={[styles.streaksCard, { backgroundColor: colors.backgroundCard }]}>
              {streakProgression.slice(0, 5).map((streak, index) => (
                <View key={index} style={[styles.streakRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.streakInfo}>
                    <Text style={[styles.streakLength, { color: colors.text }]}>{streak.length} дней</Text>
                    <Text style={[styles.streakDates, { color: colors.textSecondary }]}>
                      {new Date(streak.streakStart).toLocaleDateString('ru-RU')} -{' '}
                      {new Date(streak.streakEnd).toLocaleDateString('ru-RU')}
                    </Text>
                  </View>
                  {!streak.completed && (
                    <View style={[styles.streakBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.streakBadgeText}>Текущая</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultColors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: defaultColors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  lockedText: {
    fontSize: 16,
    color: defaultColors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  premiumButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: defaultColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  premiumButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: defaultColors.backgroundSecondary,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: defaultColors.primary,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: defaultColors.textSecondary,
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  chartCard: {
    backgroundColor: defaultColors.backgroundCard,
    borderRadius: 12,
    padding: 16,
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
    fontSize: 18,
    fontWeight: '700',
    color: defaultColors.text,
    marginBottom: 16,
  },
  chartWithAxis: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  yAxis: {
    width: 40,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 8,
    paddingBottom: 20,
  },
  yAxisLabel: {
    fontSize: 10,
    color: defaultColors.textSecondary,
    textAlign: 'right',
  },
  lineChartContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 200,
    gap: 4,
  },
  lineChartBar: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  lineChartBarFill: {
    width: '100%',
    backgroundColor: defaultColors.primary,
    borderRadius: 4,
    minHeight: 2,
  },
  lineChartLabel: {
    fontSize: 9,
    color: defaultColors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: defaultColors.text,
    marginBottom: 12,
  },
  comparisonCard: {
    backgroundColor: defaultColors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  comparisonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: defaultColors.text,
    marginBottom: 12,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  comparisonItem: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 12,
    color: defaultColors.textSecondary,
    marginBottom: 4,
  },
  comparisonValue: {
    fontSize: 20,
    fontWeight: '700',
    color: defaultColors.text,
  },
  comparisonSubtext: {
    fontSize: 11,
    color: defaultColors.textTertiary,
    marginTop: 2,
  },
  comparisonArrow: {
    paddingHorizontal: 12,
  },
  comparisonChange: {
    marginTop: 12,
    alignItems: 'center',
  },
  comparisonChangeText: {
    fontSize: 18,
    fontWeight: '700',
  },
  comparisonChangePositive: {
    color: defaultColors.error,
  },
  comparisonChangeNegative: {
    color: defaultColors.primary,
  },
  analyticsCard: {
    backgroundColor: defaultColors.backgroundCard,
    borderRadius: 12,
    padding: 12,
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
  analyticsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: defaultColors.border,
  },
  analyticsDay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  analyticsDayName: {
    fontSize: 15,
    fontWeight: '600',
    color: defaultColors.text,
  },
  analyticsValues: {
    alignItems: 'flex-end',
  },
  analyticsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: defaultColors.text,
  },
  analyticsSubtext: {
    fontSize: 11,
    color: defaultColors.textSecondary,
    marginTop: 2,
  },
  streaksCard: {
    backgroundColor: defaultColors.backgroundCard,
    borderRadius: 12,
    padding: 12,
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
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: defaultColors.border,
  },
  streakInfo: {
    flex: 1,
  },
  streakLength: {
    fontSize: 16,
    fontWeight: '700',
    color: defaultColors.text,
  },
  streakDates: {
    fontSize: 12,
    color: defaultColors.textSecondary,
    marginTop: 2,
  },
  streakBadge: {
    backgroundColor: defaultColors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  streakBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
});
