import { CurrencyCode, VALID_CURRENCIES } from '../storage/settings';

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  RUB: 'Российский рубль (₽)',
  BYN: 'Белорусский рубль (Br)',
  KZT: 'Казахстанский тенге (₸)',
  UZS: 'Узбекский сум (soʻm)',
  UAH: 'Украинская гривна (₴)',
  AMD: 'Армянский драм (֏)',
  AZN: 'Азербайджанский манат (₼)',
  GEL: 'Грузинский лари (₾)',
  KGS: 'Киргизский сом (с)',
  MDL: 'Молдавский лей (L)',
  TJS: 'Таджикский сомони (SM)',
  TMT: 'Туркменский манат (m)',
  EUR: 'Евро (€)',
  USD: 'Доллар США ($)',
};

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  RUB: '₽',
  BYN: 'Br',
  KZT: '₸',
  UZS: 'soʻm',
  UAH: '₴',
  AMD: '֏',
  AZN: '₼',
  GEL: '₾',
  KGS: 'с',
  MDL: 'L',
  TJS: 'SM',
  TMT: 'm',
  EUR: '€',
  USD: '$',
};

/** Список валют для выбора в настройках (порядок: СНГ, затем EUR, USD) */
export const CURRENCY_LIST: { code: CurrencyCode; label: string }[] = VALID_CURRENCIES.map((code) => ({
  code,
  label: CURRENCY_LABELS[code],
}));

/** Форматирует сумму с символом валюты (без конвертации — только отображение) */
export function formatPrice(amount: number, currency: CurrencyCode): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const value = amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : amount.toFixed(0);
  return `${value} ${symbol}`;
}

/** Форматирует цену для списка (коротко) */
export function formatPriceShort(amount: number, currency: CurrencyCode): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  return `${amount.toFixed(0)} ${symbol}`;
}

/** Компактный формат для подписей на графиках (без пробела, не переносится) */
export function formatPriceChart(amount: number, currency: CurrencyCode): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const value = amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : amount.toFixed(0);
  return `${value}${symbol}`;
}

/** Сумма без знака валюты (для столбцов статистики трат) */
export function formatPriceValueOnly(amount: number): string {
  return amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : amount.toFixed(0);
}
