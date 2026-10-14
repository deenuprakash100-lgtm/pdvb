import Link from 'next/link';
import { AddToCart } from './AddToCart';

type Props = {
  product: {
    slug: string; name: string; description: string; imageUrl: string | null; isAvailable: boolean; prepTimeMin: number | null;
    requiresPrescription: boolean; shop?: { name: string } | null; category: { emoji: string };
    variants: { id: string; label: string; pricePaise: number; mrpPaise: number | null; stockQty: number; isAvailable: boolean }[];
  };
  blockCheckoutNote?: string;
};

export function ProductCard({ product: p, blockCheckoutNote }: Props) {
  const variants = p.variants.map((v) => ({ id: v.id, label: v.label, pricePaise: v.pricePaise, mrpPaise: v.mrpPaise, inStock: v.isAvailable && v.stockQty > 0 }));
  const allOut = !p.isAvailable || variants.every((v) => !v.inStock);
  return (
    <article className="flex flex-col rounded-xl border border-ink/10 bg-white p-3">
      <Link href={`/product/${p.slug}`} className="block">
        <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-mist text-5xl">
          {p.imageUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.imageUrl} alt={p.name} loading="lazy" className="h-full w-full object-cover" /> : <span aria-hidden>{p.category.emoji}</span>}
        </div>
        <h3 className="mt-2 text-base font-semibold leading-tight">{p.name}</h3>
      </Link>
      {p.shop && <p className="text-xs text-ink/60">{p.shop.name}</p>}
      <p className="mb-2 mt-1 line-clamp-2 text-sm text-ink/70">{p.description}</p>
      {p.prepTimeMin && <p className="mb-2 text-xs text-ink/60">Ready in about {p.prepTimeMin} min</p>}
      {allOut ? <p className="mt-auto rounded-lg bg-chili/10 p-2 text-center text-sm font-medium text-chili">Out of stock</p>
        : p.requiresPrescription ? <p className="mt-auto rounded-lg bg-saffron/20 p-2 text-sm">Prescription required. Contact the pharmacy to order.</p>
        : <AddToCart variants={variants} name={p.name} disabled={!!blockCheckoutNote} />}
      {blockCheckoutNote && !allOut && !p.requiresPrescription && <p className="mt-1 text-xs text-ink/60">{blockCheckoutNote}</p>}
    </article>
  );
}
