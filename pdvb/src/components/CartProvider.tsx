'use client';
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

export type CartItem = { variantId: string; qty: number };
type Ctx = {
  items: CartItem[];
  count: number;
  add: (variantId: string, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  ready: boolean;
};
const CartCtx = createContext<Ctx | null>(null);
const KEY = 'pdvb-cart-v1';

// The cart stores ONLY variant ids and quantities. Prices always come from the server.
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setItems(JSON.parse(raw)); } catch { /* ignore */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(items)); }, [items, ready]);

  const add = useCallback((variantId: string, qty = 1) =>
    setItems((cur) => {
      const found = cur.find((i) => i.variantId === variantId);
      if (found) return cur.map((i) => (i.variantId === variantId ? { ...i, qty: Math.min(20, i.qty + qty) } : i));
      return [...cur, { variantId, qty: Math.min(20, qty) }];
    }), []);
  const setQty = useCallback((variantId: string, qty: number) =>
    setItems((cur) => (qty <= 0 ? cur.filter((i) => i.variantId !== variantId) : cur.map((i) => (i.variantId === variantId ? { ...i, qty: Math.min(20, qty) } : i)))), []);
  const remove = useCallback((variantId: string) => setItems((cur) => cur.filter((i) => i.variantId !== variantId)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => ({ items, count: items.reduce((s, i) => s + i.qty, 0), add, setQty, remove, clear, ready }), [items, add, setQty, remove, clear, ready]);
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error('useCart must be used inside CartProvider');
  return c;
}
