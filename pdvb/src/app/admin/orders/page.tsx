import Link from 'next/link';
import type { Prisma, OrderStatus, PaymentMethod } from '@prisma/client';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatINR } from '@/lib/money';
import { STATUS_LABELS } from '@/lib/orders';

export const metadata = { title: 'Orders' };

export default async function Orders({ searchParams: sp }: { searchParams: Record<string, string | undefined> }) {
  await requireRole(['ADMIN', 'STAFF']);
  const where: Prisma.OrderWhereInput = {
    ...(sp.status && { status: sp.status as OrderStatus }),
    ...(sp.method && { paymentMethod: sp.method as PaymentMethod }),
    ...(sp.category && { items: { some: { categorySlug: sp.category } } }),
    ...((sp.from || sp.to) && { createdAt: { ...(sp.from && { gte: new Date(`${sp.from}T00:00:00+05:30`) }), ...(sp.to && { lte: new Date(`${sp.to}T23:59:59+05:30`) }) } }),
    ...(sp.q && { OR: [{ number: { contains: sp.q, mode: 'insensitive' } }, { customerName: { contains: sp.q, mode: 'insensitive' } }, { phone: { contains: sp.q } }] }),
  };
  const orders = await db.order.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100, include: { payment: true } });
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h1 className="text-3xl font-bold">Orders</h1><a className="btn-ghost" href={`/api/admin/orders/export?${qs}`}>Export CSV</a></div>
      <form className="mb-4 grid gap-2 rounded-xl border border-ink/10 bg-white p-3 sm:grid-cols-3 lg:grid-cols-7">
        <input name="q" defaultValue={sp.q} placeholder="Order ID, name, phone" className="input lg:col-span-2" aria-label="Search orders" />
        <select name="status" defaultValue={sp.status ?? ''} className="input" aria-label="Status"><option value="">Any status</option>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="method" defaultValue={sp.method ?? ''} className="input" aria-label="Payment method"><option value="">Any payment</option><option value="ONLINE">Online</option><option value="COD">COD</option></select>
        <select name="category" defaultValue={sp.category ?? ''} className="input" aria-label="Category"><option value="">Any category</option>{['food', 'groceries', 'vegetables', 'meat', 'medicine'].map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <input type="date" name="from" defaultValue={sp.from} className="input" aria-label="From date" /><input type="date" name="to" defaultValue={sp.to} className="input" aria-label="To date" />
        <button className="btn-primary sm:col-span-3 lg:col-span-7">Filter</button>
      </form>
      {orders.length === 0 ? <p className="rounded-xl bg-mist p-6 text-center">No orders match these filters.</p> : (
        <div className="overflow-x-auto rounded-xl border border-ink/10 bg-white"><table className="w-full text-left text-sm">
          <thead className="bg-mist"><tr>{['Order', 'Placed', 'Customer', 'Total', 'Payment', 'Status'].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
          <tbody>{orders.map((o) => (
            <tr key={o.id} className="border-t border-ink/10"><td className="p-2"><Link className="font-semibold text-leaf underline" href={`/admin/orders/${o.id}`}>{o.number}</Link></td>
              <td className="p-2">{o.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}</td>
              <td className="p-2">{o.customerName}<br /><span className="text-ink/60">{o.phone}</span></td><td className="p-2">{formatINR(o.totalPaise)}</td>
              <td className="p-2">{o.paymentMethod === 'COD' ? (o.codCollectedAt ? 'COD - collected' : 'COD - not yet paid') : `Online - ${o.payment?.status}`}</td><td className="p-2">{STATUS_LABELS[o.status]}</td></tr>
          ))}</tbody></table></div>)}
    </div>
  );
}
