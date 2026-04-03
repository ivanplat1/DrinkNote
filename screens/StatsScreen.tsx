import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Animated from 'react-native-reanimated';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getAllDrinks } from '../storage/drinks';
import { Drink } from '../types/drink';
import { useTheme } from '../theme/ThemeContext';
import { useCurrency } from '../theme/CurrencyContext';
import { formatPrice, formatPriceValueOnly } from '../utils/currency';
import { colors as defaultColors } from '../theme/colors';
import { formatTotalVolume } from '../utils/units';
import { WEEKDAY_SHORT_RU, WEEKDAY_SHORT_EN, MONTH_SHORT_RU, MONTH_SHORT_EN } from '../utils/date';
import { useI18n } from '../i18n/I18nContext';
import { isPremiumUser } from '../storage/premium';
import { getStreakGoal } from '../storage/streakGoal';
import { useOnboarding } from '../context/OnboardingContext';
import { getDemoDrinksForOnboarding } from '../utils/onboardingDemoData';
import AdvancedStatsContent from './AdvancedStatsContent';
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
type StatsTabType = 'basic' | 'advanced';

export default function StatsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { currency } = useCurrency();
  const { language, localeTag, t, tf } = useI18n();
  const WEEKDAY_SHORT = language === 'ru' ? WEEKDAY_SHORT_RU : WEEKDAY_SHORT_EN;
  const MONTH_SHORT = language === 'ru' ? MONTH_SHORT_RU : MONTH_SHORT_EN;
  const { isOnboardingActive } = useOnboarding();
  const wasOnboardingRef = React.useRef(isOnboardingActive);
  const [allDrinks, setAllDrinks] = useState<Drink[]>([]);
  const [period, setPeriod] = useState<PeriodType>('overall');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<StatsTabType>('basic');
  const [isPremium, setIsPremium] = useState(false);
  const [streakGoal, setStreakGoal] = useState<number | null>(null);

  const loadDrinks = useCallback(async () => {
    const drinks = await getAllDrinks();
    setAllDrinks(drinks);
  }, []);

  // Фильтруем данные для базовой версии - только последние 3 месяца
  const filteredDrinks = useMemo(() => {
    if (isPremium || activeTab === 'advanced') {
      return allDrinks;
    }
    
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoISO = threeMonthsAgo.toISOString().split('T')[0];
    
    return allDrinks.filter(drink => drink.dateISO >= threeMonthsAgoISO);
  }, [allDrinks, isPremium, activeTab]);

  const checkPremium = useCallback(async () => {
    const premium = await isPremiumUser();
    setIsPremium(premium);
  }, []);

  const loadStreakGoal = useCallback(async () => {
    const goal = await getStreakGoal();
    setStreakGoal(goal);
  }, []);

  // При завершении онбординга сразу сбрасываем демо-данные и грузим реальные, чтобы не мелькали при открытии вкладки
  useEffect(() => {
    if (wasOnboardingRef.current === true && isOnboardingActive === false) {
      setAllDrinks([]);
      loadDrinks();
      checkPremium();
      loadStreakGoal();
    }
    wasOnboardingRef.current = isOnboardingActive;
  }, [isOnboardingActive, loadDrinks, checkPremium, loadStreakGoal]);

  useFocusEffect(
    useCallback(() => {
      if (isOnboardingActive) {
        setAllDrinks(getDemoDrinksForOnboarding());
        checkPremium();
        loadStreakGoal();
        return;
      }
      loadDrinks();
      checkPremium();
      loadStreakGoal();
    }, [loadDrinks, checkPremium, loadStreakGoal, isOnboardingActive])
  );

  const overallStats = useMemo(() => getOverallStats(filteredDrinks), [filteredDrinks]);
  const weekStats = useMemo(() => getWeekStats(filteredDrinks, selectedDate), [filteredDrinks, selectedDate]);
  const monthStats = useMemo(() => getMonthStats(filteredDrinks, selectedDate), [filteredDrinks, selectedDate]);

  const currentStats = period === 'overall' ? overallStats : period === 'week' ? weekStats : monthStats;

  // Новая статистика (только для общей статистики)
  const beverageTypeStats = useMemo(() => getBeverageTypeStats(filteredDrinks), [filteredDrinks]);
  const weekdayStats = useMemo(() => getWeekdayStats(filteredDrinks), [filteredDrinks]);
  const records = useMemo(() => getRecords(filteredDrinks), [filteredDrinks]);
  const topDrinks = useMemo(() => getTopDrinks(filteredDrinks, 5), [filteredDrinks]);

  // Максимальное значение для графика дней недели
  const maxWeekdayValue = useMemo(() => {
    if (weekdayStats.length === 0) return 1;
    return Math.max(...weekdayStats.map(d => d.averageUnits), 1);
  }, [weekdayStats]);

  // Данные для графика (дни выбранной недели или последние N месяцев)
  const chartData = useMemo(() => {
    if (period === 'week') {
      return getWeekDaysStats(filteredDrinks, selectedDate);
    } else if (period === 'month') {
      // Для базовой версии показываем только последние 3 месяца
      const monthsToShow = isPremium ? 12 : 3;
      return getLastNMonths(filteredDrinks, monthsToShow);
    }
    return [];
  }, [filteredDrinks, period, selectedDate, isPremium]);

  const maxChartValue = useMemo(() => {
    if (chartData.length === 0) return 1;
    if (period === 'week') {
      return Math.max(...chartData.map(d => d.units), 1);
    } else {
      return Math.max(...chartData.map(d => d.stats.totalUnits), 1);
    }
  }, [chartData, period]);

  // Генерируем значения для шкалы Y графика тренда (5 делений)
  const chartYAxisValues = useMemo(() => {
    if (maxChartValue <= 0) return [0];
    const step = maxChartValue / 4;
    return [maxChartValue, step * 3, step * 2, step, 0].map(v => Math.round(v * 10) / 10);
  }, [maxChartValue]);

  // Генерируем значения для шкалы Y графика дней недели (5 делений)
  const weekdayYAxisValues = useMemo(() => {
    if (maxWeekdayValue <= 0) return [0];
    const step = maxWeekdayValue / 4;
    return [maxWeekdayValue, step * 3, step * 2, step, 0].map(v => Math.round(v * 10) / 10);
  }, [maxWeekdayValue]);

  const formatPeriodLabel = (date: Date, type: PeriodType): string => {
    if (type === 'week') {
      const start = startOfWeek(date);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.getDate()}-${end.getDate()} ${start.toLocaleDateString(localeTag, { month: 'short' })}`;
    } else if (type === 'month') {
      return date.toLocaleDateString(localeTag, { month: 'long', year: 'numeric' });
    }
    return '';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      {/* Переключатель вкладок (родительские) */}
      <View style={styles.parentTabContainer}>
        <TouchableOpacity
          style={styles.parentTabButton}
          onPress={() => setActiveTab('basic')}
        >
            <Text style={[styles.parentTabText, activeTab === 'basic' && styles.parentTabTextActive, { color: activeTab === 'basic' ? colors.primary : colors.textSecondary }]}>
            {t('statsScreen.tabBasic')}
          </Text>
          {activeTab === 'basic' && <View style={[styles.parentTabIndicator, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.parentTabButton}
          onPress={() => {
            if (isPremium) {
              setActiveTab('advanced');
            } else {
              navigation.navigate('Premium' as never);
            }
          }}
        >
          <View style={styles.parentTabButtonContent}>
            <Text style={[styles.parentTabText, activeTab === 'advanced' && styles.parentTabTextActive, { color: activeTab === 'advanced' ? colors.primary : colors.textSecondary }]}>
              {t('statsScreen.tabAdvanced')}
            </Text>
            {!isPremium && (
              <MaterialCommunityIcons name="crown" size={14} color={activeTab === 'advanced' ? colors.primary : colors.textSecondary} />
            )}
          </View>
          {activeTab === 'advanced' && <View style={[styles.parentTabIndicator, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>
      </View>

      {/* Показываем расширенную статистику или блокировку */}
      {activeTab === 'advanced' ? (
        !isPremium ? (
          <View style={styles.lockedContainer}>
            <MaterialCommunityIcons name="lock" size={64} color={colors.textSecondary} />
            <Text style={styles.lockedTitle}>{t('premium.features.advancedStatsTitle')}</Text>
            <Text style={styles.lockedText}>
              {t('premium.notAvailable')}
            </Text>
            <TouchableOpacity
              style={[styles.premiumButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('Premium' as never)}
            >
              <MaterialCommunityIcons name="crown" size={20} color="#f4c430" />
              <Text style={styles.premiumButtonText}>{t('statsScreen.unlockPremium')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <AdvancedStatsContent allDrinks={allDrinks} />
        )
      ) : (
        <Animated.ScrollView style={[styles.scrollView, { backgroundColor: colors.background }]} contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]} removeClippedSubviews={Platform.OS === 'android'} directionalLockEnabled scrollEventThrottle={32} >
        {/* Предупреждение о ограничении для базовой версии */}
        {!isPremium && allDrinks.length > filteredDrinks.length && (
          <View style={styles.limitWarning}>
            <MaterialCommunityIcons name="information" size={18} color={colors.warning} />
            <Text style={styles.limitWarningText}>
              {t('statsScreen.baseLimitHint')}
            </Text>
            <TouchableOpacity
              style={styles.limitWarningButton}
              onPress={() => navigation.navigate('Premium' as never)}
            >
              <MaterialCommunityIcons name="crown" size={14} color={colors.primary} />
              <Text style={styles.limitWarningButtonText}>{t('statsScreen.premiumShort')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Выбор периода (дочерние табы) */}
        <View style={[styles.periodSelector, { backgroundColor: colors.backgroundSecondary }]}>
          <TouchableOpacity
            style={[styles.periodButton, period === 'overall' && styles.periodButtonActive, period === 'overall' && { backgroundColor: colors.primary }]}
            onPress={() => setPeriod('overall')}
          >
            <Text 
              style={[styles.periodButtonText, period === 'overall' && styles.periodButtonTextActive, { color: period === 'overall' ? '#fff' : colors.textSecondary }]}
              numberOfLines={1}
            >
              {t('statsScreen.periodOverall')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, period === 'week' && styles.periodButtonActive, period === 'week' && { backgroundColor: colors.primary }]}
            onPress={() => setPeriod('week')}
          >
            <Text 
              style={[styles.periodButtonText, period === 'week' && styles.periodButtonTextActive, { color: period === 'week' ? '#fff' : colors.textSecondary }]}
              numberOfLines={1}
            >
              {t('statsScreen.periodWeek')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, period === 'month' && styles.periodButtonActive, period === 'month' && { backgroundColor: colors.primary }]}
            onPress={() => setPeriod('month')}
          >
            <Text 
              style={[styles.periodButtonText, period === 'month' && styles.periodButtonTextActive, { color: period === 'month' ? '#fff' : colors.textSecondary }]}
              numberOfLines={1}
            >
              {t('statsScreen.periodMonth')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Навигация по периодам */}
        {period !== 'overall' && (
          <View style={[styles.periodNavigation, { backgroundColor: colors.backgroundCard }]}>
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
            <Text style={[styles.periodLabel, { color: colors.textSecondary }]}>{formatPeriodLabel(selectedDate, period)}</Text>
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
        <View style={[styles.statsCard, { backgroundColor: colors.backgroundCard }]}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{currentStats.totalUnits.toFixed(2)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('statsScreen.standardUnits')}</Text>
              <Text style={[styles.statSubLabel, { color: colors.textTertiary }]}>{tf('stats.gramsAlcohol', { g: (currentStats.totalUnits * 10).toFixed(1) })}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {formatTotalVolume(currentStats.totalVolumeMl, 1, {
                  ml: t('common.mlShort'),
                  l: t('common.lShort'),
                })}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('statsScreen.volume')}</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{period === 'overall' ? (currentStats as typeof overallStats).totalDays : currentStats.daysWithDrinks}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('stats.daysWithEntries')}</Text>
              {period !== 'overall' && (
                <Text style={[styles.statSubLabel, { color: colors.textTertiary }]}>
                  {period === 'week' 
                    ? tf('stats.pctOfWeek', { pct: Math.round(((currentStats.daysWithDrinks || 0) / 7) * 100) })
                    : period === 'month' 
                    ? tf('stats.pctOfMonth', { pct: Math.round(((currentStats.daysWithDrinks || 0) / new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate()) * 100) })
                    : ''
                  }
                </Text>
              )}
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{currentStats.averagePerDay.toFixed(2)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('stats.avgPerDay')}</Text>
              <Text style={[styles.statSubLabel, { color: colors.textTertiary }]}>{tf('stats.gramsAlcohol', { g: (currentStats.averagePerDay * 10).toFixed(1) })}</Text>
            </View>
          </View>
          {isPremium && (
            <View style={[styles.statsRow, styles.statsRowSpent]}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {currentStats.totalSpent > 0 ? formatPriceValueOnly(currentStats.totalSpent) : '—'}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('stats.sum')}</Text>
                {currentStats.totalSpent === 0 && (
                  <Text style={[styles.statSubLabel, { color: colors.textTertiary }]}>{t('stats.noPrices')}</Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* График тренда */}
        {chartData.length > 0 && (
          <View style={[styles.chartCard, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>
              {tf('stats.trendTitle', { unit: period === 'week' ? t('stats.trendUnitWeek') : t('stats.trendUnitMonths') })}
            </Text>
            <View style={styles.chartWithAxis}>
              {/* Шкала Y */}
              <View style={styles.yAxis}>
                {chartYAxisValues.map((value, index) => (
                  <Text key={index} style={[styles.yAxisLabel, { color: colors.textSecondary }]}>
                    {value === 0 ? '0' : value.toFixed(value >= 10 ? 0 : 1)}
                  </Text>
                ))}
              </View>
              {/* График */}
              <View style={styles.chartContainer}>
                {chartData.map((item, index) => {
                  const height = period === 'week' 
                    ? (maxChartValue > 0 ? (item.units / maxChartValue) * 100 : 0)
                    : (maxChartValue > 0 ? (item.stats.totalUnits / maxChartValue) * 100 : 0);
                  const value = period === 'week' ? item.units : item.stats.totalUnits;
                  return (
                    <View key={index} style={styles.chartBarContainer}>
                      <View style={styles.chartBarWrapper}>
                        <View style={[styles.chartBar, { height: `${height}%`, backgroundColor: colors.primary, shadowColor: colors.primary }]}>
                          {height > 0 && (
                            <>
                              <View style={styles.chartBarGradient} />
                              {height > 15 && (
                                <Text style={styles.chartValueLabel}>
                                  {value.toFixed(value >= 10 ? 0 : 1)}
                                </Text>
                              )}
                            </>
                          )}
                        </View>
                      </View>
                      <Text 
                        style={[styles.chartLabel, { color: colors.textSecondary }]} 
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.7}
                      >
                        {period === 'week' ? WEEKDAY_SHORT[index] : MONTH_SHORT[item.month.getMonth()]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Дополнительная информация для общей статистики */}
        {period === 'overall' && overallStats.firstDate && overallStats.lastDate && (
          <View style={[styles.infoCard, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {t('stats.period')}: {new Date(overallStats.firstDate).toLocaleDateString(localeTag)} - {new Date(overallStats.lastDate).toLocaleDateString(localeTag)}
              {!isPremium && allDrinks.length > filteredDrinks.length && (
                <Text style={[styles.infoTextSub, { color: colors.textTertiary }]}> (ограничено до 3 месяцев)</Text>
              )}
            </Text>
          </View>
        )}

        {/* Статистика по типам напитков (только для общей статистики) */}
        {period === 'overall' && beverageTypeStats.length > 0 && (
          <View style={[styles.chartCard, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>{t('statsScreen.byDrinkTypes')}</Text>
            {beverageTypeStats.map((item, index) => {
              const typeColors = colors[item.type] || colors.other;
              const getTypeLabel = (type: Drink['beverageType']) => t(`drinkTypesPlural.${type}`);
              return (
                <View key={item.type} style={styles.typeRow}>
                  <View style={styles.typeLabelRow}>
                    <View style={[styles.typeColorDot, { backgroundColor: typeColors.main }]} />
                    <Text style={[styles.typeLabel, { color: colors.text }]}>{getTypeLabel(item.type)}</Text>
                  </View>
                  <View style={styles.typeStatsRow}>
                    <Text style={[styles.typePercentage, { color: colors.primary }]}>{item.percentage}%</Text>
                    <View style={styles.typeUnitsContainer}>
                      <Text style={[styles.typeUnits, { color: colors.textSecondary }]}>{item.totalUnits.toFixed(1)} {t('advancedStats.unitsShort')}</Text>
                      <Text style={[styles.typeUnitsSub, { color: colors.textTertiary }]}>
                        {Math.round(item.totalUnits * 10)} {t('common.gShort')}
                      </Text>
                      {isPremium && item.totalSpent > 0 && (
                        <Text style={[styles.typeUnitsSub, { color: colors.textTertiary }]}>· {formatPriceValueOnly(item.totalSpent)}</Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* График по дням недели (только для общей статистики) */}
        {period === 'overall' && weekdayStats.length > 0 && (
          <View style={[styles.chartCard, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>{t('statsScreen.byWeekdaysAvg')}</Text>
            <View style={styles.chartWithAxis}>
              {/* Шкала Y */}
              <View style={styles.yAxis}>
                {weekdayYAxisValues.map((value, index) => (
                  <Text key={index} style={[styles.yAxisLabel, { color: colors.textSecondary }]}>
                    {value === 0 ? '0' : value.toFixed(value >= 10 ? 0 : 1)}
                  </Text>
                ))}
              </View>
              {/* График */}
              <View style={styles.chartContainer}>
                {weekdayStats.map((item) => {
                  const height = maxWeekdayValue > 0 ? (item.averageUnits / maxWeekdayValue) * 100 : 0;
                  return (
                    <View key={item.weekday} style={styles.chartBarContainer}>
                      <View style={styles.chartBarWrapper}>
                        <View style={[styles.chartBar, { height: `${height}%`, backgroundColor: colors.primary, shadowColor: colors.primary }]}>
                          {height > 0 && (
                            <>
                              <View style={styles.chartBarGradient} />
                              {height > 15 && (
                                <Text style={styles.chartValueLabel}>
                                  {item.averageUnits.toFixed(item.averageUnits >= 10 ? 0 : 1)}
                                </Text>
                              )}
                            </>
                          )}
                        </View>
                      </View>
                      <Text style={[styles.chartLabel, { color: colors.textSecondary }]}>{WEEKDAY_SHORT[item.weekday]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Рекорды (только для общей статистики) */}
        {period === 'overall' && records.heaviestDay && (
          <View style={[styles.chartCard, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>{t('statsScreen.records')}</Text>
            <View style={styles.recordsRow}>
              <View style={[styles.recordItem, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={[styles.recordLabel, { color: colors.textSecondary }]}>{t('statsScreen.heaviestDay')}</Text>
                <Text style={[styles.recordValue, { color: colors.primary }]}>{records.heaviestDay.units.toFixed(2)} {t('advancedStats.unitsShort')}</Text>
                <Text style={[styles.recordSubValue, { color: colors.textSecondary }]}>{tf('stats.gramsAlcohol', { g: (records.heaviestDay.units * 10).toFixed(1) })}</Text>
                <Text style={[styles.recordDate, { color: colors.textTertiary }]}>
                  {new Date(records.heaviestDay.date).toLocaleDateString(localeTag, { day: 'numeric', month: 'short' })}
                </Text>
              </View>
              {records.currentStreak > 0 && (
                <View style={[styles.recordItem, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text style={[styles.recordLabel, { color: colors.textSecondary }]}>{t('statsScreen.alcoholFreeDays')}</Text>
                  <Text style={[styles.recordValue, { color: colors.primary }]}>{records.currentStreak}</Text>
                  <Text style={[styles.recordDate, { color: colors.textTertiary }]}>{t('statsScreen.currentStreak')}</Text>
                </View>
              )}
            </View>
            {records.longestStreak > 0 && (
              <View style={styles.recordsRow}>
                <View style={[styles.recordItem, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text style={[styles.recordLabel, { color: colors.textSecondary }]}>{t('statsScreen.bestStreak')}</Text>
                  <Text style={[styles.recordValue, { color: colors.primary }]}>{records.longestStreak} {t('advancedStats.daysShort')}</Text>
                </View>
              </View>
            )}
            {isPremium && streakGoal != null && streakGoal > 0 && (
              <View style={[styles.recordItem, { marginTop: 12, backgroundColor: colors.backgroundSecondary, padding: 12 }]}>
                <Text style={[styles.recordLabel, { color: colors.textSecondary, marginBottom: 6 }]}>
                  {tf('statsScreen.goal', { days: `${streakGoal} ${t('advancedStats.daysShort')}` })}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1, height: 8, backgroundColor: colors.backgroundTertiary, borderRadius: 4, overflow: 'hidden' }}>
                    <View
                      style={{
                        width: `${Math.min(100, (records.currentStreak / streakGoal) * 100)}%`,
                        height: '100%',
                        backgroundColor: records.currentStreak >= streakGoal ? colors.success : colors.primary,
                        borderRadius: 4,
                      }}
                    />
                  </View>
                  <Text style={[styles.recordValue, { color: colors.primary, fontSize: 14, marginLeft: 8 }]}>
                    {records.currentStreak} / {streakGoal}
                  </Text>
                </View>
                {records.currentStreak >= streakGoal && (
                  <Text style={[styles.recordDate, { color: colors.success, marginTop: 4 }]}>{t('statsScreen.goalAchieved')}</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Топ напитков (только для общей статистики) */}
        {period === 'overall' && topDrinks.length > 0 && (
          <View style={[styles.chartCard, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>{t('statsScreen.top5Drinks')}</Text>
            {topDrinks.map((drink, index) => {
              const typeColors = colors[drink.beverageType] || colors.other;
              return (
                <View key={`${drink.name}_${index}`} style={[styles.topDrinkRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.topDrinkRank, { backgroundColor: colors.backgroundSecondary }]}>
                    <Text style={[styles.topDrinkRankText, { color: colors.primary }]}>{index + 1}</Text>
                  </View>
                  <View style={styles.topDrinkInfo}>
                    <Text style={[styles.topDrinkName, { color: colors.text }]}>{drink.name}</Text>
                    <Text style={[styles.topDrinkDetails, { color: colors.textSecondary }]}>
                      {drink.count} × ·{' '}
                      {formatTotalVolume(drink.totalVolumeMl, 1, {
                        ml: t('common.mlShort'),
                        l: t('common.lShort'),
                      })}{' '}
                      · {drink.totalUnits.toFixed(1)} {t('advancedStats.unitsShort')} ({Math.round(drink.totalUnits * 10)}{' '}
                      {t('common.gShort')})
                    </Text>
                  </View>
                  <View style={[styles.topDrinkTypeDot, { backgroundColor: typeColors.main }]} />
                </View>
              );
            })}
          </View>
        )}
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultColors.background,
  },
  parentTabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: defaultColors.border,
    marginHorizontal: 16,
    marginTop: 8,
  },
  parentTabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  parentTabButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  parentTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: defaultColors.textSecondary,
  },
  parentTabTextActive: {
    color: defaultColors.primary,
  },
  parentTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: defaultColors.primary,
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
  limitWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: defaultColors.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: defaultColors.warning,
  },
  limitWarningText: {
    flex: 1,
    fontSize: 13,
    color: defaultColors.textSecondary,
  },
  limitWarningButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: defaultColors.backgroundCard,
  },
  limitWarningButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: defaultColors.primary,
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
    color: defaultColors.text,
    letterSpacing: -0.5,
  },
  subTabContainer: {
    backgroundColor: defaultColors.backgroundSecondary,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
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
    flexBasis: 0,
    paddingVertical: 6,
    paddingHorizontal: 0,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    width: '33.333%',
  },
  periodButtonActive: {
    backgroundColor: defaultColors.primary,
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: defaultColors.textSecondary,
    textAlign: 'center',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  statsCard: {
    backgroundColor: defaultColors.backgroundCard,
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
    color: defaultColors.text,
    textTransform: 'capitalize',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statsRowSpent: {
    marginBottom: 0,
    marginTop: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: defaultColors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: defaultColors.textSecondary,
    textAlign: 'center',
  },
  statSubLabel: {
    fontSize: 11,
    color: defaultColors.textTertiary,
    textAlign: 'center',
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: defaultColors.backgroundCard,
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
    fontSize: 17,
    fontWeight: '700',
    color: defaultColors.text,
    marginBottom: 24,
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
    height: 140,
  },
  yAxisLabel: {
    fontSize: 10,
    color: defaultColors.textSecondary,
    textAlign: 'right',
  },
  chartContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    paddingHorizontal: 2,
    paddingTop: 0,
    gap: 2,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBarWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    marginBottom: 4,
    alignItems: 'center',
    height: '100%',
  },
  chartBar: {
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
  chartBarGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
  },
  chartLabel: {
    fontSize: 9,
    color: defaultColors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
    width: '100%',
  },
  chartValueLabel: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '700',
    position: 'absolute',
    top: 4,
    zIndex: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  infoCard: {
    backgroundColor: defaultColors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: defaultColors.textSecondary,
    textAlign: 'center',
  },
  infoTextSub: {
    fontSize: 12,
    color: defaultColors.textTertiary,
    fontStyle: 'italic',
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: defaultColors.border,
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
    color: defaultColors.text,
  },
  typeStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  typePercentage: {
    fontSize: 15,
    fontWeight: '600',
    color: defaultColors.primary,
    minWidth: 50,
    textAlign: 'right',
  },
  typeUnitsContainer: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  typeUnits: {
    fontSize: 13,
    color: defaultColors.textSecondary,
    textAlign: 'right',
  },
  typeUnitsSub: {
    fontSize: 11,
    color: defaultColors.textTertiary,
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
    backgroundColor: defaultColors.backgroundSecondary,
    borderRadius: 12,
  },
  recordLabel: {
    fontSize: 12,
    color: defaultColors.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  recordValue: {
    fontSize: 20,
    fontWeight: '700',
    color: defaultColors.primary,
    marginBottom: 2,
  },
  recordSubValue: {
    fontSize: 12,
    color: defaultColors.textSecondary,
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 11,
    color: defaultColors.textTertiary,
    textAlign: 'center',
  },
  topDrinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: defaultColors.border,
  },
  topDrinkRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: defaultColors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  topDrinkRankText: {
    fontSize: 14,
    fontWeight: '700',
    color: defaultColors.primary,
  },
  topDrinkInfo: {
    flex: 1,
  },
  topDrinkName: {
    fontSize: 15,
    fontWeight: '600',
    color: defaultColors.text,
    marginBottom: 4,
  },
  topDrinkDetails: {
    fontSize: 12,
    color: defaultColors.textSecondary,
  },
  topDrinkTypeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
  },
});
