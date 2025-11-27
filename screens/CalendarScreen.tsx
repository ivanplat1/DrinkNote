import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Dimensions, Alert, Platform, TouchableWithoutFeedback, NativeSyntheticEvent, NativeScrollEvent, ScrollView, TextInput, KeyboardAvoidingView, Keyboard, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, useAnimatedReaction, withRepeat, withSequence } from 'react-native-reanimated';
import { MaterialIcons, FontAwesome6, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getAllDrinks, getDrinksByDate, removeDrink, addOrMergeDrink, updateDrink } from '../storage/drinks';
import { Drink } from '../types/drink';
import { PresetDrink } from '../types/preset';
import { getUserPresets, suggestedPresets, addPreset, presetsEventEmitter } from '../storage/presets';
import { WEEKDAY_SHORT_RU, buildMonthMatrix, formatISO, getWeekdayIndexMonFirst } from '../utils/date';
import { formatTotalVolume, calculateStandardUnits } from '../utils/units';
import { colors } from '../theme/colors';
import { getDailyGoal, getLethalDose, checkAndUnlockAchievements, Achievement, getAppStartDate } from '../storage/settings';

// Компонент диагонального градиента для плоских металлических слитков
function MetalGradient({ type }: { type: 'bronze' | 'silver' | 'gold' }) {
  const glowAnim = useSharedValue(0);
  
  React.useEffect(() => {
    // Бесконечная анимация от 0 до 360 (градусы круга)
    glowAnim.value = withRepeat(
      withTiming(360, { duration: 4000 }),
      -1,
      false
    );
  }, []);
  
  // Выраженные диагональные градиенты (перевернутые - темное сверху)
  const gradients = {
    bronze: {
      colors: ['#7d4d2f', '#a66841', '#c08850', '#e8c4a0'] as const,
      locations: [0, 0.3, 0.7, 1] as const,
      border: '#c08850',
    },
    silver: {
      colors: ['#707070', '#a8a8a8', '#d3d3d3', '#ffffff'] as const,
      locations: [0, 0.3, 0.7, 1] as const,
      border: '#d3d3d3',
    },
    gold: {
      colors: ['#a07d1a', '#c9a029', '#f4c430', '#ffe680'] as const,
      locations: [0, 0.3, 0.7, 1] as const,
      border: '#f4c430',
    },
  };
  
  const gradient = gradients[type];
  
  const animatedBorderStyle = useAnimatedStyle(() => {
    'worklet';
    const angle = glowAnim.value % 360; // 0-360 градусов, циклически
    
    // Функция для расчета яркости стороны в зависимости от угла света
    const getBrightness = (sideAngle: number) => {
      // Расстояние между текущим углом света и углом стороны
      let diff = Math.abs(angle - sideAngle);
      // Нормализуем разницу (кратчайший путь по кругу)
      if (diff > 180) diff = 360 - diff;
      
      // Чем ближе свет, тем ярче (от 0.2 до 0.8)
      // diff от 0 (прямо на стороне) до 180 (противоположная сторона)
      const brightness = 0.2 + (1 - diff / 180) * 0.6;
      return brightness;
    };
    
    const topBrightness = getBrightness(0);     // Верх = 0°
    const rightBrightness = getBrightness(90);  // Право = 90°
    const bottomBrightness = getBrightness(180); // Низ = 180°
    const leftBrightness = getBrightness(270);   // Лево = 270°
    
    return {
      position: 'absolute',
      top: -4,
      left: -4,
      right: -4,
      bottom: -4,
      borderRadius: 10,
      borderWidth: 2,
      borderTopColor: `rgba(255, 255, 255, ${topBrightness})`,
      borderRightColor: `rgba(255, 255, 255, ${rightBrightness})`,
      borderBottomColor: `rgba(255, 255, 255, ${bottomBrightness})`,
      borderLeftColor: `rgba(255, 255, 255, ${leftBrightness})`,
    };
  });
  
  return (
    <>
      {/* Диагональный градиент внутри рамки */}
      <LinearGradient
        colors={gradient.colors}
        locations={gradient.locations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: 'absolute',
          top: -3,
          left: -3,
          right: -3,
          bottom: -3,
          borderRadius: 9,
        }}
      />
      
      {/* Анимированная светящаяся рамка */}
      <Animated.View style={animatedBorderStyle} pointerEvents="none" />
    </>
  );
}

// Компонент заголовка месяца - вынесен отдельно для независимого обновления
function MonthHeader({ label, headerStyle, monthStyle, sobrietyStats }: { 
  label: string;
  headerStyle: any; 
  monthStyle: any;
  sobrietyStats?: { currentStreak: number; bestStreak: number };
}) {
  return (
    <View style={headerStyle}>
      <View style={{ flex: 1 }}>
        <Text style={monthStyle}>{label}</Text>
        {sobrietyStats && sobrietyStats.currentStreak > 0 && (
          <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '600', marginTop: 2 }}>
            🔥 {sobrietyStats.currentStreak} {sobrietyStats.currentStreak === 1 ? 'день' : sobrietyStats.currentStreak < 5 ? 'дня' : 'дней'} без алкоголя
          </Text>
        )}
      </View>
      {sobrietyStats && sobrietyStats.bestStreak > 0 && (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
            Рекорд: {sobrietyStats.bestStreak} {sobrietyStats.bestStreak === 1 ? 'день' : sobrietyStats.bestStreak < 5 ? 'дня' : 'дней'}
          </Text>
        </View>
      )}
    </View>
  );
}

// Компонент для свайп-удаления записи
function SwipeableListItem({ item, onRemove, onQuantityChange }: { item: Drink; onRemove: (id: string) => void; onQuantityChange: (id: string, delta: number) => void }) {
  const translateX = useSharedValue(0);
  const swipeState = useSharedValue(0); // 0 = idle, 1 = swiped
  const isFirstGesture = useSharedValue(true);
  const screenWidth = Dimensions.get('window').width;
  const fifthWidth = screenWidth / 5;
  const [showTrash, setShowTrash] = useState(false);
  
  const handleRemove = () => {
    onRemove(item.id);
  };
  
  const handleShowTrash = (show: boolean) => {
    setShowTrash(show);
  };
  
  const startX = useSharedValue(0);
  
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart(() => {
      startX.value = translateX.value;
      isFirstGesture.value = Math.abs(translateX.value) < 1;
    })
    .onUpdate((e) => {
      const newValue = startX.value + e.translationX;
      
      if (isFirstGesture.value) {
        if (newValue < 0) {
          const maxSwipe = -fifthWidth;
          translateX.value = Math.max(maxSwipe, newValue);
          
          if (Math.abs(newValue) > fifthWidth) {
            swipeState.value = 1;
            runOnJS(handleShowTrash)(true);
          }
        } else {
          translateX.value = 0;
        }
      } else {
        if (newValue < 0) {
          const maxSwipe = -screenWidth * 0.8;
          translateX.value = Math.max(maxSwipe, newValue);
        } else if (newValue > 0) {
          translateX.value = Math.min(0, newValue);
          if (newValue > -fifthWidth / 2) {
            swipeState.value = 0;
            runOnJS(handleShowTrash)(false);
          }
        }
      }
    })
    .onEnd((e) => {
      if (isFirstGesture.value) {
        const finalValue = startX.value + e.translationX;
        const clampedValue = Math.max(-fifthWidth, finalValue);
        
        if (Math.abs(clampedValue) < fifthWidth) {
          translateX.value = withTiming(0, { duration: 200 });
          swipeState.value = 0;
          runOnJS(handleShowTrash)(false);
        } else {
          translateX.value = withTiming(-fifthWidth, { duration: 200 });
          swipeState.value = 1;
          runOnJS(handleShowTrash)(true);
        }
        isFirstGesture.value = false;
      } else {
        const currentPos = startX.value + e.translationX;
        
        if (e.translationX < -30 || currentPos < -fifthWidth * 1.5) {
          translateX.value = withTiming(-screenWidth, { duration: 200 }, () => {
            runOnJS(handleRemove)();
          });
        } else if (e.translationX > 20 || currentPos > -fifthWidth * 0.5) {
          translateX.value = withTiming(0, { duration: 200 });
          swipeState.value = 0;
          runOnJS(handleShowTrash)(false);
          isFirstGesture.value = true;
        } else {
          translateX.value = withTiming(-fifthWidth, { duration: 200 });
        }
      }
    });
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const deleteButtonStyle = useAnimatedStyle(() => {
    const gap = 8;
    const width = Math.max(0, -translateX.value - gap);
    return {
      width: width,
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.swipeContainer}>
        <Animated.View style={[styles.deleteButtonContainer, deleteButtonStyle]}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => {
              translateX.value = withTiming(-screenWidth, { duration: 200 }, () => {
                runOnJS(handleRemove)();
              });
            }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="delete-sweep" size={28} color={colors.error} />
          </TouchableOpacity>
        </Animated.View>
        
        <Animated.View style={[styles.listItem, animatedStyle]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                <Text style={styles.itemSub}>
                  {formatTotalVolume(item.volumeMl, item.quantity ?? 1)} · {item.abvPercent}% · {item.standardUnits.toFixed(2)} ед.
                  {item.quantity && item.quantity > 1 ? ` (x${item.quantity})` : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}>
                <TouchableOpacity
                  onPress={() => onQuantityChange(item.id, -1)}
                  style={[styles.qtyButton, { marginRight: 4 }]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.qtyButtonText}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.qtyValue, { minWidth: 24, textAlign: 'center' }]}>{item.quantity ?? 1}</Text>
                <TouchableOpacity
                  onPress={() => onQuantityChange(item.id, 1)}
                  style={[styles.qtyButton, { marginLeft: 4 }]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.qtyButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export default function CalendarScreen() {
  const [all, setAll] = useState<Drink[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayList, setDayList] = useState<Drink[]>([]);
  const [dailyGoal, setDailyGoal] = useState<number | null>(null);
  const [lethalDose, setLethalDose] = useState<number>(15);
  const [appStartDate, setAppStartDate] = useState<string | null>(null);
  const appStartDateRef = useRef<string | null>(null);
  const listRef = useRef<FlatList<Date>>(null);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState<number>(0);
  const [weekRowHeight, setWeekRowHeight] = useState<number>(0);
  const hasMeasuredHeaderRef = useRef<boolean>(false);
  const hasMeasuredWeekRowRef = useRef<boolean>(false);
  
  // Вычисляем высоту списка на основе измеренных высот header и weekRow
  const listHeight = useMemo(() => {
    if (headerHeight === 0 || weekRowHeight === 0) {
      return null;
    }
    // Высота = экран - SafeArea insets - paddingTop (12px) - header - marginBottom (8px) - weekRow - marginBottom (6px) - таб-бар (49px)
    const paddingTop = 12;
    const marginAfterHeader = 8;
    const marginAfterWeekRow = 6;
    const tabBarHeight = 49; // Стандартная высота таб-бара React Navigation
    const calculatedHeight = screenHeight - insets.top - insets.bottom - paddingTop - headerHeight - marginAfterHeader - weekRowHeight - marginAfterWeekRow - tabBarHeight;
    return Math.max(300, calculatedHeight);
  }, [screenHeight, insets.top, insets.bottom, headerHeight, weekRowHeight]);

  const loadAll = useCallback(async () => {
    const startTime = performance.now();
    const list = await getAllDrinks();
    const endTime = performance.now();
    console.log(`[PERF] loadAll completed in ${(endTime - startTime).toFixed(2)}ms, drinks: ${list.length}`);
    setAll(list);
  }, []);

  const [forceUpdate, setForceUpdate] = useState(0);
  
  const loadDailyGoal = useCallback(async () => {
    console.log('[LOAD DATA] loadDailyGoal started');
    const goal = await getDailyGoal();
    setDailyGoal(goal);
    console.log('[LOAD DATA] dailyGoal loaded:', goal);
    
    const lethal = await getLethalDose();
    setLethalDose(lethal);
    console.log('[LOAD DATA] lethalDose loaded:', lethal);
    
    const startDate = await getAppStartDate();
    appStartDateRef.current = startDate;
    setAppStartDate(startDate);
    console.log('[LOAD DATA] appStartDate loaded:', startDate, '(ref also set)');
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Загружаем данные при фокусе на экран
      loadAll();
      loadDailyGoal();
      return () => {
        // Cleanup при размонтировании
      };
    }, [loadAll, loadDailyGoal])
  );

  const totalsByDate = useMemo(() => {
    const startTime = performance.now();
    const map: Record<string, number> = {};
    for (const d of all) {
      map[d.dateISO] = (map[d.dateISO] ?? 0) + d.standardUnits;
    }
    const endTime = performance.now();
    const duration = endTime - startTime;
    if (duration > 1 || all.length > 0) {
      console.log(`[PERF] totalsByDate computed in ${duration.toFixed(2)}ms, drinks: ${all.length}, dates: ${Object.keys(map).length}`);
    }
    return map;
  }, [all]);

  // Подсчет текущей серии дней без алкоголя и лучшей серии
  const sobrietyStats = useMemo(() => {
    const today = new Date();
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    
    // Находим дату последнего употребления
    let lastDrinkDate: Date | null = null;
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const iso = formatISO(checkDate);
      const total = totalsByDate[iso] ?? 0;
      
      if (total > 0) {
        lastDrinkDate = checkDate;
        break;
      }
    }
    
    // Считаем дни с последнего употребления (сегодня не считаем, только завершенные дни)
    if (lastDrinkDate) {
      const diffTime = today.getTime() - lastDrinkDate.getTime();
      const daysSinceLastDrink = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      // Вычитаем 1, чтобы не считать сегодняшний день
      currentStreak = Math.max(0, daysSinceLastDrink - 1);
    } else {
      // Если не нашли употребление за 365 дней, считаем что серия = 365+ (минус сегодня)
      currentStreak = 364;
    }
    
    // Считаем лучшую серию за все время (с учетом даты первого запуска)
    // Находим диапазон дат
    const allDates = Object.keys(totalsByDate);
    
    if (allDates.length === 0) {
      // Если нет записей вообще, рекорд = 0
      bestStreak = 0;
    } else {
      const sortedDates = allDates.sort();
      const firstDate = new Date(sortedDates[0]);
      const startDateFilter = appStartDateRef.current ? new Date(appStartDateRef.current) : firstDate;
      // Начинаем с более РАННЕЙ даты (или с appStartDate если она установлена)
      const effectiveStartDate = startDateFilter < firstDate ? startDateFilter : firstDate;
      
      // Проходим по всем дням от startDate до вчерашнего дня (сегодня не считаем)
      const currentDate = new Date(effectiveStartDate);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() - 1); // Вчерашний день - последний завершенный
      
      while (currentDate <= endDate) {
        const iso = formatISO(currentDate);
        const total = totalsByDate[iso] ?? 0;
        
        if (total === 0) {
          tempStreak++;
          if (tempStreak > bestStreak) {
            bestStreak = tempStreak;
          }
        } else {
          tempStreak = 0;
        }
        
        // Переходим к следующему дню
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    // Текущая серия может быть лучшей
    if (currentStreak > bestStreak) {
      bestStreak = currentStreak;
    }
    
    return { currentStreak, bestStreak };
  }, [totalsByDate, forceUpdate]);

  // Форсируем обновление при изменении appStartDate
  useEffect(() => {
    if (appStartDate !== null) {
      setForceUpdate(prev => prev + 1);
    }
  }, [appStartDate]);
  
  // Проверка и разблокировка достижений
  useEffect(() => {
    const checkAchievements = async () => {
      if (sobrietyStats.currentStreak > 0) {
        const newAchievements = await checkAndUnlockAchievements(sobrietyStats.currentStreak);
        if (newAchievements.length > 0) {
          // Показываем уведомление о новом достижении
          const achievement = newAchievements[0];
          Alert.alert(
            '🏆 Достижение разблокировано!',
            `${achievement.title}\n${achievement.description}`,
            [{ text: 'Отлично!', style: 'default' }]
          );
        }
      }
    };
    checkAchievements();
  }, [sobrietyStats.currentStreak]);

  // Определяем серии дней без алкоголя для визуального выделения
  const streaksByDate = useMemo(() => {
    const map: Record<string, number> = {};
    const sortedDates = Object.keys(totalsByDate).sort();
    
    let currentStreak = 0;
    for (const dateISO of sortedDates) {
      const total = totalsByDate[dateISO] ?? 0;
      if (total === 0) {
        currentStreak++;
        map[dateISO] = currentStreak;
      } else {
        currentStreak = 0;
      }
    }
    
    return map;
  }, [totalsByDate]);

  // Подготовим список месяцев: 3 года назад до текущего месяца (текущий - последний)
  const base = useMemo(() => new Date(), []);
  const months: Date[] = useMemo(() => {
    const arr: Date[] = [];
    for (let i = -36; i <= 0; i++) {
      arr.push(new Date(base.getFullYear(), base.getMonth() + i, 1));
    }
    return arr;
  }, [base]);
  
  // Мемоизируем матрицы для каждого месяца
  const monthMatrices = useMemo(() => {
    const startTime = performance.now();
    const matrices: Map<string, Date[]> = new Map();
    months.forEach(month => {
      const key = `${month.getFullYear()}-${month.getMonth()}`;
      matrices.set(key, buildMonthMatrix(month));
    });
    const endTime = performance.now();
    console.log(`[PERF] monthMatrices computed in ${(endTime - startTime).toFixed(2)}ms, months: ${months.length}`);
    return matrices;
  }, [months]);
  
  const initialIndex = months.length - 1; // текущий месяц - последний в массиве
  const [visibleIndex, setVisibleIndex] = useState(initialIndex);
  const lastScrollIndexRef = useRef(initialIndex);
  
  // Отдельное состояние для текста заголовка - обновляется независимо
  const [monthLabel, setMonthLabel] = useState<string>('');

  // Форматтер вынесен наружу, чтобы не создавать его при каждом рендере
  const dateFormatter = useMemo(() => 
    new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }),
    []
  );

  // Предрендерим все тексты месяцев для мгновенного переключения
  const monthLabels = useMemo(() => {
    return months.map((month) => dateFormatter.format(month));
  }, [months, dateFormatter]);

  // Инициализируем начальный текст
  useEffect(() => {
    if (monthLabels.length > 0 && !monthLabel) {
      setMonthLabel(monthLabels[initialIndex] || '');
    }
  }, [monthLabels, initialIndex, monthLabel]);

  // initialScrollIndex делает начальный скролл, не нужен useEffect

  const onMomentumEndHorizontal = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / screenWidth);
    if (idx !== visibleIndex) setVisibleIndex(idx);
  };


  const openDay = useCallback((date: Date) => {
    const startTime = performance.now();
    const iso = formatISO(date);
    setSelectedDate(iso);
    // Используем локальное состояние all вместо загрузки из AsyncStorage
    const list = all.filter((d) => d.dateISO === iso);
    const endTime = performance.now();
    console.log(`[PERF] openDay completed in ${(endTime - startTime).toFixed(2)}ms, date: ${iso}, drinks: ${list.length}`);
    setDayList(list);
  }, [all]);

  const deleteEntry = async (id: string) => {
    // Оптимистичное обновление UI - удаляем из dayList сразу
    if (selectedDate) {
      const updatedDayList = dayList.filter(d => d.id !== id);
      setDayList(updatedDayList);
    }
    
    // Удаляем из хранилища асинхронно
    await removeDrink(id);
    
    // НЕ обновляем all когда модалка открыта - это вызывает перерендер календаря (500ms!)
    // Обновим all когда модалка закроется через loadAll() в closeAddModal/closeCustomModal
  };

  // Состояния для добавления напитков
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [userPresets, setUserPresets] = useState<PresetDrink[]>([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<PresetDrink['beverageType']>('beer');
  const [newVolume, setNewVolume] = useState('500');
  const [newAbv, setNewAbv] = useState('5');
  const [searchQuery, setSearchQuery] = useState('');

  // Загружаем пресеты при монтировании
  useEffect(() => {
    (async () => {
      try {
        const presets = await getUserPresets();
        setUserPresets(presets);
      } catch (error) {
        console.error('[CalendarScreen] Error loading presets:', error);
      }
    })();
  }, []);

  // Подписываемся на события изменения пресетов для синхронизации между экранами
  useEffect(() => {
    const unsubscribe = presetsEventEmitter.subscribe((presets) => {
      setUserPresets(presets);
    });
    return unsubscribe;
  }, []);

  // Отслеживание изменений состояния модальных окон
  useEffect(() => {  }, [addModalVisible, customModalVisible, selectedDate]);

  const getBeverageTypeLabel = (type: PresetDrink['beverageType']): string => {
    const labels: Record<PresetDrink['beverageType'], string> = {
      beer: 'Пиво',
      wine: 'Вино',
      spirit: 'Крепкий',
      cocktail: 'Коктейль',
      other: 'Другое',
    };
    return labels[type] || labels.other;
  };

  // Функции для работы с модальными окнами
  const openAddModal = () => {    if (!selectedDate) {      return;
    }    setAddModalVisible(true);
  };
  const closeAddModal = () => {
    setAddModalVisible(false);
    setSearchQuery(''); // Очищаем поисковый запрос при закрытии
    // Обновляем список записей дня из текущего состояния all
    if (selectedDate) {
      const list = all.filter((d) => d.dateISO === selectedDate);
      setDayList(list);
    }
    // Обновляем календарь после закрытия модалки
    loadAll();
  };
  const openCustomModal = () => {    try {
      setAddModalVisible(false);
      setSearchQuery(''); // Очищаем поисковый запрос при закрытии
      setCustomModalVisible(true);    } catch (error) {
      console.error('[CalendarScreen] Error in openCustomModal:', error);
    }
  };
  const closeCustomModal = () => {
    setCustomModalVisible(false);
    setNewName('');
    setNewType('beer');
    setNewVolume('500');
    setNewAbv('5');
    // Обновляем список записей дня из текущего состояния all
    if (selectedDate) {
      const list = all.filter((d) => d.dateISO === selectedDate);
      setDayList(list);
    }
  };

  // Добавление напитка сразу с количеством 1
  const addDrinkFromPreset = async (preset: PresetDrink) => {
    if (!selectedDate) {
      return;
    }
    try {
      const baseUnits = calculateStandardUnits(preset.volumeMl, preset.abvPercent);
      const entry: Drink = {
        id: `drink_${Date.now()}`,
        dateISO: selectedDate,
        name: preset.name,
        beverageType: preset.beverageType,
        volumeMl: preset.volumeMl,
        abvPercent: preset.abvPercent,
        standardUnits: baseUnits,
        quantity: 1,
      };
      // Закрываем модальное окно добавления сразу
      setAddModalVisible(false);
      setSearchQuery(''); // Очищаем поисковый запрос при закрытии
      
      // Добавляем в хранилище асинхронно
      const updated = await addOrMergeDrink(entry);
      
      // Обновляем список записей дня из обновленного состояния
      const list = updated.filter((d) => d.dateISO === selectedDate);
      setDayList(list);
      
      // НЕ обновляем all когда модалка открыта - это вызывает перерендер календаря (500ms!)
      // Обновим all когда модалка закроется через loadAll() в closeAddModal
    } catch (error) {
      console.error('[CalendarScreen] Error in addDrinkFromPreset:', error);
    }
  };

  // Изменение количества записи
  const changeQuantity = async (id: string, delta: number) => {
    const startTime = performance.now();
    if (!selectedDate) return;
    
    const drink = dayList.find(d => d.id === id);
    if (!drink) return;
    
    const currentQty = drink.quantity ?? 1;
    const newQty = currentQty + delta;
    
    if (newQty <= 0) {
      // Удаляем запись если количество стало 0 или меньше
      await deleteEntry(id);
      const endTime = performance.now();
      console.log(`[PERF] changeQuantity (delete) completed in ${(endTime - startTime).toFixed(2)}ms`);
      return;
    }
    
    // Оптимистичное обновление UI - обновляем dayList сразу (как в TodayScreen)
    const updatedDayList = dayList.map(d => {
      if (d.id === id) {
        // Пересчитываем standardUnits с новым количеством
        const baseUnits = calculateStandardUnits(d.volumeMl, d.abvPercent);
        const newStandardUnits = Math.round(baseUnits * newQty * 100) / 100;
        return { ...d, quantity: newQty, standardUnits: newStandardUnits };
      }
      return d;
    });
    setDayList(updatedDayList);
    
    // Обновляем запись в хранилище асинхронно БЕЗ ожидания (как в TodayScreen)
    // Не ждем завершения, чтобы UI оставался отзывчивым
    updateDrink(id, { quantity: newQty }).catch(error => {
      console.error('[CalendarScreen] Error updating drink:', error);
      // В случае ошибки перезагружаем данные
      if (selectedDate) {
        (async () => {
          const list = await getDrinksByDate(selectedDate);
          setDayList(list);
        })();
      }
    });
    
    const endTime = performance.now();
    console.log(`[PERF] changeQuantity completed in ${(endTime - startTime).toFixed(2)}ms, id: ${id}, delta: ${delta}`);
  };

  // Добавление предложенного пресета: добавляет напиток только на день (без добавления в избранное)
  const addSuggestedPreset = async (preset: PresetDrink) => {
    if (!selectedDate) {
      return;
    }
    try {
      // Добавляем напиток на выбранный день
      const baseUnits = calculateStandardUnits(preset.volumeMl, preset.abvPercent);
      const entry: Drink = {
        id: `drink_${Date.now()}`,
        dateISO: selectedDate,
        name: preset.name,
        beverageType: preset.beverageType,
        volumeMl: preset.volumeMl,
        abvPercent: preset.abvPercent,
        standardUnits: baseUnits,
        quantity: 1,
      };
      
      // Закрываем модальное окно добавления сразу
      setAddModalVisible(false);
      setSearchQuery(''); // Очищаем поисковый запрос при закрытии
      
      // Добавляем напиток на день
      const updated = await addOrMergeDrink(entry);
      
      // Обновляем список записей дня
      const list = updated.filter((d) => d.dateISO === selectedDate);
      setDayList(list);
    } catch (error) {
      console.error('[CalendarScreen] Error in addSuggestedPreset:', error);
    }
  };

  // Фильтруем избранное по поисковому запросу
  const filteredUserPresets = useMemo(() => {
    const startTime = performance.now();
    if (!searchQuery || !searchQuery.trim()) {
      return userPresets;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const filtered = userPresets.filter((preset) => 
      preset.name.toLowerCase().includes(query)
    );
    const endTime = performance.now();
    if (endTime - startTime > 1) {
      console.log(`[PERF] filteredUserPresets computed in ${(endTime - startTime).toFixed(2)}ms, filtered: ${filtered.length}/${userPresets.length}`);
    }
    return filtered;
  }, [userPresets, searchQuery]);

  // Фильтруем предложенные напитки - исключаем те, что уже в избранном
  // Проверяем точное совпадение по объему, крепости и типу
  // Также фильтруем по поисковому запросу
  const availableSuggestedPresets = useMemo(() => {
    const startTime = performance.now();
    const filtered = suggestedPresets.filter((suggested) => {
      return !userPresets.some((userPreset) => 
        userPreset.volumeMl === suggested.volumeMl &&
        userPreset.abvPercent === suggested.abvPercent &&
        userPreset.beverageType === suggested.beverageType
      );
    });
    
    // Фильтрация по поисковому запросу
    let result = filtered;
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = filtered.filter((preset) => 
        preset.name.toLowerCase().includes(query)
      );
    }
    const endTime = performance.now();
    if (endTime - startTime > 1) {
      console.log(`[PERF] availableSuggestedPresets computed in ${(endTime - startTime).toFixed(2)}ms, result: ${result.length}/${suggestedPresets.length}`);
    }
    return result;
  }, [userPresets, searchQuery]);

  // Сохранение кастомного напитка
  const saveCustomPreset = async () => {
    if (!selectedDate) return;
    const volume = parseFloat(newVolume);
    const abv = parseFloat(newAbv);
    if (!newName || isNaN(volume) || isNaN(abv)) {
      Alert.alert('Ошибка', 'Заполните название, объём и крепость');
      return;
    }
    const units = calculateStandardUnits(volume, abv);
    const entry: Drink = {
      id: `drink_${Date.now()}`,
      dateISO: selectedDate,
      name: newName,
      beverageType: newType,
      volumeMl: volume,
      abvPercent: abv,
      standardUnits: units,
      quantity: 1,
    };
    
    closeCustomModal();
    
    const updated = await addOrMergeDrink(entry);
    
    if (selectedDate) {
      const list = updated.filter((d) => d.dateISO === selectedDate);
      setDayList(list);
    }
    
    // НЕ обновляем all когда модалка открыта - это вызывает перерендер календаря (500ms!)
    // Обновим all когда модалка закроется через loadAll() в closeCustomModal
  };

  const dayTotalUnits = useMemo(() => dayList.reduce((s, d) => s + d.standardUnits, 0), [dayList]);
  const dayTotalVolumeMl = useMemo(() => dayList.reduce((s, d) => s + d.volumeMl * (d.quantity ?? 1), 0), [dayList]);

  const scrollToToday = useCallback(() => {
    if (listRef.current && listHeight && listHeight > 0) {
      try {
        listRef.current.scrollToIndex({ 
          index: initialIndex, 
          animated: true,
        });
      } catch (error) {
        // Если не удалось, пробуем через offset
        if (listRef.current) {
          listRef.current.scrollToOffset({ 
            offset: initialIndex * actualMonthHeight, 
            animated: true,
          });
        }
      }
    }
  }, [listHeight, initialIndex]);

  // Мемоизируем условие показа кнопки чтобы избежать задержки
  const showBackToToday = useMemo(() => visibleIndex < initialIndex, [visibleIndex, initialIndex]);

  // Мемоизируем renderItem для оптимизации производительности
  // Вычисляем высоту ячейки чтобы 6 рядов точно влезли в listHeight
  const cellHeight = listHeight ? Math.floor(listHeight / 6) : 0;
  const actualMonthHeight = cellHeight * 6;
  
  console.log(`[INIT] listHeight=${listHeight}, cellHeight=${cellHeight}, actualMonthHeight=${actualMonthHeight}`);
  
  const renderMonthItem = useCallback(({ item, index }: { item: Date; index: number }) => {
    if (!listHeight || listHeight <= 0) {
      return <View style={{ height: 300, width: screenWidth }} />;
    }
    const monthKey = `${item.getFullYear()}-${item.getMonth()}`;
    const matrix = monthMatrices.get(monthKey) || buildMonthMatrix(item);
    
    const firstDay = matrix[0];
    const lastDay = matrix[matrix.length - 1];
    console.log(`[RENDER MONTH] Index: ${index}, Month: ${item.getMonth() + 1}/${item.getFullYear()}, cellHeight=${cellHeight}, actualMonthHeight=${actualMonthHeight}`);
    console.log(`  First cell: ${formatISO(firstDay)}, Last cell: ${formatISO(lastDay)}`);
    
    const cellWidth = Math.floor(screenWidth / 7);
    const monthWidth = cellWidth * 7;
    
    const todayISO = formatISO(new Date());
    const today = new Date();
    
    // Вычисляем все серии без алкоголя для поиска лучшей
    const allStreaks: { dates: string[]; length: number }[] = [];
    const startDate = appStartDateRef.current ? new Date(appStartDateRef.current) : new Date(0);
    let scanDate = new Date(today);
    scanDate.setHours(0, 0, 0, 0);
    
    let currentScanStreak: string[] = [];
    while (scanDate >= startDate) {
      const scanISO = formatISO(scanDate);
      const scanTotal = totalsByDate[scanISO] ?? 0;
      
      if (scanTotal === 0 && scanISO <= todayISO) {
        currentScanStreak.push(scanISO);
      } else {
        if (currentScanStreak.length > 0) {
          allStreaks.push({ dates: [...currentScanStreak], length: currentScanStreak.length });
          currentScanStreak = [];
        }
      }
      scanDate.setDate(scanDate.getDate() - 1);
    }
    // Добавляем последнюю серию если есть
    if (currentScanStreak.length > 0) {
      allStreaks.push({ dates: [...currentScanStreak], length: currentScanStreak.length });
    }
    
    // Находим лучшую завершенную серию (не текущую, если она активна)
    const currentStreakActive = allStreaks.length > 0 && allStreaks[0].dates.includes(todayISO);
    const completedStreaks = currentStreakActive ? allStreaks.slice(1) : allStreaks;
    const bestCompletedStreak = completedStreaks.length > 0 
      ? completedStreaks.reduce((best, current) => current.length > best.length ? current : best)
      : null;
    
    // Создаем Map для лучшей завершенной серии
    const bestStreakDays = new Map<string, number>();
    if (bestCompletedStreak && bestCompletedStreak.length >= 7) {
      bestCompletedStreak.dates.reverse().forEach((iso, index) => {
        bestStreakDays.set(iso, index + 1);
      });
    }
    
    // Вычисляем текущую серию без алкоголя с номерами дней
    const currentStreakDays = new Map<string, number>(); // ISO -> день в серии (1, 2, 3...)
    let tempDate = new Date(today);
    tempDate.setHours(0, 0, 0, 0);
    
    // Идем от сегодня назад, пока встречаем дни без алкоголя
    const streakDates: string[] = [];
    while (tempDate >= startDate) {
      const tempISO = formatISO(tempDate);
      const tempTotal = totalsByDate[tempISO] ?? 0;
      
      if (tempTotal === 0 && tempISO <= todayISO) {
        streakDates.push(tempISO);
        tempDate.setDate(tempDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    // Присваиваем номера дней (от самого раннего к сегодня)
    streakDates.reverse().forEach((iso, index) => {
      currentStreakDays.set(iso, index + 1);
    });
    
    const cells = matrix.map((d, idx) => {
      const iso = formatISO(d);
      const total = totalsByDate[iso] ?? 0;
      const isCurrentMonth = d.getMonth() === item.getMonth();
      const isToday = iso === todayISO;
      const isLastCol = (idx % 7) === 6;
      const isLastRow = Math.floor(idx / 7) === 5;
      const streakDayNumber = currentStreakDays.get(iso);
      const isInCurrentStreak = streakDayNumber !== undefined;
      const bestStreakDayNumber = bestStreakDays.get(iso);
      const isInBestStreak = bestStreakDayNumber !== undefined;
      
      // Определяем стиль свечения в зависимости от длины серии (детальная прогрессия)
      let glowStyle = null;
      
      // Сначала проверяем лучшую серию (стили дублируют стандартные, градиент поверх)
      if (isInBestStreak && bestStreakDayNumber && bestCompletedStreak) {
        const bestLength = bestCompletedStreak.length;
        if (bestLength >= 30) {
          glowStyle = styles.cellGoldStrong; // 30+ дней - золото
        } else if (bestLength >= 14) {
          glowStyle = styles.cellGoldMedium; // 14-29 дней - серебро
        } else {
          glowStyle = styles.cellGoldLight; // 7-13 дней - медь
        }
      } else if (isInCurrentStreak && streakDayNumber) {
        if (streakDayNumber >= 30) {
          glowStyle = styles.cellGlow30Plus;
        } else if (streakDayNumber >= 21) {
          glowStyle = styles.cellGlow21;
        } else if (streakDayNumber >= 14) {
          glowStyle = styles.cellGlow14;
        } else if (streakDayNumber >= 10) {
          glowStyle = styles.cellGlow10;
        } else if (streakDayNumber >= 7) {
          glowStyle = styles.cellGlow7;
        } else if (streakDayNumber === 6) {
          glowStyle = styles.cellGlow6;
        } else if (streakDayNumber === 5) {
          glowStyle = styles.cellGlow5;
        } else if (streakDayNumber === 4) {
          glowStyle = styles.cellGlow4;
        } else if (streakDayNumber === 3) {
          glowStyle = styles.cellGlow3;
        } else if (streakDayNumber === 2) {
          glowStyle = styles.cellGlow2;
        } else if (streakDayNumber === 1) {
          glowStyle = styles.cellGlow1;
        }
      }
      
      // Тепловая карта: градиент от зеленого до красного
      let cellColorStyle = null;
      
      if (dailyGoal !== null && dailyGoal > 0 && total > 0) {
        if (total <= dailyGoal * 0.5) {
          cellColorStyle = styles.cellLowAmount; // Светло-зеленый
        } else if (total <= dailyGoal) {
          cellColorStyle = styles.cellModerateAmount; // Желто-зеленый
        } else if (total <= dailyGoal * 1.5) {
          cellColorStyle = styles.cellHighAmount; // Оранжевый
        } else if (total < lethalDose) {
          cellColorStyle = styles.cellVeryHighAmount; // Красный
        } else {
          cellColorStyle = styles.cellCriticalAmount; // Темно-красный
        }
      } else if (total > 0) {
        // Если цель не установлена, показываем только факт употребления
        if (total >= lethalDose) {
          cellColorStyle = styles.cellCriticalAmount;
        } else {
          cellColorStyle = styles.cellModerateAmount;
        }
      }
      
      return (
        <TouchableOpacity
          key={`${iso}_${idx}`}
          style={[
            styles.cell,
            { width: cellWidth - 4, height: cellHeight - 4 },
            isCurrentMonth ? styles.cellCurrent : styles.cellAdjacent,
            cellColorStyle,
            isToday && styles.cellToday,
            glowStyle,
          ]}
          onPress={() => openDay(d)}
        >
          <View style={styles.cellContent}>
            {/* Градиент слитка + анимированная рамка */}
            {isInBestStreak && bestCompletedStreak && (
              <MetalGradient 
                type={bestCompletedStreak.length >= 30 ? 'gold' : 
                     bestCompletedStreak.length >= 14 ? 'silver' : 'bronze'} 
              />
            )}
            <Text style={[styles.dayNum, !isCurrentMonth && styles.dayNumMuted]}>{d.getDate()}</Text>
            <View style={styles.badgeContainer}>
              {total >= lethalDose ? (
                <View style={styles.deadIconContainer}>
                  <Text style={styles.deadEmoji}>💀</Text>
                </View>
              ) : total > 0 ? (
                <View style={styles.badge}>
                  <MaterialCommunityIcons name="glass-cocktail" size={14} color="#f59e0b" />
                  <Text style={styles.badgeUnits}>{total.toFixed(1)}</Text>
                  <Text style={styles.badgeAlcohol}>{(total * 10).toFixed(0)}г</Text>
                </View>
              ) : isInBestStreak && bestCompletedStreak ? (
                <Text style={styles.awardEmoji}>
                  {bestCompletedStreak.length >= 30 ? '🏆' : 
                   bestCompletedStreak.length >= 14 ? '🥈' : '🥉'}
                </Text>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      );
    });
    
    return (
      <View 
        style={{ height: actualMonthHeight, width: monthWidth, alignSelf: 'center', overflow: 'hidden' }}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          console.log(`[LAYOUT] Month ${item.getMonth() + 1}: container height=${h}, expected=${actualMonthHeight}`);
        }}
      >
        <View 
          style={styles.grid}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            console.log(`[LAYOUT] Month ${item.getMonth() + 1}: grid height=${h}, cellHeight=${cellHeight}`);
          }}
        >
          {cells}
        </View>
      </View>
    );
  }, [actualMonthHeight, listHeight, screenWidth, monthMatrices, totalsByDate, streaksByDate, dailyGoal, lethalDose, openDay, initialIndex]);


  // Мемоизируем календарь чтобы он не перерендеривался при изменении dayList
  const calendarView = useMemo(() => {
    if (listHeight === null || listHeight <= 0 || actualMonthHeight <= 0) return null;
    
    const totalContentHeight = actualMonthHeight * months.length;
    console.log(`[FLATLIST] Creating FlatList: actualMonthHeight=${actualMonthHeight}, months=${months.length}, totalContentHeight=${totalContentHeight}`);
    
    return (
      <View style={{ height: actualMonthHeight, width: screenWidth, overflow: 'hidden' }}>
        <FlatList
          ref={listRef}
          data={months}
          horizontal={false}
          pagingEnabled
          snapToInterval={actualMonthHeight}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          style={{ height: actualMonthHeight, width: screenWidth, overflow: 'hidden' }}
          contentContainerStyle={{ height: totalContentHeight }}
          getItemLayout={(_, index) => {
            const layout = { 
              length: actualMonthHeight, 
              offset: actualMonthHeight * index, 
              index 
            };
            if (index % 3 === 0) { // Логируем каждый 3-й для меньшего спама
              console.log(`[ITEM LAYOUT] Index ${index}: length=${layout.length}, offset=${layout.offset}`);
            }
            return layout;
          }}
          keyExtractor={(item, index) => `month-${item.getFullYear()}-${item.getMonth()}-${index}`}
          initialScrollIndex={initialIndex}
          removeClippedSubviews={true}
          windowSize={3}
          maxToRenderPerBatch={1}
          updateCellsBatchingPeriod={100}
          initialNumToRender={1}
          scrollEventThrottle={16}
          onScrollToIndexFailed={() => {
            // Игнорируем ошибки скролла
          }}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            const idx = Math.round(y / actualMonthHeight);
            
            console.log(`[SCROLL] y=${y.toFixed(1)}, actualMonthHeight=${actualMonthHeight}, idx=${idx}`);
            
            // Обновляем только если индекс действительно изменился
            if (idx !== lastScrollIndexRef.current && idx >= 0 && idx < months.length) {
              lastScrollIndexRef.current = idx;
              console.log(`[SCROLL] Changed to month index ${idx}`);
              // Обновляем текст заголовка синхронно для мгновенного отображения
              if (monthLabels[idx]) {
                setMonthLabel(monthLabels[idx]);
              }
              // Обновляем состояние асинхронно для других зависимостей
              requestAnimationFrame(() => {
                setVisibleIndex(idx);
              });
            }
          }}
          onMomentumScrollEnd={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            const idx = Math.round(y / actualMonthHeight);
            const currentIdx = lastScrollIndexRef.current;
            if (idx !== currentIdx) {
              setVisibleIndex(idx);
            }
          }}
          renderItem={renderMonthItem}
        />
      </View>
    );
  }, [actualMonthHeight, listHeight, screenWidth, months, renderMonthItem, listRef]);
  

  // Пока не измерили высоту, показываем только структуру для измерения
  const needsMeasurement = listHeight === null || listHeight <= 0;

  return (
    <SafeAreaView style={styles.container}>
      <View 
        onLayout={(e) => {
          const height = e.nativeEvent.layout.height;
          if (!hasMeasuredHeaderRef.current && height > 0) {
            hasMeasuredHeaderRef.current = true;
            setHeaderHeight(height);
          }
          }}
        >
        <MonthHeader 
          label={monthLabel}
          headerStyle={styles.headerRow} 
          monthStyle={styles.month}
          sobrietyStats={sobrietyStats}
        />
      </View>

      <View 
        style={styles.weekRow}
        onLayout={(e) => {
          const height = e.nativeEvent.layout.height;
          if (!hasMeasuredWeekRowRef.current && height > 0) {
            hasMeasuredWeekRowRef.current = true;
            setWeekRowHeight(height);
          }
        }}
      >
        {WEEKDAY_SHORT_RU.map((w) => (
          <Text key={w} style={styles.weekCell}>{w}</Text>
        ))}
      </View>

      {/* Календарь - мемоизирован, не перерендеривается при изменении dayList */}
      {!needsMeasurement && calendarView}
      
      {/* Спиннер пока измеряется высота */}
      {needsMeasurement && (
        <View style={{ 
          flex: 1,
          justifyContent: 'center', 
          alignItems: 'center',
          backgroundColor: colors.background
        }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Кнопка возврата к текущему месяцу */}
      {showBackToToday && (
        <TouchableOpacity
          style={styles.backToTodayButton}
          onPress={scrollToToday}
          activeOpacity={0.8}
        >
          <FontAwesome name="chevron-circle-down" size={44} color={colors.primaryLight} />
        </TouchableOpacity>
      )}

      <Modal visible={!!selectedDate && !addModalVisible && !customModalVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={() => {
          setSelectedDate(null);
          loadAll();
        }}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSpacer} />
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalCard}>
                <GestureDetector gesture={Gesture.Pan()
                  .activeOffsetY([10, 100])
                  .failOffsetX([-50, 50])
                  .onEnd((e) => {
                    if (e.translationY > 50) {
                      runOnJS(setSelectedDate)(null);
                      runOnJS(loadAll)();
                    }
                  })
                }>
                  <TouchableOpacity 
                    style={styles.modalDragHandle}
                    onPress={() => {
                      setSelectedDate(null);
                      // Обновляем календарь после закрытия модалки дня
                      loadAll();
                    }}
                    activeOpacity={1}
                  >
                    <View style={styles.modalDragBar} />
                  </TouchableOpacity>
                </GestureDetector>
                <View style={[styles.modalHeader, { marginTop: 4 }]}>
                  <View style={{ flex: 1 }}>
                    {selectedDate && (() => {
                      const date = new Date(selectedDate + 'T00:00:00');
                      const weekdayIndex = getWeekdayIndexMonFirst(date);
                      const weekdayShort = WEEKDAY_SHORT_RU[weekdayIndex];
                      const dayNumber = date.getDate();
                      const month = date.toLocaleDateString('ru-RU', { month: 'short' });
                      return (
                        <Text style={styles.modalTitle}>
                          {weekdayShort}, {dayNumber} {month}
                        </Text>
                      );
                    })()}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <MaterialCommunityIcons name="cup" size={14} color={colors.textSecondary} />
                      <Text style={styles.modalTotal}>{formatTotalVolume(dayTotalVolumeMl, 1)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <MaterialIcons name="water-drop" size={14} color={colors.textSecondary} />
                      <Text style={styles.modalTotal}>{(dayTotalUnits * 10).toFixed(0)}г</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <MaterialCommunityIcons name="calculator" size={14} color={colors.textSecondary} />
                      <Text style={styles.modalTotal}>{dayTotalUnits.toFixed(1)}</Text>
                    </View>
                  </View>
                </View>
                <View style={{ marginTop: 20 }}>
                  <FlatList
                    data={dayList}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 10 + insets.bottom }}
                    renderItem={({ item }) => (
                      <SwipeableListItem
                        item={item}
                        onRemove={deleteEntry}
                        onQuantityChange={changeQuantity}
                      />
                    )}
                    ListEmptyComponent={
                      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                        <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>Нет записей</Text>
                      </View>
                    }
                    ListFooterComponent={
                      <TouchableOpacity 
                        onPress={openAddModal}
                        style={styles.addDrinkButton}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.addDrinkButtonText}>+ Добавить напиток</Text>
                      </TouchableOpacity>
                    }
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Модалка выбора напитка для добавления */}
      <Modal 
        visible={addModalVisible && !customModalVisible} 
        animationType="slide" 
        transparent
        onRequestClose={closeAddModal}
      >
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.modalBackdrop}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
              style={[
                styles.kav,
                searchQuery && searchQuery.trim() && { justifyContent: 'flex-start' }
              ]}
            >
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={[
                  styles.modalCard,
                  searchQuery && searchQuery.trim() && [styles.modalCardFullScreen, { paddingTop: 8 + insets.top }]
                ]}>
                  <GestureDetector gesture={Gesture.Pan()
                    .activeOffsetY([10, 100])
                    .failOffsetX([-50, 50])
                    .onEnd((e) => {
                      if (e.translationY > 50) {
                        runOnJS(closeAddModal)();
                      }
                    })
                  }>
                    <TouchableOpacity 
                      style={styles.modalDragHandle}
                      onPress={closeAddModal}
                      activeOpacity={1}
                    >
                      <View style={styles.modalDragBar} />
                    </TouchableOpacity>
                  </GestureDetector>
                  <View style={searchQuery && searchQuery.trim() ? { flex: 1 } : {}}>
                    <Text style={styles.modalTitle}>Добавить напиток</Text>
                    <Text style={{ marginBottom: 12, color: colors.textSecondary }}>Выберите из избранного или добавьте свой</Text>
                  
                    {/* Строка поиска для предложенных пресетов */}
                    <TextInput
                      placeholder="Поиск напитков..."
                      placeholderTextColor={colors.textTertiary}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      style={styles.searchInput}
                      returnKeyType="search"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  
                    <ScrollView 
                      style={searchQuery && searchQuery.trim() ? { flex: 1 } : { maxHeight: 300 }} 
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={{ paddingBottom: 10 + insets.bottom }}
                    >
                  {filteredUserPresets.length > 0 && (
                    <>
                      <Text style={{ marginBottom: 8, color: colors.textSecondary, fontWeight: '600' }}>Избранное</Text>
                      {filteredUserPresets.map((preset) => (
                        <Pressable
                          key={preset.id}
                          style={({ pressed }) => [
                            styles.presetItem,
                            pressed && { opacity: 0.7 }
                          ]}
                          onPressIn={() => {
                            Keyboard.dismiss();
                          }}
                          onPress={() => {
                            addDrinkFromPreset(preset);
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={styles.presetText}>{preset.name}</Text>
                            <Text style={styles.presetDetails}>{preset.volumeMl} мл · {preset.abvPercent}%</Text>
                          </View>
                        </Pressable>
                      ))}
                    </>
                  )}
                  
                  {availableSuggestedPresets.length > 0 && (
                    <>
                      <Text style={{ marginTop: 16, marginBottom: 8, color: colors.textSecondary, fontWeight: '600' }}>Предложенные</Text>
                      {availableSuggestedPresets.map((preset) => (
                        <Pressable
                          key={preset.id}
                          style={({ pressed }) => [
                            styles.suggestedItem,
                            pressed && { opacity: 0.7 }
                          ]}
                          onPressIn={() => {
                            Keyboard.dismiss();
                          }}
                          onPress={() => {
                            addSuggestedPreset(preset);
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={styles.suggestedText}>{preset.name}</Text>
                            <Text style={styles.suggestedDetails}>{preset.volumeMl} мл · {preset.abvPercent}%</Text>
                          </View>
                        </Pressable>
                      ))}
                    </>
                  )}
                  
                  <TouchableOpacity
                    style={styles.addCustomButton}
                    onPress={() => {
                      Keyboard.dismiss();
                      openCustomModal();
                    }}
                  >
                    <Text style={styles.addCustomButtonText}>+ Добавить свой напиток</Text>
                  </TouchableOpacity>
                </ScrollView>
                  </View>
                </View>
            </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Модалка добавления своего напитка */}
      <Modal visible={customModalVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={closeCustomModal}>
          <View style={styles.modalBackdrop}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
              style={styles.kav}
            >
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalCard}>
                  <GestureDetector gesture={Gesture.Pan()
                    .activeOffsetY([10, 100])
                    .failOffsetX([-50, 50])
                    .onEnd((e) => {
                      if (e.translationY > 50) {
                        runOnJS(closeCustomModal)();
                      }
                    })
                  }>
                    <TouchableOpacity 
                      style={styles.modalDragHandle}
                      onPress={closeCustomModal}
                      activeOpacity={1}
                    >
                      <View style={styles.modalDragBar} />
                    </TouchableOpacity>
                  </GestureDetector>
                  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text style={styles.modalTitle}>Новый напиток</Text>
                    <Text style={{ marginBottom: 12, color: colors.textSecondary, fontSize: 14 }}>
                      Объём и крепость будут автоматически добавлены в название
                    </Text>
                    <TextInput
                      placeholder="Название (например, Джин-тоник)"
                      placeholderTextColor={colors.textTertiary}
                      value={newName}
                      onChangeText={setNewName}
                      style={styles.input}
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    <View style={styles.row}>
                      <Text style={styles.label}>Тип:</Text>
                      <View style={styles.typeRow}>
                        {(['beer','wine','spirit','cocktail','other'] as const).map((t) => (
                          <TouchableOpacity
                            key={t}
                            style={[styles.typeChip, newType === t && styles.typeChipActive]}
                            onPress={() => setNewType(t)}
                          >
                            <Text style={styles.typeChipText}>{getBeverageTypeLabel(t)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={styles.row}>
                      <TextInput
                        placeholder="Объём, мл"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="numeric"
                        value={newVolume}
                        onChangeText={setNewVolume}
                        style={[styles.input, { flex: 1, marginRight: 8 }]}
                        returnKeyType="done"
                        blurOnSubmit
                        onSubmitEditing={Keyboard.dismiss}
                      />
                      <TextInput
                        placeholder="Крепость, %"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="numeric"
                        value={newAbv}
                        onChangeText={setNewAbv}
                        style={[styles.input, { flex: 1 }]}
                        returnKeyType="done"
                        blurOnSubmit
                        onSubmitEditing={Keyboard.dismiss}
                      />
                    </View>
                    <View style={[styles.modalActions, { paddingBottom: 20 + insets.bottom }]}>
                      <TouchableOpacity style={styles.saveBtn} onPress={saveCustomPreset}>
                        <Text style={styles.saveBtnText}>Сохранить</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 0,
    paddingBottom: 0,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  navBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
  },
  month: {
    fontSize: 20,
    fontWeight: '700',
    textTransform: 'capitalize',
    color: colors.text,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  weekCell: {
    flex: 1,
    textAlign: 'center',
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
  cell: {
    paddingTop: 4,
    paddingHorizontal: 4,
    paddingBottom: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: 10,
    margin: 2,
    borderWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomColor: 'rgba(0, 0, 0, 0.3)',
    borderLeftColor: 'rgba(0, 0, 0, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cellContent: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    height: '100%',
    paddingTop: 2,
    paddingBottom: 2,
  },
  badgeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    zIndex: 10,
  },
  cellEmpty: {
    padding: 8,
  },
  dayNum: {
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
    color: colors.text,
    marginTop: 2,
    zIndex: 10,
  },
  dayNumMuted: {
    color: colors.textTertiary,
    opacity: 0.5,
    fontSize: 14,
  },
  cellCurrent: {
    backgroundColor: colors.backgroundCard || colors.backgroundSecondary,
  },
  cellAdjacent: {
    backgroundColor: colors.backgroundTertiary,
  },
  // Металлические стили (прозрачная рамка, анимированная рамка поверх)
  cellGoldLight: {
    backgroundColor: colors.backgroundCard || colors.backgroundSecondary,
    borderColor: 'transparent',
  },
  cellGoldMedium: {
    backgroundColor: colors.backgroundCard || colors.backgroundSecondary,
    borderColor: 'transparent',
  },
  cellGoldStrong: {
    backgroundColor: colors.backgroundCard || colors.backgroundSecondary,
    borderColor: 'transparent',
  },
  cellToday: {
    borderWidth: 2,
    borderTopColor: colors.primary,
    borderRightColor: colors.primary,
    borderBottomColor: colors.primary,
    borderLeftColor: colors.primary,
  },
  // Subtle Glow для текущей серии - детальная прогрессия с фоном
  // Первые 5 дней - каждый день усиливается
  cellGlow1: {
    backgroundColor: '#10b98110',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#10b98120',
  },
  cellGlow2: {
    backgroundColor: '#10b98118',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#10b98130',
  },
  cellGlow3: {
    backgroundColor: '#10b98120',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 5,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#10b98140',
  },
  cellGlow4: {
    backgroundColor: '#10b98128',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#10b98145',
  },
  cellGlow5: {
    backgroundColor: '#10b98130',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#10b98150',
  },
  cellGlow6: {
    backgroundColor: '#10b98138',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.68,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#10b98155',
  },
  cellGlow7: {
    backgroundColor: '#10b98135',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 7,
    elevation: 7,
    borderWidth: 1,
    borderColor: '#10b98160',
  },
  cellGlow10: {
    backgroundColor: '#10b98145',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#10b98170',
  },
  cellGlow14: {
    backgroundColor: '#10b98160',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 9,
    elevation: 9,
    borderWidth: 1.5,
    borderColor: '#10b98180',
  },
  cellGlow21: {
    backgroundColor: '#10b98180',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: '#10b98190',
  },
  cellGlow30Plus: {
    backgroundColor: '#10b981a0',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 2,
    borderColor: '#10b981',
  },
  awardEmoji: {
    fontSize: 24,
  },
  // Тепловая карта: от зеленого к красному
  cellLowAmount: {
    backgroundColor: '#10b98140', // Светло-зеленый - небольшое количество
  },
  cellModerateAmount: {
    backgroundColor: '#fbbf2440', // Желтый - умеренное количество (в пределах нормы)
  },
  cellHighAmount: {
    backgroundColor: '#f59e0b50', // Оранжевый - превышение нормы
  },
  cellVeryHighAmount: {
    backgroundColor: '#ef444460', // Красный - значительное превышение
  },
  cellCriticalAmount: {
    backgroundColor: '#991b1b80', // Темно-красный - критическое количество
  },
  badge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    minHeight: 44,
  },
  badgeUnits: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  badgeAlcohol: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  deadIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deadEmoji: {
    fontSize: 36,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSpacer: {
    height: 40,
  },
  modalCard: {
    backgroundColor: colors.backgroundCard || colors.backgroundSecondary,
    minHeight: '33%',
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalCardFullScreen: {
    flex: 1,
    minHeight: '100%',
    maxHeight: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  modalDragHandle: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 0,
    paddingBottom: 8,
    minHeight: 40,
  },
  modalDragBar: {
    width: 60,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textTertiary,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
    marginTop: 8,
    paddingBottom: 0,
    flexWrap: 'wrap',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    paddingBottom: 8,
    minHeight: 32,
    lineHeight: 28,
  },
  modalTotal: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
  swipeContainer: {
    marginBottom: 8,
    overflow: 'hidden',
    borderRadius: 12,
  },
  deleteButtonContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  deleteButton: {
    backgroundColor: '#991b1b',
    borderRadius: 12,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 2, height: -2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  itemSub: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  qtyButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginHorizontal: 8,
  },
  backToTodayButton: {
    position: 'absolute',
    bottom: 20,
    right: 8,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  centerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centerCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
    minWidth: 280,
    maxWidth: '90%',
  },
  presetItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundCard,
  },
  presetText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  presetDetails: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '400',
    marginLeft: 8,
  },
  suggestedItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundCard,
  },
  suggestedText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  suggestedDetails: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '400',
    marginLeft: 8,
  },
  addCustomButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  addCustomButtonText: {
    color: colors.primaryLight || colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  addButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  addDrinkButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 4,
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primaryLight || colors.primary,
  },
  addDrinkButtonText: {
    color: colors.primaryLight || colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'column',
    marginBottom: 8,
  },
  label: {
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  typeChipActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primary,
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
  cancelBtnText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primaryLight || colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  kav: {
    flex: 1,
    justifyContent: 'flex-end',
  },
});


