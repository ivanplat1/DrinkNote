import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { colors as defaultColors } from '../theme/colors';
import { isPremiumUser } from '../storage/premium';
import { initPurchases, purchasePremium, restorePurchases } from '../services/purchases';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

export default function PremiumScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    // Initialize purchases only when Premium screen is opened
    initializePurchases();
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkPremiumStatus();
    }, [])
  );

  const checkPremiumStatus = async () => {
    const premium = await isPremiumUser();
    setIsPremium(premium);
  };

  const initializePurchases = async () => {
    try {
      await initPurchases();
    } catch (error) {
      // Silently fail - purchases may not be available in dev mode
      console.log('Purchases not available:', error);
    }
  };

  const handlePurchase = async () => {
    setIsLoading(true);
    try {
      const result = await purchasePremium();
      if (result.success) {
        setIsPremium(true);
        Alert.alert(
          'Спасибо!',
          'Премиум функции разблокированы!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        if (result.error !== 'Purchase canceled') {
          // Show more helpful error messages
          let errorMessage = result.error || 'Не удалось выполнить покупку';
          if (result.error?.includes('not configured')) {
            errorMessage = 'Продукт не настроен в Google Play. Пожалуйста, обратитесь к разработчику.';
          } else if (result.error?.includes('not available')) {
            errorMessage = 'Покупки недоступны. Убедитесь, что приложение установлено из Google Play.';
          }
          Alert.alert('Ошибка покупки', errorMessage);
        }
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Произошла ошибка при покупке');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.success && result.restored) {
        setIsPremium(true);
        Alert.alert(
          'Успешно!',
          'Покупки восстановлены. Премиум функции разблокированы!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else if (result.success && !result.restored) {
        Alert.alert('Информация', 'Не найдено предыдущих покупок');
      } else {
        Alert.alert('Ошибка', result.error || 'Не удалось восстановить покупки');
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Произошла ошибка при восстановлении');
    } finally {
      setIsRestoring(false);
    }
  };

  const premiumFeatures = [
    {
      icon: 'chart-line',
      title: 'Расширенная статистика',
      description: 'Графики трендов, сравнение периодов, детальная аналитика',
    },
    {
      icon: 'target',
      title: 'Цель по серии',
      description: 'Задайте цель (7, 30, 90 дней без алкоголя) и отслеживайте прогресс в статистике',
    },
    {
      icon: 'palette',
      title: 'Темы оформления',
      description: 'Темная, светлая и цветовые темы для персонализации',
    },
    {
      icon: 'cash',
      title: 'Цена напитка',
      description: 'Учёт стоимости каждой записи, сумма за день и период',
    },
    {
      icon: 'label',
      title: 'Метки на календаре',
      description: 'Свои заметки к дням: отпуск, праздник, поездка — для контекста в статистике',
    },
  ];

  if (isPremium) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Премиум</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.premiumActiveContainer}>
          <MaterialCommunityIcons name="crown" size={64} color="#f4c430" />
          <Text style={[styles.premiumActiveTitle, { color: colors.text }]}>Премиум активен!</Text>
          <Text style={[styles.premiumActiveText, { color: colors.textSecondary }]}>
            Все премиум функции разблокированы и доступны для использования.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Премиум</Text>
        <View style={styles.backButton} />
      </View>

      <Animated.ScrollView
        style={[styles.scrollView, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        directionalLockEnabled
        scrollEventThrottle={32}
      >
        <View style={styles.content}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <MaterialCommunityIcons name="crown" size={80} color="#f4c430" />
            <Text style={[styles.heroTitle, { color: colors.text }]}>Разблокируйте все возможности</Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              Получите доступ к расширенной статистике, темам оформления и учёту цен
            </Text>
          </View>

          {/* Features List */}
          <View style={styles.featuresSection}>
            {premiumFeatures.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={[styles.featureIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
                  <MaterialCommunityIcons name={feature.icon as any} size={32} color={colors.primary} />
                </View>
                <View style={styles.featureContent}>
                  <Text style={[styles.featureTitle, { color: colors.text }]}>{feature.title}</Text>
                  <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>{feature.description}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Purchase Button */}
          <TouchableOpacity
            style={[styles.purchaseButton, isLoading && styles.purchaseButtonDisabled, { backgroundColor: colors.primary }]}
            onPress={handlePurchase}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.purchaseButtonText}>Купить Премиум</Text>
                <Text style={styles.purchaseButtonSubtext}>Одноразовая покупка</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Restore Button */}
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={isRestoring}
          >
            {isRestoring ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[styles.restoreButtonText, { color: colors.primary }]}>Восстановить покупки</Text>
            )}
          </TouchableOpacity>

          {/* Info */}
          <View style={[styles.infoSection, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              • Одноразовая покупка, без подписок{'\n'}
              • Все функции доступны сразу после покупки
            </Text>
          </View>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: defaultColors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: defaultColors.text,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: defaultColors.text,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: defaultColors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresSection: {
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: defaultColors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: defaultColors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: defaultColors.textSecondary,
    lineHeight: 20,
  },
  purchaseButton: {
    backgroundColor: defaultColors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  purchaseButtonSubtext: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  restoreButtonText: {
    fontSize: 14,
    color: defaultColors.primary,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: defaultColors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    fontSize: 13,
    color: defaultColors.textSecondary,
    lineHeight: 20,
  },
  premiumActiveContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  premiumActiveTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: defaultColors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  premiumActiveText: {
    fontSize: 16,
    color: defaultColors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
