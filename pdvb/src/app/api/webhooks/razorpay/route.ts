import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/signatures';
import { markPaymentFailed, markPaymentPaid } from '@/lib/payments';
import { Prisma } from '@prisma/client';

type Entity = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function POST(req: Request) {
  const raw = await req.text(); // signature is computed over the RAW body
  const sig = req.headers.get('x-razorpay-signature');
  if (!verifyWebhookSignature(raw, sig, process.env.RAZORPAY_WEBHOOK_SECRET ?? '')) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  const eventId = req.headers.get('x-razorpay-event-id');
  if (!eventId) return NextResponse.json({ error: 'Missing event id' }, { status: 400 });

  const body = JSON.parse(raw) as { event: string; payload: Record<string, { entity: Entity }> };

  // Idempotency: Razorpay retries deliveries; the unique event id makes duplicates harmless.
  try {
    await db.paymentWebhookEvent.create({ data: { providerEventId: eventId, type: body.event, payload: body as unknown as Prisma.InputJsonValue } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const prev = await db.paymentWebhookEvent.findUnique({ where: { providerEventId: eventId } });
      if (prev?.processedAt) return NextResponse.json({ ok: true, duplicate: true });
      // Previous attempt crashed before finishing: fall through and process again (handlers are idempotent).
    } else throw err;
  }

  try {
    const payment = body.payload.payment?.entity;
    switch (body.event) {
      case 'payment.captured':
      case 'order.paid': {
        const p = payment ?? undefined;
        if (p) await markPaymentPaid({ providerOrderId: p.order_id, providerPaymentId: p.id, amountPaise: Number(p.amount) });
        break;
      }
      case 'payment.authorized':
        if (payment) await db.payment.updateMany({ where: { providerOrderId: payment.order_id, status: 'PENDING' }, data: { status: 'AUTHORIZED', providerPaymentId: payment.id } });
        break;
      case 'payment.failed':
        if (payment) await markPaymentFailed(payment.order_id, payment.error_description ?? 'Payment failed');
        break;
      case 'refund.processed': {
        const refund = body.payload.refund?.entity;
        if (refund) {
          await db.refund.updateMany({ where: { providerRefundId: refund.id }, data: { status: 'PROCESSED' } });
          const pay = await db.payment.findUnique({ where: { providerPaymentId: refund.payment_id }, include: { refunds: true } });
          if (pay) {
            const refunded = pay.refunds.filter((r) => r.status === 'PROCESSED').reduce((s, r) => s + r.amountPaise, 0);
            await db.payment.update({ where: { id: pay.id }, data: { status: refunded >= pay.amountPaise ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
          }
        }
        break;
      }
      default:
        break; // ignore events we do not use
    }
    await db.paymentWebhookEvent.update({ where: { providerEventId: eventId }, data: { processedAt: new Date(), error: null } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    await db.paymentWebhookEvent.update({ where: { providerEventId: eventId }, data: { error: String(err).slice(0, 500) } });
    return NextResponse.json({ error: 'processing failed' }, { status: 500 }); // non-2xx => Razorpay retries
  }
}
