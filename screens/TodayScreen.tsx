import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TextInput, TouchableOpacity, Alert, FlatList, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Keyboard, Dimensions, AppState } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { MaterialIcons, Ionicons, Entypo, FontAwesome } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import PresetButton from '../components/PresetButton';
import { suggestedPresets, getUserPresets, addPreset, removePreset, updatePreset, presetsEventEmitter } from '../storage/presets';
import { PresetDrink } from '../types/preset';
import { addDrink, addOrMergeDrink, getDrinksByDate, getAllDrinks, removeDrink, updateDrink } from '../storage/drinks';
import { isPremiumUser } from '../storage/premium';
import { calculateStandardUnits, todayISO, formatTotalVolume } from '../utils/units';
import { Drink } from '../types/drink';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { useCurrency } from '../theme/CurrencyContext';
import { formatPrice, formatPriceShort } from '../utils/currency';
import { colors as defaultColors } from '../theme/colors';
import { formatISO, WEEKDAY_SHORT_RU, getWeekdayIndexMonFirst, buildMonthMatrix } from '../utils/date';
import { runNotificationChecks } from '../services/notifications';

const getBeverageColor = (type: PresetDrink['beverageType'], themeColors: any) => {
  return themeColors[type] || themeColors.other;
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
const SwipeableListItem = React.memo(function SwipeableListItem({ item, beverageColor, onRemove, onQuantityChange, colors, currency }: { item: Drink; beverageColor: any; onRemove: (id: string) => void; onQuantityChange: (id: string, delta: number) => void; colors: any; currency: import('../storage/settings').CurrencyCode }) {
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
        <Animated.View style={[
          styles.listItem, 
          animatedStyle, 
          { 
            backgroundColor: beverageColor.light,
            shadowColor: colors.primary,
          }
        ]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { color: beverageColor.text }]}>{item.name}</Text>
                <Text style={[styles.itemSub, { color: beverageColor.text, opacity: 0.8 }]}>
                  {formatTotalVolume(item.volumeMl, item.quantity ?? 1)} · {item.abvPercent}% · {item.standardUnits.toFixed(2)} ед.
                  {item.quantity && item.quantity > 1 ? ` (x${item.quantity})` : ''}
                  {item.price != null && item.price > 0 ? ` · ${formatPriceShort(item.price, currency)}` : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}>
                <TouchableOpacity
                  onPress={() => onQuantityChange(item.id, -1)}
                  style={[styles.qtyButton, { marginRight: 4, backgroundColor: 'transparent', borderWidth: 0 }]}
                  activeOpacity={0.7}
                >
                  <Entypo name="circle-with-minus" size={28} color={beverageColor.text} />
                </TouchableOpacity>
                <Text style={[styles.qtyValue, { minWidth: 24, textAlign: 'center', color: beverageColor.text }]}>{item.quantity ?? 1}</Text>
                <TouchableOpacity
                  onPress={() => onQuantityChange(item.id, 1)}
                  style={[styles.qtyButton, { marginLeft: 4, backgroundColor: 'transparent', borderWidth: 0 }]}
                  activeOpacity={0.7}
                >
                  <Entypo name="circle-with-plus" size={28} color={beverageColor.text} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
});

export default function TodayScreen() {
  const { colors } = useTheme();
  const { currency } = useCurrency();
  const [userPresets, setUserPresets] = useState<PresetDrink[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingDrink, setEditingDrink] = useState<Drink | null>(null);
  const [newQuantity, setNewQuantity] = useState('1');
  const [editPriceVal, setEditPriceVal] = useState('');
  const [editPresetModalVisible, setEditPresetModalVisible] = useState(false);
  const [editingPreset, setEditingPreset] = useState<PresetDrink | null>(null);
  const [presetName, setPresetName] = useState('');
  const [presetType, setPresetType] = useState<PresetDrink['beverageType']>('beer');
  const [presetVolume, setPresetVolume] = useState('500');
  const [presetAbv, setPresetAbv] = useState('5');
  const [presetPrice, setPresetPrice] = useState('');
  // Переменные для модалки добавления кастомного пресета
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<PresetDrink['beverageType']>('beer');
  const [newVolume, setNewVolume] = useState('500');
  const [newAbv, setNewAbv] = useState('5');
  const [newPriceVal, setNewPriceVal] = useState('');

  // Выбранная дата для добавления напитка
  const [selectedDateForAdd, setSelectedDateForAdd] = useState<Date>(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

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
  useEffect(() => {
    isPremiumUser().then(setIsPremium);
  }, []);

  // Обновляем статус премиума при каждом фокусе (после активации в Настройках)
  useFocusEffect(
    useCallback(() => {
      isPremiumUser().then(setIsPremium);
    }, [])
  );

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

  const handleQuickAdd = async (preset: PresetDrink) => {
    const units = calculateStandardUnits(preset.volumeMl, preset.abvPercent);
    const price = isPremium && preset.defaultPrice != null && preset.defaultPrice > 0 ? preset.defaultPrice : undefined;
    const entry: Drink = {
      id: `drink_${Date.now()}`,
      dateISO: formatISO(selectedDateForAdd),
      name: preset.name,
      beverageType: preset.beverageType,
      volumeMl: preset.volumeMl,
      abvPercent: preset.abvPercent,
      standardUnits: units,
      quantity: 1,
      ...(price != null && { price }),
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
    setNewPriceVal('');
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
    const normalizedVolume = newVolume.replace(',', '.');
    const normalizedAbv = newAbv.replace(',', '.');
    const volume = parseFloat(normalizedVolume);
    const abv = parseFloat(normalizedAbv);
    if (!newName || isNaN(volume) || isNaN(abv)) {
      Alert.alert('Ошибка', 'Заполните название, объём и крепость');
      return;
    }
    const priceNum = newPriceVal.trim() ? parseFloat(newPriceVal.replace(',', '.')) : undefined;
    const defaultPrice = isPremium && priceNum != null && !isNaN(priceNum) && priceNum >= 0 ? Math.round(priceNum * 100) / 100 : undefined;
    const updated = await addPreset({
      name: newName,
      beverageType: newType,
      volumeMl: volume,
      abvPercent: abv,
      ...(defaultPrice != null && { defaultPrice }),
    });
    setUserPresets(updated);
    closeCustomModal();
  };

  const [todayList, setTodayList] = useState<Drink[]>([]);
  const totalUnits = useMemo(() => todayList.reduce((s, d) => s + d.standardUnits, 0), [todayList]);
  const totalVolumeMl = useMemo(() => todayList.reduce((s, d) => s + d.volumeMl * (d.quantity ?? 1), 0), [todayList]);
  const totalPrice = useMemo(() => todayList.reduce((s, d) => s + (d.price ?? 0), 0), [todayList]);
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
      // Ненавязчивые уведомления: вехи (неделя, месяц, …) и тренд (улучшение/ухудшение)
      const t = setTimeout(async () => {
        try {
          const drinks = await getAllDrinks();
          await runNotificationChecks(drinks);
        } catch (_) {}
      }, 1500);
      return () => clearTimeout(t);
    }, [reloadToday])
  );

  // Обновлять список при возврате в приложение (например, после добавления через виджет)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') reloadToday();
    });
    return () => sub.remove();
  }, [reloadToday]);

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
    setEditPriceVal(drink.price != null ? String(drink.price) : '');
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingDrink(null);
    setNewQuantity('1');
    setEditPriceVal('');
  };

  const saveEditedDrink = async () => {
    if (!editingDrink) return;
    
    const quantity = Math.max(1, Math.floor(Number(newQuantity.replace(',', '.')) || 1));
    
    if (isNaN(quantity) || quantity < 1) {
      Alert.alert('Ошибка', 'Введите корректное количество');
      return;
    }

    const baseUnits = calculateStandardUnits(editingDrink.volumeMl, editingDrink.abvPercent);
    const totalUnits = Math.round(baseUnits * quantity * 100) / 100;
    const priceNum = editPriceVal.trim() ? parseFloat(editPriceVal.replace(',', '.')) : undefined;
    const price = priceNum != null && !isNaN(priceNum) && priceNum >= 0 ? Math.round(priceNum * 100) / 100 : undefined;

    await updateDrink(editingDrink.id, {
      quantity,
      standardUnits: totalUnits,
      ...(isPremium && { price }), // при премиуме передаём цену (число или undefined для сброса)
    });
    
    await reloadToday();
    closeEditModal();
  };

  const openEditPresetModal = (preset: PresetDrink) => {
    setEditingPreset(preset);
    const nameMatch = preset.name.match(/^(.+?)\s+\d+\s*(мл|л)\s*\(\d+%\)$/);
    setPresetName(nameMatch ? nameMatch[1].trim() : preset.name);
    setPresetType(preset.beverageType);
    setPresetVolume(preset.volumeMl.toString());
    setPresetAbv(preset.abvPercent.toString());
    setPresetPrice(preset.defaultPrice != null ? String(preset.defaultPrice) : '');
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
    setPresetPrice('');
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

    const priceNum = presetPrice.trim() ? parseFloat(presetPrice.replace(',', '.')) : undefined;
    const defaultPrice = isPremium && priceNum != null && !isNaN(priceNum) && priceNum >= 0 ? Math.round(priceNum * 100) / 100 : undefined;
    await updatePreset(editingPreset.id, {
      name: presetName,
      beverageType: presetType,
      volumeMl: volume,
      abvPercent: abv,
      ...(isPremium && { defaultPrice }),
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
    setSearchQuery(text);
  };

  const insets = useSafeAreaInsets();

  const handleLongPress = (presetId: string) => {
    if (editingPresetId === presetId) {
      setEditingPresetId(null);
      setDeletingPresetId(null);
    } else {
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <TouchableOpacity
        style={styles.collapsibleHeader}
        onPress={() => setPresetsCollapsed(!presetsCollapsed)}
        activeOpacity={0.7}
      >
        <Text style={[styles.title, { color: colors.text }]}>Избранное</Text>
        <Ionicons 
          name={presetsCollapsed ? "chevron-down" : "chevron-up"} 
          size={20} 
          color={colors.textSecondary} 
        />
      </TouchableOpacity>
      {!presetsCollapsed && (() => {
        const favoritesMaxHeight = Math.min(Dimensions.get('window').height * 0.36, 300);
        return (
        <View style={{ marginBottom: 12, maxHeight: favoritesMaxHeight }}>
          <ScrollView 
            style={{ maxHeight: favoritesMaxHeight }}
            contentContainerStyle={styles.presetList} 
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            <TouchableWithoutFeedback
              onPress={() => {
                if (editingPresetId || deletingPresetId) {
                  setEditingPresetId(null);
                  setDeletingPresetId(null);
                }
              }}
            >
              <View style={styles.presetList}>
            {userPresets.map((p) => {
              const beverageColor = getBeverageColor(p.beverageType, colors);
              const isEditing = editingPresetId === p.id;
              return (
                <View key={p.id} style={{ position: 'relative' }}>
                  <TouchableOpacity
                    style={[
                      styles.presetButton,
                      { backgroundColor: beverageColor.light },
                      isEditing && styles.presetButtonDeleting,
                      isEditing && { borderColor: colors.primary },
                    ]}
                    onPress={() => {
                      if (isEditing) {
                        setEditingPresetId(null);
                        return;
                      }
                      handleQuickAdd(p);
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
                              if (preset) openEditPresetModal(preset);
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
              style={[styles.addFavButtonRect, { backgroundColor: colors.backgroundSecondary, borderColor: colors.primary, shadowColor: colors.primary }]}
              onPress={() => {
                setDeletingPresetId(null);
                setEditingPresetId(null);
                openAddModal();
              }}
              accessibilityLabel="Добавить напиток"
            >
              <Entypo name="circle-with-plus" size={22} color={colors.primary} />
            </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </View>
        );
      })()}


      <TouchableOpacity
        activeOpacity={1}
        onPress={() => { deletingPresetId && setDeletingPresetId(null); editingPresetId && setEditingPresetId(null); }}
      >
        <View style={[styles.sectionHeaderRow, { borderBottomColor: colors.borderLight }]}>
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
              style={[styles.dateButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
              onPress={() => setDatePickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dateButtonText, { color: colors.text }]}>
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
      <View style={[styles.statsBar, { backgroundColor: colors.backgroundCard }]}>
        <View style={styles.statsBarItem}>
          <Text style={[styles.statsBarLabel, { color: colors.textSecondary }]}>Объем</Text>
          <Text style={[styles.statsBarValue, { color: colors.text }]}>{formatTotalVolume(totalVolumeMl, 1)}</Text>
        </View>
        <View style={[styles.statsBarDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statsBarItem}>
          <Text style={[styles.statsBarLabel, { color: colors.textSecondary }]}>Единицы</Text>
          <Text style={[styles.statsBarValue, { color: colors.text }]}>{totalUnits.toFixed(2)}</Text>
        </View>
        <View style={[styles.statsBarDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statsBarItem}>
          <Text style={[styles.statsBarLabel, { color: colors.textSecondary }]}>Спирт</Text>
          <Text style={[styles.statsBarValue, { color: colors.text }]}>{Math.round(totalAlcoholGrams)} г</Text>
        </View>
        {isPremium && totalPrice > 0 && (
          <>
            <View style={[styles.statsBarDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statsBarItem}>
              <Text style={[styles.statsBarLabel, { color: colors.textSecondary }]}>Сумма</Text>
              <Text style={[styles.statsBarValue, { color: colors.text }]}>{formatPrice(totalPrice, currency)}</Text>
            </View>
          </>
        )}
      </View>
      <FlatList
        data={todayList}
        keyExtractor={(item) => item.id}
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        overScrollMode="never"
        windowSize={6}
        initialNumToRender={8}
        maxToRenderPerBatch={4}
        renderItem={({ item }) => {
          const beverageColor = getBeverageColor(item.beverageType, colors);
          return (
            <SwipeableListItem
              item={item}
              beverageColor={beverageColor}
              onRemove={onRemoveDrink}
              onQuantityChange={changeQuantity}
              currency={currency}
              colors={colors}
            />
          );
        }}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary, textAlign: 'center', paddingVertical: 20 }}>Пока нет записей</Text>}
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      {/* Модалка выбора напитка для добавления */}
      <Modal visible={addModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          style={styles.kav}
        >
          <TouchableWithoutFeedback onPress={closeAddModal}>
            <View style={styles.modalBackdrop}>
              <TouchableWithoutFeedback onPress={() => {}}>
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
                      addModalTranslateY.value = withSpring(1000, { damping: 20, stiffness: 300 }, () => {
                        runOnJS(closeAddModal)();
                        addModalTranslateY.value = 0;
                      });
                    } else {
                      addModalTranslateY.value = withSpring(0, { damping: 20, stiffness: 300 });
                    }
                  })
                }>
                  <Animated.View style={[
                    styles.modalCard,
                    { backgroundColor: colors.backgroundCard },
                    searchQuery && searchQuery.trim() && [styles.modalCardFullScreen, { paddingTop: 4 + insets.top }],
                    addModalAnimatedStyle
                  ]}>
                    <TouchableOpacity 
                      style={styles.modalDragHandle}
                      onPress={closeAddModal}
                      activeOpacity={1}
                    >
                      <View style={[styles.modalDragBar, { backgroundColor: colors.textTertiary }]} />
                    </TouchableOpacity>
                    <View style={searchQuery && searchQuery.trim() ? { flex: 1 } : {}}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Добавить напиток</Text>
                    <Text style={{ marginBottom: 12, color: colors.textSecondary }}>Выберите из предложенных или добавьте свой</Text>
                  
                    {/* Строка поиска для предложенных пресетов */}
                    {availableSuggestedPresets.length > 0 && (
                      <TextInput
                        placeholder="Поиск напитков..."
                        placeholderTextColor={colors.textTertiary}
                        value={searchQuery}
                        onChangeText={handleSearchChange}
                        style={[styles.searchInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
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
                          style={[styles.suggestedItem, { backgroundColor: colors.backgroundCard, borderBottomColor: colors.border }]}
                          onPress={() => addSuggestedPreset(preset)}
                        >
                          <Text style={[styles.suggestedText, { color: colors.text }]}>{preset.name}</Text>
                        </TouchableOpacity>
                      ))}
                      
                      <TouchableOpacity
                        style={[styles.addCustomButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.primary, shadowColor: colors.primary }]}
                        onPress={openCustomModal}
                      >
                        <Text style={[styles.addCustomButtonText, { color: colors.primaryLight }]}>+ Добавить свой напиток</Text>
                      </TouchableOpacity>
                    </ScrollView>

                    </View>
                  </Animated.View>
                </GestureDetector>
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
                <Animated.View style={[styles.modalCard, { backgroundColor: colors.backgroundCard }, customModalAnimatedStyle]}>
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
                        customModalTranslateY.value = withSpring(1000, { damping: 20, stiffness: 300 }, () => {
                          runOnJS(closeCustomModal)();
                          customModalTranslateY.value = 0;
                        });
                      } else {
                        customModalTranslateY.value = withSpring(0, { damping: 20, stiffness: 300 });
                      }
                    })
                  }>
                    <TouchableOpacity 
                      style={styles.modalDragHandle}
                      onPress={closeCustomModal}
                      activeOpacity={1}
                    >
                      <View style={[styles.modalDragBar, { backgroundColor: colors.textTertiary }]} />
                    </TouchableOpacity>
                  </GestureDetector>
                  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Новый напиток</Text>
                  <Text style={{ marginBottom: 12, color: colors.textSecondary, fontSize: 14 }}>
                    Объём и крепость будут автоматически добавлены в название
                  </Text>
                  <TextInput
                    placeholder="Название (например, Джин-тоник)"
                    placeholderTextColor={colors.textTertiary}
                    value={newName}
                    onChangeText={setNewName}
                    style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={Keyboard.dismiss}
                  />
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: colors.text }]}>Тип:</Text>
                    <View style={styles.typeRow}>
                      {(['beer','wine','spirit','cocktail','other'] as const).map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.typeChip,
                            { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
                            newType === t && styles.typeChipActive,
                            newType === t && { backgroundColor: colors.primaryDark, borderColor: colors.primary },
                          ]}
                          onPress={() => setNewType(t)}
                        >
                          <Text style={[styles.typeChipText, { color: newType === t ? '#fff' : colors.text }]}>{getBeverageTypeLabel(t)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.label, { color: colors.text, marginBottom: 4 }]}>Объём, мл</Text>
                      <TextInput
                        placeholder="мл"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                        value={newVolume}
                        onChangeText={(text) => {
                          const normalized = text.replace(',', '.');
                          setNewVolume(normalized);
                        }}
                        style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                        returnKeyType="done"
                        blurOnSubmit
                        onSubmitEditing={Keyboard.dismiss}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: colors.text, marginBottom: 4 }]}>Крепость, %</Text>
                      <TextInput
                        placeholder="%"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                        value={newAbv}
                        onChangeText={(text) => {
                          const normalized = text.replace(',', '.');
                          setNewAbv(normalized);
                        }}
                        style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                        returnKeyType="done"
                        blurOnSubmit
                        onSubmitEditing={Keyboard.dismiss}
                      />
                    </View>
                  </View>
                  {isPremium && (
                    <View style={{ marginBottom: 12 }}>
                      <Text style={[styles.label, { color: colors.text }]}>Цена</Text>
                      <TextInput
                        placeholder="Не указана"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                        value={newPriceVal}
                        onChangeText={(t) => setNewPriceVal(t.replace(',', '.'))}
                        style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                      />
                    </View>
                  )}
                  <View style={[styles.modalActions, { paddingBottom: 20 + insets.bottom }]}>
                    <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]} onPress={closeCustomModal}>
                      <Text style={[styles.cancelBtnText, { color: colors.text }]}>Отмена</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]} onPress={saveCustomPreset}>
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
                <Animated.View style={[styles.modalCard, { backgroundColor: colors.backgroundCard }, editModalAnimatedStyle]}>
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
                        editModalTranslateY.value = withSpring(1000, { damping: 20, stiffness: 300 }, () => {
                          runOnJS(closeEditModal)();
                          editModalTranslateY.value = 0;
                        });
                      } else {
                        editModalTranslateY.value = withSpring(0, { damping: 20, stiffness: 300 });
                      }
                    })
                  }>
                    <TouchableOpacity 
                      style={styles.modalDragHandle}
                      onPress={closeEditModal}
                      activeOpacity={1}
                    >
                      <View style={[styles.modalDragBar, { backgroundColor: colors.textTertiary }]} />
                    </TouchableOpacity>
                  </GestureDetector>
                  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Изменить количество</Text>
                    <Text style={{ marginBottom: 12, color: colors.textSecondary, fontSize: 14 }}>
                      {editingDrink?.name} · {formatTotalVolume(editingDrink?.volumeMl || 0, 1)} · {editingDrink?.abvPercent}%
                    </Text>
                    <View style={styles.quantityRow}>
                      <TouchableOpacity
                        style={[styles.quantityButton, { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.primary, borderRadius: 24 }]}
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
                        style={[styles.input, styles.quantityInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                        returnKeyType="done"
                        blurOnSubmit
                        onSubmitEditing={Keyboard.dismiss}
                      />
                      <TouchableOpacity
                        style={[styles.quantityButton, { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.primary, borderRadius: 24 }]}
                        onPress={() => {
                          const current = parseInt(newQuantity) || 1;
                          setNewQuantity((current + 1).toString());
                        }}
                        activeOpacity={0.7}
                      >
                        <Entypo name="circle-with-plus" size={28} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                    {isPremium && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Цена</Text>
                        <TextInput
                          value={editPriceVal}
                          onChangeText={setEditPriceVal}
                          keyboardType="decimal-pad"
                          placeholder="Не указана"
                          placeholderTextColor={colors.textTertiary}
                          style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                        />
                      </View>
                    )}
                    <View style={[styles.modalActions, { paddingBottom: 20 + insets.bottom }]}>
                      <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]} onPress={closeEditModal}>
                        <Text style={[styles.cancelBtnText, { color: colors.text }]}>Отмена</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]} onPress={saveEditedDrink}>
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
                <Animated.View style={[styles.modalCard, { backgroundColor: colors.backgroundCard }, editPresetModalAnimatedStyle]}>
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
                        editPresetModalTranslateY.value = withSpring(1000, { damping: 20, stiffness: 300 }, () => {
                          runOnJS(closeEditPresetModal)();
                          editPresetModalTranslateY.value = 0;
                        });
                      } else {
                        editPresetModalTranslateY.value = withSpring(0, { damping: 20, stiffness: 300 });
                      }
                    })
                  }>
                    <TouchableOpacity 
                      style={styles.modalDragHandle}
                      onPress={closeEditPresetModal}
                      activeOpacity={1}
                    >
                      <View style={[styles.modalDragBar, { backgroundColor: colors.textTertiary }]} />
                    </TouchableOpacity>
                  </GestureDetector>
                  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Редактировать напиток</Text>
                    <Text style={{ marginBottom: 12, color: colors.textSecondary, fontSize: 14 }}>
                      Измените данные напитка
                    </Text>
                    <TextInput
                      placeholder="Название"
                      placeholderTextColor={colors.textTertiary}
                      value={presetName}
                      onChangeText={setPresetName}
                      style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    <View style={styles.row}>
                      <Text style={[styles.label, { color: colors.text }]}>Тип:</Text>
                      <View style={styles.typeRow}>
                        {(['beer','wine','spirit','cocktail','other'] as const).map((t) => (
                          <TouchableOpacity
                            key={t}
                            style={[
                              styles.typeChip,
                              { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
                              presetType === t && styles.typeChipActive,
                              presetType === t && { backgroundColor: colors.primaryDark, borderColor: colors.primary },
                            ]}
                            onPress={() => setPresetType(t)}
                          >
                            <Text style={[styles.typeChipText, { color: presetType === t ? '#fff' : colors.text }]}>{getBeverageTypeLabel(t)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.label, { color: colors.text, marginBottom: 4 }]}>Объём, мл</Text>
                        <TextInput
                          placeholder="мл"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="decimal-pad"
                          value={presetVolume}
                          onChangeText={(text) => {
                            const normalized = text.replace(',', '.');
                            setPresetVolume(normalized);
                          }}
                          style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                          returnKeyType="done"
                          blurOnSubmit
                          onSubmitEditing={Keyboard.dismiss}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.label, { color: colors.text, marginBottom: 4 }]}>Крепость, %</Text>
                        <TextInput
                          placeholder="%"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="decimal-pad"
                          value={presetAbv}
                          onChangeText={(text) => {
                            const normalized = text.replace(',', '.');
                            setPresetAbv(normalized);
                          }}
                          style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                          returnKeyType="done"
                          blurOnSubmit
                          onSubmitEditing={Keyboard.dismiss}
                        />
                      </View>
                    </View>
                    {isPremium && (
                      <View style={{ marginBottom: 12 }}>
                        <Text style={[styles.label, { color: colors.text, marginBottom: 4 }]}>Цена</Text>
                        <TextInput
                          placeholder="Не указана"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="decimal-pad"
                          value={presetPrice}
                          onChangeText={(t) => setPresetPrice(t.replace(',', '.'))}
                          style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                        />
                      </View>
                    )}
                    <View style={[styles.modalActions, { paddingBottom: 20 + insets.bottom }]}>
                      <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]} onPress={closeEditPresetModal}>
                        <Text style={[styles.cancelBtnText, { color: colors.text }]}>Отмена</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]} onPress={saveEditedPreset}>
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
              <Animated.View style={[styles.datePickerCard, { backgroundColor: colors.backgroundCard }, datePickerModalAnimatedStyle]}>
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
                      datePickerModalTranslateY.value = withSpring(1000, { damping: 20, stiffness: 300 }, () => {
                        runOnJS(setDatePickerVisible)(false);
                        datePickerModalTranslateY.value = 0;
                      });
                    } else {
                      datePickerModalTranslateY.value = withSpring(0, { damping: 20, stiffness: 300 });
                    }
                  })
                }>
                  <TouchableOpacity 
                    style={styles.modalDragHandle}
                    onPress={() => setDatePickerVisible(false)}
                    activeOpacity={1}
                  >
                    <View style={[styles.modalDragBar, { backgroundColor: colors.textTertiary }]} />
                  </TouchableOpacity>
                </GestureDetector>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Выберите дату</Text>
                <View style={styles.datePickerWeekRow}>
                  {WEEKDAY_SHORT_RU.map((day) => (
                    <Text key={day} style={[styles.datePickerWeekLabel, { color: colors.textSecondary }]}>{day}</Text>
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
                            { backgroundColor: colors.backgroundSecondary },
                            !isCurrentMonth && [styles.datePickerCellAdjacent, { backgroundColor: colors.backgroundSecondary }],
                            isSelected && [styles.datePickerCellSelected, { backgroundColor: colors.primary }],
                            isToday && [styles.datePickerCellToday, { borderColor: colors.primary }],
                          ]}
                          onPress={() => {
                            setSelectedDateForAdd(date);
                            setDatePickerVisible(false);
                          }}
                        >
                          <Text style={[
                            styles.datePickerCellText,
                            { color: colors.text },
                            !isCurrentMonth && [styles.datePickerCellTextMuted, { color: colors.textTertiary }],
                            isSelected && [styles.datePickerCellTextSelected, { color: '#fff' }],
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
                    style={[styles.datePickerNavButton, { backgroundColor: colors.backgroundSecondary }]}
                    onPress={() => {
                      const newDate = new Date(selectedDateForAdd);
                      newDate.setMonth(newDate.getMonth() - 1);
                      setSelectedDateForAdd(newDate);
                    }}
                  >
                    <MaterialIcons name="chevron-left" size={24} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={[styles.datePickerMonthLabel, { color: colors.text }]}>
                    {selectedDateForAdd.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                  </Text>
                  <TouchableOpacity
                    style={[styles.datePickerNavButton, { backgroundColor: colors.backgroundSecondary }]}
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
    backgroundColor: defaultColors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
    color: defaultColors.text,
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: defaultColors.text,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: defaultColors.borderLight,
  },
  total: {
    fontWeight: '600',
    fontSize: 14,
    color: defaultColors.textSecondary,
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
    minHeight: 56,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 2, height: -2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  presetButtonEditMode: {
    opacity: 0.6,
  },
  presetButtonDeleting: {
    borderWidth: 2,
    borderColor: defaultColors.primary,
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
    gap: 12,
    alignItems: 'center',
  },
  editActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: defaultColors.backgroundCard,
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
    width: 36,
    height: 36,
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
    minWidth: 56,
    minHeight: 56,
    backgroundColor: defaultColors.backgroundSecondary,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: defaultColors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: defaultColors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  addFavRectText: {
    color: defaultColors.primaryLight,
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
    backgroundColor: defaultColors.backgroundCard,
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
    backgroundColor: defaultColors.textTertiary,
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    color: defaultColors.text,
  },
  input: {
    borderWidth: 1.5,
    borderColor: defaultColors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: defaultColors.backgroundSecondary,
    fontSize: 16,
    color: defaultColors.text,
  },
  searchInput: {
    borderWidth: 1.5,
    borderColor: defaultColors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: defaultColors.text,
    backgroundColor: defaultColors.backgroundSecondary,
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
    color: defaultColors.text,
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
    borderColor: defaultColors.border,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: defaultColors.backgroundSecondary,
  },
  typeChipActive: {
    backgroundColor: defaultColors.primaryDark,
    borderColor: defaultColors.primary,
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: defaultColors.text,
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
    borderColor: defaultColors.border,
    backgroundColor: defaultColors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: defaultColors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    borderRadius: 12,
    backgroundColor: defaultColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: defaultColors.error, // Красная иконка
    fontWeight: '200',
    lineHeight: 28,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: defaultColors.backgroundCard,
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
    color: defaultColors.text,
    marginBottom: 4,
  },
  itemSub: {
    color: defaultColors.textSecondary,
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
    backgroundColor: defaultColors.backgroundCard,
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
    backgroundColor: defaultColors.errorLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: defaultColors.error,
  },
  deleteText: {
    color: defaultColors.error,
    fontWeight: '600',
    fontSize: 13,
  },
  suggestedItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: defaultColors.border,
    backgroundColor: defaultColors.backgroundCard,
  },
  suggestedText: {
    fontSize: 16,
    color: defaultColors.text,
    fontWeight: '500',
  },
  addCustomButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: defaultColors.backgroundSecondary,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 2,
    borderColor: defaultColors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: defaultColors.primary,
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
    color: defaultColors.primaryLight,
    fontSize: 16,
    fontWeight: '700',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: defaultColors.backgroundCard,
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
    color: defaultColors.textSecondary,
    marginBottom: 4,
  },
  statsBarValue: {
    fontSize: 16,
    fontWeight: '700',
    color: defaultColors.text,
  },
  statsBarDivider: {
    width: 1,
    height: 32,
    backgroundColor: defaultColors.border,
    marginHorizontal: 8,
  },
  dateButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: defaultColors.backgroundSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: defaultColors.border,
  },
  dateButtonText: {
    fontSize: 16,
    color: defaultColors.text,
    fontWeight: '600',
  },
  dateNavButton: {
    padding: 4,
  },
  datePickerCard: {
    backgroundColor: defaultColors.backgroundCard,
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
    color: defaultColors.textSecondary,
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
    backgroundColor: defaultColors.primary,
  },
  datePickerCellToday: {
    borderWidth: 2,
    borderColor: defaultColors.primary,
  },
  datePickerCellText: {
    fontSize: 16,
    color: defaultColors.text,
    fontWeight: '500',
  },
  datePickerCellTextMuted: {
    color: defaultColors.textTertiary,
  },
  datePickerCellTextSelected: {
    color: defaultColors.text,
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
    color: defaultColors.text,
    textTransform: 'capitalize',
  },
  todayButton: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: defaultColors.primary,
    borderRadius: 12,
    marginTop: 8,
  },
  todayButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: defaultColors.text,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: defaultColors.primary,
  },
  qtyButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: defaultColors.text,
    lineHeight: 20,
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '600',
    color: defaultColors.text,
    marginHorizontal: 8,
  },
});


