import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/ratelimit';
import { headers } from 'next/headers';

export const metadata = { title: 'Track your order' };

async function lookup(formData: FormData) {
  'use server';
  const ip = headers().get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const number = String(formData.get('number') ?? '').trim().toUpperCase();
  const phone = String(formData.get('phone') ?? '').replace(/\D/g, '').slice(-10);
  if (!rateLimit(`track:${ip}`, 10, 60_000)) redirect('/track?error=rate');
  const order = await db.order.findUnique({ where: { number } });
  if (!order || order.phone !== phone) redirect('/track?error=notfound');
  redirect(`/order/${order.number}?t=${order.accessToken}`);
}

export default function TrackPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <form action={lookup} className="mx-auto max-w-md space-y-3">
      <h1 className="text-3xl font-bold">Track your order</h1>
      <p className="text-ink/70">Enter your order ID and the mobile number you used at checkout.</p>
      {searchParams.error === 'notfound' && <p role="alert" className="rounded-lg bg-chili/10 p-2 text-sm text-chili">We could not find that order. Check the order ID and mobile number.</p>}
      {searchParams.error === 'rate' && <p role="alert" className="rounded-lg bg-chili/10 p-2 text-sm text-chili">Too many attempts. Please wait a minute.</p>}
      <div><label className="label" htmlFor="number">Order ID</label><input id="number" name="number" required className="input" placeholder="PDVB-240101-AB12C" /></div>
      <div><label className="label" htmlFor="phone">Mobile number</label><input id="phone" name="phone" required inputMode="numeric" className="input" /></div>
      <button className="btn-primary w-full">Find my order</button>
    </form>
  );
}
