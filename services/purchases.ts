import { Platform } from 'react-native';
import { setPremiumStatus } from '../storage/premium';

export const PREMIUM_PRODUCT_ID_ANDROID = 'premium_lifetime';
export const PREMIUM_PRODUCT_ID_IOS = 'premium_lifetime_ios';

// Product ID for premium purchase.
// Must match the product ID configured in Google Play Console / App Store Connect.
export const PREMIUM_PRODUCT_ID = Platform.select({
  android: PREMIUM_PRODUCT_ID_ANDROID,
  ios: PREMIUM_PRODUCT_ID_IOS,
  default: PREMIUM_PRODUCT_ID_ANDROID,
});

let isInitialized = false;
let purchasesAvailable = false;

// Lazy load native module to avoid runtime crashes in builds where it's not available.
let Iap: typeof import('expo-iap') | null = null;

async function loadIapModule() {
  if (Iap) return Iap;
  try {
    if (Platform.OS === 'web') return null;
    const mod = (await import('expo-iap')) as typeof import('expo-iap');

    // Minimal runtime guard (avoids "undefined is not a function" style crashes).
    if (
      typeof (mod as any)?.initConnection !== 'function' ||
      typeof (mod as any)?.requestPurchase !== 'function' ||
      typeof (mod as any)?.getAvailablePurchases !== 'function'
    ) {
      purchasesAvailable = false;
      Iap = null;
      return null;
    }

    Iap = mod;
    return mod;
  } catch (error) {
    console.warn('IAP module not available:', error);
    purchasesAvailable = false;
    Iap = null;
    return null;
  }
}

function isPremiumPurchase(productId: string | undefined | null) {
  return productId === PREMIUM_PRODUCT_ID_ANDROID || productId === PREMIUM_PRODUCT_ID_IOS;
}

async function grantPremiumFromPurchase(purchase: any) {
  if (!purchase || purchase.purchaseState !== 'purchased') return;
  if (!isPremiumPurchase(purchase.productId)) return;

  await setPremiumStatus(true);

  // Mark transaction as finished/acknowledged when needed.
  // Non-consumable in our case, so isConsumable=false.
  try {
    const mod = Iap;
    if (mod && typeof (mod as any).finishTransaction === 'function') {
      await (mod as any).finishTransaction({ purchase, isConsumable: false });
    }
  } catch (e) {
    // Not fatal: entitlement is granted anyway.
    console.warn('finishTransaction failed (ignored):', e);
  }
}

/**
 * Initialize in-app purchases (one-time connection + listeners).
 */
export async function initPurchases(): Promise<boolean> {
  if (isInitialized) return purchasesAvailable;

  const mod = await loadIapModule();
  if (!mod) return false;

  try {
    const connected = await mod.initConnection({});
    if (!connected) {
      purchasesAvailable = false;
      return false;
    }

    // Listener-driven entitlement granting.
    // We'll keep entitlements consistent even if purchase finishes after the request.
    mod.purchaseUpdatedListener(async (purchase: any) => {
      try {
        await grantPremiumFromPurchase(purchase);
      } catch (e) {
        console.warn('purchaseUpdatedListener grant failed:', e);
      }
    });

    mod.purchaseErrorListener((error: any) => {
      console.warn('purchaseErrorListener:', error?.code ?? error);
    });

    // Restore entitlements already owned (useful for first open on the screen).
    const purchases = await mod.getAvailablePurchases();
    for (const p of purchases ?? []) {
      await grantPremiumFromPurchase(p);
    }

    isInitialized = true;
    purchasesAvailable = true;
    return true;
  } catch (error) {
    console.warn('Error initializing purchases (IAP may be unavailable):', error);
    purchasesAvailable = false;
    isInitialized = false;
    return false;
  }
}

/**
 * Purchase premium.
 */
export async function purchasePremium(): Promise<{ success: boolean; error?: string }> {
  try {
    const mod = await loadIapModule();
    if (!mod) {
      return { success: false, error: 'In-app purchases not available' };
    }

    if (!isInitialized) {
      const initialized = await initPurchases();
      if (!initialized) {
        return {
          success: false,
          error:
            Platform.OS === 'android'
              ? 'Покупки недоступны. Обычно нужно установить приложение из Google Play (internal testing достаточно) и настроить продукт в Play Console.'
              : 'Failed to initialize purchases',
        };
      }
    }

    await mod.requestPurchase({
      type: 'in-app',
      request: {
        apple: { sku: PREMIUM_PRODUCT_ID_IOS },
        google: { skus: [PREMIUM_PRODUCT_ID_ANDROID] },
      },
    });

    // Final entitlement state usually comes via purchaseUpdatedListener,
    // but we also try to update immediately for responsive UI.
    const purchases = await mod.getAvailablePurchases();
    for (const p of purchases ?? []) {
      await grantPremiumFromPurchase(p);
    }

    return { success: true };
  } catch (error) {
    console.error('Error purchasing premium:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Restore completed purchases (Android: queries available purchases; iOS: also refreshes).
 */
export async function restorePurchases(): Promise<{ success: boolean; restored: boolean; error?: string }> {
  try {
    const mod = await loadIapModule();
    if (!mod) {
      return { success: false, restored: false, error: 'In-app purchases not available' };
    }

    if (!isInitialized) {
      const initialized = await initPurchases();
      if (!initialized) {
        return { success: false, restored: false, error: 'In-app purchases not available' };
      }
    }

    await mod.restorePurchases();
    const purchases = await mod.getAvailablePurchases();

    let restored = false;
    for (const p of purchases ?? []) {
      if (p?.purchaseState === 'purchased' && isPremiumPurchase(p?.productId)) {
        restored = true;
      }
      await grantPremiumFromPurchase(p);
    }

    return { success: true, restored };
  } catch (error) {
    console.error('Error restoring purchases:', error);
    return { success: false, restored: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Disconnect from store (optional).
 */
export async function disconnectPurchases(): Promise<void> {
  if (!Iap || !isInitialized) return;
  try {
    await Iap.endConnection();
  } catch (e) {
    console.warn('disconnectPurchases failed (ignored):', e);
  } finally {
    isInitialized = false;
    purchasesAvailable = false;
  }
}
