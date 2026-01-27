import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Dimensions, Alert, Platform, TouchableWithoutFeedback, NativeSyntheticEvent, NativeScrollEvent, ScrollView, TextInput, KeyboardAvoidingView, Keyboard, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, useAnimatedReaction, withRepeat, withSequence, Easing } from 'react-native-reanimated';
import { MaterialIcons, FontAwesome6, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getAllDrinks, getDrinksByDate, removeDrink, addOrMergeDrink, updateDrink } from '../storage/drinks';
import { Drink } from '../types/drink';
import { PresetDrink } from '../types/preset';
import { getUserPresets, suggestedPresets, addPreset, presetsEventEmitter } from '../storage/presets';
import { WEEKDAY_SHORT_RU, buildMonthMatrix, formatISO, getWeekdayIndexMonFirst, endOfMonth } from '../utils/date';
import { formatTotalVolume, calculateStandardUnits } from '../utils/units';
import { colors } from '../theme/colors';
import { getDailyGoal, getLethalDose, checkAndUnlockAchievements, Achievement, getAppStartDate } from '../storage/settings';

// Сколько недель одновременно видно на экране
const VISIBLE_WEEKS = 5;

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
function MonthHeader({ 
  label, 
  headerStyle, 
  monthStyle, 
  sobrietyStats,
  animatedStyle,
}: { 
  label: string;
  headerStyle: any; 
  monthStyle: any;
  sobrietyStats?: { currentStreak: number; bestStreak: number };
  animatedStyle?: any;
}) {
  return (
    <Animated.View style={[headerStyle, animatedStyle]}>
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
    </Animated.View>
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

// Компонент годового календаря
const YearCalendarView = React.memo(function YearCalendarView({
  year,
  totalsByDate,
  streakMaps,
  onDayPress,
  dailyGoal,
  lethalDose,
  screenWidth,
  screenHeight,
  insets,
}: {
  year: number;
  totalsByDate: Record<string, number>;
  streakMaps: { currentStreakDays: Map<string, number>; bestStreakDays: Map<string, number>; bestCompletedStreak: { dates: string[]; length: number } | null };
  onDayPress: (date: string) => void;
  dailyGoal: number | null;
  lethalDose: number;
  screenWidth: number;
  screenHeight: number;
  insets: { top: number; bottom: number };
}) {
  const todayISO = useMemo(() => formatISO(new Date()), []);
  const { currentStreakDays, bestStreakDays, bestCompletedStreak } = streakMaps;
  
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const monthNamesShort = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  
  // Мемоизируем расчеты размеров
  // Важно: все расчеты сделаны так, чтобы по горизонтали не было остаточного пространства и сдвигов
  const {
    monthWidth,
    cellHeight,
    daySize,
    monthMarginBottom,
    gapBetweenMonths,
    horizontalPadding,
    paddingTop,
    paddingBottom,
    gapBetweenDays,
    monthHeight,
  } = useMemo(() => {
    // Небольшие горизонтальные отступы слева/справа
    const horizontalPadding = 6;
    const gapBetweenMonths = 4; // расстояние между колонками месяцев

    // 3 колонки: суммарная ширина месяцев + два промежутка = ширина экрана
    const monthWidth = (screenWidth - gapBetweenMonths * 2 - horizontalPadding * 2) / 3;

    // Высоты строки дней недели больше нет — убираем из расчёта
    const weekDaysHeight = 0;
    const switcherHeight = 44;
    const yearHeaderHeight = 40;
    // В годовом режиме не вычитаем высоту таб-бара — он лежит поверх,
    // а календарь можно пододвинуть вплотную, как во вкладке месяца
    const tabBarHeight = 0;
    const paddingTop = 2;
    // Убираем нижний внутренний паддинг — он давал лишнюю «полосу» снизу
    const paddingBottom = 0;

    // Доступная высота на 4 строки месяцев (вся область под годовой календарь)
    // Учитываем также верхний паддинг контейнера экрана (styles.container.paddingTop = 12)
    const containerPaddingTop = 12;
    const availableHeight =
      screenHeight -
      insets.top -
      insets.bottom -
      containerPaddingTop -
      switcherHeight -
      yearHeaderHeight -
      paddingTop -
      paddingBottom;

    // Зазор между кружочками дней
    const gapBetweenDays = 1.5;

    // Ширина ячейки с учетом зазоров: 7 дней + 6 промежутков между ними
    const cellWidth = (monthWidth - 6 * gapBetweenDays) / 7;

    // Высота заголовка месяца (название + отступ)
    const monthHeaderHeight = 18 + 8; // fontSize 18 + marginBottom 8

    // Хотим гарантированно уместить 4 ряда месяцев на экране:
    const monthsPerColumn = 4;
    const minMonthMarginBottom = 4;

    // Высота, которая остаётся на сами месяцы, если дать минимальные зазоры между рядами
    const availableForMonths =
      availableHeight - (monthsPerColumn - 1) * minMonthMarginBottom;
    const availablePerMonth = availableForMonths / monthsPerColumn;

    // Оценка размера кружка по вертикали: из высоты месяца вычитаем заголовок и зазоры между строками дней
    // 6 строк дней => 5 промежутков между ними
    const gapsBetweenDayRowsBase = 5 * gapBetweenDays;
    const daySizeByHeight =
      (availablePerMonth - monthHeaderHeight - gapsBetweenDayRowsBase) / 6;

    // Итоговый размер кружка дня — ограничиваемся минимумом по ширине и высоте
    const daySize = Math.max(6, Math.min(cellWidth, daySizeByHeight));

    // Пересчитываем фактическую высоту месяца с выбранным размером кружка
    const gapsBetweenDayRows = 5 * gapBetweenDays;
    const maxMonthHeight = monthHeaderHeight + daySize * 6 + gapsBetweenDayRows;

    const totalMonthsHeight = maxMonthHeight * monthsPerColumn;
    // Фиксированный минимальный отступ между рядами месяцев, чтобы не было «дыры» между блоками
    const monthMarginBottom = minMonthMarginBottom;

    // Высота ячейки для совместимости (по сути равна размеру кружка)
    const cellHeight = daySize;

    // Фиксированная высота «бокса» месяца (заголовок + максимум 6 строк дней),
    // чтобы при 4–5 неделях блок не сжимался и ряды месяцев не «плавали»
    const monthHeight = maxMonthHeight;

    return {
      monthWidth,
      cellWidth,
      cellHeight,
      monthMarginBottom,
      gapBetweenMonths,
      horizontalPadding,
      paddingTop,
      paddingBottom,
      weekDaysHeight,
      daySize,
      gapBetweenDays,
      monthHeight,
    };
  }, [screenWidth, screenHeight, insets.top, insets.bottom]);
  
  const renderMonth = useCallback((monthIndex: number) => {
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Определяем день недели первого дня месяца (0 = понедельник)
    const firstDayWeekday = getWeekdayIndexMonFirst(firstDay);
    
    // Создаем массив только дней текущего месяца
    const monthDays: (Date | null)[] = [];
    
    // Добавляем пустые ячейки до начала месяца
    for (let i = 0; i < firstDayWeekday; i++) {
      monthDays.push(null);
    }
    
    // Добавляем все дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthIndex, day);
      monthDays.push(date);
    }
    
    return (
      <View key={monthIndex} style={{ 
        width: monthWidth, 
        height: monthHeight,
        marginBottom: monthMarginBottom, 
        marginRight: gapBetweenMonths,
        // Каждый 3-й месяц (индексы 2, 5, 8, 11) не должен иметь marginRight
        ...(monthIndex % 3 === 2 ? { marginRight: 0 } : {})
      }}>
        <Text style={{ 
          fontSize: 18, 
          fontWeight: '700', 
          color: colors.text, 
          marginBottom: 8,
          textAlign: 'center'
        }}>
          {monthNames[monthIndex]}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {monthDays.map((date, idx) => {
            if (date === null) {
              // Пустая ячейка для выравнивания
              return (
                <View
                  key={`empty_${idx}`}
                  style={{
                    width: daySize,
                    height: daySize,
                    marginRight: gapBetweenDays / 2,
                    marginBottom: gapBetweenDays / 2,
                  }}
                />
              );
            }
            
            const iso = formatISO(date);
            const total = totalsByDate[iso] ?? 0;
            const isToday = iso === todayISO;
            const streakDayNumber = currentStreakDays.get(iso);
            const isInCurrentStreak = streakDayNumber !== undefined;
            const bestStreakDayNumber = bestStreakDays.get(iso);
            const isInBestStreak = bestStreakDayNumber !== undefined;
            
            // Определяем тип серии для металлического эффекта
            let streakType: 'bronze' | 'silver' | 'gold' | null = null;
            let streakLength = 0;
            
            if (isInBestStreak && bestCompletedStreak) {
              streakLength = bestCompletedStreak.length;
            } else if (isInCurrentStreak && streakDayNumber) {
              // Для текущей серии используем общее количество дней
              streakLength = streakDayNumber;
            }
            
            if (streakLength >= 30) {
              streakType = 'gold';
            } else if (streakLength >= 14) {
              streakType = 'silver';
            } else if (streakLength >= 7) {
              streakType = 'bronze';
            }
            
            let cellStyle: any = {
              width: daySize,
              height: daySize,
              borderRadius: daySize / 2,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: colors.backgroundCard,
              opacity: 1,
              marginRight: gapBetweenDays / 2,
              marginBottom: gapBetweenDays / 2,
            };
            
            // Цветовая градация по количеству алкоголя
            if (isInCurrentStreak || isInBestStreak) {
              // Серии воздержания - металлические цвета с обводкой
              if (streakType === 'gold') {
                cellStyle.backgroundColor = '#f4c430'; // Золото
                cellStyle.borderWidth = 1.5;
                cellStyle.borderColor = '#ffe680';
              } else if (streakType === 'silver') {
                cellStyle.backgroundColor = '#d3d3d3'; // Серебро
                cellStyle.borderWidth = 1.5;
                cellStyle.borderColor = '#ffffff';
              } else if (streakType === 'bronze') {
                cellStyle.backgroundColor = '#c08850'; // Бронза
                cellStyle.borderWidth = 1.5;
                cellStyle.borderColor = '#e8c4a0';
              } else {
                // Для коротких серий (менее 7 дней) используем зеленый с обводкой
                cellStyle.backgroundColor = '#10b981';
                cellStyle.borderWidth = 1.5;
                cellStyle.borderColor = '#34d399';
              }
              cellStyle.opacity = 1;
            } else if (total > 0) {
              // Градация по количеству алкоголя
              if (dailyGoal !== null && dailyGoal > 0) {
                if (total <= dailyGoal * 0.5) {
                  cellStyle.backgroundColor = '#22c55e'; // Светло-зеленый (низкое количество)
                } else if (total <= dailyGoal) {
                  cellStyle.backgroundColor = '#84cc16'; // Желто-зеленый (умеренное)
                } else if (total <= dailyGoal * 1.5) {
                  cellStyle.backgroundColor = '#f59e0b'; // Оранжевый (высокое)
                } else if (total < lethalDose) {
                  cellStyle.backgroundColor = '#ef4444'; // Красный (очень высокое)
                } else {
                  cellStyle.backgroundColor = '#991b1b'; // Темно-красный (критическое)
                }
              } else {
                // Если цель не установлена
                if (total >= lethalDose) {
                  cellStyle.backgroundColor = '#991b1b'; // Темно-красный (критическое)
                } else {
                  cellStyle.backgroundColor = '#f59e0b'; // Оранжевый (по умолчанию)
                }
              }
              cellStyle.opacity = 1;
            }
            
            if (isToday) {
              cellStyle.borderWidth = 2;
              cellStyle.borderColor = colors.primary;
            }
            
            return (
              <TouchableOpacity
                key={`${iso}_${idx}`}
                style={cellStyle}
                onPress={() => onDayPress(iso)}
              >
                <Text style={{ 
                  fontSize: 8,
                  color: (isInCurrentStreak || isInBestStreak) 
                    ? (streakType === 'gold' || streakType === 'bronze' ? '#ffffff' : '#000000')
                    : (total > 0 && total >= lethalDose ? '#ffffff' : colors.text),
                  fontWeight: isToday ? '700' : '400'
                }}>
                  {date.getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }, [year, monthWidth, daySize, monthMarginBottom, gapBetweenMonths, gapBetweenDays, totalsByDate, currentStreakDays, bestStreakDays, bestCompletedStreak, todayISO, onDayPress, dailyGoal, lethalDose]);
  
  const months = useMemo(() => {
    return monthNames.map((_, index) => index);
  }, []);
  
  return (
    <View
      style={{
        flex: 1,
      }}
    >
      <ScrollView
        style={{
          flex: 1,
        }}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingHorizontal: horizontalPadding,
          paddingTop: 0,
          paddingBottom,
        }}
      >
        {months.map((index) => renderMonth(index))}
      </ScrollView>
    </View>
  );
});

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
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'year'>('month');
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  
  // Автоматически выбираем текущий год при переключении на годовой режим
  useEffect(() => {
    if (calendarViewMode === 'year' && selectedYear !== currentYear) {
      setSelectedYear(currentYear);
    }
  }, [calendarViewMode]);
  const hasMeasuredHeaderRef = useRef<boolean>(false);
  const hasMeasuredWeekRowRef = useRef<boolean>(false);
  
  // Вычисляем высоту списка на основе измеренных высот header и weekRow
  const listHeight = useMemo(() => {
    if (headerHeight === 0 || weekRowHeight === 0) {
      return null;
    }
    // Высота = экран - SafeArea insets - paddingTop (12px) - переключатель режимов (44px) - marginBottom (8px) - header - marginBottom (8px) - weekRow - marginBottom (6px) - таб-бар (49px)
    const paddingTop = 12;
    const switcherHeight = 44; // Высота переключателя режимов
    const marginAfterSwitcher = 8;
    const marginAfterHeader = 8;
    const marginAfterWeekRow = 6;
    const tabBarHeight = 49; // Стандартная высота таб-бара React Navigation
    const calculatedHeight = screenHeight - insets.top - insets.bottom - paddingTop - switcherHeight - marginAfterSwitcher - headerHeight - marginAfterHeader - weekRowHeight - marginAfterWeekRow - tabBarHeight;
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
    // Серии считаются ТОЛЬКО после первой записи о напитке
    const allDates = Object.keys(totalsByDate);
    
    if (lastDrinkDate) {
      const diffTime = today.getTime() - lastDrinkDate.getTime();
      const daysSinceLastDrink = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      // Вычитаем 1, чтобы не считать сегодняшний день (только завершенные дни)
      currentStreak = Math.max(0, daysSinceLastDrink - 1);
    } else if (allDates.length > 0) {
      // Если не нашли употребление за 365 дней, но есть записи - считаем от первой записи
      const sortedDates = allDates.sort();
      const firstDate = new Date(sortedDates[0]);
      const diffTime = today.getTime() - firstDate.getTime();
      const daysSinceFirst = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      currentStreak = Math.max(0, daysSinceFirst - 1);
    } else {
      // Нет записей вообще - серия = 0
      currentStreak = 0;
    }
    
    // Считаем лучшую серию за все время - ТОЛЬКО после первой записи о напитке
    if (allDates.length === 0) {
      // Если нет записей вообще, рекорд = 0
      bestStreak = 0;
    } else {
      const sortedDates = allDates.sort();
      const firstDate = new Date(sortedDates[0]);
      
      // Начинаем считать серии ТОЛЬКО с первой записи о напитке
      // Не учитываем период до первой записи
      const effectiveStartDate = firstDate;
      
      // Проходим по всем дням от первой записи до вчерашнего дня (сегодня не считаем)
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
      // Проверяем достижения только если есть записи о напитках
      const hasAnyDrinks = all.length > 0;
      if (sobrietyStats.currentStreak > 0 && hasAnyDrinks) {
        const newAchievements = await checkAndUnlockAchievements(sobrietyStats.currentStreak, hasAnyDrinks);
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
  }, [sobrietyStats.currentStreak, all.length]);

  // Определяем серии дней без алкоголя для визуального выделения
  // Серии считаются ТОЛЬКО после первой записи о напитке
  const streaksByDate = useMemo(() => {
    const map: Record<string, number> = {};
    const sortedDates = Object.keys(totalsByDate).sort();
    
    if (sortedDates.length === 0) {
      return map; // Нет записей - нет серий
    }
    
    // Находим первую дату с записью о напитке
    const firstDateStr = sortedDates[0];
    const firstDate = new Date(firstDateStr + 'T00:00:00');
    
    // Проходим по всем дням от первой записи до сегодня
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let currentStreak = 0;
    let currentDate = new Date(firstDate);
    
    while (currentDate <= today) {
      const dateISO = formatISO(currentDate);
      const total = totalsByDate[dateISO] ?? 0;
      
      if (total === 0) {
        currentStreak++;
        map[dateISO] = currentStreak;
      } else {
        currentStreak = 0;
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return map;
  }, [totalsByDate]);

  // Вычисляем все серии без алкоголя и Maps для подсветки (один раз, не в каждом renderWeekItem)
  const streakMaps = useMemo(() => {
    const today = new Date();
    const todayISO = formatISO(today);
    
    // Находим первую дату с записью о напитке - серии считаются ТОЛЬКО после этой даты
    const allDates = Object.keys(totalsByDate).sort();
    if (allDates.length === 0) {
      // Нет записей - возвращаем пустые Maps
      return {
        currentStreakDays: new Map<string, number>(),
        bestStreakDays: new Map<string, number>(),
        bestCompletedStreak: null,
      };
    }
    
    const firstDateStr = allDates[0];
    const firstDate = new Date(firstDateStr + 'T00:00:00');
    
    // Начинаем считать серии ТОЛЬКО с первой записи о напитке
    const startDate = firstDate;
    
    // Вычисляем все серии без алкоголя для поиска лучшей
    const allStreaks: { dates: string[]; length: number }[] = [];
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
    if (currentScanStreak.length > 0) {
      allStreaks.push({ dates: [...currentScanStreak], length: currentScanStreak.length });
    }
    
    // Находим лучшую завершенную серию
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
    const currentStreakDays = new Map<string, number>();
    let tempDate = new Date(today);
    tempDate.setHours(0, 0, 0, 0);
    
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
    
    streakDates.reverse().forEach((iso, index) => {
      currentStreakDays.set(iso, index + 1);
    });
    
    return {
      currentStreakDays,
      bestStreakDays,
      bestCompletedStreak,
    };
  }, [totalsByDate]);

  // Подготовим список недель: 3 года назад до конца текущего месяца
  const baseToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const weeks: Date[] = useMemo(() => {
    // Верхняя граница: конец текущего месяца
    const endOfCurrentMonth = endOfMonth(baseToday);
    endOfCurrentMonth.setHours(0, 0, 0, 0);

    // Нижняя граница: начало месяца 2 года назад
    const startMonth = new Date(baseToday.getFullYear(), baseToday.getMonth() - 24, 1);
    startMonth.setHours(0, 0, 0, 0);

    // Выравниваем к понедельнику (0 = понедельник в getWeekdayIndexMonFirst)
    const start = new Date(startMonth);
    const weekdayIndex = getWeekdayIndexMonFirst(start); // 0..6, 0 = Пн
    start.setDate(start.getDate() - weekdayIndex);

    const result: Date[] = [];
    const cursor = new Date(start);
    while (cursor <= endOfCurrentMonth) {
      result.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }
    return result;
  }, [baseToday]);
  
  // Индекс недели, содержащей сегодняшний день
  const initialIndex = useMemo(() => {
    const todayISO = formatISO(baseToday);
    const idx = weeks.findIndex((weekStart) => {
      const start = new Date(weekStart);
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 6);
      return todayISO >= formatISO(start) && todayISO <= formatISO(end);
    });
    return idx >= 0 ? idx : weeks.length - 1;
  }, [weeks, baseToday]);
  const [visibleIndex, setVisibleIndex] = useState(initialIndex);
  const lastScrollIndexRef = useRef(initialIndex);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Отдельное состояние для текста заголовка и его анимации
  const [monthLabel, setMonthLabel] = useState<string>('');
  const monthHeaderFade = useSharedValue(1);
  const backToTodayFade = useSharedValue(0);
  
  // Throttle для обновления visibleIndex чтобы избежать частых перерендеров
  const updateVisibleIndexThrottled = useCallback((idx: number) => {
    if (throttleTimerRef.current) {
      return; // Пропускаем если уже есть запланированное обновление
    }
    throttleTimerRef.current = setTimeout(() => {
      setVisibleIndex(idx);
      throttleTimerRef.current = null;
    }, 250); // Обновляем не чаще чем раз в 250ms для плавности
  }, []);
  
  // Анимация модалок - движение за пальцем
  const dayModalTranslateY = useSharedValue(0);
  const addModalTranslateY = useSharedValue(0);
  const customModalTranslateY = useSharedValue(0);

  // Форматтер вынесен наружу, чтобы не создавать его при каждом рендере
  const dateFormatter = useMemo(() => 
    new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }),
    []
  );

  // Определяем "доминирующий" месяц на экране — по центральной из 6 видимых недель
  const dominantMonth = useMemo(() => {
    if (!weeks.length) return null;
    // Берём примерно третью неделю от верхней границы (индекс + 2)
    const centerIndex = Math.min(Math.max(visibleIndex + 2, 0), weeks.length - 1);
    const weekStart = weeks[centerIndex];
    return {
      year: weekStart.getFullYear(),
      month: weekStart.getMonth(),
      date: weekStart,
    };
  }, [weeks, visibleIndex]);
  
  // Стабилизируем year и month для оптимизации зависимостей
  const dominantYear = dominantMonth?.year ?? null;
  const dominantMonthNum = dominantMonth?.month ?? null;

  // Обновляем текст заголовка по доминирующему месяцу
  useEffect(() => {
    if (!dominantMonth) return;
    setMonthLabel(dateFormatter.format(dominantMonth.date));
  }, [dominantMonth, dateFormatter]);

  // Анимация появления заголовка при смене месяца
  const monthHeaderAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: monthHeaderFade.value,
      transform: [
        {
          translateY: (1 - monthHeaderFade.value) * 8, // лёгкий сдвиг вверх при появлении
        },
      ],
    };
  });

  const backToTodayAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: backToTodayFade.value,
      transform: [
        {
          translateY: (1 - backToTodayFade.value) * 12, // выезжает снизу
        },
      ],
    };
  });

  useEffect(() => {
    if (!dominantMonth) return;
    monthHeaderFade.value = 0;
    monthHeaderFade.value = withTiming(1, { duration: 220 });
  }, [dominantMonth?.year, dominantMonth?.month]);

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

  const handleYearDayPress = useCallback((dateISO: string) => {
    const date = new Date(dateISO);
    date.setHours(0, 0, 0, 0);
    setSelectedDate(dateISO);
    openDay(date);
  }, [openDay]);

  // Сбрасываем позицию модалки дня при открытии
  useEffect(() => {
    if (selectedDate) {
      dayModalTranslateY.value = 0;
    }
  }, [selectedDate]);

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

  // Cleanup для throttle таймера
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, []);

  // Сбрасываем позиции модалок при открытии
  useEffect(() => {
    if (addModalVisible) addModalTranslateY.value = 0;
  }, [addModalVisible]);
  useEffect(() => {
    if (customModalVisible) customModalTranslateY.value = 0;
  }, [customModalVisible]);

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
            offset: initialIndex * cellHeight, 
            animated: true,
          });
        }
      }
    }
  }, [listHeight, initialIndex]);

  // Мемоизируем условие показа кнопки "вниз к сегодня"
  const showBackToToday = useMemo(() => {
    if (!weeks.length) return false;
    // Показываем стрелку, когда пользователь пролистал достаточно ВЫШЕ сегодняшней недели:
    // на 4 и более недель (чтобы не мигала при лёгком скролле вокруг today)
    return visibleIndex <= initialIndex - 4;
  }, [visibleIndex, initialIndex, weeks.length]);

  // Анимируем появление/исчезновение стрелки вниз
  useEffect(() => {
    backToTodayFade.value = withTiming(showBackToToday ? 1 : 0, {
      duration: 320,
      easing: Easing.out(Easing.quad),
    });
  }, [showBackToToday]);

  // Мемоизируем renderItem для оптимизации производительности
  // Высота ячейки подбирается так, чтобы на экране помещалось примерно 5 недель
  const VISIBLE_WEEKS = 5;
  const cellHeight = listHeight ? Math.floor(listHeight / VISIBLE_WEEKS) : 0;
  const actualMonthHeight = cellHeight * VISIBLE_WEEKS;
  
  // Мемоизируем вычисления размеров и дат для оптимизации
  // Используем точную ширину экрана, чтобы избежать проблем с выравниванием
  const cellWidth = useMemo(() => screenWidth / 7, [screenWidth]);
  const weekWidth = useMemo(() => screenWidth, [screenWidth]);
  const todayISO = useMemo(() => formatISO(new Date()), []);
  
  // Рендер одной НЕДЕЛИ (7 дней). FlatList ниже работает поверх массива weeks.
  const renderWeekItem = useCallback(({ item, index }: { item: Date; index: number }) => {
    if (!listHeight || listHeight <= 0 || cellHeight <= 0) {
      return <View style={{ height: 300, width: screenWidth }} />;
    }

    // Начало недели (понедельник)
    const weekStart = new Date(item);
    weekStart.setHours(0, 0, 0, 0);

    // 7 последовательных дней недели
    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      weekDays.push(d);
    }

    const dynamicWeekHeight = cellHeight; // одна строка = одна неделя
    
    // Используем предвычисленные Maps вместо пересчета на каждой неделе
    const { currentStreakDays, bestStreakDays, bestCompletedStreak } = streakMaps;
    
    const cells = weekDays.map((d, idx) => {
      const iso = formatISO(d);
      const total = totalsByDate[iso] ?? 0;
      const streakDayNumber = currentStreakDays.get(iso);
      const isInCurrentStreak = streakDayNumber !== undefined;
      const bestStreakDayNumber = bestStreakDays.get(iso);
      const isInBestStreak = bestStreakDayNumber !== undefined;
      
      // Текущий месяц для подсветки — доминирующий месяц на экране
      // Но дни текущей серии без алкоголя всегда яркие, даже если в соседнем месяце
      const isCurrentMonth =
        (dominantYear !== null &&
         dominantMonthNum !== null &&
         d.getFullYear() === dominantYear &&
         d.getMonth() === dominantMonthNum) ||
        isInCurrentStreak;
      const isToday = iso === todayISO;
      const isLastCol = (idx % 7) === 6;
      const isLastRow = Math.floor(idx / 7) === 5;
      
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
      // НЕ применяем для дней в серии воздержания (они должны быть зелеными)
      let cellColorStyle = null;
      
      if (!isInCurrentStreak && !isInBestStreak) {
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
      }
      
      return (
        <TouchableOpacity
          key={`${iso}_${idx}`}
          style={[
            styles.cell,
            { width: cellWidth, height: cellHeight - 4, margin: 0 },
            // Для дней в серии не применяем cellCurrent/cellAdjacent, чтобы зеленый фон был виден
            !glowStyle && (isCurrentMonth ? styles.cellCurrent : styles.cellAdjacent),
            glowStyle, // glowStyle применяется после, чтобы перекрыть фон
            cellColorStyle,
            isToday && styles.cellToday,
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
            {(total >= lethalDose || total > 0 || (isInBestStreak && bestCompletedStreak)) && (
              <View style={styles.badgeContainer}>
                {total >= lethalDose ? (
                  <View style={styles.deadIconContainer}>
                    <Text style={styles.deadEmoji}>💀</Text>
                  </View>
                ) : total > 0 ? (
                  <View style={styles.badge}>
                    <MaterialCommunityIcons name="cup" size={14} color="#f59e0b" />
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
            )}
          </View>
        </TouchableOpacity>
      );
    });
    
    return (
      <View 
        style={{ height: dynamicWeekHeight, width: weekWidth, alignSelf: 'center', overflow: 'hidden' }}
      >
        <View style={styles.grid}>
          {cells}
        </View>
      </View>
    );
  }, [cellHeight, listHeight, cellWidth, weekWidth, todayISO, totalsByDate, streaksByDate, dailyGoal, lethalDose, openDay, dominantYear, dominantMonthNum, streakMaps]);


  // Мемоизируем календарь чтобы он не перерендеривался при изменении dayList
  const calendarView = useMemo(() => {
    if (listHeight === null || listHeight <= 0 || cellHeight <= 0) return null;
    
    // На экране всегда помещается 5 недель (5 строк)
    const weekRowHeight = cellHeight;
    const totalContentHeight = weekRowHeight * weeks.length;
    
    return (
      <View style={{ height: actualMonthHeight, width: screenWidth }}>
        <FlatList
          ref={listRef}
          data={weeks}
          horizontal={false}
          decelerationRate="normal"
          showsVerticalScrollIndicator={false}
          style={{ height: actualMonthHeight, width: screenWidth }}
          contentContainerStyle={{ paddingBottom: 20 }}
          getItemLayout={(_, index) => {
            return { 
              length: weekRowHeight, 
              offset: weekRowHeight * index, 
              index 
            };
          }}
          keyExtractor={(item, index) => `week-${formatISO(item)}-${index}`}
          initialScrollIndex={initialIndex}
          removeClippedSubviews={true}
          windowSize={3}
          maxToRenderPerBatch={3}
          updateCellsBatchingPeriod={150}
          initialNumToRender={5}
          scrollEventThrottle={200}
          maintainVisibleContentPosition={null}
          disableIntervalMomentum={true}
          onScrollToIndexFailed={() => {
            // Игнорируем ошибки скролла
          }}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            const idx = Math.round(y / weekRowHeight);
            
            // Обновляем только если индекс действительно изменился и валиден
            if (idx !== lastScrollIndexRef.current && idx >= 0 && idx < weeks.length) {
              lastScrollIndexRef.current = idx;
              // Используем throttle для плавного обновления
              updateVisibleIndexThrottled(idx);
            }
          }}
          onMomentumScrollEnd={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            const idx = Math.round(y / weekRowHeight);
            const currentIdx = lastScrollIndexRef.current;
            if (idx !== currentIdx) {
              setVisibleIndex(idx);
            }
          }}
          renderItem={renderWeekItem}
        />
      </View>
    );
  }, [actualMonthHeight, listHeight, screenWidth, weeks, renderWeekItem, listRef, cellHeight, updateVisibleIndexThrottled]);
  

  // Пока не измерили высоту, показываем только структуру для измерения
  const needsMeasurement = listHeight === null || listHeight <= 0;

  // Анимированные стили для модалок - движение за пальцем
  const dayModalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, dayModalTranslateY.value) }],
  }));
  const addModalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, addModalTranslateY.value) }],
  }));
  const customModalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, customModalTranslateY.value) }],
  }));

  return (
    <SafeAreaView style={styles.container}>
      {/* Переключатель режима календаря */}
      <View style={styles.viewModeSwitcher}>
        <TouchableOpacity
          style={[styles.viewModeButton, calendarViewMode === 'month' && styles.viewModeButtonActive]}
          onPress={() => setCalendarViewMode('month')}
          activeOpacity={0.7}
        >
          <Text style={[styles.viewModeButtonText, calendarViewMode === 'month' && styles.viewModeButtonTextActive]}>
            Месяц
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, calendarViewMode === 'year' && styles.viewModeButtonActive]}
          onPress={() => setCalendarViewMode('year')}
          activeOpacity={0.7}
        >
          <Text style={[styles.viewModeButtonText, calendarViewMode === 'year' && styles.viewModeButtonTextActive]}>
            Год
          </Text>
        </TouchableOpacity>
      </View>

      {calendarViewMode === 'month' ? (
        <>
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
              animatedStyle={monthHeaderAnimatedStyle}
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
        </>
      ) : (
        <>
          <View style={styles.yearHeader}>
            <TouchableOpacity
              style={styles.yearNavButton}
              onPress={() => setSelectedYear(selectedYear - 1)}
            >
              <MaterialIcons name="chevron-left" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.yearLabel}>{selectedYear}</Text>
            {selectedYear < currentYear ? (
              <TouchableOpacity
                style={styles.yearNavButton}
                onPress={() => setSelectedYear(selectedYear + 1)}
              >
                <MaterialIcons name="chevron-right" size={20} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={styles.yearNavButton}>
                <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
              </View>
            )}
          </View>
          <View style={styles.yearCalendarContainer}>
            <YearCalendarView
              year={selectedYear}
              totalsByDate={totalsByDate}
              streakMaps={streakMaps}
              onDayPress={handleYearDayPress}
              dailyGoal={dailyGoal}
              lethalDose={lethalDose}
              screenWidth={screenWidth}
              screenHeight={screenHeight}
              insets={insets}
            />
          </View>
        </>
      )}

      {/* Кнопка возврата к текущей неделе (вниз) с плавной анимацией - только для месячного режима */}
      {calendarViewMode === 'month' && (
        <Animated.View
          style={[styles.backToTodayButton, backToTodayAnimatedStyle]}
          pointerEvents={showBackToToday ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
            onPress={scrollToToday}
            activeOpacity={0.8}
          >
            <MaterialIcons name="keyboard-double-arrow-down" size={34} color={colors.primaryLight} />
          </TouchableOpacity>
        </Animated.View>
      )}

      <Modal visible={!!selectedDate && !addModalVisible && !customModalVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={() => {
          setSelectedDate(null);
          loadAll();
        }}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSpacer} />
            <TouchableWithoutFeedback onPress={() => {}}>
              <Animated.View style={[styles.modalCard, dayModalAnimatedStyle]}>
                <GestureDetector gesture={Gesture.Pan()
                  .minDistance(5)
                  .activeOffsetY([5, 100])
                  .failOffsetX([-30, 30])
                  .onUpdate((e) => {
                    if (e.translationY > 0) {
                      dayModalTranslateY.value = e.translationY;
                    }
                  })
                  .onEnd((e) => {
                    if (e.translationY > 50) {
                      dayModalTranslateY.value = withTiming(1000, { duration: 200 }, () => {
                        runOnJS(setSelectedDate)(null);
                        runOnJS(loadAll)();
                        dayModalTranslateY.value = 0;
                      });
                    } else {
                      dayModalTranslateY.value = withTiming(0, { duration: 200 });
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
              </Animated.View>
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
        <TouchableWithoutFeedback onPress={closeAddModal}>
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
                <Animated.View style={[
                  styles.modalCard,
                  searchQuery && searchQuery.trim() && [styles.modalCardFullScreen, { paddingTop: 4 + insets.top }],
                  addModalAnimatedStyle
                ]}>
                  <GestureDetector gesture={Gesture.Pan()
                    .minDistance(5)
                    .activeOffsetY([5, 100])
                    .failOffsetX([-30, 30])
                    .onUpdate((e) => {
                      if (e.translationY > 0) {
                        addModalTranslateY.value = e.translationY;
                      }
                    })
                    .onEnd((e) => {
                      if (e.translationY > 50) {
                        addModalTranslateY.value = withTiming(1000, { duration: 200 }, () => {
                          runOnJS(closeAddModal)();
                          addModalTranslateY.value = 0;
                        });
                      } else {
                        addModalTranslateY.value = withTiming(0, { duration: 200 });
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
                </Animated.View>
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
                <Animated.View style={[styles.modalCard, customModalAnimatedStyle]}>
                  <GestureDetector gesture={Gesture.Pan()
                    .minDistance(5)
                    .activeOffsetY([5, 100])
                    .failOffsetX([-30, 30])
                    .onUpdate((e) => {
                      if (e.translationY > 0) {
                        customModalTranslateY.value = e.translationY;
                      }
                    })
                    .onEnd((e) => {
                      if (e.translationY > 50) {
                        customModalTranslateY.value = withTiming(1000, { duration: 200 }, () => {
                          runOnJS(closeCustomModal)();
                          customModalTranslateY.value = 0;
                        });
                      } else {
                        customModalTranslateY.value = withTiming(0, { duration: 200 });
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
                </Animated.View>
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
    flexWrap: 'nowrap',
    width: '100%',
  },
  cell: {
    paddingTop: 4,
    paddingHorizontal: 4,
    paddingBottom: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: 10,
    margin: 0,
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
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    zIndex: 10,
    minHeight: 20,
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
    opacity: 1,
  },
  cellAdjacent: {
    // Та же база, но чуть приглушённая по яркости — визуально мягче при переключении месяца
    backgroundColor: colors.backgroundCard || colors.backgroundSecondary,
    opacity: 0.55,
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
    backgroundColor: '#10b981', // Полностью непрозрачный зеленый цвет
    opacity: 0.3, // Используем opacity для контроля яркости
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  cellGlow2: {
    backgroundColor: '#10b981',
    opacity: 0.35,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  cellGlow3: {
    backgroundColor: '#10b981',
    opacity: 0.4,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 5,
    elevation: 5,
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  cellGlow4: {
    backgroundColor: '#10b981',
    opacity: 0.45,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 5,
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  cellGlow5: {
    backgroundColor: '#10b981',
    opacity: 0.5,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  cellGlow6: {
    backgroundColor: '#10b981',
    opacity: 0.55,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.68,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  cellGlow7: {
    backgroundColor: '#10b981',
    opacity: 0.6,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 7,
    elevation: 7,
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  cellGlow10: {
    backgroundColor: '#10b981',
    opacity: 0.7,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  cellGlow14: {
    backgroundColor: '#10b981',
    opacity: 0.75,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 9,
    elevation: 9,
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  cellGlow21: {
    backgroundColor: '#10b981',
    opacity: 0.8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  cellGlow30Plus: {
    backgroundColor: '#10b981',
    opacity: 0.9,
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
    paddingTop: 4,
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
    paddingTop: 4,
    paddingBottom: 8,
    minHeight: 28,
  },
  modalDragBar: {
    width: 40,
    height: 3,
    borderRadius: 1.5,
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
    width: 48,
    height: 48,
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
  viewModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 10,
    padding: 4,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: colors.primaryLight,
  },
  viewModeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  viewModeButtonTextActive: {
    color: colors.text,
  },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  yearNavButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
  },
  yearLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  yearCalendarContainer: {
    flex: 1,
    // Чуть сдвигаем вниз, чтобы визуально убрать остаточную полоску снизу,
    // как во вкладке месяца (табар перекрывает нижнюю часть)
    marginBottom: -10,
  },
});


