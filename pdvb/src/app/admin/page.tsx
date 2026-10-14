import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatINR } from '@/lib/money';

export const metadata = { title: 'Admin dashboard' };

function istDayStart(): Date {
  const ist = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  return new Date(`${ist}T00:00:00+05:30`);
}

export default async function Dashboard() {
  await requireRole(['ADMIN', 'STAFF']);
  const today = istDayStart();
  const live = { status: { not: 'CANCELLED' as const } };
  const [todayCount, total, pending, completed, online, cod, codDue, top] = await Promise.all([
    db.order.count({ where: { createdAt: { gte: today }, ...live } }),
    db.order.count(),
    db.order.count({ where: { status: { in: ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'] } } }),
    db.order.count({ where: { status: 'DELIVERED' } }),
    db.payment.aggregate({ _sum: { amountPaise: true }, where: { method: 'ONLINE', status: 'PAID' } }),
    db.order.aggregate({ _sum: { totalPaise: true }, where: { paymentMethod: 'COD', codCollectedAt: { not: null } } }),
    db.order.aggregate({ _sum: { totalPaise: true }, where: { paymentMethod: 'COD', codCollectedAt: null, status: { not: 'CANCELLED' } } }),
    db.orderItem.groupBy({ by: ['name'], _sum: { qty: true }, where: { order: live }, orderBy: { _sum: { qty: 'desc' } }, take: 5 }),
  ]);
  const cards: [string, string][] = [
    ['Orders today', String(todayCount)], ['All orders', String(total)], ['Open orders', String(pending)], ['Delivered', String(completed)],
    ['Online payments received', formatINR(online._sum.amountPaise ?? 0)], ['COD cash collected', formatINR(cod._sum.totalPaise ?? 0)], ['COD cash still to collect', formatINR(codDue._sum.totalPaise ?? 0)],
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map(([l, v]) => <div key={l} className="rounded-xl border border-ink/10 bg-white p-4"><p className="text-sm text-ink/60">{l}</p><p className="font-display text-2xl font-bold">{v}</p></div>)}</div>
      <section className="rounded-xl border border-ink/10 bg-white p-4"><h2 className="mb-2 font-display text-lg font-bold">Top-selling products</h2>
        {top.length === 0 ? <p className="text-ink/60">No orders yet.</p> : <ol className="space-y-1 text-sm">{top.map((t) => <li key={t.name} className="flex justify-between"><span>{t.name}</span><span>{t._sum.qty} sold</span></li>)}</ol>}</section>
    </div>
  );
}
