import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TextInput, TouchableOpacity, Alert, FlatList, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Keyboard, Dimensions, AppState } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { MaterialIcons, Ionicons, Entypo, FontAwesome } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import PresetButton from '../components/PresetButton';
import { getUserPresets, addPreset, removePreset, updatePreset, presetsEventEmitter } from '../storage/presets';
import { addDrinkToCatalog, drinkCatalogEventEmitter, getDrinkCatalog, removeCatalogDrink, updateCatalogDrink } from '../storage/drinkCatalog';
import { PresetDrink } from '../types/preset';
import { addDrink, addOrMergeDrink, getDrinksByDate, getAllDrinks, removeDrink, updateDrink } from '../storage/drinks';
import { isPremiumUser } from '../storage/premium';
import { calculateStandardUnits, todayISO, formatTotalVolume } from '../utils/units';
import { Drink } from '../types/drink';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { useCurrency } from '../theme/CurrencyContext';
import { formatPrice, formatPriceShort } from '../utils/currency';
import { colors as defaultColors } from '../theme/colors';
import { isLightUiTheme } from '../theme/themes';
import { formatISO, WEEKDAY_SHORT_RU, getWeekdayIndexMonFirst, buildMonthMatrix } from '../utils/date';
import { runNotificationChecks } from '../services/notifications';
import { useOnboarding } from '../context/OnboardingContext';
import AddOneTimeEntryModal, { type OneTimeEntryData } from '../components/AddOneTimeEntryModal';
import { useI18n } from '../i18n/I18nContext';
import { useModalDragHandleGesture } from '../hooks/useModalDragHandleGesture';

const getBeverageColor = (type: PresetDrink['beverageType'], themeColors: any) => {
  return themeColors[type] || themeColors.other;
};

const getBeverageTypeLabel = (
  type: PresetDrink['beverageType'],
  translate: (key: string) => string
): string => translate(`drinkTypes.${type}`);

// Компонент для свайп-удаления записи
const SwipeableListItem = React.memo(function SwipeableListItem({
  item,
  beverageColor,
  onRemove,
  onQuantityChange,
  colors,
  currency,
  volumeUnits,
  unitsShort,
}: {
  item: Drink;
  beverageColor: any;
  onRemove: (id: string) => void;
  onQuantityChange: (id: string, delta: number) => void;
  colors: any;
  currency: import('../storage/settings').CurrencyCode;
  volumeUnits: { ml: string; l: string };
  unitsShort: string;
}) {
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
                  {formatTotalVolume(item.volumeMl, item.quantity ?? 1, volumeUnits)} · {item.abvPercent}% · {item.standardUnits.toFixed(2)} {unitsShort}
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
  const { colors, themeName } = useTheme();
  const blendAddDrinkOuterChrome = isLightUiTheme(themeName);
  const { currency } = useCurrency();
  const { t, localeTag } = useI18n();
  const volumeUnits = useMemo(() => ({ ml: t('common.mlShort'), l: t('common.lShort') }), [t]);
  const [userPresets, setUserPresets] = useState<PresetDrink[]>([]);
  const [catalog, setCatalog] = useState<PresetDrink[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addEntryModalVisible, setAddEntryModalVisible] = useState(false);
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
  const [editingCatalogItem, setEditingCatalogItem] = useState<PresetDrink | null>(null);

  // Выбранная дата для добавления напитка
  const [selectedDateForAdd, setSelectedDateForAdd] = useState<Date>(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [oneTimeModalVisible, setOneTimeModalVisible] = useState(false);
  const [isEditKeyboardVisible, setIsEditKeyboardVisible] = useState(false);
  const [isAddEntryKeyboardVisible, setIsAddEntryKeyboardVisible] = useState(false);
  const [isCustomKeyboardVisible, setIsCustomKeyboardVisible] = useState(false);
  const editDrinkScrollRef = useRef<ScrollView>(null);
  const editPresetScrollRef = useRef<ScrollView>(null);

  // Анимация модалок - движение за пальцем
  const addModalTranslateY = useSharedValue(0);
  const addEntryModalTranslateY = useSharedValue(0);
  const customModalTranslateY = useSharedValue(0);
  const editModalTranslateY = useSharedValue(0);
  const editPresetModalTranslateY = useSharedValue(0);
  const datePickerModalTranslateY = useSharedValue(0);
  const EDIT_MODAL_SCROLL_Y_PRICE = Platform.OS === 'android' ? 320 : 240;
  const EDIT_PRESET_MODAL_SCROLL_Y_PRICE = Platform.OS === 'android' ? 420 : 320;

  useEffect(() => {
    (async () => {
      const presets = await getUserPresets();
      setUserPresets(presets);
      const cat = await getDrinkCatalog();
      setCatalog(cat);
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
    if (addEntryModalVisible) addEntryModalTranslateY.value = 0;
  }, [addEntryModalVisible]);
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
    if (!editModalVisible && !editPresetModalVisible) return;
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setIsEditKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setIsEditKeyboardVisible(false);
      editDrinkScrollRef.current?.scrollTo({ y: 0, animated: true });
      editPresetScrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [editModalVisible, editPresetModalVisible]);

  useEffect(() => {
    if (!addEntryModalVisible) return;
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setIsAddEntryKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setIsAddEntryKeyboardVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [addEntryModalVisible]);

  useEffect(() => {
    if (!customModalVisible) return;
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setIsCustomKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setIsCustomKeyboardVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [customModalVisible]);

  useEffect(() => {
    if (!editModalVisible && !editPresetModalVisible) {
      setIsEditKeyboardVisible(false);
    }
  }, [editModalVisible, editPresetModalVisible]);
  useEffect(() => {
    if (datePickerVisible) datePickerModalTranslateY.value = 0;
  }, [datePickerVisible]);

  // Если закрыли модалку "разовой записи" во время открытой клавиатуры,
  // нужно принудительно скрыть клавиатуру, иначе KeyboardAvoidingView у модалки "Добавить напиток"
  // может остаться в "поднятом" состоянии (появляется пустота снизу).
  useEffect(() => {
    if (oneTimeModalVisible) return;
    Keyboard.dismiss();
    addEntryModalTranslateY.value = 0;
    setIsAddEntryKeyboardVisible(false);
  }, [oneTimeModalVisible]);

  // Подписываемся на события изменения пресетов для синхронизации между экранами
  useEffect(() => {
    const unsubscribe = presetsEventEmitter.subscribe((presets) => {
      setUserPresets(presets);
    });
    return unsubscribe;
  }, []);

  // Подписываемся на события изменения каталога (в т.ч. смена языка сидовых названий)
  useEffect(() => {
    const unsubscribe = drinkCatalogEventEmitter.subscribe((cat) => {
      setCatalog(cat);
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
  const closeAddModal = useCallback(() => {
    setAddModalVisible(false);
    setSearchQuery(''); // Очищаем поисковый запрос при закрытии
  }, []);

  const openAddEntryModal = () => setAddEntryModalVisible(true);
  const closeAddEntryModal = useCallback(() => {
    setAddEntryModalVisible(false);
    setEntrySearchQuery('');
  }, []);

  const addEntryFromPreset = async (preset: PresetDrink) => {
    await handleQuickAdd(preset);
    closeAddEntryModal();
  };
  const openCustomModal = () => {
    setAddModalVisible(false);
    setSearchQuery(''); // Очищаем поисковый запрос при закрытии
    setCustomModalVisible(true);
  };
  const closeCustomModal = useCallback(() => {
    Keyboard.dismiss();
    setIsCustomKeyboardVisible(false);
    setCustomModalVisible(false);
    setEditingCatalogItem(null);
    setNewName('');
    setNewType('beer');
    setNewVolume('500');
    setNewAbv('5');
    setNewPriceVal('');
  }, []);

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

  const openCatalogEditor = (item: PresetDrink) => {
    Alert.alert(item.name, t('today.catalogAction'), [
      {
        text: t('common.edit'),
        onPress: () => {
          setEditingCatalogItem(item);
          setNewName(item.name);
          setNewType(item.beverageType);
          setNewVolume(String(item.volumeMl));
          setNewAbv(String(item.abvPercent));
          setNewPriceVal(item.defaultPrice != null ? String(item.defaultPrice) : '');
          setAddModalVisible(false);
          setCustomModalVisible(true);
        },
      },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const next = await removeCatalogDrink(item.id);
          setCatalog(next);
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const openCatalogEdit = (item: PresetDrink) => {
    setEditingCatalogItem(item);
    setNewName(item.name);
    setNewType(item.beverageType);
    setNewVolume(String(item.volumeMl));
    setNewAbv(String(item.abvPercent));
    setNewPriceVal(item.defaultPrice != null ? String(item.defaultPrice) : '');
    setAddModalVisible(false);
    setCustomModalVisible(true);
  };

  const confirmCatalogDelete = (item: PresetDrink) => {
    Alert.alert(t('today.deleteDrinkTitle'), item.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const next = await removeCatalogDrink(item.id);
          setCatalog(next);
        },
      },
    ]);
  };

  // Фильтруем каталог напитков - исключаем те, что уже в избранном (для модалки "добавить в избранное")
  const [searchQuery, setSearchQuery] = useState('');
  const availableCatalogItems = useMemo(() => {
    const filtered = catalog.filter((candidate) => {
      return !userPresets.some(
        (userPreset) =>
          userPreset.volumeMl === candidate.volumeMl &&
          userPreset.abvPercent === candidate.abvPercent &&
          userPreset.beverageType === candidate.beverageType &&
          userPreset.name === candidate.name
      );
    });

    // Фильтрация по поисковому запросу
    let result = filtered;
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = filtered.filter((preset) => preset.name.toLowerCase().includes(query));
    }
    
    return result;
  }, [catalog, userPresets, searchQuery]);

  // Поиск для модалки добавления записи (как в календаре на конкретный день)
  const [entrySearchQuery, setEntrySearchQuery] = useState('');
  const filteredEntryFavorites = useMemo(() => {
    if (!entrySearchQuery.trim()) return userPresets;
    const q = entrySearchQuery.toLowerCase().trim();
    return userPresets.filter((p) => p.name.toLowerCase().includes(q));
  }, [userPresets, entrySearchQuery]);

  const entryCatalogItems = useMemo(() => {
    let list = catalog;
    if (entrySearchQuery.trim()) {
      const q = entrySearchQuery.toLowerCase().trim();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [catalog, entrySearchQuery]);


  const saveCustomPreset = async () => {
    const normalizedVolume = newVolume.replace(',', '.');
    const normalizedAbv = newAbv.replace(',', '.');
    const volume = parseFloat(normalizedVolume);
    const abv = parseFloat(normalizedAbv);
    if (!newName || isNaN(volume) || isNaN(abv)) {
      Alert.alert(t('common.error'), t('today.fillRequired'));
      return;
    }
    const priceNum = newPriceVal.trim() ? parseFloat(newPriceVal.replace(',', '.')) : undefined;
    const defaultPrice = isPremium && priceNum != null && !isNaN(priceNum) && priceNum >= 0 ? Math.round(priceNum * 100) / 100 : undefined;
    const payload = {
      name: newName,
      beverageType: newType,
      volumeMl: volume,
      abvPercent: abv,
      ...(defaultPrice != null && { defaultPrice }),
    };
    const updatedCatalog = editingCatalogItem
      ? await updateCatalogDrink(editingCatalogItem.id, payload)
      : await addDrinkToCatalog(payload);
    setCatalog(updatedCatalog);
    closeCustomModal();
    setAddModalVisible(true);
  };

  const [todayList, setTodayList] = useState<Drink[]>([]);
  const todayListRef = useRef<FlatList<Drink>>(null);
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

  const saveOneTimeEntry = useCallback(async (data: OneTimeEntryData) => {
    const units = calculateStandardUnits(data.volumeMl, data.abvPercent);
    const entry: Drink = {
      id: `drink_${Date.now()}`,
      dateISO: formatISO(selectedDateForAdd),
      name: data.name,
      beverageType: data.beverageType,
      volumeMl: data.volumeMl,
      abvPercent: data.abvPercent,
      standardUnits: units,
      quantity: 1,
      ...(data.price != null && { price: data.price }),
    };
    await addOrMergeDrink(entry);
    await reloadToday();
  }, [selectedDateForAdd, reloadToday]);

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

  const closeEditModal = useCallback(() => {
    setEditModalVisible(false);
    setEditingDrink(null);
    setNewQuantity('1');
    setEditPriceVal('');
  }, []);

  const saveEditedDrink = async () => {
    if (!editingDrink) return;
    
    const quantity = Math.max(1, Math.floor(Number(newQuantity.replace(',', '.')) || 1));
    
    if (isNaN(quantity) || quantity < 1) {
      Alert.alert(t('common.error'), t('today.invalidQuantity'));
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

  const closeEditPresetModal = useCallback(() => {
    setEditPresetModalVisible(false);
    setEditingPreset(null);
    setPresetName('');
    setPresetType('beer');
    setPresetVolume('500');
    setPresetAbv('5');
    setPresetPrice('');
  }, []);

  const saveEditedPreset = async () => {
    if (!editingPreset) return;
    
    const normalizedVolume = presetVolume.replace(',', '.');
    const normalizedAbv = presetAbv.replace(',', '.');
    const volume = parseFloat(normalizedVolume);
    const abv = parseFloat(normalizedAbv);
    
    if (!presetName || isNaN(volume) || isNaN(abv)) {
      Alert.alert(t('common.error'), t('today.fillRequired'));
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
  const [favoritesCardSize, setFavoritesCardSize] = useState<number>(56);

  const handleSearchChange = (text: string) => {
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
  const addEntryModalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, addEntryModalTranslateY.value) }],
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

  const closeDatePickerModal = useCallback(() => {
    setDatePickerVisible(false);
  }, []);

  const addModalHandleGesture = useModalDragHandleGesture(addModalTranslateY, closeAddModal);
  const addEntryModalHandleGesture = useModalDragHandleGesture(addEntryModalTranslateY, closeAddEntryModal);
  const customModalHandleGesture = useModalDragHandleGesture(customModalTranslateY, closeCustomModal);
  const editModalHandleGesture = useModalDragHandleGesture(editModalTranslateY, closeEditModal);
  const editPresetModalHandleGesture = useModalDragHandleGesture(editPresetModalTranslateY, closeEditPresetModal);
  const datePickerHandleGesture = useModalDragHandleGesture(datePickerModalTranslateY, closeDatePickerModal);

  const navigation = useNavigation();
  const { interactiveStep, registerTarget } = useOnboarding();
  const screenRootRef = useRef<View>(null);
  const favoritesRef = useRef<View>(null);
  const addButtonRef = useRef<View>(null);
  const firstPresetRef = useRef<View>(null);
  const oneTimeEntryContainerRef = useRef<View>(null);
  const oneTimeEntryRef = useRef<any>(null);
  const modalHeaderPlusRef = useRef<View>(null);

  // Регистрация координат: шаг 0 — приветствие (без цели), шаги 1–3: избранное, редактирование, кнопка «плюс».
  useEffect(() => {
    if (interactiveStep === null || interactiveStep < 1 || interactiveStep > 3) return;
    const key = ['favorites', 'favoritesEdit', 'addButton'][interactiveStep - 1];
    const refs = [favoritesRef, firstPresetRef, addButtonRef] as const;
    const r = refs[interactiveStep - 1];
    const delay = interactiveStep === 1 ? 80 : 16;
    const t = setTimeout(() => {
      screenRootRef.current?.measureInWindow((x0, y0) => {
        r.current?.measureInWindow((x1, y1, w, h) => {
          const relY = y1 - y0;
          const relX = x1 - x0;
          // Для блока «Избранное» добавляем по высоте, чтобы рамка не обрезала низ (карточки + кнопка)
          const extraH = key === 'favorites' ? 8 : 0;
          registerTarget(key, { x: relX, y: relY, width: w, height: h + extraH });
        });
      });
    }, delay);
    return () => clearTimeout(t);
  }, [interactiveStep, registerTarget]);

  // Перемерка блока «Избранное» при появлении пресетов (шаг 1), чтобы рамка не обрезала контент
  useEffect(() => {
    if (interactiveStep !== 1 || !userPresets.length) return;
    const t = setTimeout(() => {
      screenRootRef.current?.measureInWindow((x0, y0) => {
        favoritesRef.current?.measureInWindow((x1, y1, w, h) => {
          registerTarget('favorites', { x: x1 - x0, y: y1 - y0, width: w, height: h + 8 });
        });
      });
    }, 16);
    return () => clearTimeout(t);
  }, [interactiveStep, userPresets.length, registerTarget]);

  // Шаг 4: подсветка кнопки разовой записи в единой системе координат относительно screenRootRef.
  const registerOneTimeEntryTarget = useCallback(() => {
    screenRootRef.current?.measureInWindow((rx, ry) => {
      oneTimeEntryContainerRef.current?.measureInWindow((x, y, w, h) => {
        const relX = x - rx;
        const relY = y - ry;
        registerTarget('oneTimeEntry', { x: relX, y: relY, width: w, height: h });
      });
    });
  }, [registerTarget]);
  useEffect(() => {
    if (interactiveStep !== 4) return;
    todayListRef.current?.scrollToOffset({ offset: 0, animated: true });
    const t = setTimeout(registerOneTimeEntryTarget, 16);
    return () => clearTimeout(t);
  }, [interactiveStep, registerOneTimeEntryTarget]);

  // Демо-пресеты для онбординга: Пиво 500мл, Вино, Коньяк, Виски кола (только при пустом избранном)
  const demoPresetsAddedRef = useRef(false);
  useEffect(() => {
    if (interactiveStep !== 1 || userPresets.length > 0 || demoPresetsAddedRef.current) return;
    demoPresetsAddedRef.current = true;
    const demo = [
      { name: t('drinkTypes.beer') + ' 500ml', beverageType: 'beer' as const, volumeMl: 500, abvPercent: 5 },
      { name: t('drinkTypes.wine'), beverageType: 'wine' as const, volumeMl: 150, abvPercent: 12 },
      { name: t('drinkTypes.spirit'), beverageType: 'spirit' as const, volumeMl: 50, abvPercent: 40 },
      { name: t('drinkTypes.cocktail') + ' cola', beverageType: 'cocktail' as const, volumeMl: 250, abvPercent: 16 },
    ];
    (async () => {
      for (const p of demo) {
        await addPreset(p);
      }
      const updated = await getUserPresets();
      setUserPresets(updated);
    })();
  }, [interactiveStep, userPresets.length]);

  // Шаг 2 (третий слайд): показать иконки редактирования на первом пресете (Пиво)
  useEffect(() => {
    if (interactiveStep === 2 && userPresets.length > 0) {
      setEditingPresetId(userPresets[0].id);
    } else if (interactiveStep !== 2) {
      setEditingPresetId(null);
    }
  }, [interactiveStep, userPresets]);

  // Шаг 4+ (разовая запись, календарь и далее): закрыть модалки добавления в избранное
  useEffect(() => {
    if (interactiveStep >= 4) {
      const t = setTimeout(() => {
        setAddModalVisible(false);
        setCustomModalVisible(false);
      }, 50);
      return () => clearTimeout(t);
    }
  }, [interactiveStep]);
  return (
    <View ref={screenRootRef} style={{ flex: 1 }}>
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View ref={favoritesRef} collapsable={false}>
      <TouchableOpacity
        style={styles.collapsibleHeader}
        onPress={() => setPresetsCollapsed(!presetsCollapsed)}
        activeOpacity={0.7}
      >
        <Text style={[styles.title, { color: colors.text }]}>{t('todayScreen.favorites')}</Text>
        <Ionicons 
          name={presetsCollapsed ? "chevron-down" : "chevron-up"} 
          size={20} 
          color={colors.textSecondary} 
        />
      </TouchableOpacity>
      {(!presetsCollapsed || (interactiveStep !== null && interactiveStep <= 3)) && (() => {
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
            {userPresets.map((p, idx) => {
              const beverageColor = getBeverageColor(p.beverageType, colors);
              const isEditing = editingPresetId === p.id;
              const isFirst = idx === 0;
              return (
                <View key={p.id} style={{ position: 'relative' }}>
                  <TouchableOpacity
                    ref={isFirst ? firstPresetRef : undefined}
                    collapsable={false}
                    onLayout={
                      isFirst
                        ? (e) => {
                            const h = Math.round(e.nativeEvent.layout.height);
                            if (h > 0 && h !== favoritesCardSize) {
                              setFavoritesCardSize(h);
                            }
                          }
                        : undefined
                    }
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
                    <Text
                      style={[
                        styles.presetText,
                        { color: beverageColor.text, opacity: isEditing ? 0.3 : 1 },
                      ]}
                      numberOfLines={2}
                    >
                      {p.name}
                    </Text>
                    <Text
                      style={[styles.presetDetails, { color: beverageColor.text, opacity: isEditing ? 0.3 : 0.7 }]}
                      numberOfLines={1}
                    >
                      {formatTotalVolume(p.volumeMl, 1, volumeUnits)} · {p.abvPercent}%
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
                            style={[styles.editActionButtonNoBg, { marginLeft: 6 }]}
                            onPress={() => onRemovePreset(p.id)}
                          >
                            <Entypo
                              name="circle-with-cross"
                              size={18}
                              color={colors.error}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
            <TouchableOpacity
              ref={addButtonRef}
              collapsable={false}
              style={[
                styles.addFavButtonRect,
                {
                  backgroundColor: blendAddDrinkOuterChrome ? 'transparent' : colors.backgroundSecondary,
                  borderColor: colors.primary,
                  borderWidth: 2,
                  borderStyle: 'dashed',
                  shadowColor: blendAddDrinkOuterChrome ? 'transparent' : colors.primary,
                  shadowOpacity: blendAddDrinkOuterChrome ? 0 : undefined,
                  shadowRadius: blendAddDrinkOuterChrome ? 0 : undefined,
                  elevation: blendAddDrinkOuterChrome ? 0 : undefined,
                  width: favoritesCardSize,
                  height: favoritesCardSize,
                },
              ]}
              onPress={() => {
                setDeletingPresetId(null);
                setEditingPresetId(null);
                openAddModal();
              }}
              accessibilityLabel={t('today.addDrinkA11y')}
            >
              <Entypo name="circle-with-plus" size={22} color={colors.primary} />
            </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </View>
        );
      })()}
      </View>

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
                {selectedDateForAdd.toLocaleDateString(localeTag, { day: 'numeric', month: 'long', year: 'numeric' })}
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
          <Text style={[styles.statsBarLabel, { color: colors.textSecondary }]}>{t('todayScreen.volume')}</Text>
          <Text style={[styles.statsBarValue, { color: colors.text }]}>
            {formatTotalVolume(totalVolumeMl, 1, volumeUnits)}
          </Text>
        </View>
        <View style={[styles.statsBarDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statsBarItem}>
          <Text style={[styles.statsBarLabel, { color: colors.textSecondary }]}>{t('todayScreen.units')}</Text>
          <Text style={[styles.statsBarValue, { color: colors.text }]}>{totalUnits.toFixed(2)}</Text>
        </View>
        <View style={[styles.statsBarDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statsBarItem}>
          <Text style={[styles.statsBarLabel, { color: colors.textSecondary }]}>{t('todayScreen.alcohol')}</Text>
          <Text style={[styles.statsBarValue, { color: colors.text }]}>
            {Math.round(totalAlcoholGrams)} {t('common.gShort')}
          </Text>
        </View>
        {isPremium && totalPrice > 0 && (
          <>
            <View style={[styles.statsBarDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statsBarItem}>
              <Text style={[styles.statsBarLabel, { color: colors.textSecondary }]}>{t('stats.sum')}</Text>
              <Text style={[styles.statsBarValue, { color: colors.text }]}>{formatPrice(totalPrice, currency)}</Text>
            </View>
          </>
        )}
      </View>
      <View
        ref={oneTimeEntryContainerRef}
        collapsable={false}
        style={styles.addOneTimeStripContainer}
        onLayout={interactiveStep === 4 ? registerOneTimeEntryTarget : undefined}
      >
        <TouchableOpacity
          ref={oneTimeEntryRef}
          collapsable={false}
          style={[
            styles.addOneTimeStripIcon,
            blendAddDrinkOuterChrome
              ? {
                  backgroundColor: 'transparent',
                  borderColor: colors.primary,
                  borderWidth: 2,
                  borderStyle: 'dashed',
                  shadowOpacity: 0,
                  shadowRadius: 0,
                  elevation: 0,
                }
              : {
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.primary,
                  shadowColor: colors.primary,
                },
          ]}
          onPress={() => {
            // Как в календаре на конкретный день: "+" добавляет запись из списка напитков,
            // а разовую запись добавляем отдельной кнопкой внутри модалки.
            setDeletingPresetId(null);
            setEditingPresetId(null);
            openAddEntryModal();
          }}
          activeOpacity={0.7}
        >
          <Entypo name="circle-with-plus" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1 }}>
      <FlatList
        ref={todayListRef}
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
              volumeUnits={volumeUnits}
              unitsShort={t('common.unitsShort')}
            />
          );
        }}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary, textAlign: 'center', paddingVertical: 20 }}>{t('todayScreen.noEntries')}</Text>}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
      </View>

      {/* Модалка выбора напитка для добавления */}
      <Modal visible={addModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
          style={styles.kav}
        >
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={closeAddModal}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.modalCard,
                  { backgroundColor: colors.backgroundCard },
                  searchQuery && searchQuery.trim() && [styles.modalCardFullScreen, { paddingTop: 4 + insets.top }],
                  addModalAnimatedStyle,
                ]}
              >
                    <GestureDetector gesture={addModalHandleGesture}>
                      <View style={styles.modalDragHandle}>
                        <View style={[styles.modalDragBar, { backgroundColor: colors.textTertiary }]} />
                      </View>
                    </GestureDetector>
                    <View style={searchQuery && searchQuery.trim() ? { flex: 1 } : {}}>
                    <View style={styles.modalHeaderRow}>
                      <Text style={[styles.modalTitle, { color: colors.text }]}>{t('todayScreen.addDrink')}</Text>
                      <View ref={modalHeaderPlusRef} collapsable={false}>
                        <TouchableOpacity
                          style={[
                            styles.modalHeaderPlusBtn,
                            {
                              backgroundColor: blendAddDrinkOuterChrome ? 'transparent' : colors.backgroundSecondary,
                              borderWidth: 0,
                            },
                          ]}
                          onPress={openCustomModal}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                          <Entypo name="add-to-list" size={22} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={{ marginBottom: 12, color: colors.textSecondary }}>{t('todayScreen.pickOrCreate')}</Text>
                  
                    {/* Строка поиска: не прячем при пустом результате (иначе скрывается клавиатура) */}
                    {catalog.length > 0 && (
                      <TextInput
                        placeholder={t('today.searchDrinks')}
                        placeholderTextColor={colors.textTertiary}
                        value={searchQuery}
                        onChangeText={handleSearchChange}
                        style={[styles.searchInput, { backgroundColor: colors.backgroundInput, borderColor: colors.border, color: colors.text }]}
                        returnKeyType="search"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    )}
                  
                    <ScrollView
                      style={searchQuery && searchQuery.trim() ? {} : { maxHeight: 300 }} 
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={{ paddingBottom: 20 + insets.bottom }}
                    >
                      {availableCatalogItems.map((preset) => (
                        <View key={preset.id} style={[styles.suggestedItem, { position: 'relative', backgroundColor: colors.backgroundCard, borderBottomColor: colors.border }]}>
                          <TouchableOpacity
                            onPress={() => addSuggestedPreset(preset)}
                            activeOpacity={0.7}
                            style={{ paddingRight: 72 }}
                          >
                            <Text style={[styles.suggestedText, { color: colors.text }]}>{preset.name}</Text>
                          </TouchableOpacity>

                          <View style={{ position: 'absolute', right: 8, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity
                              onPress={() => openCatalogEdit(preset)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              style={{ paddingHorizontal: 8, paddingVertical: 6 }}
                            >
                              <Entypo name="pencil" size={26} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => confirmCatalogDelete(preset)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              style={{ paddingHorizontal: 8, paddingVertical: 6, marginLeft: 6 }}
                            >
                              <MaterialIcons name="delete-sweep" size={28} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </ScrollView>

                    </View>
              </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Модалка добавления напитка (как в календаре по кнопке "+ Добавить напиток") */}
      <Modal
        visible={addEntryModalVisible && !customModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeAddEntryModal}
      >
        <View style={styles.modalBackdrop}>
          <TouchableWithoutFeedback onPress={closeAddEntryModal}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : (isAddEntryKeyboardVisible ? 'padding' : undefined)}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
              style={[
                styles.kav,
                entrySearchQuery && entrySearchQuery.trim() && { justifyContent: 'flex-start' },
              ]}
            >
            <Animated.View
              style={[
                styles.modalCard,
                { backgroundColor: colors.backgroundCard },
                entrySearchQuery && entrySearchQuery.trim() && [
                  styles.modalCardFullScreen,
                  { paddingTop: 4 + insets.top },
                ],
                addEntryModalAnimatedStyle,
              ]}
            >
                  <GestureDetector gesture={addEntryModalHandleGesture}>
                    <View style={styles.modalDragHandle}>
                      <View style={[styles.modalDragBar, { backgroundColor: colors.textTertiary }]} />
                    </View>
                  </GestureDetector>

                  <View style={entrySearchQuery && entrySearchQuery.trim() ? { flex: 1 } : {}}>
                    <View style={styles.modalHeaderRow}>
                      <Text style={[styles.modalTitle, { color: colors.text }]}>{t('todayScreen.addDrink')}</Text>
                      <View ref={modalHeaderPlusRef} collapsable={false}>
                        <TouchableOpacity
                          style={[
                            styles.modalHeaderPlusBtn,
                            {
                              backgroundColor: blendAddDrinkOuterChrome ? 'transparent' : colors.backgroundSecondary,
                              borderWidth: 0,
                            },
                          ]}
                          onPress={() => {
                            Keyboard.dismiss();
                            closeAddEntryModal();
                            openCustomModal();
                          }}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                          <Entypo name="circle-with-plus" size={22} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={{ marginBottom: 8, color: colors.textSecondary }}>
                      {t('todayScreen.pickOrCreate')}
                    </Text>

                    <TouchableOpacity
                      style={[
                        styles.addOneTimeButton,
                        blendAddDrinkOuterChrome
                          ? {
                              backgroundColor: 'transparent',
                              borderColor: colors.primary,
                              borderWidth: 1,
                              borderStyle: 'dashed',
                            }
                          : { backgroundColor: colors.backgroundSecondary, borderColor: colors.primary },
                      ]}
                      onPress={() => {
                        Keyboard.dismiss();
                        setOneTimeModalVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Entypo name="plus" size={18} color={colors.primary} />
                      <Text style={[styles.addOneTimeButtonText, { color: colors.primary }]}>{t('todayScreen.addOneTime')}</Text>
                    </TouchableOpacity>

                    <TextInput
                      placeholder={t('today.searchDrinks')}
                      placeholderTextColor={colors.textTertiary}
                      value={entrySearchQuery}
                      onChangeText={setEntrySearchQuery}
                      style={[
                        styles.searchInput,
                        { backgroundColor: colors.backgroundInput, borderColor: colors.border, color: colors.text },
                      ]}
                      returnKeyType="search"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />

                    <ScrollView
                      style={entrySearchQuery && entrySearchQuery.trim() ? { flex: 1 } : { maxHeight: 300 }}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={{ paddingBottom: 10 + insets.bottom }}
                    >
                      {filteredEntryFavorites.length > 0 && (
                        <>
                          <Text style={{ marginBottom: 8, color: colors.textSecondary, fontWeight: '600' }}>{t('todayScreen.favorites')}</Text>
                          {filteredEntryFavorites.map((preset) => (
                            <TouchableOpacity
                              key={preset.id}
                              style={[
                                styles.presetItem,
                                { backgroundColor: colors.backgroundCard, borderBottomColor: colors.border },
                              ]}
                              onPressIn={() => {
                                Keyboard.dismiss();
                              }}
                              onPress={() => addEntryFromPreset(preset)}
                              activeOpacity={0.7}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={[styles.presetText, { color: colors.text }]}>{preset.name}</Text>
                                  <Text style={[styles.presetDetails, { color: colors.textSecondary }]}>
                                    {preset.volumeMl} {t('common.mlShort')} · {preset.abvPercent}%
                                  </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </>
                      )}

                      {entryCatalogItems.length > 0 && (
                        <>
                          <Text style={{ marginTop: 16, marginBottom: 8, color: colors.textSecondary, fontWeight: '600' }}>{t('todayScreen.catalog')}</Text>
                          {entryCatalogItems.map((preset) => (
                            <View
                              key={preset.id}
                              style={[
                                styles.suggestedItem,
                                {
                                  backgroundColor: colors.backgroundCard,
                                  borderBottomColor: colors.border,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                },
                              ]}
                            >
                              <TouchableOpacity
                                style={{ flex: 1, paddingRight: 12 }}
                                onPressIn={() => {
                                  Keyboard.dismiss();
                                }}
                                onPress={() => addEntryFromPreset(preset)}
                                activeOpacity={0.7}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <Text style={[styles.suggestedText, { color: colors.text }]}>{preset.name}</Text>
                                  <Text style={[styles.suggestedDetails, { color: colors.textSecondary }]}>
                                    {preset.volumeMl} {t('common.mlShort')} · {preset.abvPercent}%
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </>
                      )}
                    </ScrollView>
                  </View>
            </Animated.View>
            </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Модалка добавления своего напитка */}
      <Modal visible={customModalVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={closeCustomModal}>
          <View style={styles.modalBackdrop}>
            <KeyboardAvoidingView
              behavior={
                Platform.OS === 'ios' ? 'padding' : (isCustomKeyboardVisible ? 'padding' : undefined)
              }
              keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
              style={styles.kav}
            >
              <TouchableWithoutFeedback onPress={() => {}}>
                <Animated.View style={[styles.modalCard, { backgroundColor: colors.backgroundCard }, customModalAnimatedStyle]}>
                  <GestureDetector gesture={customModalHandleGesture}>
                    <View style={styles.modalDragHandle}>
                      <View style={[styles.modalDragBar, { backgroundColor: colors.textTertiary }]} />
                    </View>
                  </GestureDetector>
                  <ScrollView
                    ref={editDrinkScrollRef}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: Platform.OS === 'android' ? 12 : 48 + insets.bottom }}
                  >
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {editingCatalogItem ? t('todayScreen.editDrinkTitle') : t('todayScreen.newDrinkTitle')}
                  </Text>
                  <Text style={{ marginBottom: 12, color: colors.textSecondary, fontSize: 14 }}>
                    {editingCatalogItem ? t('todayScreen.editDrinkSubtitle') : t('todayScreen.autoNameHint')}
                  </Text>
                  <TextInput
                    placeholder={t('today.namePlaceholderExample')}
                    placeholderTextColor={colors.textTertiary}
                    value={newName}
                    onChangeText={setNewName}
                    style={[styles.input, { backgroundColor: colors.backgroundInput, borderColor: colors.border, color: colors.text }]}
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={Keyboard.dismiss}
                  />
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: colors.text }]}>{t('todayScreen.typeLabel')}</Text>
                    <View style={styles.typeRow}>
                      {(['beer','wine','spirit','cocktail','other'] as const).map((bevType) => {
                        const bc = getBeverageColor(bevType, colors);
                        const isSelected = newType === bevType;
                        return (
                          <TouchableOpacity
                            key={bevType}
                            style={[
                              styles.typeChip,
                              { backgroundColor: isSelected ? bc.main : bc.light, borderColor: bc.main },
                            ]}
                            onPress={() => setNewType(bevType)}
                          >
                            <Text style={[styles.typeChipText, { color: isSelected ? '#fff' : bc.text }]}>{getBeverageTypeLabel(bevType, t)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.label, { color: colors.text, marginBottom: 4 }]}>{t('todayScreen.volumeMlLabel')}</Text>
                      <TextInput
                        placeholder={t('today.ml')}
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                        value={newVolume}
                        onChangeText={(text) => {
                          const normalized = text.replace(',', '.');
                          setNewVolume(normalized);
                        }}
                        style={[styles.input, { backgroundColor: colors.backgroundInput, borderColor: colors.border, color: colors.text }]}
                        returnKeyType="done"
                        blurOnSubmit
                        onSubmitEditing={Keyboard.dismiss}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: colors.text, marginBottom: 4 }]}>{t('todayScreen.abvLabel')}</Text>
                      <TextInput
                        placeholder={t('today.percent')}
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                        value={newAbv}
                        onChangeText={(text) => {
                          const normalized = text.replace(',', '.');
                          setNewAbv(normalized);
                        }}
                        style={[styles.input, { backgroundColor: colors.backgroundInput, borderColor: colors.border, color: colors.text }]}
                        returnKeyType="done"
                        blurOnSubmit
                        onSubmitEditing={Keyboard.dismiss}
                      />
                    </View>
                  </View>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.label, { color: colors.text }]}>{t('todayScreen.price')}</Text>
                    {isPremium ? (
                      <TextInput
                        placeholder={t('today.notSpecified')}
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                        value={newPriceVal}
                        onChangeText={(t) => setNewPriceVal(t.replace(',', '.'))}
                        style={[styles.input, { backgroundColor: colors.backgroundInput, borderColor: colors.border, color: colors.text }]}
                      />
                    ) : (
                      <TextInput
                        placeholder={t('today.premiumOnly')}
                        placeholderTextColor={colors.textTertiary}
                        editable={false}
                        value=""
                        style={[styles.input, { backgroundColor: colors.backgroundInput, borderColor: colors.border, color: colors.textTertiary }]}
                      />
                    )}
                  </View>
                  <View style={[styles.modalActions, { paddingBottom: 20 + insets.bottom }]}>
                    <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]} onPress={closeCustomModal}>
                      <Text style={[styles.cancelBtnText, { color: colors.text }]}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]} onPress={saveCustomPreset}>
                      <Text style={styles.saveBtnText}>{t('common.save')}</Text>
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
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 20}
              style={styles.kav}
            >
              <TouchableWithoutFeedback onPress={() => {}}>
                <Animated.View style={[styles.modalCard, { backgroundColor: colors.backgroundCard }, editModalAnimatedStyle]}>
                  <GestureDetector gesture={editModalHandleGesture}>
                    <View style={styles.modalDragHandle}>
                      <View style={[styles.modalDragBar, { backgroundColor: colors.textTertiary }]} />
                    </View>
                  </GestureDetector>
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
                  >
                    <Text style={[styles.modalTitle, { color: colors.text }]}>{t('todayScreen.editQuantity')}</Text>
                    <Text style={{ marginBottom: 12, color: colors.textSecondary, fontSize: 14 }}>
                      {editingDrink?.name} · {formatTotalVolume(editingDrink?.volumeMl || 0, 1, volumeUnits)} · {editingDrink?.abvPercent}%
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
                        placeholder={t('today.quantity')}
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        value={newQuantity}
                        onChangeText={(text) => {
                          const normalized = text.replace(',', '.').replace(/[^0-9]/g, '');
                          setNewQuantity(normalized);
                        }}
                        style={[styles.input, styles.quantityInput, { backgroundColor: colors.backgroundInput, borderColor: colors.border, color: colors.text }]}
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
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{t('todayScreen.price')}</Text>
                        <TextInput
                          value={editPriceVal}
                          onChangeText={setEditPriceVal}
                          keyboardType="decimal-pad"
                          placeholder={t('today.notSpecified')}
                          placeholderTextColor={colors.textTertiary}
                          onFocus={() => editDrinkScrollRef.current?.scrollTo({ y: EDIT_MODAL_SCROLL_Y_PRICE, animated: true })}
                          style={[styles.input, { backgroundColor: colors.backgroundInput, borderColor: colors.border, color: colors.text }]}
                        />
                      </View>
                    )}
                    <View
                      style={[
                        styles.modalActions,
                        {
                          paddingBottom:
                            Platform.OS === 'android'
                              ? (isEditKeyboardVisible ? 0 : 16 + insets.bottom)
                              : 20 + insets.bottom,
                        },
                      ]}
                    >
                      <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]} onPress={closeEditModal}>
                        <Text style={[styles.cancelBtnText, { color: colors.text }]}>{t('common.cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]} onPress={saveEditedDrink}>
                        <Text style={styles.saveBtnText}>{t('common.save')}</Text>
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
              behavior={Platform.OS === 'ios' ? 'padding' : (isEditKeyboardVisible ? 'padding' : undefined)}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
              style={styles.kav}
            >
              <TouchableWithoutFeedback onPress={() => {}}>
                <Animated.View style={[styles.modalCard, { backgroundColor: colors.backgroundCard }, editPresetModalAnimatedStyle]}>
                  <GestureDetector gesture={editPresetModalHandleGesture}>
                    <View style={styles.modalDragHandle}>
                      <View style={[styles.modalDragBar, { backgroundColor: colors.textTertiary }]} />
                    </View>
                  </GestureDetector>
                  <ScrollView
                    ref={editPresetScrollRef}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: Platform.OS === 'android' ? 12 : 48 + insets.bottom }}
                  >
                    <Text style={[styles.modalTitle, { color: colors.text }]}>{t('todayScreen.editDrinkTitle')}</Text>
                    <Text style={{ marginBottom: 12, color: colors.textSecondary, fontSize: 14 }}>
                      {t('todayScreen.editDrinkSubtitle')}
                    </Text>
                    <TextInput
                      placeholder={t('today.name')}
                      placeholderTextColor={colors.textTertiary}
                      value={presetName}
                      onChangeText={setPresetName}
                      style={[styles.input, { backgroundColor: colors.backgroundInput, borderColor: colors.border, color: colors.text }]}
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    <View style={styles.row}>
                      <Text style={[styles.label, { color: colors.text }]}>{t('todayScreen.typeLabel')}</Text>
                      <View style={styles.typeRow}>
                        {(['beer','wine','spirit','cocktail','other'] as const).map((bevType) => (
                          <TouchableOpacity
                            key={bevType}
                            style={[
                              styles.typeChip,
                              { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
                              presetType === bevType && styles.typeChipActive,
                              presetType === bevType && { backgroundColor: colors.primaryDark, borderColor: colors.primary },
                            ]}
                            onPress={() => setPresetType(bevType)}
                          >
                            <Text style={[styles.typeChipText, { color: presetType === bevType ? '#fff' : colors.text }]}>{getBeverageTypeLabel(bevType, t)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.label, { color: colors.text, marginBottom: 4 }]}>{t('todayScreen.volumeMlLabel')}</Text>
                        <TextInput
                          placeholder={t('today.ml')}
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="decimal-pad"
                          value={presetVolume}
                          onChangeText={(text) => {
                            const normalized = text.replace(',', '.');
                            setPresetVolume(normalized);
                          }}
                          style={[styles.input, { backgroundColor: colors.backgroundInput, borderColor: colors.border, color: colors.text }]}
                          returnKeyType="done"
                          blurOnSubmit
                          onSubmitEditing={Keyboard.dismiss}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.label, { color: colors.text, marginBottom: 4 }]}>{t('todayScreen.abvLabel')}</Text>
                        <TextInput
                          placeholder={t('today.percent')}
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="decimal-pad"
                          value={presetAbv}
                          onChangeText={(text) => {
                            const normalized = text.replace(',', '.');
                            setPresetAbv(normalized);
                          }}
                          style={[styles.input, { backgroundColor: colors.backgroundInput, borderColor: colors.border, color: colors.text }]}
                          returnKeyType="done"
                          blurOnSubmit
                          onSubmitEditing={Keyboard.dismiss}
                        />
                      </View>
                    </View>
                    <View style={{ marginBottom: 12 }}>
                      <Text style={[styles.label, { color: colors.text, marginBottom: 4 }]}>{t('todayScreen.price')}</Text>
                      {isPremium ? (
                        <TextInput
                          placeholder={t('today.notSpecified')}
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="decimal-pad"
                          value={presetPrice}
                          onChangeText={(t) => setPresetPrice(t.replace(',', '.'))}
                          onFocus={() => editPresetScrollRef.current?.scrollTo({ y: EDIT_PRESET_MODAL_SCROLL_Y_PRICE, animated: true })}
                          style={[styles.input, { backgroundColor: colors.backgroundInput, borderColor: colors.border, color: colors.text }]}
                        />
                      ) : (
                        <TextInput
                          placeholder={t('today.premiumOnly')}
                          placeholderTextColor={colors.textTertiary}
                          editable={false}
                          value={presetPrice}
                          style={[styles.input, { backgroundColor: colors.backgroundInput, borderColor: colors.border, color: colors.textTertiary }]}
                        />
                      )}
                    </View>
                    <View
                      style={[
                        styles.modalActions,
                        {
                          paddingBottom:
                            Platform.OS === 'android'
                              ? (isEditKeyboardVisible ? 0 : 16 + insets.bottom)
                              : 20 + insets.bottom,
                        },
                      ]}
                    >
                      <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]} onPress={closeEditPresetModal}>
                        <Text style={[styles.cancelBtnText, { color: colors.text }]}>{t('common.cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]} onPress={saveEditedPreset}>
                        <Text style={styles.saveBtnText}>{t('common.save')}</Text>
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
                <GestureDetector gesture={datePickerHandleGesture}>
                  <View style={styles.modalDragHandle}>
                    <View style={[styles.modalDragBar, { backgroundColor: colors.textTertiary }]} />
                  </View>
                </GestureDetector>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{t('todayScreen.chooseDate')}</Text>
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
                    {selectedDateForAdd.toLocaleDateString(localeTag, { month: 'long', year: 'numeric' })}
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
                  <Text style={styles.todayButtonText}>{t('todayScreen.today')}</Text>
                </TouchableOpacity>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <AddOneTimeEntryModal
        visible={oneTimeModalVisible}
        onClose={() => {
          Keyboard.dismiss();
          setOneTimeModalVisible(false);
        }}
        isPremium={isPremium}
        onSave={saveOneTimeEntry}
      />
    </SafeAreaView>
    </View>
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
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: {
    fontSize: 16,
    color: defaultColors.text,
    fontWeight: '600',
    lineHeight: 18,
  },
  presetDetails: {
    fontSize: 12,
    fontWeight: '400',
    color: defaultColors.textSecondary,
    marginTop: 2,
  },
  addFavButtonRect: {
    height: 56,
    width: 56,
    flexShrink: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
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
    paddingTop: 6,
    paddingBottom: 10,
    minHeight: 36,
  },
  modalDragBar: {
    width: 40,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: defaultColors.textTertiary,
    alignSelf: 'center',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalHeaderPlusBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: defaultColors.text,
    flex: 1,
  },
  onboardingFooterInModal: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    ...(Platform.OS === 'android' ? { elevation: 12 } : {}),
  },
  tooltipCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    ...(Platform.OS === 'android' ? { elevation: 8 } : {}),
  },
  tooltipText: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  onboardingNextBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  onboardingNextText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  onboardingSpotlightWrap: {
    borderWidth: 3,
    borderRadius: 14,
    padding: 4,
    ...(Platform.OS === 'android' ? { elevation: 8 } : {}),
  },
  input: {
    borderWidth: 1.5,
    borderColor: defaultColors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: defaultColors.backgroundInput,
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
    backgroundColor: defaultColors.backgroundInput,
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
  presetItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: defaultColors.border,
    backgroundColor: defaultColors.backgroundCard,
  },
  addOneTimeButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: defaultColors.backgroundSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: defaultColors.primary,
    borderStyle: 'dashed',
    gap: 6,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOneTimeButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
    flex: 1,
  },
  suggestedDetails: {
    fontSize: 14,
    fontWeight: '400',
    color: defaultColors.textSecondary,
    marginLeft: 8,
  },
  addCustomButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: defaultColors.backgroundSecondary,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: defaultColors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCustomButtonText: {
    color: defaultColors.primaryLight,
    fontSize: 14,
    fontWeight: '600',
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
  addOneTimeStripIcon: {
    alignSelf: 'stretch',
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 2,
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
      android: { elevation: 0 },
    }),
  },
  addOneTimeStripContainer: {
    marginBottom: 12,
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


