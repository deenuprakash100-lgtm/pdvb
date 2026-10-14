import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { buildQuote } from '@/lib/quote';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { newAccessToken, newOrderNumber } from '@/lib/ids';
import { addHistory, cancelOrder } from '@/lib/orders';
import { enqueueWhatsApp, processDueJobs } from '@/lib/notify';
import { razorpayClient } from '@/lib/payments';

const schema = z.object({
  items: z.array(z.object({ variantId: z.string().min(1), qty: z.number().int().min(1).max(20) })).min(1).max(50),
  couponCode: z.string().max(30).optional(),
  paymentMethod: z.enum(['ONLINE', 'COD']),
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
    email: z.string().email().max(120).optional().or(z.literal('')),
    addressLine: z.string().trim().min(5).max(200),
    locality: z.string().trim().min(2).max(80),
    pincode: z.string().regex(/^\d{6}$/, 'Enter a 6-digit PIN code'),
    instructions: z.string().max(300).optional(),
  }),
});

class StockError extends Error {}

type OrderWithPayment = Prisma.OrderGetPayload<{ include: { payment: true } }>;

function respond(order: OrderWithPayment) {
  const base = { orderNumber: order.number, accessToken: order.accessToken, paymentMethod: order.paymentMethod };
  if (order.paymentMethod === 'ONLINE' && order.payment?.status !== 'PAID' && order.payment?.providerOrderId) {
    return {
      ...base,
      razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.payment.providerOrderId,
        amount: order.totalPaise,
        currency: 'INR',
        prefill: { name: order.customerName, contact: order.phone, email: order.email ?? undefined },
      },
    };
  }
  return base;
}

export async function POST(req: Request) {
  if (!rateLimit(`checkout:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a minute and try again.' }, { status: 429 });
  }
  const idempotencyKey = req.headers.get('idempotency-key') ?? '';
  if (idempotencyKey.length < 16 || idempotencyKey.length > 80) {
    return NextResponse.json({ error: 'Missing Idempotency-Key header' }, { status: 400 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid details', issues: parsed.error.issues }, { status: 400 });
  }
  const { items, couponCode, paymentMethod, customer } = parsed.data;

  // Double-click / retry safety: the same key always returns the same order.
  const existing = await db.order.findUnique({ where: { idempotencyKey }, include: { payment: true } });
  if (existing) return NextResponse.json(respond(existing));

  const quote = await buildQuote({ items, couponCode, pincode: customer.pincode, paymentMethod });
  if (quote.errors.length > 0) return NextResponse.json({ error: quote.errors[0], errors: quote.errors }, { status: 422 });

  let order: OrderWithPayment;
  try {
    order = await db.$transaction(async (tx) => {
      // Reserve stock atomically: the WHERE guard stops overselling under concurrent orders.
      for (const l of quote.lines) {
        const r = await tx.productVariant.updateMany({
          where: { id: l.variantId, stockQty: { gte: l.qty } },
          data: { stockQty: { decrement: l.qty } },
        });
        if (r.count === 0) throw new StockError(`${l.name} just went out of stock.`);
      }
      if (quote.couponCode) {
        const c = await tx.coupon.findUniqueOrThrow({ where: { code: quote.couponCode } });
        const r = await tx.coupon.updateMany({ where: { id: c.id, usedCount: c.usedCount }, data: { usedCount: { increment: 1 } } });
        if (r.count === 0 || (c.usageLimit !== null && c.usedCount >= c.usageLimit)) throw new StockError('That coupon was just used up.');
      }
      const created = await tx.order.create({
        data: {
          number: newOrderNumber(),
          idempotencyKey,
          accessToken: newAccessToken(),
          customerName: customer.name,
          phone: customer.phone,
          email: customer.email || null,
          addressLine: customer.addressLine,
          locality: customer.locality,
          pincode: customer.pincode,
          instructions: customer.instructions || null,
          status: 'PENDING_CONFIRMATION',
          paymentMethod,
          subtotalPaise: quote.totals.subtotalPaise,
          discountPaise: quote.totals.discountPaise,
          deliveryFeePaise: quote.totals.deliveryFeePaise,
          taxPaise: quote.totals.taxPaise,
          totalPaise: quote.totals.totalPaise,
          couponCode: quote.couponCode,
          shopId: quote.shopId,
          items: {
            create: quote.lines.map((l) => ({
              variantId: l.variantId, productId: l.productId, name: l.name, variantLabel: l.variantLabel,
              categorySlug: l.categorySlug, unitPricePaise: l.unitPricePaise, qty: l.qty, lineTotalPaise: l.lineTotalPaise,
            })),
          },
          payment: { create: { method: paymentMethod, status: 'PENDING', amountPaise: quote.totals.totalPaise } },
        },
        include: { payment: true },
      });
      await addHistory(tx, created.id, null, 'PENDING_CONFIRMATION', 'customer', undefined, `Order placed (${paymentMethod})`);
      // COD: notify now (payment NOT collected). ONLINE: notify only after verified payment.
      if (paymentMethod === 'COD') await enqueueWhatsApp(tx, created.id, 'ORDER_COD');
      return created;
    });
  } catch (err) {
    if (err instanceof StockError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const again = await db.order.findUnique({ where: { idempotencyKey }, include: { payment: true } });
      if (again) return NextResponse.json(respond(again));
    }
    console.error('checkout failed', err);
    return NextResponse.json({ error: 'Could not place your order. Please try again.' }, { status: 500 });
  }

  if (paymentMethod === 'COD') {
    try { await processDueJobs(5); } catch { /* cron will retry */ }
    return NextResponse.json(respond(order));
  }

  try {
    const rzp = razorpayClient();
    const rOrder = await rzp.orders.create({
      amount: order.totalPaise, // server-calculated, in paise
      currency: 'INR',
      receipt: order.number,
      notes: { orderNumber: order.number },
    });
    const updated = await db.payment.update({ where: { orderId: order.id }, data: { providerOrderId: rOrder.id } });
    return NextResponse.json(respond({ ...order, payment: updated }));
  } catch (err) {
    console.error('razorpay order failed', err);
    await cancelOrder(order.id, 'system', undefined, 'Could not create payment session');
    return NextResponse.json({ error: 'Online payment is unavailable right now. Please try again or choose Cash on Delivery.' }, { status: 502 });
  }
}
