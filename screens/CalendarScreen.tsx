import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getAllDrinks, getDrinksByDate, removeDrink } from '../storage/drinks';
import { Drink } from '../types/drink';
import { WEEKDAY_SHORT_RU, buildMonthMatrix, formatISO } from '../utils/date';
import { formatTotalVolume } from '../utils/units';
import { colors } from '../theme/colors';

export default function CalendarScreen() {
  const [all, setAll] = useState<Drink[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayList, setDayList] = useState<Drink[]>([]);
  const listRef = useRef<FlatList<Date>>(null);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const [listHeight, setListHeight] = useState<number | null>(null);

  const loadAll = useCallback(async () => {
    const list = await getAllDrinks();
    setAll(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const totalsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of all) {
      map[d.dateISO] = (map[d.dateISO] ?? 0) + d.standardUnits;
    }
    return map;
  }, [all]);

  // Подготовим список месяцев для горизонтального слайдера (±24 месяца от текущего)
  const base = useMemo(() => new Date(), []);
  const months: Date[] = useMemo(() => {
    const arr: Date[] = [];
    for (let i = -24; i <= 24; i++) {
      arr.push(new Date(base.getFullYear(), base.getMonth() + i, 1));
    }
    return arr;
  }, [base]);
  const initialIndex = 24; // текущий месяц по центру массива
  const [visibleIndex, setVisibleIndex] = useState(initialIndex);

  const monthLabel = useMemo(() => {
    const d = months[visibleIndex] ?? base;
    const formatter = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
    return formatter.format(d);
  }, [months, visibleIndex, base]);

  useEffect(() => {
    if (listRef.current && listHeight != null) {
      try {
        listRef.current.scrollToIndex({ index: initialIndex, animated: false });
      } catch {}
    }
  }, [listHeight]);

  const onMomentumEndHorizontal = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / screenWidth);
    if (idx !== visibleIndex) setVisibleIndex(idx);
  };

  // Высота области месяца, чтобы один месяц занимал экран
  const monthListHeight = useMemo(() => {
    if (listHeight != null) return listHeight;
    // fallback до измерения
    const headerSpace = 12 + 28 + 6 + 22 + 12;
    return Math.max(320, screenHeight - headerSpace);
  }, [listHeight, screenHeight]);

  const openDay = async (date: Date) => {
    const iso = formatISO(date);
    setSelectedDate(iso);
    const list = await getDrinksByDate(iso);
    setDayList(list);
  };

  const deleteEntry = async (id: string) => {
    Alert.alert('Удалить запись?', 'Это действие нельзя отменить', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await removeDrink(id);
          if (selectedDate) {
            const list = await getDrinksByDate(selectedDate);
            setDayList(list);
          }
          await loadAll();
        },
      },
    ]);
  };

  const dayTotalUnits = useMemo(() => dayList.reduce((s, d) => s + d.standardUnits, 0), [dayList]);
  const dayTotalVolumeMl = useMemo(() => dayList.reduce((s, d) => s + d.volumeMl * (d.quantity ?? 1), 0), [dayList]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.month}>{monthLabel}</Text>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAY_SHORT_RU.map((w) => (
          <Text key={w} style={styles.weekCell}>{w}</Text>
        ))}
      </View>

      <View style={{ flex: 1 }} onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}>
      <FlatList
        ref={listRef}
        data={months}
        horizontal={false}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        style={{ height: monthListHeight, width: screenWidth }}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({ length: monthListHeight, offset: monthListHeight * index, index })}
        onMomentumScrollEnd={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const idx = Math.round(y / monthListHeight);
          if (idx !== visibleIndex) setVisibleIndex(idx);
        }}
        renderItem={({ item }) => {
          const matrix = buildMonthMatrix(item);
          // Высота ячейки — 6 рядов по высоте месяца
          const cellHeight = monthListHeight / 6;
          const cellWidth = Math.floor(screenWidth / 7);
          const monthWidth = cellWidth * 7;
          return (
            <View style={{ height: monthListHeight, width: monthWidth, alignSelf: 'center' }}>
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
                      <Text style={[styles.dayNum, !isCurrentMonth && styles.dayNumMuted]}>{d.getDate()}</Text>
                      {total > 0 && (
                        <View style={styles.badge}><Text style={styles.badgeText}>{total.toFixed(1)}</Text></View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        }}
      />
      </View>

      <Modal visible={!!selectedDate} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Записи {selectedDate}</Text>
              <Text style={styles.modalTotal}>всего: {formatTotalVolume(dayTotalVolumeMl, 1)}</Text>
              <TouchableOpacity onPress={() => setSelectedDate(null)}><Text style={styles.close}>Закрыть</Text></TouchableOpacity>
            </View>
            <FlatList
              data={dayList}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.listItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <Text style={styles.itemSub}>{formatTotalVolume(item.volumeMl, item.quantity ?? 1)} · {item.abvPercent}% · {item.standardUnits.toFixed(2)} ед{item.quantity && item.quantity > 1 ? ` (x${item.quantity})` : ''}.</Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteEntry(item.id)} style={styles.deleteBtn}><Text style={styles.deleteText}>Удалить</Text></TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={<Text style={{ color: '#666' }}>Нет записей</Text>}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 0,
    paddingBottom: 12,
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
    paddingTop: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderColor: colors.border,
  },
  cellEmpty: {
    padding: 8,
  },
  dayNum: {
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center',
    color: colors.text,
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
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.backgroundCard || colors.backgroundSecondary,
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  modalTotal: {
    marginLeft: 'auto',
    marginRight: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  close: {
    color: colors.primaryLight || colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderBottomWidth: 0,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  itemSub: {
    color: colors.textSecondary,
    marginTop: 4,
    fontSize: 14,
  },
  deleteBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.errorLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteText: {
    color: colors.error,
    fontWeight: '600',
    fontSize: 13,
  },
});


