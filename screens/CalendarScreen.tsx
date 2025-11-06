import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Dimensions, Alert, Platform, TouchableWithoutFeedback, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { MaterialIcons, FontAwesome6 } from '@expo/vector-icons';
import { getAllDrinks, getDrinksByDate, removeDrink } from '../storage/drinks';
import { Drink } from '../types/drink';
import { WEEKDAY_SHORT_RU, buildMonthMatrix, formatISO, getWeekdayIndexMonFirst } from '../utils/date';
import { formatTotalVolume } from '../utils/units';
import { colors } from '../theme/colors';

// Компонент для свайп-удаления записи
function SwipeableListItem({ item, onRemove }: { item: Drink; onRemove: (id: string) => void }) {
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
              <Text style={styles.itemTitle}>{item.name}</Text>
            </View>
            <Text style={styles.itemSub}>
              {formatTotalVolume(item.volumeMl, item.quantity ?? 1)} · {item.abvPercent}% · {item.standardUnits.toFixed(2)} ед.
              {item.quantity && item.quantity > 1 ? ` (x${item.quantity})` : ''}
            </Text>
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
    const list = await getAllDrinks();
    setAll(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Загружаем данные асинхронно, не блокируя UI
      loadAll();
      return () => {
        // Cleanup при размонтировании
      };
    }, [loadAll])
  );

  const totalsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of all) {
      map[d.dateISO] = (map[d.dateISO] ?? 0) + d.standardUnits;
    }
    return map;
  }, [all]);

  // Подготовим список месяцев: 2 года назад до текущего месяца (текущий - последний)
  const base = useMemo(() => new Date(), []);
  const months: Date[] = useMemo(() => {
    const arr: Date[] = [];
    for (let i = -24; i <= 0; i++) {
      arr.push(new Date(base.getFullYear(), base.getMonth() + i, 1));
    }
    return arr;
  }, [base]);
  const initialIndex = months.length - 1; // текущий месяц - последний в массиве
  const [visibleIndex, setVisibleIndex] = useState(initialIndex);

  // Форматтер вынесен наружу, чтобы не создавать его при каждом рендере
  const dateFormatter = useMemo(() => 
    new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }),
    []
  );

  const monthLabel = useMemo(() => {
    const d = months[visibleIndex] ?? base;
    return dateFormatter.format(d);
  }, [months, visibleIndex, base, dateFormatter]);

  useEffect(() => {
    if (listRef.current && listHeight > 0) {
      // Ждем полного рендеринга FlatList перед скроллом
      // Используем несколько попыток для надежности
      let attempts = 0;
      const maxAttempts = 10;
      const tryScroll = () => {
        attempts++;
        try {
          listRef.current?.scrollToIndex({ 
            index: initialIndex, 
            animated: false,
            viewOffset: 0,
            viewPosition: 0,
          });
        } catch (error) {
          if (attempts < maxAttempts) {
            // Повторяем попытку через небольшую задержку
            setTimeout(tryScroll, 50);
          }
        }
      };
      // Первая попытка после небольшой задержки, чтобы FlatList успел отрендериться
      const timeoutId = setTimeout(tryScroll, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [listHeight, initialIndex, months.length]);

  const onMomentumEndHorizontal = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / screenWidth);
    if (idx !== visibleIndex) setVisibleIndex(idx);
  };


  const openDay = async (date: Date) => {
    const iso = formatISO(date);
    setSelectedDate(iso);
    const list = await getDrinksByDate(iso);
    setDayList(list);
  };

  const deleteEntry = async (id: string) => {
    await removeDrink(id);
    if (selectedDate) {
      const list = await getDrinksByDate(selectedDate);
      setDayList(list);
    }
    await loadAll();
  };

  const dayTotalUnits = useMemo(() => dayList.reduce((s, d) => s + d.standardUnits, 0), [dayList]);
  const dayTotalVolumeMl = useMemo(() => dayList.reduce((s, d) => s + d.volumeMl * (d.quantity ?? 1), 0), [dayList]);

  const scrollToToday = () => {
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
            offset: initialIndex * listHeight, 
            animated: true,
          });
        }
      }
    }
  };

  const showBackToToday = visibleIndex < initialIndex;

  return (
    <SafeAreaView style={styles.container}>
      <View 
        style={styles.headerRow}
        onLayout={(e) => {
          const height = e.nativeEvent.layout.height;
          if (!hasMeasuredHeaderRef.current && height > 0) {
            hasMeasuredHeaderRef.current = true;
            setHeaderHeight(height);
          }
        }}
      >
        <Text style={styles.month}>{monthLabel}</Text>
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

      <View style={{ height: listHeight ?? 0, width: screenWidth }}>
      {listHeight !== null && listHeight > 0 ? (
      <FlatList
        ref={listRef}
        data={months}
        horizontal={false}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        style={{ height: listHeight, width: screenWidth }}
        contentContainerStyle={{ height: listHeight * months.length }}
        getItemLayout={listHeight > 0 ? (_, index) => ({ 
          length: listHeight, 
          offset: listHeight * index, 
          index 
        }) : undefined}
        keyExtractor={(item, index) => `month-${item.getFullYear()}-${item.getMonth()}-${index}`}
        removeClippedSubviews={false}
        windowSize={3}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={50}
        onMomentumScrollEnd={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const idx = Math.round(y / listHeight);
          if (idx !== visibleIndex) {
            setVisibleIndex(idx);
          }
        }}
        renderItem={({ item, index }) => {
          if (!listHeight || listHeight <= 0) {
            return <View style={{ height: 300, width: screenWidth }} />;
          }
          const matrix = buildMonthMatrix(item);
          // Высота ячейки — 6 рядов по высоте месяца
          // Используем Math.ceil для более точного распределения высоты
          const cellHeight = Math.ceil(listHeight / 6);
          const cellWidth = Math.floor(screenWidth / 7);
          const monthWidth = cellWidth * 7;
          return (
            <View style={{ height: listHeight, width: monthWidth, alignSelf: 'center' }}>
              <View style={styles.grid}>
                {matrix.map((d, idx) => {
                  const iso = formatISO(d);
                  const total = totalsByDate[iso] ?? 0;
                  const isCurrentMonth = d.getMonth() === item.getMonth();
                  const isLastCol = (idx % 7) === 6;
                  const isLastRow = Math.floor(idx / 7) === 5;
                  return (
                    <TouchableOpacity
                      key={`${iso}_${idx}`}
                      style={[
                        styles.cell,
                        { width: cellWidth, height: cellHeight, borderRightWidth: isLastCol ? 0 : StyleSheet.hairlineWidth, borderBottomWidth: isLastRow ? 0 : StyleSheet.hairlineWidth },
                        isCurrentMonth ? styles.cellCurrent : styles.cellAdjacent,
                      ]}
                      onPress={() => openDay(d)}
                    >
                      <View style={styles.cellContent}>
                        <Text style={[styles.dayNum, !isCurrentMonth && styles.dayNumMuted]}>{d.getDate()}</Text>
                        {total > 0 && (
                          <View style={styles.badge}><Text style={styles.badgeText}>{total.toFixed(1)}</Text></View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        }}
      />
      ) : null}
      </View>

      {/* Кнопка возврата к текущему месяцу */}
      {showBackToToday && (
        <TouchableOpacity
          style={styles.backToTodayButton}
          onPress={scrollToToday}
          activeOpacity={0.8}
        >
          <FontAwesome6 name="circle-arrow-down" size={28} color={colors.text} />
        </TouchableOpacity>
      )}

      <Modal visible={!!selectedDate} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={() => setSelectedDate(null)}>
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
                    }
                  })
                }>
                  <TouchableOpacity 
                    style={styles.modalDragHandle}
                    onPress={() => setSelectedDate(null)}
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
                  <Text style={styles.modalTotal}>всего: {formatTotalVolume(dayTotalVolumeMl, 1)}</Text>
                </View>
                <View style={{ marginTop: 20 }}>
                  <FlatList
                    data={dayList}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <SwipeableListItem
                        item={item}
                        onRemove={deleteEntry}
                      />
                    )}
                    ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>Нет записей</Text>}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
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
  },
  cell: {
    paddingTop: 4,
    paddingHorizontal: 4,
    paddingBottom: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderColor: colors.border,
  },
  cellContent: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    height: '100%',
    paddingTop: 2,
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
  },
  dayNumMuted: {
    color: colors.textTertiary,
  },
  cellCurrent: {
    backgroundColor: colors.backgroundCard || colors.backgroundSecondary,
  },
  cellAdjacent: {
    backgroundColor: colors.backgroundTertiary,
  },
  badge: {
    marginTop: 4,
    alignSelf: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
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
    marginLeft: 'auto',
    marginRight: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
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
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  itemSub: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  backToTodayButton: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
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
});


