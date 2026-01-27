import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TextInput, TouchableOpacity, Alert, FlatList, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Keyboard, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { MaterialIcons, Ionicons, Entypo, FontAwesome } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import PresetButton from '../components/PresetButton';
import { suggestedPresets, getUserPresets, addPreset, removePreset, updatePreset, presetsEventEmitter } from '../storage/presets';
import { PresetDrink } from '../types/preset';
import { addDrink, addOrMergeDrink, getDrinksByDate, removeDrink, updateDrink } from '../storage/drinks';
import { calculateStandardUnits, todayISO, formatTotalVolume } from '../utils/units';
import { Drink } from '../types/drink';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { formatISO, WEEKDAY_SHORT_RU, getWeekdayIndexMonFirst, buildMonthMatrix } from '../utils/date';

const getBeverageColor = (type: PresetDrink['beverageType']) => {
  return colors[type] || colors.other;
};

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

// Компонент для свайп-удаления записи
function SwipeableListItem({ item, beverageColor, onRemove, onQuantityChange }: { item: Drink; beverageColor: any; onRemove: (id: string) => void; onQuantityChange: (id: string, delta: number) => void }) {
  const translateX = useSharedValue(0);
  const swipeState = useSharedValue(0); // 0 = idle, 1 = swiped
  const isFirstGesture = useSharedValue(true); // Отслеживаем, первый ли это жест
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const fifthWidth = screenWidth / 5; // 1/5 экрана
  const [showTrash, setShowTrash] = useState(false);
  
  const handleRemove = () => {
    onRemove(item.id);
  };
  
  const handleShowTrash = (show: boolean) => {
    setShowTrash(show);
  };
  
  const startX = useSharedValue(0);
  
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10]) // Активируется только при горизонтальном движении
    .failOffsetY([-10, 10]) // Не работает при вертикальном движении
    .onStart(() => {
      // Сохраняем текущую позицию как начальную для этого жеста
      startX.value = translateX.value;
      // Если начинаем с позиции 0 - это первый жест
      isFirstGesture.value = Math.abs(translateX.value) < 1;
    })
    .onUpdate((e) => {
      // Вычисляем новую позицию от начальной позиции жеста
      const newValue = startX.value + e.translationX;
      
      // Если это первый жест (начали с 0) - всегда ограничиваем до корзины
      if (isFirstGesture.value) {
        if (newValue < 0) {
          // Строго ограничиваем позицией корзины (1/5 экрана), даже если свайпают дальше
          const maxSwipe = -fifthWidth;
          translateX.value = Math.max(maxSwipe, newValue);
          
          // Если сдвинули больше чем на 1/5 - показываем корзину
          if (Math.abs(newValue) > fifthWidth) {
            swipeState.value = 1;
            runOnJS(handleShowTrash)(true);
          }
        } else {
          // Не позволяем свайп вправо когда idle
          translateX.value = 0;
        }
      } else {
        // Второй жест - из позиции корзины
        if (newValue < 0) {
          // Свайп влево - можем идти дальше для удаления
          const maxSwipe = -screenWidth * 0.8;
          translateX.value = Math.max(maxSwipe, newValue);
        } else if (newValue > 0) {
          // Свайп вправо - отмена
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
        // Первый жест - строго ограничиваем и всегда останавливаем на позиции корзины или возвращаем
        const finalValue = startX.value + e.translationX;
        // Ограничиваем максимальный сдвиг до позиции корзины (1/5 экрана)
        const clampedValue = Math.max(-fifthWidth, finalValue);
        
        if (Math.abs(clampedValue) < fifthWidth) {
          // Маленький свайп - возвращаем на место
          translateX.value = withTiming(0, { duration: 200 });
          swipeState.value = 0;
          runOnJS(handleShowTrash)(false);
        } else {
          // Большой свайп - показываем корзину (всегда останавливаемся здесь, НЕ удаляем!)
          translateX.value = withTiming(-fifthWidth, { duration: 200 });
          swipeState.value = 1;
          runOnJS(handleShowTrash)(true);
        }
        // Следующий жест будет вторым
        isFirstGesture.value = false;
      } else {
        // Второй жест из позиции корзины
        // startX.value уже равен -fifthWidth, e.translationX отсчитывается от этой позиции
        const currentPos = startX.value + e.translationX;
        
        // Проверяем, свайпнули ли еще дальше влево от позиции корзины
        if (e.translationX < -30 || currentPos < -fifthWidth * 1.5) {
          // Второй свайп влево - удаляем
          translateX.value = withTiming(-screenWidth, { duration: 200 }, () => {
            runOnJS(handleRemove)();
          });
        } else if (e.translationX > 20 || currentPos > -fifthWidth * 0.5) {
          // Свайп вправо - отмена, возвращаем на место
          translateX.value = withTiming(0, { duration: 200 });
          swipeState.value = 0;
          runOnJS(handleShowTrash)(false);
          // Сбрасываем флаг первого жеста при возврате на место
          isFirstGesture.value = true;
        } else {
          // Возвращаем к корзине
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
    // Ширина кнопки = абсолютное значение сдвига карточки минус промежуток (но не меньше 0)
    // Кнопка появляется, увеличиваясь в ширине от 0
    const gap = 8; // Промежуток между кнопкой и карточкой
    const width = Math.max(0, -translateX.value - gap);
    return {
      width: width,
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.swipeContainer}>
        {/* Кнопка удаления - растягивается на всю ширину раскрытой области */}
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
        
        {/* Карточка записи */}
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

export default function TodayScreen() {
  const [userPresets, setUserPresets] = useState<PresetDrink[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingDrink, setEditingDrink] = useState<Drink | null>(null);
  const [newQuantity, setNewQuantity] = useState('1');
  const [editPresetModalVisible, setEditPresetModalVisible] = useState(false);
  const [editingPreset, setEditingPreset] = useState<PresetDrink | null>(null);
  const [presetName, setPresetName] = useState('');
  const [presetType, setPresetType] = useState<PresetDrink['beverageType']>('beer');
  const [presetVolume, setPresetVolume] = useState('500');
  const [presetAbv, setPresetAbv] = useState('5');
  // Переменные для модалки добавления кастомного пресета
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<PresetDrink['beverageType']>('beer');
  const [newVolume, setNewVolume] = useState('500');
  const [newAbv, setNewAbv] = useState('5');

  // Выбранная дата для добавления напитка
  const [selectedDateForAdd, setSelectedDateForAdd] = useState<Date>(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  // Анимация модалок - движение за пальцем
  const addModalTranslateY = useSharedValue(0);
  const customModalTranslateY = useSharedValue(0);
  const editModalTranslateY = useSharedValue(0);
  const editPresetModalTranslateY = useSharedValue(0);
  const datePickerModalTranslateY = useSharedValue(0);

  useEffect(() => {
    (async () => {
      const presets = await getUserPresets();
      setUserPresets(presets);
    })();
  }, []);

  // Сбрасываем позиции модалок при открытии
  useEffect(() => {
    if (addModalVisible) addModalTranslateY.value = 0;
  }, [addModalVisible]);
  useEffect(() => {
    if (customModalVisible) customModalTranslateY.value = 0;
  }, [customModalVisible]);
  useEffect(() => {
    if (editModalVisible) editModalTranslateY.value = 0;
  }, [editModalVisible]);
  useEffect(() => {
    if (editPresetModalVisible) editPresetModalTranslateY.value = 0;
  }, [editPresetModalVisible]);
  useEffect(() => {
    if (datePickerVisible) datePickerModalTranslateY.value = 0;
  }, [datePickerVisible]);

  // Подписываемся на события изменения пресетов для синхронизации между экранами
  useEffect(() => {
    const unsubscribe = presetsEventEmitter.subscribe((presets) => {
      setUserPresets(presets);
    });
    return unsubscribe;
  }, []);

  // Код выбора количества (пока не используется, но оставлен для будущего использования)
  const [qtyModal, setQtyModal] = useState<{ visible: boolean; preset: PresetDrink | null; qty: string }>({ visible: false, preset: null, qty: '1' });

  const openQtyModal = (preset: PresetDrink) => {
    // setQtyModal({ visible: true, preset, qty: '1' });
    // Пока добавляем сразу по одному напитку
    handleQuickAdd(preset);
  };

  const closeQtyModal = () => setQtyModal({ visible: false, preset: null, qty: '1' });

  const confirmAddWithQty = async () => {
    if (!qtyModal.preset) return;
    const qtyNum = Math.max(1, Math.floor(Number(qtyModal.qty) || 1));
    const baseUnits = calculateStandardUnits(qtyModal.preset.volumeMl, qtyModal.preset.abvPercent);
    const totalUnits = Math.round(baseUnits * qtyNum * 100) / 100;
      const entry: Drink = {
        id: `drink_${Date.now()}`,
        dateISO: formatISO(selectedDateForAdd),
        name: qtyModal.preset.name,
        beverageType: qtyModal.preset.beverageType,
        volumeMl: qtyModal.preset.volumeMl,
        abvPercent: qtyModal.preset.abvPercent,
        standardUnits: totalUnits,
        quantity: qtyNum,
      };
    await addOrMergeDrink(entry);
    closeQtyModal();
    // Alert.alert('Добавлено', `${qtyModal.preset.name}: ${qtyNum} ед. (~${totalUnits} std)`);
    await reloadToday();
  };

  const handleQuickAdd = async (preset: PresetDrink) => {
    const units = calculateStandardUnits(preset.volumeMl, preset.abvPercent);
    const entry: Drink = {
      id: `drink_${Date.now()}`,
      dateISO: formatISO(selectedDateForAdd),
      name: preset.name,
      beverageType: preset.beverageType,
      volumeMl: preset.volumeMl,
      abvPercent: preset.abvPercent,
      standardUnits: units,
      quantity: 1,
    };
    await addOrMergeDrink(entry);
    await reloadToday();
  };

  const openAddModal = () => setAddModalVisible(true);
  const closeAddModal = () => {
    setAddModalVisible(false);
    setSearchQuery(''); // Очищаем поисковый запрос при закрытии
  };
  const openCustomModal = () => {
    setAddModalVisible(false);
    setSearchQuery(''); // Очищаем поисковый запрос при закрытии
    setCustomModalVisible(true);
  };
  const closeCustomModal = () => {
    setCustomModalVisible(false);
    setNewName('');
    setNewType('beer');
    setNewVolume('500');
    setNewAbv('5');
  };

  const addSuggestedPreset = async (preset: PresetDrink) => {
    const updated = await addPreset({
      name: preset.name,
      beverageType: preset.beverageType,
      volumeMl: preset.volumeMl,
      abvPercent: preset.abvPercent,
    });
    setUserPresets(updated);
    closeAddModal();
  };

  // Фильтруем предложенные напитки - исключаем те, что уже в избранном
  // Проверяем точное совпадение по объему, крепости и типу
  // Также фильтруем по поисковому запросу
  const [searchQuery, setSearchQuery] = useState('');
  const availableSuggestedPresets = useMemo(() => {
    const filtered = suggestedPresets.filter((suggested) => {
      return !userPresets.some((userPreset) => 
        userPreset.volumeMl === suggested.volumeMl &&
        userPreset.abvPercent === suggested.abvPercent &&
        userPreset.beverageType === suggested.beverageType
      );
    });
    
    console.log('[FILTER] Before search filter, count:', filtered.length, 'searchQuery:', searchQuery);
    
    // Фильтрация по поисковому запросу
    let result = filtered;
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = filtered.filter((preset) => 
        preset.name.toLowerCase().includes(query)
      );
      console.log('[FILTER] After search filter, query:', query, 'result count:', result.length, 'names:', result.map(p => p.name));
    } else {
      console.log('[FILTER] No search query, returning all:', filtered.length);
    }
    
    return result;
  }, [userPresets, searchQuery]);


  const saveCustomPreset = async () => {
    // Нормализуем запятую на точку перед парсингом
    const normalizedVolume = newVolume.replace(',', '.');
    const normalizedAbv = newAbv.replace(',', '.');
    const volume = parseFloat(normalizedVolume);
    const abv = parseFloat(normalizedAbv);
    if (!newName || isNaN(volume) || isNaN(abv)) {
      Alert.alert('Ошибка', 'Заполните название, объём и крепость');
      return;
    }
    const updated = await addPreset({
      name: newName,
      beverageType: newType,
      volumeMl: volume,
      abvPercent: abv,
    });
    setUserPresets(updated);
    closeCustomModal();
  };

  const [todayList, setTodayList] = useState<Drink[]>([]);
  const totalUnits = useMemo(() => todayList.reduce((s, d) => s + d.standardUnits, 0), [todayList]);
  const totalVolumeMl = useMemo(() => todayList.reduce((s, d) => s + d.volumeMl * (d.quantity ?? 1), 0), [todayList]);
  const totalAlcoholGrams = useMemo(() => {
    return todayList.reduce((s, d) => {
      const ethanolDensity = 0.789; // g/mL
      const grams = d.volumeMl * (d.abvPercent / 100) * ethanolDensity * (d.quantity ?? 1);
      return s + grams;
    }, 0);
  }, [todayList]);

  const canGoNext = useMemo(() => {
    const nextDate = new Date(selectedDateForAdd);
    nextDate.setDate(nextDate.getDate() + 1);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return nextDate <= today;
  }, [selectedDateForAdd]);

  const reloadToday = useCallback(async () => {
    const list = await getDrinksByDate(formatISO(selectedDateForAdd));
    setTodayList(list);
  }, [selectedDateForAdd]);

  useFocusEffect(
    useCallback(() => {
      reloadToday();
    }, [reloadToday])
  );

  const onRemoveDrink = async (id: string) => {
    await removeDrink(id);
    await reloadToday();
  };

  // Изменение количества записи
  const changeQuantity = async (id: string, delta: number) => {
    const drink = todayList.find(d => d.id === id);
    if (!drink) return;
    
    const currentQty = drink.quantity ?? 1;
    const newQty = currentQty + delta;
    
    if (newQty <= 0) {
      // Удаляем запись если количество стало 0 или меньше
      await onRemoveDrink(id);
      return;
    }
    
    // Обновляем запись с новым количеством используя updateDrink
    await updateDrink(id, { quantity: newQty });
    
    // Обновляем список записей дня
    await reloadToday();
  };

  const openEditModal = (drink: Drink) => {
    setEditingDrink(drink);
    setNewQuantity((drink.quantity || 1).toString());
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingDrink(null);
    setNewQuantity('1');
  };

  const saveEditedDrink = async () => {
    if (!editingDrink) return;
    
    const quantity = Math.max(1, Math.floor(Number(newQuantity.replace(',', '.')) || 1));
    
    if (isNaN(quantity) || quantity < 1) {
      Alert.alert('Ошибка', 'Введите корректное количество');
      return;
    }

    // Пересчитываем стандартные единицы с новым количеством
    const baseUnits = calculateStandardUnits(editingDrink.volumeMl, editingDrink.abvPercent);
    const totalUnits = Math.round(baseUnits * quantity * 100) / 100;

    await updateDrink(editingDrink.id, {
      ...editingDrink,
      quantity: quantity,
      standardUnits: totalUnits,
    });
    
    await reloadToday();
    closeEditModal();
  };

  const openEditPresetModal = (preset: PresetDrink) => {
    setEditingPreset(preset);
    // Извлекаем название без объема и процентов
    const nameMatch = preset.name.match(/^(.+?)\s+\d+\s*(мл|л)\s*\(\d+%\)$/);
    setPresetName(nameMatch ? nameMatch[1].trim() : preset.name);
    setPresetType(preset.beverageType);
    setPresetVolume(preset.volumeMl.toString());
    setPresetAbv(preset.abvPercent.toString());
    setEditPresetModalVisible(true);
    setDeletingPresetId(null);
  };

  const closeEditPresetModal = () => {
    setEditPresetModalVisible(false);
    setEditingPreset(null);
    setPresetName('');
    setPresetType('beer');
    setPresetVolume('500');
    setPresetAbv('5');
  };

  const saveEditedPreset = async () => {
    if (!editingPreset) return;
    
    const normalizedVolume = presetVolume.replace(',', '.');
    const normalizedAbv = presetAbv.replace(',', '.');
    const volume = parseFloat(normalizedVolume);
    const abv = parseFloat(normalizedAbv);
    
    if (!presetName || isNaN(volume) || isNaN(abv)) {
      Alert.alert('Ошибка', 'Заполните название, объём и крепость');
      return;
    }

    await updatePreset(editingPreset.id, {
      name: presetName,
      beverageType: presetType,
      volumeMl: volume,
      abvPercent: abv,
    });
    
    const updated = await getUserPresets();
    setUserPresets(updated);
    closeEditPresetModal();
  };

  const [presetsCollapsed, setPresetsCollapsed] = useState(false);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);

  // Логирование изменений searchQuery
  useEffect(() => {
    console.log('[SEARCH] searchQuery changed to:', searchQuery, 'length:', searchQuery.length);
  }, [searchQuery]);

  // Логирование изменений addModalVisible
  useEffect(() => {
    console.log('[MODAL] addModalVisible changed to:', addModalVisible);
  }, [addModalVisible]);

  const handleSearchChange = (text: string) => {
    console.log('[SEARCH] onChangeText called, new text:', text, 'old text:', searchQuery);
    console.log('[SEARCH] addModalVisible:', addModalVisible);
    setSearchQuery(text);
  };

  // Логирование ре-рендеров
  console.log('[RENDER] TodayScreen render, searchQuery:', searchQuery, 'addModalVisible:', addModalVisible, 'trimmed:', searchQuery && searchQuery.trim());
  const insets = useSafeAreaInsets();

  const handleLongPress = (presetId: string) => {
    if (deletingPresetId === presetId) {
      // Если уже в режиме удаления - удаляем
      onRemovePreset(presetId);
    } else {
      // Показываем режим редактирования/удаления
      setDeletingPresetId(presetId);
      setEditingPresetId(presetId);
    }
  };

  const onRemovePreset = async (id: string) => {
    const updated = await removePreset(id);
    setUserPresets(updated);
    setDeletingPresetId(null);
    setEditingPresetId(null);
  };

  // Анимированные стили для модалок - движение за пальцем
  const addModalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, addModalTranslateY.value) }],
  }));
  const customModalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, customModalTranslateY.value) }],
  }));
  const editModalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, editModalTranslateY.value) }],
  }));
  const editPresetModalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, editPresetModalTranslateY.value) }],
  }));
  const datePickerModalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, datePickerModalTranslateY.value) }],
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TouchableOpacity
        style={styles.collapsibleHeader}
        onPress={() => setPresetsCollapsed(!presetsCollapsed)}
        activeOpacity={0.7}
      >
        <Text style={styles.title}>Избранное</Text>
        <Ionicons 
          name={presetsCollapsed ? "chevron-down" : "chevron-up"} 
          size={20} 
          color={colors.textSecondary} 
        />
      </TouchableOpacity>
      {!presetsCollapsed && (
        <View style={{ marginBottom: 12 }}>
          <ScrollView 
            contentContainerStyle={styles.presetList} 
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            onStartShouldSetResponder={() => {
              setDeletingPresetId(null);
              setEditingPresetId(null);
              return false;
            }}
          >
            {userPresets.map((p) => {
              const beverageColor = getBeverageColor(p.beverageType);
              const isEditing = editingPresetId === p.id;
              const isDeleting = deletingPresetId === p.id;
              return (
                <View key={p.id} style={{ position: 'relative' }}>
                  <TouchableOpacity
                    style={[
                      styles.presetButton,
                      { backgroundColor: beverageColor.light },
                      isEditing && styles.presetButtonDeleting,
                    ]}
                    onPress={() => {
                      if (isEditing) {
                        // Ничего не делаем при нажатии в режиме редактирования
                      } else {
                        openQtyModal(p);
                      }
                    }}
                    onLongPress={() => handleLongPress(p.id)}
                    delayLongPress={500}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetText, { color: beverageColor.text, opacity: isEditing ? 0.3 : 1 }]}>{p.name}</Text>
                    <Text style={[styles.presetDetails, { color: beverageColor.text, opacity: isEditing ? 0.3 : 0.7 }]}>
                      {formatTotalVolume(p.volumeMl, 1)} · {p.abvPercent}%
                    </Text>
                    {isEditing && (
                      <View style={styles.editIconContainer}>
                        <View style={styles.editButtonsRow}>
                          <TouchableOpacity
                            style={styles.editActionButtonNoBg}
                            onPress={() => {
                              const preset = userPresets.find(pr => pr.id === p.id);
                              if (preset) {
                                openEditPresetModal(preset);
                              }
                            }}
                          >
                            <Entypo name="pencil" size={18} color={colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.editActionButtonNoBg}
                            onPress={() => onRemovePreset(p.id)}
                          >
                            <Entypo name="circle-with-cross" size={18} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
            <TouchableOpacity
              style={styles.addFavButtonRect}
              onPress={() => {
                setDeletingPresetId(null);
                setEditingPresetId(null);
                openAddModal();
              }}
              accessibilityLabel="Добавить напиток"
            >
              <Entypo name="circle-with-plus" size={22} color={colors.primaryLight} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}


      <TouchableOpacity
        activeOpacity={1}
        onPress={() => deletingPresetId && setDeletingPresetId(null)}
      >
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <TouchableOpacity
              style={styles.dateNavButton}
              onPress={() => {
                const newDate = new Date(selectedDateForAdd);
                newDate.setDate(newDate.getDate() - 1);
                setSelectedDateForAdd(newDate);
              }}
              activeOpacity={0.7}
            >
              <FontAwesome name="chevron-left" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setDatePickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.dateButtonText}>
                {selectedDateForAdd.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateNavButton}
              onPress={() => {
                if (!canGoNext) return;
                const newDate = new Date(selectedDateForAdd);
                newDate.setDate(newDate.getDate() + 1);
                setSelectedDateForAdd(newDate);
              }}
              activeOpacity={canGoNext ? 0.7 : 1}
              disabled={!canGoNext}
            >
              <FontAwesome name="chevron-right" size={20} color={canGoNext ? colors.primary : colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
      {/* Бар со статистикой */}
      <View style={styles.statsBar}>
        <View style={styles.statsBarItem}>
          <Text style={styles.statsBarLabel}>Объем</Text>
          <Text style={styles.statsBarValue}>{formatTotalVolume(totalVolumeMl, 1)}</Text>
        </View>
        <View style={styles.statsBarDivider} />
        <View style={styles.statsBarItem}>
          <Text style={styles.statsBarLabel}>Единицы</Text>
          <Text style={styles.statsBarValue}>{totalUnits.toFixed(2)}</Text>
        </View>
        <View style={styles.statsBarDivider} />
        <View style={styles.statsBarItem}>
          <Text style={styles.statsBarLabel}>Спирт</Text>
          <Text style={styles.statsBarValue}>{Math.round(totalAlcoholGrams)} г</Text>
        </View>
      </View>
      <FlatList
        data={todayList}
        keyExtractor={(item) => item.id}
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const beverageColor = getBeverageColor(item.beverageType);
          return (
            <SwipeableListItem
              item={item}
              beverageColor={beverageColor}
              onRemove={onRemoveDrink}
              onQuantityChange={changeQuantity}
            />
          );
        }}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary, textAlign: 'center', paddingVertical: 20 }}>Пока нет записей</Text>}
        contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
      />

      {/* Модалка количества единиц перед добавлением */}
      <Modal visible={qtyModal.visible} animationType="fade" transparent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.centerBackdrop}>
            <View style={styles.centerCard}>
              <Text style={styles.modalTitle}>Сколько единиц?</Text>
              {qtyModal.preset && (
                <Text style={{ marginBottom: 8, color: colors.textSecondary }}>{qtyModal.preset.name}</Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => setQtyModal((s) => ({ ...s, qty: String(Math.max(1, (parseInt(s.qty || '1', 10) || 1) - 1)) }))}
                  style={[styles.cancelBtn, { marginRight: 8 }]}
                >
                  <Text>-</Text>
                </TouchableOpacity>
                <TextInput
                  value={qtyModal.qty}
                  onChangeText={(t) => setQtyModal((s) => ({ ...s, qty: t.replace(/[^0-9]/g, '') }))}
                  keyboardType="number-pad"
                  style={[styles.input, { width: 100, textAlign: 'center' }]}
                  returnKeyType="done"
                  onSubmitEditing={confirmAddWithQty}
                />
                <TouchableOpacity
                  onPress={() => setQtyModal((s) => ({ ...s, qty: String((parseInt(s.qty || '1', 10) || 1) + 1) }))}
                  style={[styles.saveBtn, { marginLeft: 8, backgroundColor: '#eee' }]}
                >
                  <Text>+</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeQtyModal}>
                  <Text style={styles.cancelBtnText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={confirmAddWithQty}>
                  <Text style={styles.saveBtnText}>Добавить</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Модалка выбора напитка для добавления */}
      <Modal visible={addModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          style={styles.kav}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalBackdrop}>
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
                      // Свайп вниз закрывает модальное окно
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
                    <Text style={{ marginBottom: 12, color: colors.textSecondary }}>Выберите из предложенных или добавьте свой</Text>
                  
                    {/* Строка поиска для предложенных пресетов */}
                    {availableSuggestedPresets.length > 0 && (
                      <TextInput
                        placeholder="Поиск напитков..."
                        placeholderTextColor={colors.textTertiary}
                        value={searchQuery}
                        onChangeText={handleSearchChange}
                        style={styles.searchInput}
                        returnKeyType="search"
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={() => console.log('[SEARCH] TextInput focused')}
                        onBlur={() => console.log('[SEARCH] TextInput blurred')}
                      />
                    )}
                  
                    <ScrollView 
                      style={searchQuery && searchQuery.trim() ? {} : { maxHeight: 300 }} 
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{ paddingBottom: 20 + insets.bottom }}
                    >
                      {availableSuggestedPresets.map((preset) => (
                        <TouchableOpacity
                          key={preset.id}
                          style={styles.suggestedItem}
                          onPress={() => addSuggestedPreset(preset)}
                        >
                          <Text style={styles.suggestedText}>{preset.name}</Text>
                        </TouchableOpacity>
                      ))}
                      
                      <TouchableOpacity
                        style={styles.addCustomButton}
                        onPress={openCustomModal}
                      >
                        <Text style={styles.addCustomButtonText}>+ Добавить свой напиток</Text>
                      </TouchableOpacity>
                    </ScrollView>

                  </View>
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
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
                      // Свайп вниз закрывает модальное окно
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
                      keyboardType="decimal-pad"
                      value={newVolume}
                      onChangeText={(text) => {
                        // Заменяем запятую на точку для корректного парсинга
                        const normalized = text.replace(',', '.');
                        setNewVolume(normalized);
                      }}
                      style={[styles.input, { flex: 1, marginRight: 8 }]}
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    <TextInput
                      placeholder="Крепость, %"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                      value={newAbv}
                      onChangeText={(text) => {
                        // Заменяем запятую на точку для корректного парсинга
                        const normalized = text.replace(',', '.');
                        setNewAbv(normalized);
                      }}
                      style={[styles.input, { flex: 1 }]}
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  </View>
                  <View style={[styles.modalActions, { paddingBottom: 20 + insets.bottom }]}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={closeCustomModal}>
                      <Text style={styles.cancelBtnText}>Отмена</Text>
                    </TouchableOpacity>
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

      {/* Модалка редактирования записи */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={closeEditModal}>
          <View style={styles.modalBackdrop}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
              style={styles.kav}
            >
              <TouchableWithoutFeedback onPress={() => {}}>
                <Animated.View style={[styles.modalCard, editModalAnimatedStyle]}>
                  <GestureDetector gesture={Gesture.Pan()
                    .minDistance(5)
                    .activeOffsetY([5, 100])
                    .failOffsetX([-30, 30])
                    .onUpdate((e) => {
                      if (e.translationY > 0) {
                        editModalTranslateY.value = e.translationY;
                      }
                    })
                    .onEnd((e) => {
                      if (e.translationY > 50) {
                        editModalTranslateY.value = withTiming(1000, { duration: 200 }, () => {
                          runOnJS(closeEditModal)();
                          editModalTranslateY.value = 0;
                        });
                      } else {
                        editModalTranslateY.value = withTiming(0, { duration: 200 });
                      }
                    })
                  }>
                    <TouchableOpacity 
                      style={styles.modalDragHandle}
                      onPress={closeEditModal}
                      activeOpacity={1}
                    >
                      <View style={styles.modalDragBar} />
                    </TouchableOpacity>
                  </GestureDetector>
                  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text style={styles.modalTitle}>Изменить количество</Text>
                    <Text style={{ marginBottom: 12, color: colors.textSecondary, fontSize: 14 }}>
                      {editingDrink?.name} · {formatTotalVolume(editingDrink?.volumeMl || 0, 1)} · {editingDrink?.abvPercent}%
                    </Text>
                    <View style={styles.quantityRow}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => {
                          const current = parseInt(newQuantity) || 1;
                          if (current > 1) {
                            setNewQuantity((current - 1).toString());
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Entypo name="circle-with-minus" size={28} color={colors.primary} />
                      </TouchableOpacity>
                      <TextInput
                        placeholder="Количество"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        value={newQuantity}
                        onChangeText={(text) => {
                          const normalized = text.replace(',', '.').replace(/[^0-9]/g, '');
                          setNewQuantity(normalized);
                        }}
                        style={[styles.input, styles.quantityInput]}
                        returnKeyType="done"
                        blurOnSubmit
                        onSubmitEditing={Keyboard.dismiss}
                      />
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => {
                          const current = parseInt(newQuantity) || 1;
                          setNewQuantity((current + 1).toString());
                        }}
                        activeOpacity={0.7}
                      >
                        <Entypo name="circle-with-plus" size={28} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.modalActions, { paddingBottom: 20 + insets.bottom }]}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={closeEditModal}>
                        <Text style={styles.cancelBtnText}>Отмена</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.saveBtn} onPress={saveEditedDrink}>
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

      {/* Модалка редактирования пресета */}
      <Modal visible={editPresetModalVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={closeEditPresetModal}>
          <View style={styles.modalBackdrop}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
              style={styles.kav}
            >
              <TouchableWithoutFeedback onPress={() => {}}>
                <Animated.View style={[styles.modalCard, editPresetModalAnimatedStyle]}>
                  <GestureDetector gesture={Gesture.Pan()
                    .minDistance(5)
                    .activeOffsetY([5, 100])
                    .failOffsetX([-30, 30])
                    .onUpdate((e) => {
                      if (e.translationY > 0) {
                        editPresetModalTranslateY.value = e.translationY;
                      }
                    })
                    .onEnd((e) => {
                      if (e.translationY > 50) {
                        editPresetModalTranslateY.value = withTiming(1000, { duration: 200 }, () => {
                          runOnJS(closeEditPresetModal)();
                          editPresetModalTranslateY.value = 0;
                        });
                      } else {
                        editPresetModalTranslateY.value = withTiming(0, { duration: 200 });
                      }
                    })
                  }>
                    <TouchableOpacity 
                      style={styles.modalDragHandle}
                      onPress={closeEditPresetModal}
                      activeOpacity={1}
                    >
                      <View style={styles.modalDragBar} />
                    </TouchableOpacity>
                  </GestureDetector>
                  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text style={styles.modalTitle}>Редактировать напиток</Text>
                    <Text style={{ marginBottom: 12, color: colors.textSecondary, fontSize: 14 }}>
                      Измените данные напитка
                    </Text>
                    <TextInput
                      placeholder="Название"
                      placeholderTextColor={colors.textTertiary}
                      value={presetName}
                      onChangeText={setPresetName}
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
                            style={[styles.typeChip, presetType === t && styles.typeChipActive]}
                            onPress={() => setPresetType(t)}
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
                        keyboardType="decimal-pad"
                        value={presetVolume}
                        onChangeText={(text) => {
                          const normalized = text.replace(',', '.');
                          setPresetVolume(normalized);
                        }}
                        style={[styles.input, { flex: 1, marginRight: 8 }]}
                        returnKeyType="done"
                        blurOnSubmit
                        onSubmitEditing={Keyboard.dismiss}
                      />
                      <TextInput
                        placeholder="Крепость, %"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                        value={presetAbv}
                        onChangeText={(text) => {
                          const normalized = text.replace(',', '.');
                          setPresetAbv(normalized);
                        }}
                        style={[styles.input, { flex: 1 }]}
                        returnKeyType="done"
                        blurOnSubmit
                        onSubmitEditing={Keyboard.dismiss}
                      />
                    </View>
                    <View style={[styles.modalActions, { paddingBottom: 20 + insets.bottom }]}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={closeEditPresetModal}>
                        <Text style={styles.cancelBtnText}>Отмена</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.saveBtn} onPress={saveEditedPreset}>
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

      {/* Модалка выбора даты */}
      <Modal visible={datePickerVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={() => setDatePickerVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <Animated.View style={[styles.datePickerCard, datePickerModalAnimatedStyle]}>
                <GestureDetector gesture={Gesture.Pan()
                  .minDistance(5)
                  .activeOffsetY([5, 100])
                  .failOffsetX([-30, 30])
                  .onUpdate((e) => {
                    if (e.translationY > 0) {
                      datePickerModalTranslateY.value = e.translationY;
                    }
                  })
                  .onEnd((e) => {
                    if (e.translationY > 50) {
                      datePickerModalTranslateY.value = withTiming(1000, { duration: 200 }, () => {
                        runOnJS(setDatePickerVisible)(false);
                        datePickerModalTranslateY.value = 0;
                      });
                    } else {
                      datePickerModalTranslateY.value = withTiming(0, { duration: 200 });
                    }
                  })
                }>
                  <TouchableOpacity 
                    style={styles.modalDragHandle}
                    onPress={() => setDatePickerVisible(false)}
                    activeOpacity={1}
                  >
                    <View style={styles.modalDragBar} />
                  </TouchableOpacity>
                </GestureDetector>
                <Text style={styles.modalTitle}>Выберите дату</Text>
                <View style={styles.datePickerWeekRow}>
                  {WEEKDAY_SHORT_RU.map((day) => (
                    <Text key={day} style={styles.datePickerWeekLabel}>{day}</Text>
                  ))}
                </View>
                <View style={styles.datePickerGrid}>
                  {(() => {
                    const matrix = buildMonthMatrix(selectedDateForAdd);
                    const today = new Date();
                    const todayISO = formatISO(today);
                    return matrix.map((date, idx) => {
                      const dateISO = formatISO(date);
                      const isCurrentMonth = date.getMonth() === selectedDateForAdd.getMonth();
                      const isSelected = dateISO === formatISO(selectedDateForAdd);
                      const isToday = dateISO === todayISO;
                      return (
                        <TouchableOpacity
                          key={`${dateISO}_${idx}`}
                          style={[
                            styles.datePickerCell,
                            !isCurrentMonth && styles.datePickerCellAdjacent,
                            isSelected && styles.datePickerCellSelected,
                            isToday && styles.datePickerCellToday,
                          ]}
                          onPress={() => {
                            setSelectedDateForAdd(date);
                            setDatePickerVisible(false);
                          }}
                        >
                          <Text style={[
                            styles.datePickerCellText,
                            !isCurrentMonth && styles.datePickerCellTextMuted,
                            isSelected && styles.datePickerCellTextSelected,
                          ]}>
                            {date.getDate()}
                          </Text>
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </View>
                <View style={styles.datePickerMonthNav}>
                  <TouchableOpacity
                    style={styles.datePickerNavButton}
                    onPress={() => {
                      const newDate = new Date(selectedDateForAdd);
                      newDate.setMonth(newDate.getMonth() - 1);
                      setSelectedDateForAdd(newDate);
                    }}
                  >
                    <MaterialIcons name="chevron-left" size={24} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.datePickerMonthLabel}>
                    {selectedDateForAdd.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                  </Text>
                  <TouchableOpacity
                    style={styles.datePickerNavButton}
                    onPress={() => {
                      const newDate = new Date(selectedDateForAdd);
                      newDate.setMonth(newDate.getMonth() + 1);
                      const today = new Date();
                      if (newDate <= today) {
                        setSelectedDateForAdd(newDate);
                      }
                    }}
                  >
                    <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.todayButton}
                  onPress={() => {
                    setSelectedDateForAdd(new Date());
                    setDatePickerVisible(false);
                  }}
                >
                  <Text style={styles.todayButtonText}>Сегодня</Text>
                </TouchableOpacity>
              </Animated.View>
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
    padding: 16,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
    color: colors.text,
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: colors.text,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  total: {
    fontWeight: '600',
    fontSize: 14,
    color: colors.textSecondary,
  },
  presetList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  presetButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
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
  presetButtonEditMode: {
    opacity: 0.6,
  },
  presetButtonDeleting: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  deleteIconContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
  },
  editIconContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
  },
  editButtonsRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  editActionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  editActionButtonNoBg: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  presetDetails: {
    fontSize: 10,
    fontWeight: '400',
  },
  addFavButtonRect: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  addFavRectText: {
    color: colors.primaryLight,
    fontSize: 16,
    fontWeight: '700',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  kav: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.backgroundCard,
    minHeight: '33%',
    maxHeight: '90%',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
          modalCardFullScreen: {
    flex: 1,
    minHeight: '100%',
    maxHeight: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
shadowOpacity: 0.5,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
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
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    color: colors.text,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: colors.backgroundSecondary,
    fontSize: 16,
    color: colors.text,
    placeholderTextColor: colors.textTertiary,
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
    backgroundColor: colors.backgroundSecondary,
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
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  quantityButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: '#991b1b', // Темно-красный, гармонирующий с темной темой
    borderRadius: 12,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8, // Промежуток справа
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%', // Занимает всю ширину контейнера
    overflow: 'hidden', // Чтобы содержимое не выходило за границы при ширине 0
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
  deleteIcon: {
    fontSize: 28,
    color: colors.error, // Красная иконка
    fontWeight: '200',
    lineHeight: 28,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 2, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
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
  // Центрированная модалка
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
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
  },
  addCustomButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  addCustomButtonText: {
    color: colors.primaryLight,
    fontSize: 16,
    fontWeight: '700',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
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
  statsBarItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsBarLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statsBarValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  statsBarDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
  dateButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateButtonText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  dateNavButton: {
    padding: 4,
  },
  datePickerCard: {
    backgroundColor: colors.backgroundCard,
    minHeight: '50%',
    maxHeight: '80%',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  datePickerWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  datePickerWeekLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    width: 40,
    textAlign: 'center',
  },
  datePickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 4,
  },
  datePickerCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 4,
  },
  datePickerCellAdjacent: {
    opacity: 0.3,
  },
  datePickerCellSelected: {
    backgroundColor: colors.primary,
  },
  datePickerCellToday: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  datePickerCellText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  datePickerCellTextMuted: {
    color: colors.textTertiary,
  },
  datePickerCellTextSelected: {
    color: colors.text,
    fontWeight: '700',
  },
  datePickerMonthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  datePickerNavButton: {
    padding: 8,
  },
  datePickerMonthLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'capitalize',
  },
  todayButton: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginTop: 8,
  },
  todayButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
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
});


