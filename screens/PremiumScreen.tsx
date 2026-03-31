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
import { useI18n } from '../i18n/I18nContext';

export default function PremiumScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
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
          t('premium.thanksTitle'),
          t('premium.thanksBody'),
          [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
        );
      } else {
        if (result.error !== 'Purchase canceled') {
          // Show more helpful error messages
          let errorMessage = result.error || t('premium.purchaseErrorTitle');
          if (result.error?.includes('not configured')) {
            errorMessage = t('premium.notConfigured');
          } else if (result.error?.includes('not available')) {
            errorMessage = t('premium.notAvailable');
          }
          Alert.alert(t('premium.purchaseErrorTitle'), errorMessage);
        }
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('premium.purchaseErrorTitle'));
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
          t('premium.restoredTitle'),
          t('premium.restoredBody'),
          [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
        );
      } else if (result.success && !result.restored) {
        Alert.alert(t('common.info'), t('premium.notFound'));
      } else {
        Alert.alert(t('premium.restoreErrorTitle'), result.error || t('premium.restoreErrorTitle'));
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('premium.restoreErrorTitle'));
    } finally {
      setIsRestoring(false);
    }
  };

  const premiumFeatures = [
    {
      icon: 'chart-line',
      title: t('premium.features.advancedStatsTitle'),
      description: t('premium.features.advancedStatsDesc'),
    },
    {
      icon: 'target',
      title: t('premium.features.streakGoalTitle'),
      description: t('premium.features.streakGoalDesc'),
    },
    {
      icon: 'palette',
      title: t('premium.features.themesTitle'),
      description: t('premium.features.themesDesc'),
    },
    {
      icon: 'cash',
      title: t('premium.features.drinkPriceTitle'),
      description: t('premium.features.drinkPriceDesc'),
    },
    {
      icon: 'label',
      title: t('premium.features.calendarLabelsTitle'),
      description: t('premium.features.calendarLabelsDesc'),
    },
  ];

  if (isPremium) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('premium.title')}</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.premiumActiveContainer}>
          <MaterialCommunityIcons name="crown" size={64} color="#f4c430" />
          <Text style={[styles.premiumActiveTitle, { color: colors.text }]}>{t('premium.active')}</Text>
          <Text style={[styles.premiumActiveText, { color: colors.textSecondary }]}>
            {t('premium.activeBody')}
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('premium.title')}</Text>
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
            <Text style={[styles.heroTitle, { color: colors.text }]}>{t('premium.heroTitle')}</Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              {t('premium.heroSubtitle')}
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
                <Text style={styles.purchaseButtonText}>{t('premium.buy')}</Text>
                <Text style={styles.purchaseButtonSubtext}>{t('premium.oneTimePurchase')}</Text>
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
              <Text style={[styles.restoreButtonText, { color: colors.primary }]}>{t('premium.restore')}</Text>
            )}
          </TouchableOpacity>

          {/* Info */}
          <View style={[styles.infoSection, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {t('premium.infoBullets')}
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
