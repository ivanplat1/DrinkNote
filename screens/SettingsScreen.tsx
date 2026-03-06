import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Platform, Share, Modal, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialIcons, MaterialCommunityIcons, FontAwesome6 } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, withTiming, runOnJS, useAnimatedStyle } from 'react-native-reanimated';
import { getDailyGoal, setDailyGoal, exportData, importData, clearAllData, getUserWeight, setUserWeight, getUserGender, setUserGender, Gender, getLethalDose, getBirthDate, setBirthDate, calculateAgeFromDate, getRecommendedDailyLimit, CurrencyCode } from '../storage/settings';
import { colors as defaultColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { useCurrency } from '../theme/CurrencyContext';
import { ThemeName } from '../theme/themes';
import { CURRENCY_LIST } from '../utils/currency';
import { isPremiumUser, enableDevPremium, disableDevPremium, enablePreviewPremium, disablePreviewPremium } from '../storage/premium';
import { getStreakGoal, setStreakGoal } from '../storage/streakGoal';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { themeName, setTheme, colors } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const [dailyGoal, setDailyGoalValue] = useState<string>('');
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [recommendedLimit, setRecommendedLimit] = useState<number>(2.0);
  const [weight, setWeightValue] = useState<string>('');
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [gender, setGenderValue] = useState<Gender | null>(null);
  const [birthDate, setBirthDateValue] = useState<string>('');
  const [age, setAge] = useState<number | null>(null);
  const [lethalDose, setLethalDose] = useState<number>(15);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [tempBirthDate, setTempBirthDate] = useState<Date>(new Date(new Date().getFullYear() - 18, 0, 1));
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [importText, setImportText] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [streakGoal, setStreakGoalValue] = useState<number | null>(null);
  const [showStreakGoalModal, setShowStreakGoalModal] = useState(false);
  const [customStreakGoalInput, setCustomStreakGoalInput] = useState('');
  const importModalTranslateY = useSharedValue(0);

  const confirmStreakGoalChange = useCallback(
    (newGoal: number | null) => {
      if (newGoal === null) {
        Alert.alert(
          'Сбросить цель?',
          `Текущая цель: ${streakGoal} дней. Сбросить?`,
          [
            { text: 'Нет', style: 'cancel' },
            {
              text: 'Сбросить',
              style: 'destructive',
              onPress: async () => {
                await setStreakGoal(null);
                await loadStreakGoal();
              },
            },
          ]
        );
        return;
      }
      if (streakGoal != null) {
        Alert.alert(
          'Заменить цель?',
          `Текущая цель: ${streakGoal} дней. Заменить на ${newGoal} дней?`,
          [
            { text: 'Нет', style: 'cancel' },
            {
              text: 'Заменить',
              onPress: async () => {
                await setStreakGoal(newGoal);
                await loadStreakGoal();
              },
            },
          ]
        );
        return;
      }
      setStreakGoal(newGoal).then(loadStreakGoal);
    },
    [streakGoal, loadStreakGoal]
  );

  const updateRecommendation = useCallback(async () => {
    const recommended = await getRecommendedDailyLimit();
    setRecommendedLimit(recommended);
  }, []);

  const loadSettings = useCallback(async () => {
    const goal = await getDailyGoal();
    setDailyGoalValue(goal !== null ? goal.toString() : '');
    
    const userWeight = await getUserWeight();
    setWeightValue(userWeight !== null ? userWeight.toString() : '');
    
    const userGender = await getUserGender();
    setGenderValue(userGender);
    
    const userBirthDate = await getBirthDate();
    setBirthDateValue(userBirthDate || '');
    const calculatedAge = calculateAgeFromDate(userBirthDate);
    setAge(calculatedAge);
    
    const lethal = await getLethalDose();
    setLethalDose(lethal);
    
    // Загружаем рекомендацию
    await updateRecommendation();
  }, [updateRecommendation]);

  const loadStreakGoal = useCallback(async () => {
    const goal = await getStreakGoal();
    setStreakGoalValue(goal);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
      checkPremiumStatus();
      loadStreakGoal();
    }, [loadSettings, loadStreakGoal])
  );

  const checkPremiumStatus = async () => {
    const premium = await isPremiumUser();
    setIsPremium(premium);
  };

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
      await updateRecommendation();
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
    await updateRecommendation();
  };

  const handleSaveGender = async (selectedGender: Gender) => {
    // Toggle логика: если уже выбран этот пол, сбрасываем, иначе выбираем
    const newGender = gender === selectedGender ? null : selectedGender;
    await setUserGender(newGender);
    setGenderValue(newGender);
    const lethal = await getLethalDose();
    setLethalDose(lethal);
    await updateRecommendation();
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

  const handleImport = async (merge: boolean) => {
    if (!importText.trim()) {
      Alert.alert('Ошибка', 'Вставьте данные для импорта');
      return;
    }

    try {
      const result = await importData(importText, merge);
      
      if (result.success) {
        Alert.alert(
          'Импорт завершен',
          `Успешно импортировано ${result.drinksCount} записей о напитках`,
          [
            {
              text: 'OK',
              onPress: () => {
                setShowImportModal(false);
                setImportText('');
                loadSettings();
              },
            },
          ]
        );
      } else {
        Alert.alert('Ошибка импорта', result.error || 'Не удалось импортировать данные');
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось импортировать данные');
    }
  };

  const handlePickFile = async () => {
    try {
      if (Platform.OS === 'web') {
        // Для веба используем скрытый input file
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.txt,application/json,text/plain';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const text = await file.text();
            setImportText(text);
          }
        };
        input.click();
      } else {
        // Для мобильных используем expo-document-picker
        const result = await DocumentPicker.getDocumentAsync({
          // Google Drive и некоторые файловые менеджеры часто отдают JSON как text/plain/.txt.
          type: ['application/json', 'text/plain', 'application/octet-stream'],
          copyToCacheDirectory: true,
        });
        
        if (!result.canceled && result.assets && result.assets[0]) {
          const fileUri = result.assets[0].uri;
          try {
            const response = await fetch(fileUri);
            const text = await response.text();
            setImportText(text);
          } catch (fetchError) {
            // Если fetch не работает, попробуем прочитать через FileReader
            Alert.alert('Ошибка', 'Не удалось прочитать файл. Попробуйте вставить данные вручную.');
          }
        }
      }
    } catch (error: any) {
      if (DocumentPicker.isCancel(error)) {
        // Пользователь отменил выбор файла
        return;
      }
      Alert.alert('Ошибка', 'Не удалось выбрать файл');
    }
  };

  const closeImportModal = useCallback(() => {
    setShowImportModal(false);
    setImportText('');
    importModalTranslateY.value = 0;
  }, []);

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <Animated.ScrollView keyboardShouldPersistTaps="handled" style={[styles.scrollView, { backgroundColor: colors.background }]} contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }, { paddingBottom: 280 }]} removeClippedSubviews={Platform.OS === 'android'} directionalLockEnabled scrollEventThrottle={32} >
        {/* Дневная цель */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Дневная цель</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Безопасного уровня потребления алкоголя не существует (ВОЗ). Чем меньше, тем лучше.</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, marginTop: 4 }]}>Условная единица (ед.) = 10 г чистого этанола.</Text>
          <View style={[styles.goalContainer, { backgroundColor: colors.backgroundCard }]}>
            {/* Левая часть - Своё значение */}
            <View style={styles.goalColumn}>
              <Text style={[styles.goalColumnLabel, { color: colors.textSecondary }]}>Своё значение</Text>
              {isEditingGoal ? (
                <View style={styles.goalInputRow}>
                  <TextInput
                    style={[styles.goalInput, { color: colors.text, backgroundColor: colors.backgroundSecondary }]}
                    value={dailyGoal}
                    onChangeText={(text) => {
                      const normalized = text.replace(',', '.').replace(/[^0-9.]/g, '');
                      setDailyGoalValue(normalized);
                    }}
                    placeholder={`${recommendedLimit.toFixed(1)} ед.`}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleSaveGoal}
                    onBlur={handleSaveGoal}
                    autoFocus
                  />
                  <Text style={[styles.goalUnit, { color: colors.textSecondary }]}>ед.</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.goalDisplayRow}
                  onPress={() => setIsEditingGoal(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.goalValue, { color: dailyGoal ? colors.text : colors.textTertiary }]}>
                    {dailyGoal ? `${parseFloat(dailyGoal.replace(',', '.')).toFixed(1)} ед.` : `${recommendedLimit.toFixed(1)} ед.`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* Разделитель */}
            <View style={[styles.goalDivider, { backgroundColor: colors.border }]} />
            
            {/* Правая часть - Условная норма */}
            <View style={styles.goalColumn}>
              <Text style={[styles.goalColumnLabel, { color: colors.textSecondary }]}>Условная норма</Text>
              <View style={[styles.goalDisplayRow, { flexDirection: 'row', alignItems: 'center', gap: 2 }]}>
                <Text style={[styles.goalValue, styles.goalRecommended, { color: colors.primary }]}>
                  {recommendedLimit.toFixed(1)} ед.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      '',
                      '📐 Условная единица (ед.) = 10 г чистого этанола.\n\n' +
                      '📊 Базовая норма:\n' +
                      '• Мужчины: 2.5 ед. (25г спирта)\n' +
                      '• Женщины: 1.5 ед. (15г спирта)\n\n' +
                      '⚖️ Корректировка по весу:\n' +
                      '• Средний вес: 80кг (М) / 65кг (Ж)\n' +
                      '• Коэффициент: ±30%\n\n' +
                      '🎂 Корректировка по возрасту:\n' +
                      '• До 25 лет: -20%\n' +
                      '• 50-65 лет: -15%\n' +
                      '• Старше 65: -30%\n\n' +
                      '⚠️ Внимание:\n' +
                      'Это ориентировочный расчет, не медицинская рекомендация. ВОЗ утверждает, что безопасного уровня потребления алкоголя не существует.',
                      [{ text: 'Понятно', style: 'default' }]
                    );
                  }}
                  style={{ padding: 4 }}
                >
                  <MaterialIcons name="info-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Параметры профиля */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Параметры профиля</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Настройте профиль для определения условной нормы</Text>
          <View style={[styles.profileContainer, { backgroundColor: colors.backgroundCard }]}>
            {/* Вес */}
            <View style={styles.profileRow}>
              <Text style={[styles.profileLabel, { color: colors.text }]}>Вес:</Text>
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
                    await updateRecommendation();
                  }}
                >
                  <MaterialIcons name="chevron-left" size={24} color={colors.primary} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.profileInput, { textAlign: 'right', color: colors.text, backgroundColor: colors.backgroundSecondary }]}
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
                <Text style={[styles.profileUnit, { color: colors.textSecondary }]}>кг</Text>
                <TouchableOpacity
                  style={styles.profileArrowButton}
                  onPress={async () => {
                    const current = weight ? parseFloat(weight.replace(',', '.')) : 50;
                    const newValue = Math.min(300, current + 1);
                    setWeightValue(newValue.toString());
                    await setUserWeight(newValue);
                    const lethal = await getLethalDose();
                    setLethalDose(lethal);
                    await updateRecommendation();
                  }}
                >
                  <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Пол */}
            <View style={styles.profileRow}>
              <Text style={[styles.profileLabel, { color: colors.text }]}>Пол:</Text>
              <View style={styles.profileInputRow}>
                <TouchableOpacity
                  style={[
                    styles.profileGenderIconButton,
                    gender === 'female' && styles.profileGenderButtonActive,
                    {
                      backgroundColor: gender === 'female' ? colors.primaryDark : colors.backgroundSecondary,
                      borderColor: gender === 'female' ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => handleSaveGender('female')}
                >
                  <MaterialCommunityIcons name="gender-female" size={24} color={gender === 'female' ? '#fff' : colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.profileGenderIconButton,
                    gender === 'male' && styles.profileGenderButtonActive,
                    {
                      backgroundColor: gender === 'male' ? colors.primaryDark : colors.backgroundSecondary,
                      borderColor: gender === 'male' ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => handleSaveGender('male')}
                >
                  <MaterialCommunityIcons name="gender-male" size={24} color={gender === 'male' ? '#fff' : colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.profileGenderIconButton,
                    gender === 'genderless' && styles.profileGenderButtonActive,
                    {
                      backgroundColor: gender === 'genderless' ? colors.primaryDark : colors.backgroundSecondary,
                      borderColor: gender === 'genderless' ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => handleSaveGender('genderless')}
                >
                  <FontAwesome6 name="genderless" size={24} color={gender === 'genderless' ? '#fff' : colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Дата рождения */}
            <View style={styles.profileRow}>
              <Text style={[styles.profileLabel, { color: colors.text }]}>Дата рождения:</Text>
              <TouchableOpacity
                style={{ flex: 1, alignItems: 'flex-end' }}
                onPress={() => {
                  setTempBirthDate(birthDate ? new Date(birthDate) : new Date(new Date().getFullYear() - 18, 0, 1));
                  setShowBirthDatePicker(true);
                }}
              >
                <Text style={[styles.profileValue, !birthDate && styles.valuePlaceholder, { color: birthDate ? colors.textSecondary : colors.textTertiary }]}>
                  {birthDate ? new Date(birthDate).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Не установлена'}
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>

        {/* Премиум */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: colors.backgroundCard }]} 
            onPress={() => navigation.navigate('Premium' as never)}
          >
            <MaterialCommunityIcons name="crown" size={24} color={isPremium ? "#f4c430" : colors.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.actionButtonText, { color: colors.text }]}>
                {isPremium ? 'Премиум активен' : 'Премиум'}
              </Text>
              {!isPremium && (
                <Text style={[styles.actionButtonSubtext, { color: colors.textSecondary }]}>Разблокировать все функции</Text>
              )}
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.textTertiary} />
          </TouchableOpacity>
          {__DEV__ && (
            <TouchableOpacity 
              style={[styles.actionButton, { marginTop: 8, opacity: 0.7 }]} 
              onPress={async () => {
                if (isPremium) {
                  await disableDevPremium();
                  await checkPremiumStatus();
                  Alert.alert('Dev Mode', 'Премиум отключен (dev mode)');
                } else {
                  await enableDevPremium();
                  await checkPremiumStatus();
                  Alert.alert('Dev Mode', 'Премиум включен (dev mode)');
                }
              }}
            >
              <MaterialCommunityIcons name="bug" size={24} color={colors.textSecondary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.actionButtonText, { fontSize: 14, color: colors.text }]}>
                  {isPremium ? 'Отключить Premium (Dev)' : 'Включить Premium (Dev)'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          {/* Preview build premium activation (for APK for friends) */}
          {!__DEV__ && (
            <TouchableOpacity 
              style={[styles.actionButton, { marginTop: 8, opacity: 0.7 }]} 
              onPress={async () => {
                if (isPremium) {
                  await disablePreviewPremium();
                  await checkPremiumStatus();
                  Alert.alert('Preview Mode', 'Премиум отключен');
                } else {
                  await enablePreviewPremium();
                  await checkPremiumStatus();
                  Alert.alert('Preview Mode', 'Премиум активирован для тестирования');
                }
              }}
            >
              <MaterialCommunityIcons name="crown" size={24} color={colors.textSecondary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.actionButtonText, { fontSize: 14, color: colors.text }]}>
                  {isPremium ? 'Отключить Premium (Preview)' : 'Активировать Premium (Preview)'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Цель по серии: премиум — активна, базовая — показать заблокированной */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Цель по серии</Text>
          {isPremium ? (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.backgroundCard }]}
              onPress={() => {
                setCustomStreakGoalInput(streakGoal != null ? String(streakGoal) : '');
                setShowStreakGoalModal(true);
              }}
            >
              <MaterialCommunityIcons name="target" size={24} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.actionButtonText, { color: colors.text }]}>
                  {streakGoal != null ? `${streakGoal} дней` : 'Не задана'}
                </Text>
                <Text style={[styles.actionButtonSubtext, { color: colors.textSecondary }]}>
                  Отслеживание прогресса в статистике и календаре
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.actionButton, { backgroundColor: colors.backgroundCard, opacity: 0.8 }]}>
              <MaterialCommunityIcons name="target" size={24} color={colors.textTertiary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>Доступно в полной версии</Text>
                <Text style={[styles.actionButtonSubtext, { color: colors.textTertiary }]}>
                  Отслеживание прогресса в статистике и календаре
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Модалка: своя цель по серии — по центру экрана */}
        <Modal visible={showStreakGoalModal} transparent animationType="fade">
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalOverlayCenter}
            onPress={() => setShowStreakGoalModal(false)}
          >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 40} style={styles.modalContentWrap}>
              <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={[styles.modalContent, { backgroundColor: colors.backgroundCard }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Цель: дней без алкоголя</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                  value={customStreakGoalInput}
                  onChangeText={setCustomStreakGoalInput}
                  placeholder="Введите число дней"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <View style={{ flexDirection: 'row', marginTop: 16, gap: 12 }}>
                  {streakGoal != null && (
                    <TouchableOpacity
                      style={[styles.modalButton, { flex: 1, backgroundColor: colors.error }]}
                      onPress={() => {
                        setShowStreakGoalModal(false);
                        setCustomStreakGoalInput('');
                        confirmStreakGoalChange(null);
                      }}
                    >
                      <Text style={[styles.modalButtonText, { color: '#fff' }]}>Сброс</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.modalButton, { flex: 1, backgroundColor: colors.primary }]}
                    onPress={() => {
                      const trimmed = customStreakGoalInput.trim();
                      if (trimmed === '') {
                        setShowStreakGoalModal(false);
                        setCustomStreakGoalInput('');
                        return;
                      }
                      const num = parseInt(trimmed, 10);
                      if (isNaN(num) || num < 1 || num > 999) {
                        Alert.alert('Ошибка', 'Введите число от 1 до 999');
                        return;
                      }
                      setShowStreakGoalModal(false);
                      setCustomStreakGoalInput('');
                      confirmStreakGoalChange(num);
                    }}
                  >
                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>Сохранить</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>

        {/* Темы оформления (только для премиум) */}
        {isPremium && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Тема оформления</Text>
            <View style={styles.themeContainer}>
              {(
                [
                  { id: 'dark' as ThemeName, label: 'Темная', bg: '#0f172a', accent: '#6366f1' },
                  { id: 'light' as ThemeName, label: 'Светлая', bg: '#ffffff', accent: '#3b82f6' },
                  { id: 'sepia' as ThemeName, label: 'Теплая', bg: '#1c1917', accent: '#f59e0b' },
                  { id: 'nord' as ThemeName, label: 'Северная', bg: '#e5e9f0', accent: '#5e81ac' },
                  { id: 'darcula' as ThemeName, label: 'Зелёный', bg: '#2b2b2b', accent: '#6a9955' },
                  { id: 'highContrast' as ThemeName, label: 'Розовая', bg: '#fdf8f6', accent: '#db2777' },
                ] as const
              ).map(({ id, label, bg, accent }) => (
                <TouchableOpacity
                  key={id}
                  style={[
                    styles.themeButton,
                    themeName === id && styles.themeButtonActive,
                    { backgroundColor: themeName === id ? colors.backgroundCard : colors.backgroundSecondary, borderColor: themeName === id ? colors.primary : colors.border }
                  ]}
                  onPress={() => setTheme(id)}
                >
                  <View style={[styles.themePreview, { backgroundColor: bg }]}>
                    <View style={[styles.themePreviewAccent, { backgroundColor: accent }]} />
                  </View>
                  <Text style={[
                    styles.themeButtonText,
                    themeName === id && styles.themeButtonTextActive,
                    { color: themeName === id ? colors.primary : colors.text }
                  ]}>
                    {label}
                  </Text>
                  {themeName === id && (
                    <MaterialIcons name="check" size={18} color={colors.primary} style={{ marginLeft: 6 }} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Валюта */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Валюта</Text>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.backgroundCard }]}
            onPress={() => setShowCurrencyPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionButtonText, { color: colors.text }]} numberOfLines={1}>
              {CURRENCY_LIST.find((c) => c.code === currency)?.label ?? currency}
            </Text>
            <MaterialIcons name="keyboard-arrow-down" size={24} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Экспорт и импорт данных */}
        <View style={styles.section}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.backgroundCard }]} onPress={handleExport}>
            <MaterialIcons name="file-download" size={24} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Экспорт данных</Text>
            <MaterialIcons name="chevron-right" size={24} color={colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.backgroundCard }]} onPress={() => setShowImportModal(true)}>
            <MaterialIcons name="file-upload" size={24} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Импорт данных</Text>
            <MaterialIcons name="chevron-right" size={24} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Удаление данных */}
        <View style={styles.section}>
          <TouchableOpacity style={[styles.actionButton, styles.dangerButton, { backgroundColor: colors.backgroundCard, borderColor: colors.error }]} onPress={handleClearData}>
            <MaterialIcons name="delete-forever" size={24} color={colors.error} />
            <Text style={[styles.actionButtonText, styles.dangerButtonText, { color: colors.error }]}>Удалить все данные</Text>
            <MaterialIcons name="chevron-right" size={24} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Информация о приложении */}
        <View style={styles.section}>
          <View style={[styles.infoCard, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>DrinkNote</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Версия 1.0.0</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Трекер потребления алкоголя</Text>
          </View>
    </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      {/* DateTimePicker для даты рождения */}
      {Platform.OS === 'ios' ? (
        <Modal
          visible={showBirthDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowBirthDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => setShowBirthDatePicker(false)}
            />
            <View style={[styles.datePickerModal, { backgroundColor: colors.backgroundCard }]}>
              <View style={[styles.datePickerHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                  onPress={() => setShowBirthDatePicker(false)}
                  style={styles.datePickerButton}
                >
                  <Text style={[styles.datePickerCancelText, { color: colors.textSecondary }]}>Отмена</Text>
                </TouchableOpacity>
                <Text style={[styles.datePickerTitle, { color: colors.text }]}>Дата рождения</Text>
                <TouchableOpacity
                  onPress={async () => {
                    const dateISO = tempBirthDate.toISOString().split('T')[0];
                    setBirthDateValue(dateISO);
                    await setBirthDate(dateISO);
                    const calculatedAge = calculateAgeFromDate(dateISO);
                    setAge(calculatedAge);
                    const lethal = await getLethalDose();
                    setLethalDose(lethal);
                    await updateRecommendation();
                    setShowBirthDatePicker(false);
                  }}
                  style={styles.datePickerButton}
                >
                  <Text style={[styles.datePickerDoneText, { color: colors.primary }]}>Готово</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempBirthDate}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
                themeVariant="dark"
                locale="ru-RU"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    setTempBirthDate(selectedDate);
                  }
                }}
              />
            </View>
          </View>
        </Modal>
      ) : (
        showBirthDatePicker && (
          <DateTimePicker
            value={tempBirthDate}
            mode="date"
            display="default"
            maximumDate={new Date()}
            minimumDate={new Date(1900, 0, 1)}
            onChange={async (event, selectedDate) => {
              setShowBirthDatePicker(false);
              if (event.type === 'set' && selectedDate) {
                const dateISO = selectedDate.toISOString().split('T')[0];
                setBirthDateValue(dateISO);
                await setBirthDate(dateISO);
                const calculatedAge = calculateAgeFromDate(dateISO);
                setAge(calculatedAge);
                const lethal = await getLethalDose();
                setLethalDose(lethal);
                await updateRecommendation();
                setTempBirthDate(selectedDate);
              }
            }}
          />
        )
      )}

      {/* Модальное окно для импорта данных */}
      <Modal
        visible={showImportModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowImportModal(false);
          setImportText('');
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeImportModal}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.importModalContainer}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <GestureDetector gesture={Gesture.Pan()
              .activeOffsetY([10, 100])
              .failOffsetX([-50, 50])
              .onUpdate((e) => {
                importModalTranslateY.value = e.translationY;
              })
              .onEnd((e) => {
                // Свайп вниз закрывает модальное окно
                if (e.translationY > 50) {
                  importModalTranslateY.value = withTiming(1000, { duration: 200 }, () => {
                    runOnJS(closeImportModal)();
                    importModalTranslateY.value = 0;
                  });
                } else {
                  importModalTranslateY.value = withTiming(0, { duration: 200 });
                }
              })
            }>
              <Animated.View 
                style={[
                  styles.importModal,
                  { backgroundColor: colors.backgroundCard },
                  useAnimatedStyle(() => ({
                    transform: [{ translateY: importModalTranslateY.value }]
                  }))
                ]}
              >
                <TouchableOpacity 
                  style={styles.modalDragHandle}
                  onPress={closeImportModal}
                  activeOpacity={1}
                >
                  <View style={[styles.modalDragBar, { backgroundColor: colors.textTertiary }]} />
                </TouchableOpacity>
              
              <View style={[styles.importHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.importTitle, { color: colors.text }]}>Импорт данных</Text>
                <TouchableOpacity
                  onPress={closeImportModal}
                  style={styles.closeButton}
                >
                  <MaterialIcons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.importContentWrapper}>
                <Animated.ScrollView
                  style={styles.importScrollView}
                  contentContainerStyle={styles.importScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  directionalLockEnabled
                  scrollEventThrottle={32}
                >
                  <Text style={[styles.importHint, { color: colors.textSecondary }]}>
                    Выберите файл (.json или .txt) или вставьте JSON данные из экспортированного файла
                  </Text>
                  
                  <TouchableOpacity
                    style={[styles.filePickerButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={handlePickFile}
                  >
                    <MaterialIcons name="insert-drive-file" size={24} color={colors.primary} />
                    <Text style={[styles.filePickerButtonText, { color: colors.primary }]}>Выбрать файл</Text>
                  </TouchableOpacity>
                  
                  <TextInput
                    style={[styles.importTextInput, { backgroundColor: colors.backgroundSecondary, color: colors.text }]}
                    value={importText}
                    onChangeText={setImportText}
                    placeholder="Или вставьте JSON данные здесь..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    textAlignVertical="top"
                  />
                </Animated.ScrollView>
                
                <View
                  style={[
                    styles.importButtonsContainer,
                    {
                      backgroundColor: colors.backgroundCard,
                      borderTopColor: colors.border,
                      paddingBottom: Math.max(
                        Platform.OS === 'ios' ? 34 : 20,
                        insets.bottom + (Platform.OS === 'android' ? 12 : 0)
                      ),
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={[styles.importButton, styles.importButtonReplace, { backgroundColor: colors.primary }, !importText.trim() && styles.importButtonDisabled]}
                    onPress={() => handleImport(false)}
                    disabled={!importText.trim()}
                  >
                    <Text style={[styles.importButtonText, { color: '#fff' }]}>Заменить все</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.importButton, styles.importButtonMerge, { backgroundColor: colors.primaryDark, borderColor: colors.primary }, !importText.trim() && styles.importButtonDisabled]}
                    onPress={() => handleImport(true)}
                    disabled={!importText.trim()}
                  >
                    <Text style={[styles.importButtonText, { color: '#fff' }]}>Добавить</Text>
                  </TouchableOpacity>
                </View>
              </View>
              </Animated.View>
            </GestureDetector>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Выпадающий список валют */}
      <Modal
        visible={showCurrencyPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCurrencyPicker(false)}
          />
          <View style={[styles.currencyPickerModal, { backgroundColor: colors.backgroundCard, paddingBottom: Math.max(Platform.OS === 'ios' ? 34 : 20, insets.bottom) }]}>
            <View style={[styles.currencyPickerHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.currencyPickerTitle, { color: colors.text }]}>Выберите валюту</Text>
              <TouchableOpacity onPress={() => setShowCurrencyPicker(false)} style={styles.currencyPickerClose}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Animated.ScrollView
              style={styles.currencyPickerScroll}
              contentContainerStyle={{ paddingBottom: insets.bottom }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              directionalLockEnabled
              scrollEventThrottle={32}
            >
              {CURRENCY_LIST.map(({ code, label }, index) => (
                <TouchableOpacity
                  key={code}
                  style={[
                    styles.currencyPickerItem,
                    { borderBottomColor: colors.border },
                    index === CURRENCY_LIST.length - 1 && { borderBottomWidth: 0 },
                    currency === code && { backgroundColor: colors.backgroundSecondary },
                  ]}
                  onPress={() => {
                    setCurrency(code);
                    setShowCurrencyPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.currencyPickerItemText, { color: colors.text }]} numberOfLines={1}>
                    {label}
                  </Text>
                  {currency === code && (
                    <MaterialIcons name="check" size={22} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </Animated.ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultColors.background,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: defaultColors.text,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: defaultColors.textSecondary,
    marginBottom: 12,
  },
  goalContainer: {
    backgroundColor: defaultColors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'stretch',
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
  goalColumn: {
    flex: 1,
  },
  goalColumnLabel: {
    fontSize: 13,
    color: defaultColors.textSecondary,
    marginBottom: 8,
    fontWeight: '600',
  },
  goalDivider: {
    width: 1,
    backgroundColor: defaultColors.border,
    marginHorizontal: 16,
    alignSelf: 'stretch',
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
    color: defaultColors.text,
    backgroundColor: defaultColors.backgroundSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  goalUnit: {
    fontSize: 16,
    color: defaultColors.textSecondary,
  },
  saveButton: {
    backgroundColor: defaultColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveButtonText: {
    color: defaultColors.text,
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
    color: defaultColors.text,
  },
  goalRecommended: {
    color: defaultColors.primary,
  },
  editButton: {
    padding: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: defaultColors.backgroundCard,
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
    borderColor: defaultColors.error,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: defaultColors.text,
  },
  actionButtonSubtext: {
    fontSize: 12,
    fontWeight: '400',
    color: defaultColors.textSecondary,
    marginTop: 2,
  },
  dangerButtonText: {
    color: defaultColors.error,
  },
  infoCard: {
    backgroundColor: defaultColors.backgroundSecondary,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: defaultColors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: defaultColors.textSecondary,
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
    borderColor: defaultColors.border,
    alignItems: 'center',
    backgroundColor: defaultColors.backgroundSecondary,
  },
  genderButtonActive: {
    backgroundColor: defaultColors.primaryDark,
    borderColor: defaultColors.primary,
  },
  genderButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: defaultColors.textSecondary,
  },
  genderButtonTextActive: {
    color: defaultColors.text,
  },
  lethalDoseInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: defaultColors.backgroundSecondary,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lethalDoseLabel: {
    fontSize: 14,
    color: defaultColors.textSecondary,
  },
  lethalDoseValue: {
    fontSize: 18,
    fontWeight: '700',
    color: defaultColors.error,
  },
  ageText: {
    fontSize: 14,
    color: defaultColors.textSecondary,
    marginTop: 4,
  },
  profileContainer: {
    backgroundColor: defaultColors.backgroundCard,
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
    color: defaultColors.text,
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
    color: defaultColors.textSecondary,
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
    color: defaultColors.text,
    backgroundColor: defaultColors.backgroundSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 60,
  },
  profileUnit: {
    fontSize: 14,
    color: defaultColors.textSecondary,
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
    borderColor: defaultColors.border,
    backgroundColor: defaultColors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileGenderButtonActive: {
    backgroundColor: defaultColors.primaryDark,
    borderColor: defaultColors.primary,
  },
  profileAgeText: {
    fontSize: 12,
    color: defaultColors.textTertiary,
    marginTop: 2,
    textAlign: 'right',
  },
  profileLethalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: defaultColors.error,
  },
  valuePlaceholder: {
    color: defaultColors.textTertiary,
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalOverlayCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContentWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    padding: 20,
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
  },
  datePickerModal: {
    backgroundColor: defaultColors.backgroundCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.select({ ios: 34, android: 20 }),
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: defaultColors.border,
  },
  datePickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: defaultColors.text,
    flex: 1,
    textAlign: 'center',
  },
  datePickerButton: {
    padding: 4,
    minWidth: 70,
  },
  datePickerCancelText: {
    fontSize: 17,
    color: defaultColors.textSecondary,
  },
  datePickerDoneText: {
    fontSize: 17,
    fontWeight: '600',
    color: defaultColors.primary,
    textAlign: 'right',
  },
  currencyPickerModal: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.select({ ios: 34, android: 20 }),
  },
  currencyPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  currencyPickerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  currencyPickerClose: {
    padding: 4,
  },
  currencyPickerScroll: {
    maxHeight: 400,
  },
  currencyPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  currencyPickerItemText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  importModalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: '15%',
    width: '100%',
  },
  importModal: {
    backgroundColor: defaultColors.backgroundCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flex: 1,
  },
  modalDragHandle: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    minHeight: 24,
  },
  modalDragBar: {
    width: 40,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: defaultColors.textTertiary,
    alignSelf: 'center',
  },
  importContentWrapper: {
    flex: 1,
    flexDirection: 'column',
  },
  importScrollView: {
    flex: 1,
  },
  importScrollContent: {
    paddingBottom: 20,
    paddingTop: 8,
    flexGrow: 1,
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: defaultColors.backgroundSecondary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: defaultColors.border,
    borderStyle: 'dashed',
  },
  filePickerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: defaultColors.primary,
    marginLeft: 8,
  },
  importHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: defaultColors.border,
  },
  importTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: defaultColors.text,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  importHint: {
    fontSize: 14,
    color: defaultColors.textSecondary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  importTextInput: {
    backgroundColor: defaultColors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 12,
    minHeight: 200,
    maxHeight: 300,
    fontSize: 14,
    color: defaultColors.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  importButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.select({ ios: 34, android: 20 }),
    gap: 12,
    backgroundColor: defaultColors.backgroundCard,
    borderTopWidth: 1,
    borderTopColor: defaultColors.border,
  },
  importButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 0,
  },
  importButtonReplace: {
    backgroundColor: defaultColors.primary,
  },
  importButtonMerge: {
    backgroundColor: defaultColors.primaryDark,
    borderWidth: 1.5,
    borderColor: defaultColors.primary,
  },
  importButtonDisabled: {
    opacity: 0.5,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  themeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  themeButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: defaultColors.backgroundSecondary,
    borderWidth: 1.5,
    borderColor: defaultColors.border,
  },
  themeButtonActive: {
    borderColor: defaultColors.primary,
    backgroundColor: defaultColors.backgroundCard,
  },
  themePreview: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: defaultColors.border,
  },
  themePreviewAccent: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  themeButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: defaultColors.text,
  },
  themeButtonTextActive: {
    color: defaultColors.primary,
    fontWeight: '600',
  },
  currencyListCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  currencyListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  currencyListLabel: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  currencyListRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
});

