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

function hasRequestedSku(products: any[] | null | undefined, sku: string) {
  if (!products || products.length === 0) return false;
  return products.some((p: any) => {
    if (!p) return false;
    if (p.productId === sku || p.id === sku) return true;
    if (Array.isArray(p.ids) && p.ids.includes(sku)) return true;
    return false;
  });
}

function androidSkuHelpText(): string {
  return [
    `Ожидаемый ID товара в коде: "${PREMIUM_PRODUCT_ID_ANDROID}" — он должен совпасть с Product ID в Play Console.`,
    '1) Monetize → Products: тип «Разовая покупка» (In-app), а не «Подписка», если в приложении покупка lifetime.',
    '2) Статус товара — Active; цена и страны заполнены.',
    '3) Приложение установлено с Google Play (Internal / Closed testing), не из APK с компьютера.',
    '4) Тот же Google-аккаунт на устройстве, что в License testing (Settings → License testing).',
    '5) Сборка с тем же applicationId, что в консоли (сейчас в проекте: com.drinknote.app).',
    '6) После создания товара иногда нужны несколько часов, пока он появится в биллинге.',
  ].join('\n');
}

type AndroidPremiumPrefetch = {
  ok: boolean;
  error?: string;
  /** Billing Library 7+ often needs the default one-time offer token for launchBillingFlow */
  androidOfferToken?: string;
};

function extractAndroidOneTimeOfferToken(product: any): string | undefined {
  const details = product?.oneTimePurchaseOfferDetailsAndroid;
  if (!Array.isArray(details) || details.length === 0) return undefined;
  const token = details[0]?.offerToken ?? details[0]?.offerTokenAndroid;
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}

/**
 * Prefetch in-app product on Android.
 * Important: expo-iap Android native maps fetch results only for in-app OR subs — not for type "all",
 * so "all" can resolve to an empty list and falsely look like «товар не найден».
 */
async function prefetchPremiumProductAndroid(mod: any): Promise<AndroidPremiumPrefetch> {
  try {
    const inAppProducts = await mod.fetchProducts({
      type: 'in-app',
      skus: [PREMIUM_PRODUCT_ID_ANDROID],
    });

    if (hasRequestedSku(inAppProducts, PREMIUM_PRODUCT_ID_ANDROID)) {
      const match = (inAppProducts ?? []).find((p: any) => {
        if (!p) return false;
        if (p.productId === PREMIUM_PRODUCT_ID_ANDROID || p.id === PREMIUM_PRODUCT_ID_ANDROID) return true;
        if (Array.isArray(p.ids) && p.ids.includes(PREMIUM_PRODUCT_ID_ANDROID)) return true;
        return false;
      });
      const androidOfferToken = extractAndroidOneTimeOfferToken(match);
      return { ok: true, androidOfferToken };
    }

    // Helpful branch: SKU exists only as subscription → in-app query is empty
    let subProducts: any[] | null = null;
    try {
      subProducts = await mod.fetchProducts({
        type: 'subs',
        skus: [PREMIUM_PRODUCT_ID_ANDROID],
      });
    } catch {
      subProducts = null;
    }

    if (hasRequestedSku(subProducts, PREMIUM_PRODUCT_ID_ANDROID)) {
      return {
        ok: false,
        error:
          `Товар "${PREMIUM_PRODUCT_ID_ANDROID}" в консоли заведён как подписка, а приложение запрашивает разовую покупку (in-app).\n\n` +
          'Создайте в Play Console продукт типа «Разовая покупка» с этим ID (или смените ID в коде под существующий managed product).',
      };
    }

    return {
      ok: false,
      error: `Товар не найден в Google Play для этого аккаунта и сборки.\n\n${androidSkuHelpText()}`,
    };
  } catch (e: any) {
    const code = e?.code != null ? ` (${String(e.code)})` : '';
    const msg = e?.message || String(e);
    return {
      ok: false,
      error: `Не удалось получить товар из Google Play${code}: ${msg}\n\n${androidSkuHelpText()}`,
    };
  }
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

    // Pre-flight: in-app query (avoid native type "all" → empty list) + offer token for Billing 7+.
    let androidOfferToken: string | undefined;
    if (Platform.OS === 'android') {
      const prefetch = await prefetchPremiumProductAndroid(mod);
      if (!prefetch.ok) {
        return { success: false, error: prefetch.error };
      }
      androidOfferToken = prefetch.androidOfferToken;
    }

    await mod.requestPurchase({
      type: 'in-app',
      request: {
        apple: { sku: PREMIUM_PRODUCT_ID_IOS },
        google: {
          skus: [PREMIUM_PRODUCT_ID_ANDROID],
          ...(androidOfferToken ? { offerToken: androidOfferToken } : {}),
        },
      },
    });

    // Final entitlement state usually comes via purchaseUpdatedListener,
    // but we also try to update immediately for responsive UI.
    const purchases = await mod.getAvailablePurchases();
    for (const p of purchases ?? []) {
      await grantPremiumFromPurchase(p);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error purchasing premium:', error);
    const code = error?.code != null ? `[${String(error.code)}] ` : '';
    const msg =
      error instanceof Error ? error.message : typeof error?.message === 'string' ? error.message : 'Unknown error';
    return { success: false, error: `${code}${msg}`.trim() };
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


