import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { detectDefaultLanguage, localeTagFor, t as translate, tf as translateFormat } from './i18n';
import { getLanguageOverride, setLanguageOverride, type AppLanguage } from '../storage/settings';

type LanguageMode = 'auto' | AppLanguage;

interface I18nContextValue {
  language: AppLanguage;
  mode: LanguageMode;
  setMode: (mode: LanguageMode) => Promise<void>;
  t: (key: string) => string;
  tf: (key: string, vars: Record<string, string | number>) => string;
  localeTag: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<LanguageMode>('auto');
  const [language, setLanguage] = useState<AppLanguage>('en');

  const recompute = useCallback((m: LanguageMode) => {
    const resolved: AppLanguage = m === 'auto' ? detectDefaultLanguage() : m;
    setLanguage(resolved);
  }, []);

  useEffect(() => {
    getLanguageOverride()
      .then((override) => {
        const m: LanguageMode = override ?? 'auto';
        setModeState(m);
        recompute(m);
      })
      .catch(() => {
        setModeState('auto');
        recompute('auto');
      });
  }, [recompute]);

  const setMode = useCallback(
    async (m: LanguageMode) => {
      setModeState(m);
      recompute(m);
      await setLanguageOverride(m === 'auto' ? null : m);
    },
    [recompute]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      mode,
      setMode,
      t: (key: string) => translate(language, key),
      tf: (key: string, vars: Record<string, string | number>) => translateFormat(language, key, vars),
      localeTag: localeTagFor(language),
    }),
    [language, mode, setMode]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
}

