import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Drink } from '../types/drink';
import { useTheme } from '../theme/ThemeContext';
import { useCurrency } from '../theme/CurrencyContext';
import { formatPrice, formatPriceChart } from '../utils/currency';
import { colors as defaultColors } from '../theme/colors';
import {
  getMonthlyTrend,
  getWeeklyTrend,
  getBeverageTypeStats,
  getDetailedWeekdayAnalytics,
  getStreakProgression,
  compareCurrentWeekWithPrevious,
  compareCurrentWeekWithPreviousAdjusted,
  compareCurrentMonthWithPrevious,
  compareCurrentMonthWithPreviousAdjusted,
  compareCurrentYearWithPrevious,
} from '../utils/stats';

interface AdvancedStatsContentProps {
  allDrinks: Drink[];
}

export default function AdvancedStatsContent({ allDrinks }: AdvancedStatsContentProps) {
  const { colors } = useTheme();
  const { currency } = useCurrency();
  const [trendPeriod, setTrendPeriod] = useState<'weeks' | 'months'>('months');

  // Данные для графиков
  const monthlyTrend = useMemo(() => getMonthlyTrend(allDrinks, 12), [allDrinks]);
  const weeklyTrend = useMemo(() => getWeeklyTrend(allDrinks, 12), [allDrinks]);
  const weekdayAnalytics = useMemo(() => getDetailedWeekdayAnalytics(allDrinks), [allDrinks]);
  const streakProgression = useMemo(() => getStreakProgression(allDrinks), [allDrinks]);
  const weekComparison = useMemo(() => compareCurrentWeekWithPrevious(allDrinks), [allDrinks]);
  const weekComparisonAdjusted = useMemo(() => compareCurrentWeekWithPreviousAdjusted(allDrinks), [allDrinks]);
  const monthComparison = useMemo(() => compareCurrentMonthWithPrevious(allDrinks), [allDrinks]);
  const monthComparisonAdjusted = useMemo(() => compareCurrentMonthWithPreviousAdjusted(allDrinks), [allDrinks]);
  const yearComparison = useMemo(() => compareCurrentYearWithPrevious(allDrinks), [allDrinks]);

  const trendData = trendPeriod === 'months' ? monthlyTrend : weeklyTrend;
  const maxTrendValue = useMemo(() => {
    if (trendData.length === 0) return 1;
    return Math.max(...trendData.map(d => d.totalUnits), 1);
  }, [trendData]);

  const hasSpending = useMemo(() => trendData.some(d => d.totalSpent > 0), [trendData]);
  const maxSpentValue = useMemo(() => {
    if (!hasSpending || trendData.length === 0) return 1;
    return Math.max(...trendData.map(d => d.totalSpent), 1);
  }, [trendData, hasSpending]);

  const beverageTypeStats = useMemo(() => getBeverageTypeStats(allDrinks), [allDrinks]);
  const typeStatsWithSpending = useMemo(() => beverageTypeStats.filter(t => t.totalSpent > 0), [beverageTypeStats]);

  // Генерируем значения для шкалы Y (5 делений) - от максимума вверху до 0 внизу
  const yAxisValues = useMemo(() => {
    if (maxTrendValue <= 0) return [0];
    const step = maxTrendValue / 4;
    return [maxTrendValue, step * 3, step * 2, step, 0].map(v => Math.round(v * 10) / 10);
  }, [maxTrendValue]);

  const yAxisSpentValues = useMemo(() => {
    if (maxSpentValue <= 0) return [0];
    const step = maxSpentValue / 4;
    return [maxSpentValue, step * 3, step * 2, step, 0].map(v => Math.round(v * 10) / 10);
  }, [maxSpentValue]);

  return (
    <ScrollView style={[styles.scrollView, { backgroundColor: colors.background }]} contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]}>
      {/* Переключатель периода тренда (дочерние табы) */}
      <View style={[styles.periodSelector, { backgroundColor: colors.backgroundSecondary }]}>
        <TouchableOpacity
          style={[styles.periodButton, trendPeriod === 'months' && styles.periodButtonActive, trendPeriod === 'months' && { backgroundColor: colors.primary }]}
          onPress={() => setTrendPeriod('months')}
        >
          <Text style={[styles.periodButtonText, trendPeriod === 'months' && styles.periodButtonTextActive, { color: trendPeriod === 'months' ? '#fff' : colors.textSecondary }]}>
            По месяцам
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, trendPeriod === 'weeks' && styles.periodButtonActive, trendPeriod === 'weeks' && { backgroundColor: colors.primary }]}
          onPress={() => setTrendPeriod('weeks')}
        >
          <Text style={[styles.periodButtonText, trendPeriod === 'weeks' && styles.periodButtonTextActive, { color: trendPeriod === 'weeks' ? '#fff' : colors.textSecondary }]}>
            По неделям
          </Text>
        </TouchableOpacity>
      </View>

      {/* График тренда */}
      {trendData.length > 0 && (
        <View style={[styles.chartCard, { backgroundColor: colors.backgroundCard }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            Тренд ({trendPeriod === 'months' ? '12 месяцев' : '12 недель'})
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
                      <View style={styles.lineChartBarWrapper}>
                        <View style={[styles.lineChartBarFill, { height: `${height}%`, backgroundColor: colors.primary, shadowColor: colors.primary }]}>
                          {height > 0 && (
                            <>
                              <View style={styles.lineChartBarGradient} />
                              {height > 15 && (
                                <Text style={styles.lineChartValueLabel}>
                                  {item.totalUnits.toFixed(item.totalUnits >= 10 ? 0 : 1)}
                                </Text>
                              )}
                            </>
                          )}
                        </View>
                      </View>
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

      {/* Тренд трат (если есть цены) */}
      {hasSpending && trendData.length > 0 && (
        <View style={[styles.chartCard, { backgroundColor: colors.backgroundCard }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            Траты ({trendPeriod === 'months' ? '12 месяцев' : '12 недель'})
          </Text>
          <View style={styles.chartWithAxis}>
            <View style={styles.yAxis}>
              {yAxisSpentValues.map((value, index) => (
                <Text key={index} style={[styles.yAxisLabel, { color: colors.textSecondary }]}>
                  {value === 0 ? '0' : formatPrice(value, currency)}
                </Text>
              ))}
            </View>
            <View style={styles.lineChartContainer}>
              {trendData.map((item, index) => {
                const height = maxSpentValue > 0 ? (item.totalSpent / maxSpentValue) * 100 : 0;
                const labelText = trendPeriod === 'months'
                  ? `${item.month.getMonth() + 1}`
                  : `${index + 1}`;
                return (
                  <View key={index} style={styles.lineChartBar}>
                    <View style={styles.lineChartBarWrapper}>
                      <View style={[styles.lineChartBarFill, { height: `${height}%`, backgroundColor: colors.primary, shadowColor: colors.primary }]}>
                        {height > 0 && (
                          <>
                            <View style={styles.lineChartBarGradient} />
                            {height > 15 && item.totalSpent > 0 && (
                              <Text style={styles.lineChartValueLabel} numberOfLines={1}>
                                {formatPriceChart(item.totalSpent, currency)}
                              </Text>
                            )}
                          </>
                        )}
                      </View>
                    </View>
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Сравнение периодов</Text>

          {/* Текущая неделя vs предыдущая (только для режима "По неделям") */}
          {trendPeriod === 'weeks' && (
            <>
              <View style={[styles.comparisonCard, { backgroundColor: colors.backgroundCard }]}>
                <Text style={[styles.comparisonTitle, { color: colors.text }]}>Текущая неделя vs предыдущая</Text>
                <View style={styles.comparisonRow}>
                  <View style={styles.comparisonItem}>
                    <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>Предыдущая</Text>
                    <Text style={[styles.comparisonValue, { color: colors.text }]}>
                      {weekComparison.period1.totalUnits.toFixed(1)} ед.
                    </Text>
                    <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                      {weekComparison.period1.daysWithDrinks} дней
                    </Text>
                    {(weekComparison.period1.totalSpent > 0 || weekComparison.period2.totalSpent > 0) && (
                      <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                        Сумма: {formatPrice(weekComparison.period1.totalSpent, currency)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.comparisonArrow}>
                    <MaterialIcons
                      name={weekComparison.change.units >= 0 ? 'arrow-forward' : 'arrow-back'}
                      size={24}
                      color={weekComparison.change.units >= 0 ? colors.error : colors.primary}
                    />
                  </View>
                  <View style={styles.comparisonItem}>
                    <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>Текущая</Text>
                    <Text style={[styles.comparisonValue, { color: colors.text }]}>
                      {weekComparison.period2.totalUnits.toFixed(1)} ед.
                    </Text>
                    <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                      {weekComparison.period2.daysWithDrinks} дней
                    </Text>
                    {(weekComparison.period1.totalSpent > 0 || weekComparison.period2.totalSpent > 0) && (
                      <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                        Сумма: {formatPrice(weekComparison.period2.totalSpent, currency)}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.comparisonChange}>
                  <Text
                    style={[
                      styles.comparisonChangeText,
                      weekComparison.change.unitsPercent >= 0
                        ? [styles.comparisonChangePositive, { color: colors.error }]
                        : [styles.comparisonChangeNegative, { color: colors.primary }],
                    ]}
                  >
                    {weekComparison.change.unitsPercent >= 0 ? '+' : ''}
                    {weekComparison.change.unitsPercent.toFixed(1)}%
                  </Text>
                  {(weekComparison.period1.totalSpent > 0 || weekComparison.period2.totalSpent > 0) && (
                    <Text
                      style={[
                        styles.comparisonChangeText,
                        styles.comparisonChangeSub,
                        weekComparison.change.spentPercent >= 0 ? { color: colors.error } : { color: colors.primary },
                      ]}
                    >
                      Сумма: {weekComparison.change.spentPercent >= 0 ? '+' : ''}{weekComparison.change.spentPercent.toFixed(1)}%
                    </Text>
                  )}
                </View>
              </View>
              <View style={[styles.comparisonCard, { backgroundColor: colors.backgroundCard }]}>
                <Text style={[styles.comparisonTitle, { color: colors.text }]}>Текущая неделя vs предыдущая (за схожий период)</Text>
                <View style={styles.comparisonRow}>
                  <View style={styles.comparisonItem}>
                    <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>Предыдущая</Text>
                    <Text style={[styles.comparisonValue, { color: colors.text }]}>
                      {weekComparisonAdjusted.period1.totalUnits.toFixed(1)} ед.
                    </Text>
                    <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                      {weekComparisonAdjusted.period1.daysWithDrinks} дней
                    </Text>
                    {(weekComparisonAdjusted.period1.totalSpent > 0 || weekComparisonAdjusted.period2.totalSpent > 0) && (
                      <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                        Сумма: {formatPrice(weekComparisonAdjusted.period1.totalSpent, currency)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.comparisonArrow}>
                    <MaterialIcons
                      name={weekComparisonAdjusted.change.units >= 0 ? 'arrow-forward' : 'arrow-back'}
                      size={24}
                      color={weekComparisonAdjusted.change.units >= 0 ? colors.error : colors.primary}
                    />
                  </View>
                  <View style={styles.comparisonItem}>
                    <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>Текущая</Text>
                    <Text style={[styles.comparisonValue, { color: colors.text }]}>
                      {weekComparisonAdjusted.period2.totalUnits.toFixed(1)} ед.
                    </Text>
                    <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                      {weekComparisonAdjusted.period2.daysWithDrinks} дней
                    </Text>
                    {(weekComparisonAdjusted.period1.totalSpent > 0 || weekComparisonAdjusted.period2.totalSpent > 0) && (
                      <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                        Сумма: {formatPrice(weekComparisonAdjusted.period2.totalSpent, currency)}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.comparisonChange}>
                  <Text
                    style={[
                      styles.comparisonChangeText,
                      weekComparisonAdjusted.change.unitsPercent >= 0
                        ? [styles.comparisonChangePositive, { color: colors.error }]
                        : [styles.comparisonChangeNegative, { color: colors.primary }],
                    ]}
                  >
                    {weekComparisonAdjusted.change.unitsPercent >= 0 ? '+' : ''}
                    {weekComparisonAdjusted.change.unitsPercent.toFixed(1)}%
                  </Text>
                  {(weekComparisonAdjusted.period1.totalSpent > 0 || weekComparisonAdjusted.period2.totalSpent > 0) && (
                    <Text style={[styles.comparisonChangeText, styles.comparisonChangeSub, weekComparisonAdjusted.change.spentPercent >= 0 ? { color: colors.error } : { color: colors.primary }]}>
                      Сумма: {weekComparisonAdjusted.change.spentPercent >= 0 ? '+' : ''}{weekComparisonAdjusted.change.spentPercent.toFixed(1)}%
                    </Text>
                  )}
                </View>
              </View>
            </>
          )}

          {/* Текущий месяц vs предыдущий (только для режима "По месяцам") */}
          {trendPeriod === 'months' && (
            <>
              <View style={[styles.comparisonCard, { backgroundColor: colors.backgroundCard }]}>
                <Text style={[styles.comparisonTitle, { color: colors.text }]}>Текущий месяц vs предыдущий</Text>
                <View style={styles.comparisonRow}>
                  <View style={styles.comparisonItem}>
                    <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>Предыдущий</Text>
                    <Text style={[styles.comparisonValue, { color: colors.text }]}>
                      {monthComparison.period1.totalUnits.toFixed(1)} ед.
                    </Text>
                    <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                      {monthComparison.period1.daysWithDrinks} дней
                    </Text>
                    {(monthComparison.period1.totalSpent > 0 || monthComparison.period2.totalSpent > 0) && (
                      <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                        Сумма: {formatPrice(monthComparison.period1.totalSpent, currency)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.comparisonArrow}>
                    <MaterialIcons
                      name={monthComparison.change.units >= 0 ? 'arrow-forward' : 'arrow-back'}
                      size={24}
                      color={monthComparison.change.units >= 0 ? colors.error : colors.primary}
                    />
                  </View>
                  <View style={styles.comparisonItem}>
                    <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>Текущий</Text>
                    <Text style={[styles.comparisonValue, { color: colors.text }]}>
                      {monthComparison.period2.totalUnits.toFixed(1)} ед.
                    </Text>
                    <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                      {monthComparison.period2.daysWithDrinks} дней
                    </Text>
                    {(monthComparison.period1.totalSpent > 0 || monthComparison.period2.totalSpent > 0) && (
                      <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                        Сумма: {formatPrice(monthComparison.period2.totalSpent, currency)}
                      </Text>
                    )}
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
                  {(monthComparison.period1.totalSpent > 0 || monthComparison.period2.totalSpent > 0) && (
                    <Text style={[styles.comparisonChangeText, styles.comparisonChangeSub, monthComparison.change.spentPercent >= 0 ? { color: colors.error } : { color: colors.primary }]}>
                      Сумма: {monthComparison.change.spentPercent >= 0 ? '+' : ''}{monthComparison.change.spentPercent.toFixed(1)}%
                    </Text>
                  )}
                </View>
              </View>
              <View style={[styles.comparisonCard, { backgroundColor: colors.backgroundCard }]}>
                <Text style={[styles.comparisonTitle, { color: colors.text }]}>Текущий месяц vs предыдущий (за схожий период)</Text>
                <View style={styles.comparisonRow}>
                  <View style={styles.comparisonItem}>
                    <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>Предыдущий</Text>
                    <Text style={[styles.comparisonValue, { color: colors.text }]}>
                      {monthComparisonAdjusted.period1.totalUnits.toFixed(1)} ед.
                    </Text>
                    <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                      {monthComparisonAdjusted.period1.daysWithDrinks} дней
                    </Text>
                    {(monthComparisonAdjusted.period1.totalSpent > 0 || monthComparisonAdjusted.period2.totalSpent > 0) && (
                      <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                        Сумма: {formatPrice(monthComparisonAdjusted.period1.totalSpent, currency)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.comparisonArrow}>
                    <MaterialIcons
                      name={monthComparisonAdjusted.change.units >= 0 ? 'arrow-forward' : 'arrow-back'}
                      size={24}
                      color={monthComparisonAdjusted.change.units >= 0 ? colors.error : colors.primary}
                    />
                  </View>
                  <View style={styles.comparisonItem}>
                    <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>Текущий</Text>
                    <Text style={[styles.comparisonValue, { color: colors.text }]}>
                      {monthComparisonAdjusted.period2.totalUnits.toFixed(1)} ед.
                    </Text>
                    <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                      {monthComparisonAdjusted.period2.daysWithDrinks} дней
                    </Text>
                    {(monthComparisonAdjusted.period1.totalSpent > 0 || monthComparisonAdjusted.period2.totalSpent > 0) && (
                      <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                        Сумма: {formatPrice(monthComparisonAdjusted.period2.totalSpent, currency)}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.comparisonChange}>
                  <Text
                    style={[
                      styles.comparisonChangeText,
                      monthComparisonAdjusted.change.unitsPercent >= 0
                        ? [styles.comparisonChangePositive, { color: colors.error }]
                        : [styles.comparisonChangeNegative, { color: colors.primary }],
                    ]}
                  >
                    {monthComparisonAdjusted.change.unitsPercent >= 0 ? '+' : ''}
                    {monthComparisonAdjusted.change.unitsPercent.toFixed(1)}%
                  </Text>
                  {(monthComparisonAdjusted.period1.totalSpent > 0 || monthComparisonAdjusted.period2.totalSpent > 0) && (
                    <Text style={[styles.comparisonChangeText, styles.comparisonChangeSub, monthComparisonAdjusted.change.spentPercent >= 0 ? { color: colors.error } : { color: colors.primary }]}>
                      Сумма: {monthComparisonAdjusted.change.spentPercent >= 0 ? '+' : ''}{monthComparisonAdjusted.change.spentPercent.toFixed(1)}%
                    </Text>
                  )}
                </View>
              </View>
            </>
          )}

          {/* Текущий год vs предыдущий */}
          <View style={[styles.comparisonCard, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.comparisonTitle, { color: colors.text }]}>Текущий год vs предыдущий</Text>
            <View style={styles.comparisonRow}>
              <View style={styles.comparisonItem}>
                <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>Предыдущий</Text>
                <Text style={[styles.comparisonValue, { color: colors.text }]}>
                  {yearComparison.period1.totalUnits.toFixed(1)} ед.
                </Text>
                <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                  {yearComparison.period1.daysWithDrinks} дней
                </Text>
                {(yearComparison.period1.totalSpent > 0 || yearComparison.period2.totalSpent > 0) && (
                  <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                    Сумма: {formatPrice(yearComparison.period1.totalSpent, currency)}
                  </Text>
                )}
              </View>
              <View style={styles.comparisonArrow}>
                <MaterialIcons
                  name={yearComparison.change.units >= 0 ? 'arrow-forward' : 'arrow-back'}
                  size={24}
                  color={yearComparison.change.units >= 0 ? colors.error : colors.primary}
                />
              </View>
              <View style={styles.comparisonItem}>
                <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>Текущий</Text>
                <Text style={[styles.comparisonValue, { color: colors.text }]}>
                  {yearComparison.period2.totalUnits.toFixed(1)} ед.
                </Text>
                <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                  {yearComparison.period2.daysWithDrinks} дней
                </Text>
                {(yearComparison.period1.totalSpent > 0 || yearComparison.period2.totalSpent > 0) && (
                  <Text style={[styles.comparisonSubtext, { color: colors.textTertiary }]}>
                    Сумма: {formatPrice(yearComparison.period2.totalSpent, currency)}
                  </Text>
                )}
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
              {(yearComparison.period1.totalSpent > 0 || yearComparison.period2.totalSpent > 0) && (
                <Text style={[styles.comparisonChangeText, styles.comparisonChangeSub, yearComparison.change.spentPercent >= 0 ? { color: colors.error } : { color: colors.primary }]}>
                  Сумма: {yearComparison.change.spentPercent >= 0 ? '+' : ''}{yearComparison.change.spentPercent.toFixed(1)}%
                </Text>
              )}
            </View>
          </View>
        </View>

      {/* Траты по типам напитков (если есть цены) */}
      {typeStatsWithSpending.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Траты по типам напитков</Text>
          <View style={[styles.analyticsCard, { backgroundColor: colors.backgroundCard }]}>
            {typeStatsWithSpending.map((item) => {
              const typeLabels: Record<Drink['beverageType'], string> = {
                beer: 'Пиво',
                wine: 'Вино',
                spirit: 'Крепкие',
                cocktail: 'Коктейли',
                other: 'Другое',
              };
              return (
                <View key={item.type} style={[styles.analyticsRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.analyticsDayName, { color: colors.text }]}>{typeLabels[item.type]}</Text>
                  <View style={styles.analyticsValues}>
                    <Text style={[styles.analyticsValue, { color: colors.text }]}>{formatPrice(item.totalSpent, currency)}</Text>
                    <Text style={[styles.analyticsSubtext, { color: colors.textSecondary }]}>
                      {item.totalUnits.toFixed(1)} ед. · {item.count} записей
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: defaultColors.backgroundSecondary,
    borderRadius: 8,
    padding: 3,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: defaultColors.primary,
  },
  periodButtonText: {
    fontSize: 13,
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
    marginBottom: 20,
    letterSpacing: -0.3,
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
    paddingBottom: 8,
    height: 200,
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
    paddingTop: 0,
    gap: 4,
  },
  lineChartBar: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  lineChartBarWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  lineChartBarFill: {
    width: '100%',
    backgroundColor: defaultColors.primary,
    borderRadius: 6,
    minHeight: 2,
    overflow: 'visible',
    position: 'relative',
    justifyContent: 'flex-start',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: defaultColors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  lineChartBarGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
  },
  lineChartLabel: {
    fontSize: 9,
    color: defaultColors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  lineChartValueLabel: {
    fontSize: 8,
    color: '#fff',
    fontWeight: '700',
    position: 'absolute',
    top: 4,
    zIndex: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
  comparisonChangeSub: {
    fontSize: 13,
    marginTop: 4,
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
