import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { detectDefaultLanguage, localeTagFor, t as translate, tf as translateFormat } from './i18n';
import { getAppLanguage, setAppLanguage, type AppLanguage } from '../storage/language';
import { refreshSeededPresetsLocalization } from '../storage/presets';
import { refreshDrinkCatalogLocalization } from '../storage/drinkCatalog';

interface I18nContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: string) => string;
  tf: (key: string, vars: Record<string, string | number>) => string;
  localeTag: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>('en');

  useEffect(() => {
    getAppLanguage()
      .then(async (saved) => {
        if (saved) {
          setLanguage(saved);
          return;
        }
        // First run: pick a concrete language and persist it.
        const detected = detectDefaultLanguage();
        setLanguage(detected);
        await setAppLanguage(detected);
      })
      .catch(async () => {
        const detected = detectDefaultLanguage();
        setLanguage(detected);
        await setAppLanguage(detected);
      });
  }, []);

  const setLanguageAndPersist = useCallback(async (lang: AppLanguage) => {
    setLanguage(lang);
    await setAppLanguage(lang);
    // Update seeded preset/catalog names immediately so UI reflects the new language without reload.
    try {
      await Promise.all([refreshSeededPresetsLocalization(), refreshDrinkCatalogLocalization()]);
    } catch {
      // no-op: language change must not crash the app
    }
  }, []);

  // Keep a module-level getter so non-component code (e.g. context configs)
  // can read the current language without hooks.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    currentLanguage = language;
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage: setLanguageAndPersist,
      t: (key: string) => translate(language, key),
      tf: (key: string, vars: Record<string, string | number>) => translateFormat(language, key, vars),
      localeTag: localeTagFor(language),
    }),
    [language, setLanguageAndPersist]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
}

let currentLanguage: AppLanguage = 'en';

export function getCurrentLanguageUnsafe(): AppLanguage {
  return currentLanguage;
}

