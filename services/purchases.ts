import { Platform } from 'react-native';
import { setPremiumStatus } from '../storage/premium';

// Product ID for premium purchase
// This should match the product ID configured in Google Play Console / App Store Connect
export const PREMIUM_PRODUCT_ID = Platform.select({
  android: 'premium_lifetime', // Will be configured in Google Play Console
  ios: 'premium_lifetime_ios', // Will be configured in App Store Connect
  default: 'premium_lifetime',
});

let isInitialized = false;
let purchasesAvailable = false;

// Lazy load the module to avoid errors if it's not available
let InAppPurchases: typeof import('expo-in-app-purchases') | null = null;

async function loadPurchasesModule() {
  if (InAppPurchases) {
    return InAppPurchases;
  }
  
  try {
    // Only load in non-web environments
    if (Platform.OS !== 'web') {
      InAppPurchases = await import('expo-in-app-purchases');
      purchasesAvailable = true;
      return InAppPurchases;
    }
  } catch (error) {
    console.warn('In-app purchases module not available:', error);
    purchasesAvailable = false;
  }
  
  return null;
}

/**
 * Initialize in-app purchases
 */
export async function initPurchases(): Promise<boolean> {
  if (isInitialized) {
    return purchasesAvailable;
  }

  try {
    const module = await loadPurchasesModule();
    if (!module) {
      console.log('In-app purchases not available (web or module not found)');
      return false;
    }

    // Connect to store
    const { responseCode } = await module.connectAsync();
    
    if (responseCode === module.IAPResponseCode.OK) {
      isInitialized = true;
      purchasesAvailable = true;
      console.log(`In-app purchases initialized successfully. Product ID: ${PREMIUM_PRODUCT_ID}`);
      
      // Set purchase listener
      module.setPurchaseListener(({ responseCode, results, errorCode }) => {
        if (responseCode === module.IAPResponseCode.OK) {
          results?.forEach(async (purchase) => {
            if (!purchase.acknowledged) {
              // Verify purchase and grant premium
              if (purchase.productId === PREMIUM_PRODUCT_ID) {
                await setPremiumStatus(true);
                // Acknowledge purchase
                await module.finishTransactionAsync(purchase, true);
              }
            }
          });
        } else if (responseCode === module.IAPResponseCode.USER_CANCELED) {
          console.log('User canceled the purchase');
        } else {
          console.error('Purchase error:', errorCode);
        }
      });
      
      return true;
    } else {
      purchasesAvailable = false;
      console.error(
        `Failed to initialize purchases. Response code: ${responseCode}. ` +
          `On Android, in-app purchases usually require an app build installed from Google Play (internal testing is enough) ` +
          `and a configured product ID: ${PREMIUM_PRODUCT_ID}.`
      );
      return false;
    }
  } catch (error) {
    console.warn('Error initializing purchases (module may not be available):', error);
    purchasesAvailable = false;
    return false;
  }
}

/**
 * Purchase premium
 */
export async function purchasePremium(): Promise<{ success: boolean; error?: string }> {
  try {
    const module = await loadPurchasesModule();
    if (!module) {
      return { success: false, error: 'In-app purchases not available' };
    }

    if (!isInitialized) {
      const initialized = await initPurchases();
      if (!initialized) {
        return {
          success: false,
          error:
            Platform.OS === 'android'
              ? 'Покупки недоступны. Обычно нужно установить приложение из Google Play (достаточно internal testing) и настроить продукт в Play Console.'
              : 'Failed to initialize purchases',
        };
      }
    }

    // Purchase the product
    const { responseCode, results } = await module.purchaseItemAsync(PREMIUM_PRODUCT_ID);

    if (responseCode === module.IAPResponseCode.OK && results) {
      // Purchase successful - status will be set by purchase listener
      // But we can also set it here for immediate feedback
      await setPremiumStatus(true);
      return { success: true };
    } else if (responseCode === module.IAPResponseCode.USER_CANCELED) {
      return { success: false, error: 'Purchase canceled' };
    } else {
      // More detailed error messages for debugging
      let errorMessage = 'Purchase failed';
      if (responseCode === module.IAPResponseCode.ERROR) {
        errorMessage = 'Purchase error: Product may not be configured in Play Console';
      } else if (responseCode === module.IAPResponseCode.DEFERRED) {
        errorMessage = 'Purchase is pending approval';
      } else {
        errorMessage = `Purchase failed (code: ${responseCode})`;
      }
      console.error(`Purchase failed: responseCode=${responseCode}, productId=${PREMIUM_PRODUCT_ID}`);
      return { success: false, error: errorMessage };
    }
  } catch (error) {
    console.error('Error purchasing premium:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/** Restore: get history, if premium was bought — turn premium on. */
export async function restorePurchases(): Promise<{ success: boolean; restored: boolean; error?: string }> {
  try {
    const module = await loadPurchasesModule();
    if (!module || !(isInitialized || (await initPurchases()))) {
      return { success: false, restored: false, error: 'In-app purchases not available' };
    }
    const { responseCode, results } = await module.getPurchaseHistoryAsync();
    if (responseCode !== module.IAPResponseCode.OK) {
      return { success: false, restored: false, error: 'Failed to restore purchases' };
    }
    const premium = results?.find((p) => p.productId === PREMIUM_PRODUCT_ID);
    if (premium) {
      await setPremiumStatus(true);
      if (!premium.acknowledged) await module.finishTransactionAsync(premium, true);
      return { success: true, restored: true };
    }
    return { success: true, restored: false };
  } catch (error) {
    console.error('Error restoring purchases:', error);
    return { success: false, restored: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Disconnect from store (call when app closes)
 */
export async function disconnectPurchases(): Promise<void> {
  if (isInitialized && purchasesAvailable) {
    try {
      const module = await loadPurchasesModule();
      if (module) {
        await module.disconnectAsync();
        isInitialized = false;
      }
    } catch (error) {
      console.error('Error disconnecting purchases:', error);
    }
  }
}
