import Link from 'next/link';
import { db } from '@/lib/db';
import { listProducts } from '@/lib/catalog';
import { getSettings } from '@/lib/settings';
import { formatINR } from '@/lib/money';
import { ProductCard } from '@/components/ProductCard';
import { ContactActions } from '@/components/ContactActions';

const TILE: Record<string, string> = {
  food: 'bg-saffron text-ink', groceries: 'bg-leaf text-white', vegetables: 'bg-[#2E8B57] text-white', meat: 'bg-chili text-white', medicine: 'bg-ink text-white',
};

export default async function Home() {
  const [settings, categories, shops, popular, deals, coupons] = await Promise.all([
    getSettings(),
    db.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.shop.findMany({ where: { isActive: true }, include: { category: true }, take: 6 }),
    listProducts({ featured: true, take: 8 }),
    db.productVariant.findMany({ where: { mrpPaise: { not: null }, isAvailable: true, product: { archivedAt: null, isAvailable: true } }, include: { product: { include: { category: true, shop: true, variants: { orderBy: { sortOrder: 'asc' } } } } }, take: 40 }),
    db.coupon.findMany({ where: { isActive: true }, take: 2 }),
  ]);
  const dealProducts = Array.from(new Map(deals.filter((v) => v.mrpPaise! > v.pricePaise).map((v) => [v.product.id, v.product])).values()).slice(0, 4);

  return (
    <div className="space-y-12">
      <section className="grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-end">
        <div>
          <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-5xl">{settings.tagline}</h1>
          <p className="mt-3 max-w-prose text-ink/70">Order from local kitchens, grocers, vegetable sellers and butchers in one cart. Pay online or on delivery.</p>
          <form action="/search" className="mt-5 flex max-w-xl gap-2" role="search">
            <input name="q" className="input" placeholder="Try biryani, milk, tomatoes..." aria-label="Search" />
            <button className="btn-primary">Search</button>
          </form>
        </div>
        <div className="rounded-2xl bg-mist p-5">
          <p className="font-display text-lg font-bold">Delivery information</p>
          <ul className="mt-2 space-y-1 text-sm text-ink/80">
            <li>Area: {settings.serviceArea}</li>
            <li>Delivery fee {formatINR(settings.deliveryFeePaise)}{settings.freeDeliveryAbovePaise ? `, free above ${formatINR(settings.freeDeliveryAbovePaise)}` : ''}</li>
            <li>Minimum order {formatINR(settings.minOrderPaise)}</li>
          </ul>
          <div className="mt-3"><ContactActions settings={settings} /></div>
        </div>
      </section>

      <section aria-labelledby="cats">
        <h2 id="cats" className="mb-4 text-2xl font-bold">What do you need today?</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {categories.map((c) => (
            <Link key={c.id} href={`/c/${c.slug}`} className={`flex min-h-36 flex-col justify-between rounded-2xl p-4 transition-transform hover:-translate-y-0.5 ${TILE[c.slug] ?? 'bg-leaf text-white'}`}>
              <span className="text-4xl" aria-hidden>{c.emoji}</span>
              <span><span className="block font-display text-lg font-bold leading-tight">{c.name}</span><span className="text-xs opacity-80">{c.tagline}</span></span>
            </Link>
          ))}
        </div>
      </section>

      {coupons.length > 0 && (
        <section aria-label="Offers" className="flex flex-wrap gap-3">
          {coupons.map((c) => (
            <div key={c.id} className="flex-1 rounded-xl border-2 border-dashed border-saffron bg-white p-4">
              <p className="text-sm text-ink/70">{c.description}</p>
              <p className="font-display text-xl font-extrabold">Use code {c.code}</p>
            </div>
          ))}
        </section>
      )}

      {dealProducts.length > 0 && (
        <section><h2 className="mb-4 text-2xl font-bold">Discounted today</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{dealProducts.map((p) => <ProductCard key={p.id} product={p} blockCheckoutNote={p.category.slug === 'medicine' && !settings.medicineEnabled ? 'Medicine checkout is not enabled yet.' : undefined} />)}</div></section>
      )}

      <section><h2 className="mb-4 text-2xl font-bold">Popular picks</h2>
        {popular.length === 0 ? <p className="text-ink/60">No featured products yet. Mark products as featured in the admin.</p> :
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{popular.map((p) => <ProductCard key={p.id} product={p} />)}</div>}
      </section>

      <section><h2 className="mb-4 text-2xl font-bold">Food shops near you</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((s) => (
            <Link key={s.id} href={`/shop/${s.slug}`} className="rounded-xl border border-ink/10 bg-white p-4 hover:border-leaf">
              <p className="font-display text-lg font-bold">{s.name}</p>
              <p className="text-sm text-ink/70">{s.description}</p>
              <p className="mt-2 text-xs text-ink/60">Open {s.opensAt} to {s.closesAt} · about {s.deliveryEtaMin} min</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
