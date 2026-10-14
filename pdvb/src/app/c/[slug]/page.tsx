import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { listProducts } from '@/lib/catalog';
import { getSettings, contactLinks } from '@/lib/settings';
import { ProductCard } from '@/components/ProductCard';
import { FilterBar, parseFilters } from '@/components/FilterBar';

export default async function CategoryPage({ params, searchParams }: { params: { slug: string }; searchParams: Record<string, string | undefined> }) {
  const category = await db.category.findUnique({ where: { slug: params.slug } });
  if (!category) notFound();
  const settings = await getSettings();

  if (category.slug === 'food') {
    const shops = await db.shop.findMany({ where: { categoryId: category.id }, orderBy: { name: 'asc' } });
    return (
      <div>
        <h1 className="text-3xl font-bold">{category.emoji} {category.name}</h1>
        <p className="mb-6 text-ink/70">Pick a shop to see its menu. Each order can include items from one shop only.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((s) => (
            <Link key={s.id} href={`/shop/${s.slug}`} className={`rounded-xl border bg-white p-4 ${s.isActive ? 'border-ink/10 hover:border-leaf' : 'pointer-events-none opacity-60'}`}>
              <p className="font-display text-lg font-bold">{s.name} {!s.isActive && <span className="text-sm font-normal text-chili">(closed)</span>}</p>
              <p className="text-sm text-ink/70">{s.description}</p>
              <p className="mt-2 text-xs text-ink/60">Open {s.opensAt} to {s.closesAt} · about {s.deliveryEtaMin} min · min order ₹{s.minOrderPaise / 100}</p>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const f = parseFilters(searchParams);
  const products = await listProducts({ categorySlug: category.slug, ...f });
  const groups = Array.from(new Set(products.map((p) => p.group ?? 'Other')));
  const medicineBlocked = category.slug === 'medicine' && !settings.medicineEnabled;
  const links = contactLinks(settings);

  return (
    <div>
      <h1 className="text-3xl font-bold">{category.emoji} {category.name}</h1>
      <p className="mb-4 text-ink/70">{category.tagline}</p>
      {category.slug === 'medicine' && (
        <div className="mb-6 rounded-xl border border-saffron bg-saffron/15 p-4 text-sm">
          <p className="font-semibold">{medicineBlocked ? 'Online medicine ordering is not available yet.' : 'Prescription medicines need pharmacist verification.'}</p>
          <p className="mt-1">{settings.pharmacyContactName ? `Please contact ${settings.pharmacyContactName}` : 'Please contact our partner pharmacy'}{settings.pharmacyContactPhone ? ` on ${settings.pharmacyContactPhone}` : ''} to place a medicine order.
            {' '}<a className="font-semibold underline" href={links.whatsapp}>Message us on WhatsApp</a>.</p>
        </div>
      )}
      <FilterBar params={searchParams} />
      {products.length === 0 ? <p className="rounded-xl bg-mist p-6 text-center">No products match these filters. Try clearing the price range or the in-stock filter.</p> :
        groups.map((g) => (
          <section key={g} className="mb-8"><h2 className="mb-3 text-xl font-bold">{g}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {products.filter((p) => (p.group ?? 'Other') === g).map((p) => <ProductCard key={p.id} product={p} blockCheckoutNote={medicineBlocked ? 'Checkout disabled for medicines.' : undefined} />)}
            </div>
          </section>
        ))}
    </div>
  );
}
