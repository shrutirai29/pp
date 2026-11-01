/**
 * PayPal REST API Supported Currencies Allowlist
 * Reference: https://developer.paypal.com/docs/api/reference/currency-codes/
 *
 * IMPORTANT CURRENCY SAFETY INVARIANT:
 * PayPal REST API v2 does NOT support INR for international consumer checkout.
 * DealMind must NEVER silently convert or substitute unsupported currencies to USD.
 * Any unsupported currency must be rejected prior to creating or capturing orders.
 */
export const PAYPAL_SUPPORTED_CURRENCIES = [
  'AUD',
  'BRL',
  'CAD',
  'CNY',
  'CZK',
  'DKK',
  'EUR',
  'HKD',
  'HUF',
  'ILS',
  'JPY',
  'MYR',
  'MXN',
  'TWD',
  'NZD',
  'NOK',
  'PHP',
  'PLN',
  'GBP',
  'SGD',
  'SEK',
  'CHF',
  'THB',
  'USD',
] as const;

export type PayPalSupportedCurrency = typeof PAYPAL_SUPPORTED_CURRENCIES[number];

export const ZERO_DECIMAL_CURRENCIES = ['HUF', 'JPY', 'TWD'] as const;

/**
 * Validates whether a currency code is on the official PayPal REST API allowlist.
 */
export function isPayPalSupportedCurrency(currency: unknown): currency is PayPalSupportedCurrency {
  if (!currency || typeof currency !== 'string') return false;
  return PAYPAL_SUPPORTED_CURRENCIES.includes(currency.trim().toUpperCase() as any);
}

/**
 * Accurately compares two financial amounts according to currency minor-unit precision.
 * - For zero-decimal currencies (HUF, JPY, TWD), compares exact integer values.
 * - For standard 2-decimal currencies (USD, EUR, etc.), compares exact minor units (cents)
 *   to avoid floating-point jitter while strictly prohibiting any arbitrary tolerance.
 */
export function isAmountEqual(actual: number, expected: number, currency: string): boolean {
  const upper = (currency || '').trim().toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.includes(upper as any)) {
    return Math.round(actual) === Math.round(expected);
  }
  return Math.round(actual * 100) === Math.round(expected * 100);
}
