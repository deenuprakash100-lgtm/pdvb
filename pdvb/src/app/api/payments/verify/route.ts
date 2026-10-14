import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { verifyCheckoutSignature } from '@/lib/signatures';
import { markPaymentFailed, markPaymentPaid, razorpayClient } from '@/lib/payments';

const schema = z.object({
  razorpay_order_id: z.string().min(5),
  razorpay_payment_id: z.string().min(5),
  razorpay_signature: z.string().min(10),
});

/**
 * Called by the browser after Razorpay Checkout succeeds. The browser's claim is NOT trusted:
 * we verify the HMAC signature AND re-fetch the payment from Razorpay before marking anything paid.
 * The webhook is the independent second path (covers closed tabs / network loss).
 */
export async function POST(req: Request) {
  if (!rateLimit(`verify:${clientIp(req)}`, 20, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data;

  const secret = process.env.RAZORPAY_KEY_SECRET ?? '';
  if (!verifyCheckoutSignature(orderId, paymentId, signature, secret)) {
    return NextResponse.json({ error: 'Payment signature mismatch' }, { status: 400 });
  }

  const payment = await db.payment.findUnique({ where: { providerOrderId: orderId } });
  if (!payment) return NextResponse.json({ error: 'Unknown payment' }, { status: 404 });

  const remote = await razorpayClient().payments.fetch(paymentId);
  if (remote.order_id !== orderId) return NextResponse.json({ error: 'Payment does not match this order' }, { status: 400 });

  if (remote.status === 'captured') {
    const r = await markPaymentPaid({ providerOrderId: orderId, providerPaymentId: paymentId, amountPaise: Number(remote.amount) });
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 409 });
    return NextResponse.json({ status: 'PAID' });
  }
  if (remote.status === 'authorized') {
    // Money is held but not captured yet. Wait for the payment.captured webhook (or enable auto-capture in Razorpay).
    await db.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'AUTHORIZED', providerPaymentId: paymentId } });
    return NextResponse.json({ status: 'PROCESSING' });
  }
  if (remote.status === 'failed') {
    await markPaymentFailed(orderId, 'Payment failed at provider');
    return NextResponse.json({ status: 'FAILED' });
  }
  return NextResponse.json({ status: 'PENDING' });
}
