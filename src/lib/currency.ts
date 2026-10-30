import { CurrencyCode } from '../types/deal';

export function formatCurrency(amount: number, currency: CurrencyCode = 'INR'): string {
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    const symbolMap: Record<CurrencyCode, string> = {
      INR: '₹',
      USD: '$',
      EUR: '€',
      GBP: '£',
    };
    return `${symbolMap[currency] || '₹'}${amount.toLocaleString()}`;
  }
}
