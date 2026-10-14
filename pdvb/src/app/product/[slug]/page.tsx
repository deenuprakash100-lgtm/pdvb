import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { productInclude } from '@/lib/catalog';
import { getSettings } from '@/lib/settings';
import { ProductCard } from '@/components/ProductCard';
import { ContactActions } from '@/components/ContactActions';

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await db.product.findFirst({ where: { slug: params.slug, archivedAt: null }, include: productInclude });
  if (!product) notFound();
  const settings = await getSettings();
  return (
    <div className="mx-auto max-w-md">
      <ProductCard product={product} blockCheckoutNote={product.category.slug === 'medicine' && !settings.medicineEnabled ? 'Medicine checkout is not enabled yet.' : undefined} />
      <div className="mt-6"><p className="mb-2 text-sm text-ink/70">Questions about this item?</p><ContactActions settings={settings} /></div>
    </div>
  );
}
