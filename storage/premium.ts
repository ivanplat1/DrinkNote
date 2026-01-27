import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const PREMIUM_KEY = 'premium_status_v1';
const DEV_MODE_KEY = 'dev_premium_enabled';

// Development mode: set to true to enable premium without purchases (for testing)
// Set this via AsyncStorage: AsyncStorage.setItem('dev_premium_enabled', 'true')
const DEV_MODE_ENABLED = __DEV__; // Only in development builds

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
    
    // Check actual premium status
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
