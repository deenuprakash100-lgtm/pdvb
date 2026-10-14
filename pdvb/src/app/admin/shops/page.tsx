import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { updateShop } from '../actions';

export const metadata = { title: 'Shops' };

export default async function AdminShops() {
  const s = await requireRole(['ADMIN', 'STAFF']);
  const shops = await db.shop.findMany({ orderBy: { name: 'asc' } });
  const ro = s.role !== 'ADMIN';
  return (
    <div><h1 className="mb-1 text-3xl font-bold">Shops</h1><p className="mb-4 text-sm text-ink/70">Rename the placeholder shops to your real partners. Disabling a shop hides its menu from checkout.</p>
      <div className="space-y-3">{shops.map((sh) => (
        <form key={sh.id} action={updateShop} className="grid gap-2 rounded-xl border border-ink/10 bg-white p-3 sm:grid-cols-6"><input type="hidden" name="shopId" value={sh.id} />
          <input name="name" defaultValue={sh.name} required className="input sm:col-span-2" aria-label="Shop name" disabled={ro} />
          <input name="description" defaultValue={sh.description} className="input sm:col-span-4" aria-label="Description" disabled={ro} />
          <label className="text-xs">Opens<input name="opensAt" type="time" defaultValue={sh.opensAt} className="input" disabled={ro} /></label>
          <label className="text-xs">Closes<input name="closesAt" type="time" defaultValue={sh.closesAt} className="input" disabled={ro} /></label>
          <label className="text-xs">ETA (min)<input name="eta" type="number" defaultValue={sh.deliveryEtaMin} className="input" disabled={ro} /></label>
          <label className="text-xs">Min order ₹<input name="minOrder" type="number" defaultValue={sh.minOrderPaise / 100} className="input" disabled={ro} /></label>
          <label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={sh.isActive} disabled={ro} /> Accepting orders</label>
          {!ro && <button className="btn-primary">Save shop</button>}</form>))}</div></div>
  );
}
