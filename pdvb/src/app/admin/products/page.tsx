import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { toggleProduct, updateVariant } from '../actions';

export const metadata = { title: 'Products' };

export default async function AdminProducts({ searchParams }: { searchParams: { q?: string; category?: string } }) {
  const s = await requireRole(['ADMIN', 'STAFF']);
  const canEdit = s.role === 'ADMIN';
  const products = await db.product.findMany({
    where: { archivedAt: null, ...(searchParams.category && { category: { slug: searchParams.category } }), ...(searchParams.q && { name: { contains: searchParams.q, mode: 'insensitive' } }) },
    include: { variants: { orderBy: { sortOrder: 'asc' } }, category: true, shop: true }, orderBy: [{ categoryId: 'asc' }, { name: 'asc' }], take: 150,
  });
  return (
    <div>
      <h1 className="mb-1 text-3xl font-bold">Products</h1>
      <p className="mb-4 text-sm text-ink/70">Edit prices (₹), original price, stock and availability per size. {canEdit ? '' : 'Only admins can edit.'}</p>
      <form className="mb-4 flex gap-2"><input name="q" defaultValue={searchParams.q} placeholder="Search products" className="input max-w-xs" aria-label="Search products" />
        <select name="category" defaultValue={searchParams.category ?? ''} className="input w-auto" aria-label="Category"><option value="">All categories</option>{['food', 'groceries', 'vegetables', 'meat', 'medicine'].map((c) => <option key={c}>{c}</option>)}</select><button className="btn-ghost">Filter</button></form>
      <div className="space-y-3">
        {products.map((p) => (
          <div key={p.id} className="rounded-xl border border-ink/10 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{p.name}</p><span className="text-xs text-ink/60">{p.category.name}{p.shop ? ` · ${p.shop.name}` : ''}</span>
              <span className={`rounded px-2 text-xs ${p.isAvailable ? 'bg-leaf/10 text-leaf' : 'bg-chili/10 text-chili'}`}>{p.isAvailable ? 'On sale' : 'Paused'}</span>
              {canEdit && <form action={toggleProduct} className="ml-auto flex gap-2"><input type="hidden" name="productId" value={p.id} />
                <button name="action" value={p.isAvailable ? 'pause' : 'enable'} className="btn-ghost px-2 py-1 text-xs">{p.isAvailable ? 'Pause sales' : 'Resume sales'}</button>
                <button name="action" value="archive" className="btn-ghost px-2 py-1 text-xs text-chili">Archive</button></form>}</div>
            {p.variants.map((v) => (
              <form key={v.id} action={updateVariant} className="mt-2 flex flex-wrap items-center gap-2 text-sm"><input type="hidden" name="variantId" value={v.id} />
                <span className="w-24 font-medium">{v.label}</span>
                <label className="flex items-center gap-1">₹<input name="price" type="number" step="0.01" min="0" required defaultValue={v.pricePaise / 100} className="input w-24" aria-label={`${p.name} ${v.label} price`} disabled={!canEdit} /></label>
                <label className="flex items-center gap-1">MRP<input name="mrp" type="number" step="0.01" min="0" defaultValue={v.mrpPaise ? v.mrpPaise / 100 : ''} className="input w-24" aria-label={`${p.name} ${v.label} original price`} disabled={!canEdit} /></label>
                <label className="flex items-center gap-1">Stock<input name="stock" type="number" min="0" required defaultValue={v.stockQty} className="input w-20" aria-label={`${p.name} ${v.label} stock`} disabled={!canEdit} /></label>
                <label className="flex items-center gap-1"><input name="available" type="checkbox" defaultChecked={v.isAvailable} disabled={!canEdit} /> Available</label>
                {canEdit && <button className="btn-primary px-3 py-1.5">Save</button>}</form>))}
          </div>))}
      </div>
    </div>
  );
}
