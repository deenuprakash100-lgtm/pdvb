import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { formatINR } from '@/lib/money';
import { STATUS_FLOW, STATUS_LABELS } from '@/lib/orders';
import { ContactActions } from '@/components/ContactActions';
import { StatusPoller } from '@/components/StatusPoller';

export const metadata = { title: 'Your order' };

const PAY_LABEL: Record<string, string> = { PENDING: 'Pending', AUTHORIZED: 'Processing', PAID: 'Paid', FAILED: 'Failed', REFUND_PENDING: 'Refund pending', PARTIALLY_REFUNDED: 'Partially refunded', REFUNDED: 'Refunded' };

export default async function OrderPage({ params, searchParams }: { params: { number: string }; searchParams: { t?: string } }) {
  const order = await db.order.findUnique({ where: { number: params.number }, include: { items: true, payment: true, history: { orderBy: { createdAt: 'asc' } } } });
  // The unguessable token in the URL is the access control: no token, no address or phone shown.
  if (!order || !searchParams.t || searchParams.t !== order.accessToken) notFound();
  const settings = await getSettings();
  const cod = order.paymentMethod === 'COD';
  const payStatus = cod ? (order.codCollectedAt ? 'Paid (cash collected)' : 'Cash to be paid on delivery') : PAY_LABEL[order.payment?.status ?? 'PENDING'];
  const waiting = !cod && ['PENDING', 'AUTHORIZED'].includes(order.payment?.status ?? 'PENDING') && order.status !== 'CANCELLED';
  const stepIndex = STATUS_FLOW.indexOf(order.status);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <StatusPoller active={waiting} />
      <div className="rounded-2xl bg-mist p-5">
        <h1 className="text-2xl font-bold">{waiting ? 'Confirming your payment...' : order.status === 'CANCELLED' ? 'Order cancelled' : 'Thank you, your order is placed'}</h1>
        <p className="mt-1">Order ID <strong>{order.number}</strong></p>
        {waiting && <p className="mt-2 text-sm">This usually takes a few seconds. If you were charged, your order will be confirmed automatically. Do not pay again.</p>}
      </div>
      <section className="rounded-xl border border-ink/10 bg-white p-4">
        <h2 className="mb-2 font-display text-lg font-bold">Status: {STATUS_LABELS[order.status]}</h2>
        {order.status !== 'CANCELLED' && <ol className="flex flex-wrap gap-2 text-xs">{STATUS_FLOW.map((s, i) => <li key={s} className={`rounded-full px-3 py-1 ${i <= stepIndex ? 'bg-leaf text-white' : 'bg-mist text-ink/60'}`}>{STATUS_LABELS[s]}</li>)}</ol>}
        <ul className="mt-3 space-y-1 text-xs text-ink/60">{order.history.map((h) => <li key={h.id}>{h.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}: {STATUS_LABELS[h.toStatus]}</li>)}</ul>
      </section>
      <section className="rounded-xl border border-ink/10 bg-white p-4">
        <ul className="divide-y divide-ink/10 text-sm">{order.items.map((i) => <li key={i.id} className="flex justify-between py-2"><span>{i.name} ({i.variantLabel}) x {i.qty}</span><span>{formatINR(i.lineTotalPaise)}</span></li>)}</ul>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(order.subtotalPaise)}</dd></div>
          {order.discountPaise > 0 && <div className="flex justify-between text-leaf"><dt>Discount</dt><dd>-{formatINR(order.discountPaise)}</dd></div>}
          <div className="flex justify-between"><dt>Delivery</dt><dd>{order.deliveryFeePaise ? formatINR(order.deliveryFeePaise) : 'Free'}</dd></div>
          <div className="flex justify-between border-t border-ink/10 pt-2 text-lg font-bold"><dt>{cod ? 'Total due' : 'Total'}</dt><dd>{formatINR(order.totalPaise)}</dd></div>
        </dl>
        <p className="mt-3 text-sm">Payment: {cod ? 'Cash on delivery' : 'Online'} · {payStatus}</p>
        <p className="mt-1 text-sm text-ink/70">Delivering to {order.addressLine}, {order.locality} - {order.pincode}</p>
      </section>
      <div><p className="mb-2 text-sm text-ink/70">Need help with this order?</p><ContactActions settings={settings} orderNumber={order.number} /></div>
    </div>
  );
}
