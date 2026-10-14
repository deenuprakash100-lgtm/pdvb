import Razorpay from 'razorpay';
import { db } from './db';
import { addHistory } from './orders';
import { enqueueWhatsApp, processDueJobs } from './notify';

export function razorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error('Razorpay keys are not configured.');
  return new Razorpay({ key_id, key_secret });
}

/**
 * Idempotent "payment succeeded" transition. Safe to call from the browser-verify route AND from the webhook,
 * in any order and any number of times. Only the first call changes state and enqueues the WhatsApp job.
 * The caller MUST have verified the payment with Razorpay first (signature + API fetch, or webhook signature).
 */
export async function markPaymentPaid(args: { providerOrderId: string; providerPaymentId: string; amountPaise: number }) {
  const payment = await db.payment.findUnique({ where: { providerOrderId: args.providerOrderId }, include: { order: true } });
  if (!payment) return { ok: false as const, reason: 'payment_not_found' };
  if (payment.amountPaise !== args.amountPaise) return { ok: false as const, reason: 'amount_mismatch' };

  const changed = await db.$transaction(async (tx) => {
    const res = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: ['PENDING', 'AUTHORIZED', 'FAILED'] } },
      data: { status: 'PAID', providerPaymentId: args.providerPaymentId, paidAt: new Date(), failureReason: null },
    });
    if (res.count === 0) return false; // already paid (or refunded): nothing to do
    if (payment.order.status === 'PENDING_CONFIRMATION') {
      await tx.order.update({ where: { id: payment.orderId }, data: { status: 'CONFIRMED' } });
      await addHistory(tx, payment.orderId, 'PENDING_CONFIRMATION', 'CONFIRMED', 'system', undefined, 'Online payment verified');
    }
    await enqueueWhatsApp(tx, payment.orderId, 'ORDER_PAID');
    return true;
  });

  if (changed) {
    try { await processDueJobs(5); } catch { /* the queue/cron will retry */ }
  }
  return { ok: true as const, changed, orderId: payment.orderId };
}

export async function markPaymentFailed(providerOrderId: string, reason: string) {
  await db.payment.updateMany({
    where: { providerOrderId, status: { in: ['PENDING', 'AUTHORIZED'] } },
    data: { status: 'FAILED', failureReason: reason.slice(0, 300) },
  });
}
