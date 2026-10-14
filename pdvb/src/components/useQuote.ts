'use client';
import { useEffect, useState } from 'react';
import type { CartItem } from './CartProvider';
import type { Quote } from '@/lib/quote';

export function useQuote(items: CartItem[], opts: { couponCode?: string; pincode?: string; paymentMethod?: 'ONLINE' | 'COD'; enabled: boolean }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify([items, opts.couponCode, opts.pincode, opts.paymentMethod]);
  useEffect(() => {
    if (!opts.enabled) return;
    if (items.length === 0) { setQuote(null); return; }
    const ctrl = new AbortController();
    setLoading(true);
    fetch('/api/cart/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify({ items, couponCode: opts.couponCode || undefined, pincode: opts.pincode || undefined, paymentMethod: opts.paymentMethod }) })
      .then((r) => r.json()).then((q) => setQuote(q.lines ? q : null)).catch(() => {}).finally(() => setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, opts.enabled]);
  return { quote, loading };
}
