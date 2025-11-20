import React, { useCallback, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Platform, Share, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons, MaterialCommunityIcons, FontAwesome6 } from '@expo/vector-icons';
import { getDailyGoal, setDailyGoal, exportData, clearAllData, getUserWeight, setUserWeight, getUserGender, setUserGender, Gender, getLethalDose, getBirthYear, setBirthYear, calculateAge } from '../storage/settings';
import { colors } from '../theme/colors';

export default function SettingsScreen() {
  const [dailyGoal, setDailyGoalValue] = useState<string>('');
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [weight, setWeightValue] = useState<string>('');
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [gender, setGenderValue] = useState<Gender | null>(null);
  const [birthYear, setBirthYearValue] = useState<string>((new Date().getFullYear() - 18).toString());
  const [age, setAge] = useState<number | null>(null);
  const [lethalDose, setLethalDose] = useState<number>(15);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const yearPickerScrollRef = useRef<ScrollView>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const ITEM_HEIGHT = 50;

  const loadSettings = useCallback(async () => {
    const goal = await getDailyGoal();
    setDailyGoalValue(goal !== null ? goal.toString() : '');
    
    const userWeight = await getUserWeight();
    setWeightValue(userWeight !== null ? userWeight.toString() : '');
    
    const userGender = await getUserGender();
    setGenderValue(userGender);
    
    const userBirthYear = await getBirthYear();
    setBirthYearValue(userBirthYear !== null ? userBirthYear.toString() : '');
    const calculatedAge = calculateAge(userBirthYear);
    setAge(calculatedAge);
    
    const lethal = await getLethalDose();
    setLethalDose(lethal);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const handleSaveGoal = async () => {
    const value = parseFloat(dailyGoal.replace(',', '.'));
    if (isNaN(value) || value < 0) {
      Alert.alert('Ошибка', 'Введите корректное значение');
      return;
    }
    await setDailyGoal(value);
    setIsEditingGoal(false);
    Alert.alert('Сохранено', 'Дневная цель обновлена');
  };

  const handleSaveWeight = async () => {
    const trimmed = weight.trim();
    if (!trimmed) {
      // Если поле пустое, удаляем значение
      await setUserWeight(null);
      const lethal = await getLethalDose();
      setLethalDose(lethal);
      loadSettings();
      return;
    }
    const value = parseFloat(trimmed.replace(',', '.'));
    if (isNaN(value) || value <= 0 || value > 300) {
      Alert.alert('Ошибка', 'Введите корректный вес (1-300 кг)');
      return;
    }
    await setUserWeight(value);
    const lethal = await getLethalDose();
    setLethalDose(lethal);
  };

  const handleSaveGender = async (selectedGender: Gender) => {
    // Toggle логика: если уже выбран этот пол, сбрасываем, иначе выбираем
    const newGender = gender === selectedGender ? null : selectedGender;
    await setUserGender(newGender);
    setGenderValue(newGender);
    const lethal = await getLethalDose();
    setLethalDose(lethal);
  };

  const handleSaveBirthYear = async () => {
    const trimmed = birthYear.trim();
    if (!trimmed) {
      // Если поле пустое, удаляем значение
      await setBirthYear(null);
      setAge(null);
      loadSettings();
      return;
    }
    const value = parseInt(trimmed, 10);
    const currentYear = new Date().getFullYear();
    if (isNaN(value) || value < 1900 || value > currentYear) {
      Alert.alert('Ошибка', `Введите корректный год рождения (1900-${currentYear})`);
      return;
    }
    await setBirthYear(value);
    const calculatedAge = calculateAge(value);
    setAge(calculatedAge);
    const lethal = await getLethalDose();
    setLethalDose(lethal);
  };

  const handleExport = async () => {
    try {
      const data = await exportData();
      const fileName = `drinknote_export_${new Date().toISOString().slice(0, 10)}.json`;
      
      if (Platform.OS === 'web') {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        Alert.alert('Экспорт', 'Файл загружен');
      } else {
        await Share.share({
          message: data,
          title: fileName,
        });
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось экспортировать данные');
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Удалить все данные?',
      'Это действие нельзя отменить. Все записи, пресеты и настройки будут удалены.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            setDailyGoalValue('');
            Alert.alert('Готово', 'Все данные удалены');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Настройки</Text>

        {/* Дневная цель */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Дневная цель</Text>
          <View style={styles.goalContainer}>
            {isEditingGoal ? (
              <View style={styles.goalInputRow}>
                <TextInput
                  style={styles.goalInput}
                  value={dailyGoal}
                  onChangeText={(text) => {
                    const normalized = text.replace(',', '.').replace(/[^0-9.]/g, '');
                    setDailyGoalValue(normalized);
                  }}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveGoal}
                  onBlur={handleSaveGoal}
                  autoFocus
                />
                <Text style={styles.goalUnit}>ед.</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.goalDisplayRow}
                onPress={() => setIsEditingGoal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.goalValue}>
                  {dailyGoal ? `${parseFloat(dailyGoal.replace(',', '.')).toFixed(2)} ед.` : 'Не установлена'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Параметры профиля */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Параметры профиля</Text>
          <Text style={styles.sectionSubtitle}>Для расчета смертельной дозы</Text>
          
          <View style={styles.profileContainer}>
            {/* Вес */}
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Вес:</Text>
              <View style={styles.profileInputRow}>
                <TouchableOpacity
                  style={styles.profileArrowButton}
                  onPress={async () => {
                    const current = weight ? parseFloat(weight.replace(',', '.')) : 50;
                    const newValue = Math.max(1, current - 1);
                    setWeightValue(newValue.toString());
                    await setUserWeight(newValue);
                    const lethal = await getLethalDose();
                    setLethalDose(lethal);
                  }}
                >
                  <MaterialIcons name="chevron-left" size={24} color={colors.primary} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.profileInput, { textAlign: 'right' }]}
                  value={weight}
                  onChangeText={(text) => {
                    const normalized = text.replace(',', '.').replace(/[^0-9.]/g, '');
                    setWeightValue(normalized);
                  }}
                  placeholder="50"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveWeight}
                  onBlur={handleSaveWeight}
                />
                <Text style={styles.profileUnit}>кг</Text>
                <TouchableOpacity
                  style={styles.profileArrowButton}
                  onPress={async () => {
                    const current = weight ? parseFloat(weight.replace(',', '.')) : 50;
                    const newValue = Math.min(300, current + 1);
                    setWeightValue(newValue.toString());
                    await setUserWeight(newValue);
                    const lethal = await getLethalDose();
                    setLethalDose(lethal);
                  }}
                >
                  <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Пол */}
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Пол:</Text>
              <View style={styles.profileInputRow}>
                <TouchableOpacity
                  style={[styles.profileGenderIconButton, gender === 'female' && styles.profileGenderButtonActive]}
                  onPress={() => handleSaveGender('female')}
                >
                  <MaterialCommunityIcons name="gender-female" size={24} color={gender === 'female' ? colors.text : colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.profileGenderIconButton, gender === 'male' && styles.profileGenderButtonActive]}
                  onPress={() => handleSaveGender('male')}
                >
                  <MaterialCommunityIcons name="gender-male" size={24} color={gender === 'male' ? colors.text : colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.profileGenderIconButton, gender === 'genderless' && styles.profileGenderButtonActive]}
                  onPress={() => handleSaveGender('genderless')}
                >
                  <FontAwesome6 name="genderless" size={24} color={gender === 'genderless' ? colors.text : colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Год рождения */}
            <View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Год рождения:</Text>
                <View style={styles.profileInputRow}>
                  <TouchableOpacity
                    style={styles.profileArrowButton}
                    onPress={async () => {
                      const current = birthYear ? parseInt(birthYear, 10) : new Date().getFullYear() - 18;
                      const newValue = Math.max(1900, current - 1);
                      setBirthYearValue(newValue.toString());
                      await setBirthYear(newValue);
                      const calculatedAge = calculateAge(newValue);
                      setAge(calculatedAge);
                      const lethal = await getLethalDose();
                      setLethalDose(lethal);
                    }}
                  >
                    <MaterialIcons name="chevron-left" size={24} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.profileInput, { justifyContent: 'center', alignItems: 'center' }]}
                    onPress={() => setYearPickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 15, color: colors.text }}>
                      {birthYear || (new Date().getFullYear() - 18).toString()}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.profileArrowButton}
                    onPress={async () => {
                      const current = birthYear ? parseInt(birthYear, 10) : new Date().getFullYear() - 18;
                      const currentYear = new Date().getFullYear();
                      const newValue = Math.min(currentYear, current + 1);
                      setBirthYearValue(newValue.toString());
                      await setBirthYear(newValue);
                      const calculatedAge = calculateAge(newValue);
                      setAge(calculatedAge);
                      const lethal = await getLethalDose();
                      setLethalDose(lethal);
                    }}
                  >
                    <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

          </View>
        </View>

        {/* Экспорт данных */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.actionButton} onPress={handleExport}>
            <MaterialIcons name="file-download" size={24} color={colors.primary} />
            <Text style={styles.actionButtonText}>Экспорт данных</Text>
            <MaterialIcons name="chevron-right" size={24} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Удаление данных */}
        <View style={styles.section}>
          <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={handleClearData}>
            <MaterialIcons name="delete-forever" size={24} color={colors.error} />
            <Text style={[styles.actionButtonText, styles.dangerButtonText]}>Удалить все данные</Text>
            <MaterialIcons name="chevron-right" size={24} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Информация о приложении */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>DrinkNote</Text>
            <Text style={styles.infoText}>Версия 1.0.0</Text>
            <Text style={styles.infoText}>Трекер потребления алкоголя</Text>
          </View>
    </View>
      </ScrollView>

      {/* Модальное окно выбора года - iOS style wheel */}
      <Modal
        visible={yearPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setYearPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => setYearPickerVisible(false)}
          />
          <View style={styles.yearPickerModal}>
            <View style={styles.yearPickerHeader}>
              <TouchableOpacity
                onPress={() => setYearPickerVisible(false)}
                style={styles.yearPickerCancelButton}
              >
                <Text style={styles.yearPickerCancelText}>Отмена</Text>
              </TouchableOpacity>
              <Text style={styles.yearPickerTitle}>Год рождения</Text>
              <TouchableOpacity
                onPress={async () => {
                  // Вычисляем выбранный год на основе позиции скролла
                  const selectedIndex = Math.round(scrollOffset / ITEM_HEIGHT);
                  const currentYear = new Date().getFullYear();
                  const selectedYear = currentYear - selectedIndex;
                  if (selectedYear >= 1900 && selectedYear <= currentYear) {
                    setBirthYearValue(selectedYear.toString());
                    await setBirthYear(selectedYear);
                    const calculatedAge = calculateAge(selectedYear);
                    setAge(calculatedAge);
                    const lethal = await getLethalDose();
                    setLethalDose(lethal);
                  }
                  setYearPickerVisible(false);
                }}
                style={styles.yearPickerDoneButton}
              >
                <Text style={styles.yearPickerDoneText}>Готово</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.yearPickerWheelContainer}>
              {/* Верхняя маска */}
              <View style={styles.yearPickerMask} pointerEvents="none" />
              {/* Центральная линия */}
              <View style={styles.yearPickerCenterLine} pointerEvents="none" />
              {/* Нижняя маска */}
              <View style={[styles.yearPickerMask, { bottom: 0, top: 'auto' }]} pointerEvents="none" />
              
              <ScrollView
                ref={yearPickerScrollRef}
                style={styles.yearPickerWheel}
                contentContainerStyle={styles.yearPickerWheelContent}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                onScroll={(e) => {
                  setScrollOffset(e.nativeEvent.contentOffset.y);
                }}
                scrollEventThrottle={16}
                onMomentumScrollEnd={(e) => {
                  // Выравниваем на ближайший элемент
                  const offset = e.nativeEvent.contentOffset.y;
                  const index = Math.round(offset / ITEM_HEIGHT);
                  yearPickerScrollRef.current?.scrollTo({
                    y: index * ITEM_HEIGHT,
                    animated: true,
                  });
                }}
                onLayout={() => {
                  // Прокручиваем к выбранному году при открытии
                  if (birthYear && yearPickerScrollRef.current) {
                    const currentYear = new Date().getFullYear();
                    const selectedYear = parseInt(birthYear, 10);
                    const index = currentYear - selectedYear;
                    setTimeout(() => {
                      yearPickerScrollRef.current?.scrollTo({
                        y: index * ITEM_HEIGHT,
                        animated: false,
                      });
                      setScrollOffset(index * ITEM_HEIGHT);
                    }, 100);
                  }
                }}
              >
                {(() => {
                  const currentYear = new Date().getFullYear();
                  const years = [];
                  for (let year = currentYear; year >= 1900; year--) {
                    years.push(year);
                  }
                  // Добавляем пустые элементы сверху и снизу для центрирования
                  return (
                    <>
                      <View style={{ height: ITEM_HEIGHT * 2 }} />
                      {years.map((year, index) => {
                        return (
                          <View
                            key={year}
                            style={styles.yearPickerWheelItem}
                          >
                            <Text style={styles.yearPickerWheelItemText}>
                              {year}
                            </Text>
                          </View>
                        );
                      })}
                      <View style={{ height: ITEM_HEIGHT * 2 }} />
                    </>
                  );
                })()}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    marginBottom: 24,
    color: colors.text,
    letterSpacing: -0.5,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  goalContainer: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
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
  goalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goalInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  goalUnit: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButton: {
    padding: 4,
  },
  goalDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  editButton: {
    padding: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    gap: 12,
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
  dangerButton: {
    borderWidth: 1,
    borderColor: colors.error,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  dangerButtonText: {
    color: colors.error,
  },
  infoCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  genderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  genderButtonActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primary,
  },
  genderButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  genderButtonTextActive: {
    color: colors.text,
  },
  lethalDoseInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lethalDoseLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  lethalDoseValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.error,
  },
  ageText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  profileContainer: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    gap: 16,
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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  profileLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    minWidth: 120,
  },
  profileValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    gap: 8,
  },
  profileValue: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  profileInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    gap: 4,
  },
  profileArrowButton: {
    padding: 4,
    marginHorizontal: 0,
  },
  profileInput: {
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 60,
  },
  profileUnit: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  profileEditButton: {
    padding: 4,
  },
  profileSaveButton: {
    padding: 4,
  },
  profileCancelButton: {
    padding: 4,
  },
  profileClearButton: {
    padding: 4,
  },
  profileGenderIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileGenderButtonActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primary,
  },
  profileAgeText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
    textAlign: 'right',
  },
  profileLethalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  yearPickerModal: {
    backgroundColor: colors.backgroundCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalOverlayTouchable: {
    flex: 1,
  },
  yearPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  yearPickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  yearPickerCancelButton: {
    padding: 4,
    zIndex: 1,
  },
  yearPickerCancelText: {
    fontSize: 17,
    color: colors.primary,
  },
  yearPickerDoneButton: {
    padding: 4,
    zIndex: 1,
  },
  yearPickerDoneText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary,
  },
  yearPickerWheelContainer: {
    height: 200,
    position: 'relative',
    overflow: 'hidden',
  },
  yearPickerWheel: {
    flex: 1,
  },
  yearPickerWheelContent: {
    paddingVertical: 0,
  },
  yearPickerWheelItem: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearPickerWheelItemText: {
    fontSize: 20,
    color: colors.text,
    fontWeight: '500',
  },
  yearPickerMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 75,
    backgroundColor: colors.backgroundCard,
    zIndex: 1,
    opacity: 0.95,
  },
  yearPickerCenterLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
    zIndex: 2,
    marginTop: -0.5,
  },
});
