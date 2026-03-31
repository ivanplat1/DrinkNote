import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const PREMIUM_KEY = 'premium_status_v1';
const DEV_MODE_KEY = 'dev_premium_enabled';
const PREVIEW_PREMIUM_KEY = 'preview_premium_enabled';

// Development mode: set to true to enable premium without purchases (for testing)
// Set this via AsyncStorage: AsyncStorage.setItem('dev_premium_enabled', 'true')
const DEV_MODE_ENABLED = __DEV__; // Only in development builds

// Preview builds: allow premium activation via AsyncStorage for friends/testers
// Set via: AsyncStorage.setItem('preview_premium_enabled', 'true')
// Or use: AsyncStorage.setItem('premium_status_v1', 'true') directly
const ALLOW_PREVIEW_PREMIUM = true; // Allow in preview/release builds for testing

/**
 * Check if user has premium status
 */
export async function isPremiumUser(): Promise<boolean> {
  try {
    // Check dev mode first (for testing without Google Play setup)
    if (DEV_MODE_ENABLED) {
      const devMode = await AsyncStorage.getItem(DEV_MODE_KEY);
      if (devMode === 'true') {
        return true;
      }
    }
    
    // Check preview premium mode (for APK builds for friends/testers)
    if (ALLOW_PREVIEW_PREMIUM) {
      const previewPremium = await AsyncStorage.getItem(PREVIEW_PREMIUM_KEY);
      if (previewPremium === 'true') {
        return true;
      }
    }
    
    // Check actual premium status (from purchase or direct set)
    const value = await AsyncStorage.getItem(PREMIUM_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Set premium status
 */
export async function setPremiumStatus(isPremium: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PREMIUM_KEY, isPremium ? 'true' : 'false');
  } catch (error) {
    console.error('Failed to set premium status:', error);
  }
}

/**
 * Check premium status (synchronous check from cache)
 * Use this for immediate checks, but verify with isPremiumUser() for critical operations
 */
let premiumCache: boolean | null = null;

export async function checkPremium(): Promise<boolean> {
  const status = await isPremiumUser();
  premiumCache = status;
  return status;
}

/**
 * Get cached premium status (may be null if not checked yet)
 */
export function getCachedPremiumStatus(): boolean | null {
  return premiumCache;
}

/**
 * Clear premium status (for testing or logout)
 */
export async function clearPremiumStatus(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREMIUM_KEY);
    if (DEV_MODE_ENABLED) {
      await AsyncStorage.removeItem(DEV_MODE_KEY);
    }
    if (ALLOW_PREVIEW_PREMIUM) {
      await AsyncStorage.removeItem(PREVIEW_PREMIUM_KEY);
    }
    premiumCache = null;
  } catch (error) {
    console.error('Failed to clear premium status:', error);
  }
}

/**
 * Enable premium in dev mode (for testing without purchases)
 * Only works in development builds
 */
export async function enableDevPremium(): Promise<void> {
  if (DEV_MODE_ENABLED) {
    try {
      await AsyncStorage.setItem(DEV_MODE_KEY, 'true');
      premiumCache = true;
    } catch (error) {
      console.error('Failed to enable dev premium:', error);
    }
  }
}

/**
 * Disable dev premium mode
 */
export async function disableDevPremium(): Promise<void> {
  if (DEV_MODE_ENABLED) {
    try {
      await AsyncStorage.removeItem(DEV_MODE_KEY);
      premiumCache = null;
    } catch (error) {
      console.error('Failed to disable dev premium:', error);
    }
  }
}

/**
 * Enable premium for preview builds (for friends/testers)
 * Works in any build, not just dev
 */
export async function enablePreviewPremium(): Promise<void> {
  try {
    await AsyncStorage.setItem(PREVIEW_PREMIUM_KEY, 'true');
    await AsyncStorage.setItem(PREMIUM_KEY, 'true'); // Also set main key for consistency
    premiumCache = true;
  } catch (error) {
    console.error('Failed to enable preview premium:', error);
  }
}

/**
 * Disable preview premium mode
 */
export async function disablePreviewPremium(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREVIEW_PREMIUM_KEY);
    // In preview toggle flow we explicitly turn premium off for testing.
    // If user really owns premium purchase, they can restore it from Premium screen.
    await AsyncStorage.removeItem(PREMIUM_KEY);
    premiumCache = false;
  } catch (error) {
    console.error('Failed to disable preview premium:', error);
  }
}
