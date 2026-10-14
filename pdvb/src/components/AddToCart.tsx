'use client';
import { useState } from 'react';
import { useCart } from './CartProvider';
import { formatINR, discountPercent } from '@/lib/money';

export type VariantView = { id: string; label: string; pricePaise: number; mrpPaise: number | null; inStock: boolean };

export function AddToCart({ variants, disabled, name }: { variants: VariantView[]; disabled?: boolean; name: string }) {
  const { add } = useCart();
  const firstAvail = variants.find((v) => v.inStock) ?? variants[0]!;
  const [vid, setVid] = useState(firstAvail.id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const v = variants.find((x) => x.id === vid)!;
  const off = discountPercent(v.pricePaise, v.mrpPaise);
  const blocked = disabled || !v.inStock;

  return (
    <div className="mt-auto space-y-2">
      {variants.length > 1 && (
        <select aria-label={`Choose size for ${name}`} className="input" value={vid} onChange={(e) => setVid(e.target.value)}>
          {variants.map((x) => <option key={x.id} value={x.id} disabled={!x.inStock}>{x.label} - {formatINR(x.pricePaise)}{x.inStock ? '' : ' (out of stock)'}</option>)}
        </select>
      )}
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold">{formatINR(v.pricePaise)}</span>
        {off > 0 && <><span className="text-sm text-ink/50 line-through">{formatINR(v.mrpPaise!)}</span><span className="rounded bg-chili/10 px-1.5 text-xs font-bold text-chili">{off}% off</span></>}
        {variants.length === 1 && <span className="text-sm text-ink/60">/ {v.label}</span>}
      </div>
      <div className="flex gap-2">
        <div className="flex items-center rounded-lg border border-ink/20">
          <button type="button" className="px-3 py-2" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}>-</button>
          <span className="w-6 text-center text-sm" aria-live="polite">{qty}</span>
          <button type="button" className="px-3 py-2" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(20, q + 1))}>+</button>
        </div>
        <button type="button" className="btn-primary flex-1" disabled={blocked}
          onClick={() => { add(v.id, qty); setAdded(true); setTimeout(() => setAdded(false), 1200); }}>
          {blocked ? 'Unavailable' : added ? 'Added' : 'Add to cart'}
        </button>
      </div>
    </div>
  );
}
