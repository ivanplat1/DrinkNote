import { CurrencyCode, VALID_CURRENCIES } from '../storage/settings';

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
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
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  CZK: 'Kč',
  TRY: '₺',
  INR: '₹',
  BRL: 'R$',
  MXN: '$',
  SGD: 'S$',
  HKD: 'HK$',
  KRW: '₩',
};

/** Список валют для выбора в настройках (USD/EUR/GBP first, then A-Z). */
const TOP: CurrencyCode[] = ['USD', 'EUR', 'GBP'];
export const CURRENCY_LIST: CurrencyCode[] = [
  ...TOP,
  ...VALID_CURRENCIES.filter((c) => !TOP.includes(c)).slice().sort(),
];

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
