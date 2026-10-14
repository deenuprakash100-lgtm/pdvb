'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/components/CartProvider';
import { useQuote } from '@/components/useQuote';
import { Summary } from '@/components/Summary';

declare global { interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void } } }

type Pending = { orderNumber: string; accessToken: string; razorpay: { keyId: string; orderId: string; amount: number; currency: string; prefill: Record<string, string | undefined> } };

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clear, ready } = useCart();
  const [form, setForm] = useState({ name: '', phone: '', email: '', addressLine: '', locality: '', pincode: '', instructions: '' });
  const [method, setMethod] = useState<'ONLINE' | 'COD'>('ONLINE');
  const [coupon, setCoupon] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const keyRef = useRef<string>(crypto.randomUUID());

  const pinOk = /^\d{6}$/.test(form.pincode);
  const { quote } = useQuote(items, { couponCode: coupon, pincode: pinOk ? form.pincode : undefined, paymentMethod: method, enabled: ready });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function openPayment(p: Pending) {
    if (!(await loadRazorpay()) || !window.Razorpay) { setError('Could not load the payment window. Check your connection and retry.'); return; }
    const rzp = new window.Razorpay({
      key: p.razorpay.keyId, order_id: p.razorpay.orderId, amount: p.razorpay.amount, currency: p.razorpay.currency, name: 'PDVB', prefill: p.razorpay.prefill,
      handler: async (resp: Record<string, string>) => {
        setBusy(true);
        // The browser's success callback is NOT proof of payment: the server verifies it.
        const r = await fetch('/api/payments/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(resp) });
        const d = await r.json().catch(() => ({}));
        if (r.ok && (d.status === 'PAID' || d.status === 'PROCESSING')) { clear(); router.push(`/order/${p.orderNumber}?t=${p.accessToken}`); return; }
        setBusy(false);
        setError('We could not confirm your payment yet. If money was deducted it will be reconciled automatically; check your order status or contact us.');
      },
      modal: { ondismiss: () => { setBusy(false); setError('Payment was not completed. You can retry below. You will not be charged twice.'); } },
    });
    rzp.on('payment.failed', (r) => { setError(r.error?.description ?? 'Payment failed. Please retry.'); });
    rzp.open();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': keyRef.current },
        body: JSON.stringify({ items, couponCode: coupon || undefined, paymentMethod: method, customer: { ...form, email: form.email || undefined, instructions: form.instructions || undefined } }),
      });
      const d = await res.json();
      if (!res.ok) { keyRef.current = crypto.randomUUID(); setError(d.error ?? 'Could not place order.'); setBusy(false); return; }
      if (d.razorpay) { const p = d as Pending; setPending(p); await openPayment(p); setBusy(false); return; }
      clear(); router.push(`/order/${d.orderNumber}?t=${d.accessToken}`);
    } catch { setError('Network problem. Please try again; your order will not be duplicated.'); setBusy(false); }
  }

  if (ready && items.length === 0) return <div className="rounded-xl bg-mist p-10 text-center">Your cart is empty. <Link className="underline" href="/">Browse categories</Link></div>;
  const blocked = !quote || quote.errors.length > 0;

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold">Checkout</h1>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="name">Full name</label><input id="name" required minLength={2} className="input" value={form.name} onChange={set('name')} autoComplete="name" /></div>
          <div><label className="label" htmlFor="phone">Mobile number</label><input id="phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" title="10-digit Indian mobile number" className="input" value={form.phone} onChange={set('phone')} autoComplete="tel-national" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="email">Email (optional)</label><input id="email" type="email" className="input" value={form.email} onChange={set('email')} autoComplete="email" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="addr">Delivery address</label><input id="addr" required minLength={5} className="input" value={form.addressLine} onChange={set('addressLine')} placeholder="House / flat, street, landmark" autoComplete="street-address" /></div>
          <div><label className="label" htmlFor="loc">Locality</label><input id="loc" required className="input" value={form.locality} onChange={set('locality')} /></div>
          <div><label className="label" htmlFor="pin">PIN code</label><input id="pin" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className="input" value={form.pincode} onChange={set('pincode')} autoComplete="postal-code" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="ins">Delivery instructions (optional)</label><textarea id="ins" maxLength={300} className="input" rows={2} value={form.instructions} onChange={set('instructions')} /></div>
        </div>
        <fieldset className="rounded-xl border border-ink/10 bg-white p-4">
          <legend className="px-1 font-semibold">Payment method</legend>
          <label className="flex items-center gap-2 py-1"><input type="radio" checked={method === 'ONLINE'} onChange={() => setMethod('ONLINE')} /> Pay online (UPI, cards, netbanking)</label>
          <label className={`flex items-center gap-2 py-1 ${quote && !quote.codAllowed ? 'opacity-50' : ''}`}><input type="radio" disabled={!!quote && !quote.codAllowed} checked={method === 'COD'} onChange={() => setMethod('COD')} /> Cash on delivery {quote && !quote.codAllowed && <span className="text-xs">(not available for this order)</span>}</label>
        </fieldset>
      </section>
      <aside className="h-fit space-y-3 rounded-xl border border-ink/10 bg-white p-4">
        <h2 className="font-display text-lg font-bold">Order summary</h2>
        <ul className="text-sm">{quote?.lines.map((l) => <li key={l.variantId} className="flex justify-between py-0.5"><span>{l.name} ({l.variantLabel}) x {l.qty}</span><span>₹{l.lineTotalPaise / 100}</span></li>)}</ul>
        <div className="flex gap-2"><input className="input" placeholder="Coupon code" aria-label="Coupon code" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} /><button type="button" className="btn-ghost" onClick={() => setCoupon(couponInput.trim().toUpperCase())}>Apply</button></div>
        {quote && <Summary quote={quote} />}
        {quote?.errors.map((m) => <p key={m} role="alert" className="rounded-lg bg-chili/10 p-2 text-sm text-chili">{m}</p>)}
        {error && <p role="alert" className="rounded-lg bg-chili/10 p-2 text-sm text-chili">{error}</p>}
        <p className="text-sm text-ink/70">You will {method === 'ONLINE' ? 'pay online' : 'pay cash on delivery'}{quote ? `: ₹${quote.totals.totalPaise / 100}` : ''}.</p>
        {pending ? <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => openPayment(pending)}>Retry payment</button>
          : <button className="btn-primary w-full" disabled={busy || blocked || !pinOk}>{busy ? 'Please wait...' : method === 'ONLINE' ? 'Pay now' : 'Place order'}</button>}
        {!pinOk && <p className="text-xs text-ink/60">Enter your 6-digit PIN code to check delivery and final price.</p>}
      </aside>
    </form>
  );
}
