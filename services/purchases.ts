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
let purchaseUpdateSub: { remove: () => void } | null = null;
let purchaseErrorSub: { remove: () => void } | null = null;

type ExpoIapModule = typeof import('expo-iap');

// Lazy load the module to avoid errors if it's not available (e.g. web)
let IAP: ExpoIapModule | null = null;

type PurchaseWaiter = {
  resolve: (purchase: import('expo-iap').Purchase) => void;
  reject: (error: Error) => void;
};

let pendingPurchase: PurchaseWaiter | null = null;

async function loadPurchasesModule(): Promise<ExpoIapModule | null> {
  if (IAP) {
    return IAP;
  }

  try {
    if (Platform.OS !== 'web') {
      IAP = await import('expo-iap');
      purchasesAvailable = true;
      return IAP;
    }
  } catch (error) {
    console.warn('In-app purchases module not available:', error);
    purchasesAvailable = false;
  }

  return null;
}

function isPremiumProduct(productId: string | null | undefined): boolean {
  return productId === PREMIUM_PRODUCT_ID;
}

async function grantPremiumAndFinish(
  module: ExpoIapModule,
  purchase: import('expo-iap').Purchase
): Promise<void> {
  await setPremiumStatus(true);
  // Lifetime premium must NOT be consumed — Billing Library 8+ cannot restore consumed one-time products.
  await module.finishTransaction({ purchase, isConsumable: false });
}

function attachPurchaseListeners(module: ExpoIapModule) {
  purchaseUpdateSub?.remove();
  purchaseErrorSub?.remove();

  purchaseUpdateSub = module.purchaseUpdatedListener(async (purchase) => {
    try {
      if (isPremiumProduct(purchase.productId)) {
        await grantPremiumAndFinish(module, purchase);
      }
      pendingPurchase?.resolve(purchase);
    } catch (error) {
      pendingPurchase?.reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      pendingPurchase = null;
    }
  });

  purchaseErrorSub = module.purchaseErrorListener((error) => {
    const message =
      error.code === module.ErrorCode.UserCancelled
        ? 'Purchase canceled'
        : error.message || `Purchase failed (${error.code})`;
    pendingPurchase?.reject(Object.assign(new Error(message), { code: error.code }));
    pendingPurchase = null;
  });
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

    await module.initConnection();
    attachPurchaseListeners(module);
    isInitialized = true;
    purchasesAvailable = true;
    console.log(`In-app purchases initialized successfully. Product ID: ${PREMIUM_PRODUCT_ID}`);
    return true;
  } catch (error) {
    purchasesAvailable = false;
    console.warn('Error initializing purchases (module may not be available):', error);
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

    // Warm product cache (optional but helps surface missing SKU early)
    try {
      await module.fetchProducts({ skus: [PREMIUM_PRODUCT_ID], type: 'in-app' });
    } catch (error) {
      console.warn('fetchProducts failed (continuing with purchase):', error);
    }

    const purchasePromise = new Promise<import('expo-iap').Purchase>((resolve, reject) => {
      pendingPurchase = { resolve, reject };
    });

    try {
      await module.requestPurchase({
        request: {
          apple: { sku: PREMIUM_PRODUCT_ID },
          google: { skus: [PREMIUM_PRODUCT_ID] },
        },
        type: 'in-app',
      });
    } catch (error) {
      pendingPurchase = null;
      throw error;
    }

    try {
      const purchase = await purchasePromise;
      if (isPremiumProduct(purchase.productId)) {
        await setPremiumStatus(true);
        return { success: true };
      }
      return { success: false, error: 'Purchase completed for unexpected product' };
    } catch (error) {
      const code = (error as { code?: string })?.code;
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (code === module.ErrorCode.UserCancelled || message === 'Purchase canceled') {
        return { success: false, error: 'Purchase canceled' };
      }
      if (code === module.ErrorCode.AlreadyOwned) {
        await setPremiumStatus(true);
        return { success: true };
      }

      console.error(`Purchase failed: ${message}, productId=${PREMIUM_PRODUCT_ID}`);
      return { success: false, error: message };
    }
  } catch (error) {
    console.error('Error purchasing premium:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/** Restore: get owned purchases, if premium was bought — turn premium on. */
export async function restorePurchases(): Promise<{
  success: boolean;
  restored: boolean;
  error?: string;
}> {
  try {
    const module = await loadPurchasesModule();
    if (!module || !(isInitialized || (await initPurchases()))) {
      return { success: false, restored: false, error: 'In-app purchases not available' };
    }

    // iOS: sync first so historical non-consumables surface
    if (Platform.OS === 'ios' && typeof module.restorePurchases === 'function') {
      try {
        await module.restorePurchases();
      } catch (error) {
        console.warn('restorePurchases sync failed:', error);
      }
    }

    const purchases = await module.getAvailablePurchases();
    const premium = purchases.find((p) => isPremiumProduct(p.productId));
    if (premium) {
      await grantPremiumAndFinish(module, premium);
      return { success: true, restored: true };
    }
    return { success: true, restored: false };
  } catch (error) {
    console.error('Error restoring purchases:', error);
    return {
      success: false,
      restored: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
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
        purchaseUpdateSub?.remove();
        purchaseErrorSub?.remove();
        purchaseUpdateSub = null;
        purchaseErrorSub = null;
        pendingPurchase = null;
        await module.endConnection();
        isInitialized = false;
      }
    } catch (error) {
      console.error('Error disconnecting purchases:', error);
    }
  }
}
