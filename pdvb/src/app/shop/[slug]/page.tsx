import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { listProducts } from '@/lib/catalog';
import { getSettings } from '@/lib/settings';
import { ProductCard } from '@/components/ProductCard';
import { ContactActions } from '@/components/ContactActions';
import { formatINR } from '@/lib/money';

export default async function ShopPage({ params }: { params: { slug: string } }) {
  const shop = await db.shop.findUnique({ where: { slug: params.slug } });
  if (!shop) notFound();
  const [settings, products] = await Promise.all([getSettings(), listProducts({ shopSlug: shop.slug })]);
  const groups = Array.from(new Set(products.map((p) => p.group ?? 'Menu')));
  return (
    <div>
      <div className="mb-6 rounded-2xl bg-mist p-5">
        <h1 className="text-3xl font-bold">{shop.name}</h1>
        <p className="text-ink/70">{shop.description}</p>
        <p className="mt-2 text-sm">{shop.isActive ? <span className="font-semibold text-leaf">Accepting orders</span> : <span className="font-semibold text-chili">Currently closed</span>} · Open {shop.opensAt} to {shop.closesAt} · about {shop.deliveryEtaMin} min · minimum order {formatINR(shop.minOrderPaise)}</p>
        <div className="mt-3"><ContactActions settings={settings} /></div>
      </div>
      {groups.map((g) => (
        <section key={g} className="mb-8"><h2 className="mb-3 text-xl font-bold">{g}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.filter((p) => (p.group ?? 'Menu') === g).map((p) => <ProductCard key={p.id} product={{ ...p, isAvailable: p.isAvailable && shop.isActive }} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
