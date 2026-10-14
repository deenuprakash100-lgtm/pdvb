import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatINR } from '@/lib/money';
import { STATUS_LABELS } from '@/lib/orders';
import { getSettings } from '@/lib/settings';
import { buildOrderText, type MessageOrder } from '@/lib/notify-message';
import { clickToChatUrl } from '@/lib/notify';
import { recordCodCollection, requestRefund, retryNotification, updateOrderStatus } from '../../actions';

const ERRORS: Record<string, string> = { closed: 'This order is already closed.', unpaid: 'Online payment has not been verified yet, so this order cannot move forward.', cod: 'COD can only be recorded once, after the order is delivered.', refund: 'Only verified online payments can be refunded.', reason: 'Enter a reason for the refund.' };

export default async function OrderDetail({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  const session = await requireRole(['ADMIN', 'STAFF']);
  const o = await db.order.findUnique({ where: { id: params.id }, include: { items: true, payment: true, history: { orderBy: { createdAt: 'desc' } }, notifications: { include: { logs: { orderBy: { createdAt: 'desc' }, take: 5 } } }, refunds: true } });
  if (!o) notFound();
  const settings = await getSettings();
  const kind = o.paymentMethod === 'COD' ? 'ORDER_COD' : 'ORDER_PAID';
  const canChat = o.paymentMethod === 'COD' || o.payment?.status === 'PAID';
  const chatUrl = canChat && settings.whatsappBusinessRecipient ? clickToChatUrl(settings.whatsappBusinessRecipient, buildOrderText(o as unknown as MessageOrder, kind)) : null;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">{o.number}</h1>
      {searchParams.error && <p role="alert" className="rounded-lg bg-chili/10 p-3 text-sm text-chili">{ERRORS[searchParams.error] ?? 'Action not allowed.'}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-ink/10 bg-white p-4 text-sm"><h2 className="mb-2 font-display text-lg font-bold">Customer</h2>
          <p>{o.customerName} · <a className="underline" href={`tel:${o.phone}`}>{o.phone}</a>{o.email && <> · {o.email}</>}</p>
          <p>{o.addressLine}, {o.locality} - {o.pincode}</p><p className="mt-1">Instructions: {o.instructions || 'None'}</p></section>
        <section className="rounded-xl border border-ink/10 bg-white p-4 text-sm"><h2 className="mb-2 font-display text-lg font-bold">Payment</h2>
          <p>{o.paymentMethod === 'COD' ? 'Cash on delivery' : 'Online'} · {o.paymentMethod === 'COD' ? (o.codCollectedAt ? 'Cash collected' : 'NOT YET PAID') : o.payment?.status}</p>
          {o.payment?.providerPaymentId && <p className="break-all text-ink/70">Ref: {o.payment.providerPaymentId}</p>}
          <p className="mt-1 text-lg font-bold">{formatINR(o.totalPaise)}</p>
          {o.paymentMethod === 'COD' && o.status === 'DELIVERED' && !o.codCollectedAt && <form action={recordCodCollection} className="mt-2"><input type="hidden" name="orderId" value={o.id} /><button className="btn-primary">Record cash collected ({formatINR(o.totalPaise)})</button></form>}
          {session.role === 'ADMIN' && o.paymentMethod === 'ONLINE' && o.payment?.status === 'PAID' && (
            <form action={requestRefund} className="mt-2 flex gap-2"><input type="hidden" name="orderId" value={o.id} /><input name="reason" required placeholder="Refund reason" className="input" aria-label="Refund reason" /><button className="btn-ghost">Refund in full</button></form>)}
          {o.refunds.map((r) => <p key={r.id} className="mt-1 text-xs">Refund {formatINR(r.amountPaise)}: {r.status} ({r.reason})</p>)}
        </section>
      </div>
      <section className="rounded-xl border border-ink/10 bg-white p-4 text-sm"><h2 className="mb-2 font-display text-lg font-bold">Items</h2>
        <ul>{o.items.map((i) => <li key={i.id} className="flex justify-between py-0.5"><span>{i.name} ({i.variantLabel}) x {i.qty}</span><span>{formatINR(i.lineTotalPaise)}</span></li>)}</ul></section>
      {o.status !== 'CANCELLED' && o.status !== 'DELIVERED' && (
        <form action={updateOrderStatus} className="flex flex-wrap gap-2 rounded-xl border border-ink/10 bg-white p-4"><input type="hidden" name="orderId" value={o.id} />
          <select name="status" className="input w-auto" defaultValue={o.status} aria-label="New status">{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input name="note" placeholder="Note (optional)" className="input w-auto flex-1" /><button className="btn-primary">Update status</button></form>)}
      <section className="rounded-xl border border-ink/10 bg-white p-4 text-sm"><h2 className="mb-2 font-display text-lg font-bold">WhatsApp notifications</h2>
        {o.notifications.length === 0 && <p className="text-ink/60">None queued yet{o.paymentMethod === 'ONLINE' ? ' (online orders notify only after verified payment).' : '.'}</p>}
        {o.notifications.map((n) => (
          <div key={n.id} className="mb-3 rounded-lg bg-mist p-3"><p><strong>{n.kind}</strong> · {n.status} · attempts {n.attempts}{n.status === 'DEMO' && ' (demo mode: NOT actually sent)'}</p>
            {n.lastError && <p className="text-chili">{n.lastError}</p>}
            <ul className="mt-1 text-xs text-ink/70">{n.logs.map((l) => <li key={l.id}>{l.createdAt.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} {l.status}: {l.detail}</li>)}</ul>
            {n.status !== 'SENT' && n.status !== 'DELIVERED' && n.status !== 'READ' && <form action={retryNotification} className="mt-2"><input type="hidden" name="jobId" value={n.id} /><input type="hidden" name="orderId" value={o.id} /><button className="btn-ghost">Retry sending</button></form>}</div>))}
        {chatUrl && <p className="mt-2"><a className="btn-ghost" href={chatUrl} target="_blank" rel="noopener noreferrer">Open WhatsApp with this order</a><span className="ml-2 text-xs text-ink/60">Opens a prefilled chat. You must press Send; nothing is sent automatically.</span></p>}</section>
      <section className="rounded-xl border border-ink/10 bg-white p-4 text-sm"><h2 className="mb-2 font-display text-lg font-bold">History</h2>
        <ul className="space-y-1">{o.history.map((h) => <li key={h.id}>{h.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · {STATUS_LABELS[h.toStatus]} · {h.actorLabel}{h.note && ` · ${h.note}`}</li>)}</ul></section>
    </div>
  );
}
