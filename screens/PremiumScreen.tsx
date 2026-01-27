import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { isPremiumUser } from '../storage/premium';
import { initPurchases, purchasePremium, restorePurchases } from '../services/purchases';
import { useNavigation } from '@react-navigation/native';

export default function PremiumScreen() {
  const navigation = useNavigation();
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    checkPremiumStatus();
    // Initialize purchases only when Premium screen is opened
    // This avoids loading the native module on app startup
    initializePurchases();
  }, []);

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
          Alert.alert('Ошибка', result.error || 'Не удалось выполнить покупку');
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
      icon: 'palette',
      title: 'Темы оформления',
      description: 'Темная, светлая и цветовые темы для персонализации',
    },
    {
      icon: 'widgets',
      title: 'Виджеты',
      description: 'Виджеты для главного экрана с текущей серией и статистикой',
    },
    {
      icon: 'fitness-center',
      title: 'Интеграция с Google Fit',
      description: 'Автоматический экспорт данных о воздержании в Google Fit',
    },
  ];

  if (isPremium) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Премиум</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.premiumActiveContainer}>
          <MaterialCommunityIcons name="crown" size={64} color="#f4c430" />
          <Text style={styles.premiumActiveTitle}>Премиум активен!</Text>
          <Text style={styles.premiumActiveText}>
            Все премиум функции разблокированы и доступны для использования.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Премиум</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <MaterialCommunityIcons name="crown" size={80} color="#f4c430" />
            <Text style={styles.heroTitle}>Разблокируйте все возможности</Text>
            <Text style={styles.heroSubtitle}>
              Получите доступ к расширенной статистике, темам оформления, виджетам и интеграциям
            </Text>
          </View>

          {/* Features List */}
          <View style={styles.featuresSection}>
            {premiumFeatures.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={styles.featureIconContainer}>
                  <MaterialCommunityIcons name={feature.icon as any} size={32} color={colors.primary} />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Purchase Button */}
          <TouchableOpacity
            style={[styles.purchaseButton, isLoading && styles.purchaseButtonDisabled]}
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
              <Text style={styles.restoreButtonText}>Восстановить покупки</Text>
            )}
          </TouchableOpacity>

          {/* Info */}
          <View style={styles.infoSection}>
            <Text style={styles.infoText}>
              • Одноразовая покупка, без подписок{'\n'}
              • Работает офлайн, без серверов{'\n'}
              • Все функции доступны сразу после покупки
            </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    color: colors.text,
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
    color: colors.text,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
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
    borderRadius: 28,
    backgroundColor: colors.backgroundSecondary,
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
    color: colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  purchaseButton: {
    backgroundColor: colors.primary,
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
    color: colors.primary,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
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
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  premiumActiveText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
