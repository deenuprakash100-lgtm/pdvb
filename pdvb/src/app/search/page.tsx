import { listProducts } from '@/lib/catalog';
import { ProductCard } from '@/components/ProductCard';
import { FilterBar, parseFilters } from '@/components/FilterBar';
import { getSettings } from '@/lib/settings';

export const metadata = { title: 'Search' };

export default async function SearchPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const f = parseFilters(searchParams);
  const [settings, products] = await Promise.all([getSettings(), f.q ? listProducts({ ...f }) : Promise.resolve([])]);
  return (
    <div>
      <h1 className="mb-4 text-3xl font-bold">{f.q ? `Results for "${f.q}"` : 'Search'}</h1>
      <FilterBar params={searchParams} />
      {!f.q ? <p className="rounded-xl bg-mist p-6 text-center">Type a product or shop name to start.</p>
        : products.length === 0 ? <p className="rounded-xl bg-mist p-6 text-center">Nothing found for "{f.q}". Check the spelling or try a broader word like "rice" or "chicken".</p>
        : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{products.map((p) => <ProductCard key={p.id} product={p} blockCheckoutNote={p.category.slug === 'medicine' && !settings.medicineEnabled ? 'Medicine checkout is not enabled yet.' : undefined} />)}</div>}
    </div>
  );
}
