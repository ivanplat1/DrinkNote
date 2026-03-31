import * as Localization from 'expo-localization';
import type { AppLanguage } from '../storage/language';
import { translations, type Translations } from './strings';

const RU_REGIONS = new Set([
  'RU',
  'BY',
  'KZ',
  'KG',
  'UZ',
  'TJ',
  'TM',
  'AM',
  'AZ',
  'MD',
]);

export function detectDefaultLanguage(): AppLanguage {
  try {
    const locales = Localization.getLocales?.() ?? [];
    const primary = locales[0];
    const languageCode = (primary?.languageCode ?? '').toLowerCase();
    const regionCode = (primary?.regionCode ?? '').toUpperCase();

    if (languageCode.startsWith('ru')) return 'ru';
    if (regionCode && RU_REGIONS.has(regionCode)) return 'ru';
    return 'en';
  } catch {
    return 'en';
  }
}

function getPath(obj: Translations, path: string): string | null {
  const parts = path.split('.');
  let current: any = obj;
  for (const p of parts) {
    if (!current || typeof current !== 'object' || !(p in current)) return null;
    current = current[p];
  }
  return typeof current === 'string' ? current : null;
}

export function t(language: AppLanguage, key: string): string {
  const dict = translations[language] as unknown as Translations;
  const fallback = translations.ru as unknown as Translations;
  return getPath(dict, key) ?? getPath(fallback, key) ?? key;
}

export function tf(language: AppLanguage, key: string, vars: Record<string, string | number>): string {
  const raw = t(language, key);
  return raw.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    const v = vars[name];
    return v == null ? '' : String(v);
  });
}

export function localeTagFor(language: AppLanguage): string {
  return language === 'ru' ? 'ru-RU' : 'en-US';
}

export function formatDaysCount(language: AppLanguage, days: number): string {
  if (language !== 'ru') {
    return days === 1 ? `${days} day` : `${days} days`;
  }
  const n = Math.abs(days) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return `${days} дней`;
  if (n1 > 1 && n1 < 5) return `${days} дня`;
  if (n1 === 1) return `${days} день`;
  return `${days} дней`;
}

