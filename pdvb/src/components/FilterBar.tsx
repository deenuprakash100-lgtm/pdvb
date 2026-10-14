export function FilterBar({ params, showSearch = true }: { params: Record<string, string | undefined>; showSearch?: boolean }) {
  return (
    <form className="mb-6 grid gap-2 rounded-xl border border-ink/10 bg-white p-3 sm:grid-cols-2 lg:grid-cols-6" role="search">
      {showSearch && <input name="q" defaultValue={params.q} placeholder="Search" aria-label="Search" className="input lg:col-span-2" />}
      <input name="min" type="number" min={0} defaultValue={params.min} placeholder="Min ₹" aria-label="Minimum price" className="input" />
      <input name="max" type="number" min={0} defaultValue={params.max} placeholder="Max ₹" aria-label="Maximum price" className="input" />
      <select name="sort" defaultValue={params.sort ?? 'popular'} aria-label="Sort" className="input">
        <option value="popular">Most popular</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
      </select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="inStock" value="1" defaultChecked={params.inStock === '1'} /> In stock only</label>
      <button className="btn-primary sm:col-span-2 lg:col-span-1">Apply filters</button>
    </form>
  );
}

export function parseFilters(sp: Record<string, string | undefined>) {
  const num = (v?: string) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);
  return { q: sp.q?.trim() || undefined, min: num(sp.min), max: num(sp.max), inStock: sp.inStock === '1', sort: (['price_asc', 'price_desc'].includes(sp.sort ?? '') ? sp.sort : 'popular') as 'popular' | 'price_asc' | 'price_desc' };
}
