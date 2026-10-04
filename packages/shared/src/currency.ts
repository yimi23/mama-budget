// Fixed table, USD base. The envelope is in USD; lines show store currency first.

import type { CurrencyCode } from './types.ts';

/** Units of the currency per 1 USD. NGN is overridden from the API's .env at runtime. */
export const PER_USD: Record<CurrencyCode, number> = {
  USD: 1,
  NGN: 1600,
  GBP: 0.79,
  EUR: 0.92,
  CAD: 1.37,
};

const CODES = new Set<string>(Object.keys(PER_USD));

export function toCurrencyCode(raw: string | null | undefined): CurrencyCode {
  const c = (raw ?? '').trim().toUpperCase();
  return CODES.has(c) ? (c as CurrencyCode) : 'USD';
}

const SYMBOLS: [string, CurrencyCode][] = [
  ['₦', 'NGN'], ['NGN', 'NGN'], ['£', 'GBP'], ['GBP', 'GBP'], ['€', 'EUR'], ['EUR', 'EUR'],
  ['CA$', 'CAD'], ['C$', 'CAD'], ['CAD', 'CAD'], ['US$', 'USD'], ['USD', 'USD'], ['$', 'USD'],
];

/** Currency from a price string like "₦12,500.00" or "£24". Defaults to USD. */
export function currencyOf(text: string): CurrencyCode {
  for (const [sym, code] of SYMBOLS) if (text.includes(sym)) return code;
  return 'USD';
}

/** Number from a price string: "$1,299.99" -> 1299.99, "12.500,00 €" -> 12500. */
export function parsePrice(text: string): number | null {
  const m = text.replace(/\s/g, '').match(/\d[\d.,]*/);
  if (!m) return null;
  let s = m[0];
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastComma > lastDot && s.length - lastComma === 3) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function toUSD(amount: number, currency: CurrencyCode): number {
  return amount / PER_USD[currency];
}
