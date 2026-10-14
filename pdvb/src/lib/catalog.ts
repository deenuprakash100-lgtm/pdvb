import { db } from './db';
import type { Prisma } from '@prisma/client';

export const productInclude = { variants: { orderBy: { sortOrder: 'asc' } }, shop: true, category: true } satisfies Prisma.ProductInclude;

export type ListParams = {
  categorySlug?: string; shopSlug?: string; q?: string; min?: number; max?: number; inStock?: boolean;
  sort?: 'popular' | 'price_asc' | 'price_desc'; featured?: boolean; take?: number;
};

export async function listProducts(p: ListParams) {
  const where: Prisma.ProductWhereInput = {
    archivedAt: null,
    ...(p.categorySlug && { category: { slug: p.categorySlug } }),
    ...(p.shopSlug && { shop: { slug: p.shopSlug } }),
    ...(p.featured && { isFeatured: true }),
    ...(p.inStock && { isAvailable: true, variants: { some: { isAvailable: true, stockQty: { gt: 0 } } } }),
    ...(p.q && { OR: [{ name: { contains: p.q, mode: 'insensitive' } }, { shop: { name: { contains: p.q, mode: 'insensitive' } } }, { group: { contains: p.q, mode: 'insensitive' } }] }),
    ...((p.min !== undefined || p.max !== undefined) && { variants: { some: { pricePaise: { ...(p.min !== undefined && { gte: p.min * 100 }), ...(p.max !== undefined && { lte: p.max * 100 }) } } } }),
  };
  const products = await db.product.findMany({ where, include: productInclude, take: p.take ?? 120, orderBy: [{ popularity: 'desc' }, { name: 'asc' }] });
  const minPrice = (x: (typeof products)[number]) => Math.min(...x.variants.map((v) => v.pricePaise));
  if (p.sort === 'price_asc') products.sort((a, b) => minPrice(a) - minPrice(b));
  if (p.sort === 'price_desc') products.sort((a, b) => minPrice(b) - minPrice(a));
  return products;
}
