'use server';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { createSession, destroySession, requireRole } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';
import { addHistory, cancelOrder } from '@/lib/orders';
import { requeueJob } from '@/lib/notify';
import { razorpayClient } from '@/lib/payments';
import { saveSettings, type SiteSettings } from '@/lib/settings';
import { SETTING_FIELDS } from './settings/fields';
import type { OrderStatus } from '@prisma/client';

const STAFF = ['ADMIN', 'STAFF'] as const;
const audit = (actorId: string, action: string, entity: string, entityId: string, meta?: object) =>
  db.auditLog.create({ data: { actorId, action, entity, entityId, meta: meta as never } });

export async function loginAction(formData: FormData) {
  const ip = headers().get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  if (!rateLimit(`login:${ip}`, 8, 15 * 60_000)) redirect('/admin/login?error=rate');
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const user = await db.user.findUnique({ where: { email } });
  // Compare even when the user is missing so response time does not reveal valid emails.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
  if (!user || !ok || (user.role !== 'ADMIN' && user.role !== 'STAFF')) redirect('/admin/login?error=invalid');
  await createSession({ id: user.id, name: user.name, role: user.role });
  redirect('/admin');
}

export async function logoutAction() { destroySession(); redirect('/admin/login'); }

export async function updateOrderStatus(formData: FormData) {
  const s = await requireRole([...STAFF]);
  const id = String(formData.get('orderId'));
  const to = String(formData.get('status')) as OrderStatus;
  const note = String(formData.get('note') ?? '').slice(0, 200) || undefined;
  const order = await db.order.findUniqueOrThrow({ where: { id }, include: { payment: true } });
  if (order.status === 'CANCELLED' || order.status === 'DELIVERED') redirect(`/admin/orders/${id}?error=closed`);
  if (to === 'CANCELLED') {
    await cancelOrder(id, s.name, s.id, note ?? 'Cancelled by admin');
  } else {
    if (order.paymentMethod === 'ONLINE' && order.payment?.status !== 'PAID') redirect(`/admin/orders/${id}?error=unpaid`);
    await db.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { status: to } });
      await addHistory(tx, id, order.status, to, s.name, s.id, note);
    });
  }
  await audit(s.id, 'order.status', 'Order', id, { from: order.status, to });
  revalidatePath(`/admin/orders/${id}`);
  redirect(`/admin/orders/${id}`);
}

/** COD is only marked paid when staff record that cash was actually collected (order must be delivered). */
export async function recordCodCollection(formData: FormData) {
  const s = await requireRole([...STAFF]);
  const id = String(formData.get('orderId'));
  const order = await db.order.findUniqueOrThrow({ where: { id } });
  if (order.paymentMethod !== 'COD' || order.status !== 'DELIVERED' || order.codCollectedAt) redirect(`/admin/orders/${id}?error=cod`);
  await db.$transaction([
    db.order.update({ where: { id }, data: { codCollectedAt: new Date(), codCollectedById: s.id } }),
    db.payment.update({ where: { orderId: id }, data: { status: 'PAID', paidAt: new Date() } }),
  ]);
  await audit(s.id, 'cod.collected', 'Order', id, { amountPaise: order.totalPaise });
  redirect(`/admin/orders/${id}`);
}

/** Refund goes through Razorpay. Status becomes REFUND_PENDING; the refund.processed webhook finalises it. */
export async function requestRefund(formData: FormData) {
  const s = await requireRole(['ADMIN']);
  const id = String(formData.get('orderId'));
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 200);
  if (reason.length < 3) redirect(`/admin/orders/${id}?error=reason`);
  const payment = await db.payment.findUniqueOrThrow({ where: { orderId: id } });
  if (payment.method !== 'ONLINE' || payment.status !== 'PAID' || !payment.providerPaymentId) redirect(`/admin/orders/${id}?error=refund`);
  const r = await razorpayClient().payments.refund(payment.providerPaymentId!, { amount: payment.amountPaise, notes: { reason } });
  await db.$transaction([
    db.refund.create({ data: { orderId: id, paymentId: payment.id, amountPaise: payment.amountPaise, providerRefundId: r.id, reason, requestedById: s.id } }),
    db.payment.update({ where: { id: payment.id }, data: { status: 'REFUND_PENDING' } }),
  ]);
  await audit(s.id, 'refund.requested', 'Order', id, { amountPaise: payment.amountPaise, reason });
  redirect(`/admin/orders/${id}`);
}

export async function retryNotification(formData: FormData) {
  const s = await requireRole([...STAFF]);
  const jobId = String(formData.get('jobId'));
  const orderId = String(formData.get('orderId'));
  await requeueJob(jobId);
  await audit(s.id, 'notification.retry', 'NotificationJob', jobId);
  redirect(`/admin/orders/${orderId}`);
}

export async function updateVariant(formData: FormData) {
  const s = await requireRole(['ADMIN']);
  const id = String(formData.get('variantId'));
  const price = Math.round(parseFloat(String(formData.get('price'))) * 100);
  const mrpRaw = String(formData.get('mrp') ?? '');
  const mrp = mrpRaw ? Math.round(parseFloat(mrpRaw) * 100) : null;
  const stock = parseInt(String(formData.get('stock')), 10);
  if (!Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) redirect('/admin/products?error=invalid');
  await db.productVariant.update({ where: { id }, data: { pricePaise: price, mrpPaise: mrp && mrp > price ? mrp : null, stockQty: stock, isAvailable: formData.get('available') === 'on' } });
  await audit(s.id, 'variant.update', 'ProductVariant', id, { price, mrp, stock });
  revalidatePath('/admin/products');
}

export async function toggleProduct(formData: FormData) {
  const s = await requireRole(['ADMIN']);
  const id = String(formData.get('productId'));
  const action = String(formData.get('action'));
  if (action === 'archive') await db.product.update({ where: { id }, data: { archivedAt: new Date(), isAvailable: false } });
  else await db.product.update({ where: { id }, data: { isAvailable: action === 'enable' } });
  await audit(s.id, `product.${action}`, 'Product', id);
  revalidatePath('/admin/products');
}

export async function updateShop(formData: FormData) {
  const s = await requireRole(['ADMIN']);
  const id = String(formData.get('shopId'));
  await db.shop.update({ where: { id }, data: {
    name: String(formData.get('name')).trim().slice(0, 80), description: String(formData.get('description') ?? '').slice(0, 300),
    opensAt: String(formData.get('opensAt')), closesAt: String(formData.get('closesAt')),
    deliveryEtaMin: Math.max(5, parseInt(String(formData.get('eta')), 10) || 40),
    minOrderPaise: Math.max(0, Math.round(parseFloat(String(formData.get('minOrder')) || '0') * 100)),
    isActive: formData.get('active') === 'on',
  } });
  await audit(s.id, 'shop.update', 'Shop', id);
  revalidatePath('/admin/shops');
}

export async function saveSettingsAction(formData: FormData) {
  const s = await requireRole(['ADMIN']);
  const patch: Record<string, unknown> = {};
  for (const f of SETTING_FIELDS) {
    const raw = formData.get(f.key);
    if (f.type === 'checkbox') patch[f.key] = raw === 'on';
    else if (f.type === 'rupees') patch[f.key] = raw === '' || raw === null ? null : Math.round(parseFloat(String(raw)) * 100);
    else if (f.type === 'number') patch[f.key] = parseInt(String(raw), 10) || 0;
    else patch[f.key] = String(raw ?? '').trim().slice(0, 300);
  }
  if (patch.freeDeliveryAbovePaise === null) patch.freeDeliveryAbovePaise = null;
  await saveSettings(patch as Partial<SiteSettings>);
  await audit(s.id, 'settings.update', 'Setting', 'site', { keys: Object.keys(patch) }); // values (incl. numbers) are not logged
  revalidatePath('/', 'layout');
  redirect('/admin/settings?saved=1');
}

export async function addZone(formData: FormData) {
  const s = await requireRole(['ADMIN']);
  const pincode = String(formData.get('pincode') ?? '').trim();
  if (!/^\d{6}$/.test(pincode)) redirect('/admin/settings?error=pin');
  await db.deliveryZone.upsert({ where: { pincode }, update: { isActive: true }, create: { pincode, label: String(formData.get('label') ?? '') || null } });
  await audit(s.id, 'zone.add', 'DeliveryZone', pincode);
  redirect('/admin/settings?saved=1');
}
