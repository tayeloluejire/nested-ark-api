import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import useSWR from 'swr';

const fetcher = (url: string) => api.get(url).then(r => r.data);

// Key currencies with symbols
export const CURRENCIES: Record<string, { symbol: string; name: string; flag: string }> = {
  USD: { symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  NGN: { symbol: '₦', name: 'Nigerian Naira', flag: '🇳🇬' },
  GHS: { symbol: '₵', name: 'Ghanaian Cedi', flag: '🇬🇭' },
  KES: { symbol: 'KSh', name: 'Kenyan Shilling', flag: '🇰🇪' },
  ZAR: { symbol: 'R', name: 'South African Rand', flag: '🇿🇦' },
  EUR: { symbol: '€', name: 'Euro', flag: '🇪🇺' },
  GBP: { symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
};

export function useCurrency() {
  const [selected, setSelected] = useState('USD');
  const { data } = useSWR('/api/rates', fetcher, { refreshInterval: 3600000 }); // 1hr

  // Detect user locale on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('preferred_currency');
      if (saved && CURRENCIES[saved]) { setSelected(saved); return; }
      // Try to guess from browser locale
      const locale = navigator.language || 'en-US';
      if (locale.includes('NG')) setSelected('NGN');
      else if (locale.includes('GH')) setSelected('GHS');
      else if (locale.includes('KE')) setSelected('KES');
      else if (locale.includes('ZA')) setSelected('ZAR');
      else if (locale.includes('GB')) setSelected('GBP');
      else if (locale.includes('AU')) setSelected('AUD');
    } catch {}
  }, []);

  const setCurrency = useCallback((code: string) => {
    setSelected(code);
    try { localStorage.setItem('preferred_currency', code); } catch {}
  }, []);

  const convert = useCallback((usdAmount: number): number => {
    if (selected === 'USD' || !data?.rates) return usdAmount;
    const rate = data.rates[selected];
    return rate ? Math.round(usdAmount * rate) : usdAmount;
  }, [selected, data]);

  const format = useCallback((usdAmount: number): string => {
    const converted = convert(usdAmount);
    const info = CURRENCIES[selected];
    const symbol = info?.symbol || selected;
    if (converted >= 1_000_000_000) return `${symbol}${(converted / 1_000_000_000).toFixed(2)}B`;
    if (converted >= 1_000_000) return `${symbol}${(converted / 1_000_000).toFixed(2)}M`;
    if (converted >= 1_000) return `${symbol}${(converted / 1_000).toFixed(0)}k`;
    return `${symbol}${converted.toLocaleString()}`;
  }, [convert, selected]);

  return {
    currency: selected,
    setCurrency,
    convert,
    format,
    rates: data?.rates || {},
    symbol: CURRENCIES[selected]?.symbol || selected,
    flag: CURRENCIES[selected]?.flag || '',
    availableCurrencies: Object.entries(CURRENCIES),
  };
}
