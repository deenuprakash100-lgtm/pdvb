'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/components/CartProvider';
import { useQuote } from '@/components/useQuote';
import { Summary } from '@/components/Summary';
import { formatINR } from '@/lib/money';

export default function CartPage() {
  const { items, setQty, remove, ready } = useCart();
  const [codeInput, setCodeInput] = useState('');
  const [coupon, setCoupon] = useState('');
  const { quote, loading } = useQuote(items, { couponCode: coupon, enabled: ready });

  if (ready && items.length === 0) {
    return <div className="rounded-xl bg-mist p-10 text-center"><h1 className="text-2xl font-bold">Your cart is empty</h1><p className="mt-1 text-ink/70">Add something from a category to get started.</p><Link href="/" className="btn-primary mt-4">Browse categories</Link></div>;
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section>
        <h1 className="mb-4 text-3xl font-bold">Your cart</h1>
        <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-white">
          {(quote?.lines ?? items.map((i) => ({ variantId: i.variantId, name: 'Loading...', variantLabel: '', unitPricePaise: 0, mrpPaise: null, qty: i.qty, lineTotalPaise: 0, shopName: null }))).map((l) => (
            <li key={l.variantId} className="flex items-center gap-3 p-3">
              <div className="flex-1"><p className="font-medium">{l.name} <span className="text-sm text-ink/60">{l.variantLabel}</span></p>{l.shopName && <p className="text-xs text-ink/60">{l.shopName}</p>}
                <p className="text-sm">{formatINR(l.unitPricePaise)}{l.mrpPaise && l.mrpPaise > l.unitPricePaise && <span className="ml-2 text-ink/50 line-through">{formatINR(l.mrpPaise)}</span>}</p></div>
              <div className="flex items-center rounded-lg border border-ink/20">
                <button className="px-3 py-1.5" aria-label={`Decrease ${l.name}`} onClick={() => setQty(l.variantId, l.qty - 1)}>-</button>
                <span className="w-6 text-center text-sm">{l.qty}</span>
                <button className="px-3 py-1.5" aria-label={`Increase ${l.name}`} onClick={() => setQty(l.variantId, l.qty + 1)}>+</button>
              </div>
              <p className="w-20 text-right font-semibold">{formatINR(l.lineTotalPaise)}</p>
              <button className="text-sm text-chili underline" onClick={() => remove(l.variantId)}>Remove</button>
            </li>
          ))}
        </ul>
      </section>
      <aside className="h-fit space-y-4 rounded-xl border border-ink/10 bg-white p-4">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setCoupon(codeInput.trim().toUpperCase()); }}>
          <input className="input" placeholder="Coupon code" aria-label="Coupon code" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} />
          <button className="btn-ghost">Apply</button>
        </form>
        {quote && <Summary quote={quote} />}
        {loading && <p className="text-xs text-ink/60">Updating prices...</p>}
        {quote?.errors.map((e) => <p key={e} className="rounded-lg bg-chili/10 p-2 text-sm text-chili" role="alert">{e}</p>)}
        <Link href="/checkout" aria-disabled={!quote || quote.errors.length > 0} className={`btn-primary w-full ${!quote || quote.errors.length > 0 ? 'pointer-events-none opacity-50' : ''}`}>Go to checkout</Link>
      </aside>
    </div>
  );
}
