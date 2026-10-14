import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { Prisma, OrderStatus, PaymentMethod } from '@prisma/client';

// Spreadsheet apps execute cells starting with = + - @ as formulas, so neutralise them.
const cell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || (s.role !== 'ADMIN' && s.role !== 'STAFF')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const where: Prisma.OrderWhereInput = {
    ...(sp.get('status') && { status: sp.get('status') as OrderStatus }),
    ...(sp.get('method') && { paymentMethod: sp.get('method') as PaymentMethod }),
    ...(sp.get('category') && { items: { some: { categorySlug: sp.get('category')! } } }),
    ...((sp.get('from') || sp.get('to')) && { createdAt: { ...(sp.get('from') && { gte: new Date(`${sp.get('from')}T00:00:00+05:30`) }), ...(sp.get('to') && { lte: new Date(`${sp.get('to')}T23:59:59+05:30`) }) } }),
    ...(sp.get('q') && { OR: [{ number: { contains: sp.get('q')!, mode: 'insensitive' as const } }, { customerName: { contains: sp.get('q')!, mode: 'insensitive' as const } }, { phone: { contains: sp.get('q')! } }] }),
  };
  const orders = await db.order.findMany({ where, include: { payment: true, items: true }, orderBy: { createdAt: 'desc' }, take: 5000 });
  const rows = [['Order', 'Placed (IST)', 'Customer', 'Phone', 'Pincode', 'Items', 'Subtotal', 'Discount', 'Delivery', 'Tax', 'Total', 'Method', 'Payment status', 'Order status']];
  for (const o of orders) {
    rows.push([o.number, o.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), o.customerName, o.phone, o.pincode,
      o.items.map((i) => `${i.name} (${i.variantLabel}) x${i.qty}`).join('; '), (o.subtotalPaise / 100).toFixed(2), (o.discountPaise / 100).toFixed(2),
      (o.deliveryFeePaise / 100).toFixed(2), (o.taxPaise / 100).toFixed(2), (o.totalPaise / 100).toFixed(2), o.paymentMethod,
      o.paymentMethod === 'COD' ? (o.codCollectedAt ? 'COLLECTED' : 'NOT PAID') : (o.payment?.status ?? ''), o.status]);
  }
  return new NextResponse(rows.map((r) => r.map(cell).join(',')).join('\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="pdvb-orders.csv"' } });
}
