import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { getDailyGoal, setDailyGoal, exportData, clearAllData } from '../storage/settings';
import { colors } from '../theme/colors';

export default function SettingsScreen() {
  const [dailyGoal, setDailyGoalValue] = useState<string>('');
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  const loadSettings = useCallback(async () => {
    const goal = await getDailyGoal();
    setDailyGoalValue(goal !== null ? goal.toString() : '');
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
                  autoFocus
                />
                <Text style={styles.goalUnit}>ед.</Text>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveGoal}>
                  <Text style={styles.saveButtonText}>Сохранить</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsEditingGoal(false);
                    loadSettings();
                  }}
                >
                  <MaterialIcons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.goalDisplayRow}>
                <Text style={styles.goalValue}>
                  {dailyGoal ? `${parseFloat(dailyGoal.replace(',', '.')).toFixed(2)} ед.` : 'Не установлена'}
                </Text>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => setIsEditingGoal(true)}
                >
                  <MaterialIcons name="edit" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
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
});
