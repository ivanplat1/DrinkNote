import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TextInput, TouchableOpacity, Alert, FlatList, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Keyboard, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { MaterialIcons, Ionicons, Entypo } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PresetButton from '../components/PresetButton';
import { suggestedPresets, getUserPresets, addPreset, removePreset, updatePreset } from '../storage/presets';
import { PresetDrink } from '../types/preset';
import { addDrink, addOrMergeDrink, getDrinksByDate, removeDrink, updateDrink } from '../storage/drinks';
import { calculateStandardUnits, todayISO, formatTotalVolume } from '../utils/units';
import { Drink } from '../types/drink';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';

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
function SwipeableListItem({ item, beverageColor, onRemove, onEdit }: { item: Drink; beverageColor: any; onRemove: (id: string) => void; onEdit?: (item: Drink) => void }) {
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
          <TouchableOpacity 
            style={{ flex: 1 }}
            onPress={() => onEdit && onEdit(item)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                {onEdit && (
                  <Ionicons name="pencil" size={18} color={colors.textTertiary} style={{ marginLeft: 8 }} />
                )}
              </View>
              <Text style={styles.itemSub}>
                {formatTotalVolume(item.volumeMl, item.quantity ?? 1)} · {item.abvPercent}% · {item.standardUnits.toFixed(2)} ед.
                {item.quantity && item.quantity > 1 ? ` (x${item.quantity})` : ''}
              </Text>
            </View>
          </TouchableOpacity>
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

  useEffect(() => {
    (async () => {
      const presets = await getUserPresets();
      setUserPresets(presets);
    })();
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
      dateISO: todayISO(),
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
      dateISO: todayISO(),
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
  const closeAddModal = () => setAddModalVisible(false);
  const openCustomModal = () => {
    setAddModalVisible(false);
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
  const availableSuggestedPresets = useMemo(() => {
    return suggestedPresets.filter((suggested) => {
      // Проверяем, нет ли уже такого напитка в избранном (по объему, крепости и типу)
      return !userPresets.some((userPreset) => 
        userPreset.volumeMl === suggested.volumeMl &&
        userPreset.abvPercent === suggested.abvPercent &&
        userPreset.beverageType === suggested.beverageType
      );
    });
  }, [userPresets]);

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

  const reloadToday = useCallback(async () => {
    const list = await getDrinksByDate(todayISO());
    setTodayList(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadToday();
    }, [reloadToday])
  );

  const onRemoveDrink = async (id: string) => {
    await removeDrink(id);
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

  return (
    <View style={styles.container}>
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
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            setDeletingPresetId(null);
            setEditingPresetId(null);
          }}
          style={{ flex: 0 }}
        >
          <ScrollView contentContainerStyle={styles.presetList}>
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
                        <Entypo name="pencil" size={24} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.editActionButtonNoBg}
                        onPress={() => onRemovePreset(p.id)}
                      >
                        <Entypo name="circle-with-cross" size={24} color={colors.error} />
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
          <Entypo name="circle-with-plus" size={20} color={colors.primaryLight} />
        </TouchableOpacity>
        </ScrollView>
      </TouchableOpacity>
      )}

      <TouchableOpacity
        activeOpacity={1}
        onPress={() => deletingPresetId && setDeletingPresetId(null)}
      >
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Сегодняшние записи</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.total}>всего: {formatTotalVolume(totalVolumeMl, 1)}</Text>
            <Text style={styles.total}>всего: {totalUnits.toFixed(2)} ед.</Text>
          </View>
        </View>
      </TouchableOpacity>
      <FlatList
        data={todayList}
        keyExtractor={(item) => item.id}
        scrollEnabled={true}
        renderItem={({ item }) => {
          const beverageColor = getBeverageColor(item.beverageType);
          return (
            <SwipeableListItem
              item={item}
              beverageColor={beverageColor}
              onRemove={onRemoveDrink}
              onEdit={openEditModal}
            />
          );
        }}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary, textAlign: 'center', paddingVertical: 20 }}>Пока нет записей за сегодня</Text>}
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
        <TouchableWithoutFeedback onPress={closeAddModal}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalCard}>
                <GestureDetector gesture={Gesture.Pan()
                  .activeOffsetY([10, 100])
                  .failOffsetX([-50, 50])
                  .onEnd((e) => {
                    // Свайп вниз закрывает модальное окно
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
                <Text style={styles.modalTitle}>Добавить напиток</Text>
                <Text style={{ marginBottom: 12, color: colors.textSecondary }}>Выберите из предложенных или добавьте свой</Text>
              
              <ScrollView style={{ maxHeight: 300 }}>
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

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeAddModal}>
                  <Text style={styles.cancelBtnText}>Отмена</Text>
                </TouchableOpacity>
              </View>
              </View>
            </TouchableWithoutFeedback>
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
                      // Свайп вниз закрывает модальное окно
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
                  <ScrollView keyboardShouldPersistTaps="handled">
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
                  <View style={[styles.modalActions, { paddingBottom: insets.bottom }]}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={closeCustomModal}>
                      <Text style={styles.cancelBtnText}>Отмена</Text>
                    </TouchableOpacity>
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
                <View style={styles.modalCard}>
                  <GestureDetector gesture={Gesture.Pan()
                    .activeOffsetY([10, 100])
                    .failOffsetX([-50, 50])
                    .onEnd((e) => {
                      if (e.translationY > 50) {
                        runOnJS(closeEditModal)();
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
                  <ScrollView keyboardShouldPersistTaps="handled">
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
                    <View style={[styles.modalActions, { paddingBottom: insets.bottom }]}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={closeEditModal}>
                        <Text style={styles.cancelBtnText}>Отмена</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.saveBtn} onPress={saveEditedDrink}>
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
                <View style={styles.modalCard}>
                  <GestureDetector gesture={Gesture.Pan()
                    .activeOffsetY([10, 100])
                    .failOffsetX([-50, 50])
                    .onEnd((e) => {
                      if (e.translationY > 50) {
                        runOnJS(closeEditPresetModal)();
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
                  <ScrollView keyboardShouldPersistTaps="handled">
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
                    <View style={[styles.modalActions, { paddingBottom: insets.bottom }]}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={closeEditPresetModal}>
                        <Text style={styles.cancelBtnText}>Отмена</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.saveBtn} onPress={saveEditedPreset}>
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
    </View>
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
    paddingVertical: 12,
    paddingHorizontal: 16,
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
    fontSize: 14,
    fontWeight: '600',
  },
  addFavButtonRect: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
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
    paddingTop: 8,
    paddingBottom: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalDragHandle: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 0,
    paddingBottom: 12,
    minHeight: 40,
  },
  modalDragBar: {
    width: 60,
    height: 4,
    borderRadius: 2,
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
});


