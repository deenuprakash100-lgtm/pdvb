
import Link from 'next/link';
import { db } from '@/lib/db';
import { listProducts } from '@/lib/catalog';
import { getSettings } from '@/lib/settings';
import { formatINR } from '@/lib/money';
import { ProductCard } from '@/components/ProductCard';
import { ContactActions } from '@/components/ContactActions';

const CATEGORY_CONFIG = [
  {
    slug: 'food',
    title: 'Food',
    description: 'Restaurants and delicious meals',
    emoji: '🍛',
    image:
      'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=85',
    color: 'bg-orange-50',
    aliases: ['food', 'restaurant', 'restaurants'],
  },
  {
    slug: 'vegetables',
    title: 'Fresh vegetables',
    description: 'Fresh vegetables delivered daily',
    emoji: '🥦',
    image:
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=85',
    color: 'bg-green-50',
    aliases: ['vegetables', 'vegetable', 'fresh-vegetables'],
  },
  {
    slug: 'groceries',
    title: 'Rice, Dal Items',
    description: 'Rice, pulses and grocery essentials',
    emoji: '🌾',
    image:
      'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=85',
    color: 'bg-amber-50',
    aliases: ['groceries', 'grocery', 'rice-dal', 'rice-dal-items'],
  },
  {
    slug: 'meat',
    title: 'Chicken & Fish',
    description: 'Choose your preferred local shop',
    emoji: '🍗',
    image:
      'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=800&q=85',
    color: 'bg-rose-50',
    aliases: ['meat', 'chicken-fish', 'chicken', 'fish', 'seafood'],
  },
  {
    slug: 'medicine',
    title: 'Medicine',
    description: 'Healthcare and pharmacy essentials',
    emoji: '💊',
    image:
      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=85',
    color: 'bg-blue-50',
    aliases: ['medicine', 'medicines', 'pharmacy'],
  },
];

const SHOP_IMAGES = [
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=85',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=85',
  'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=85',
];

function normalizeSlug(value: string) {
  return value.toLowerCase().trim().replace(/[\s_]+/g, '-');
}

export default async function Home() {
  const [
    settings,
    categories,
    shops,
    popular,
    deals,
    coupons,
  ] = await Promise.all([
    getSettings(),

    db.category.findMany({
      orderBy: { sortOrder: 'asc' },
    }),

    db.shop.findMany({
      where: { isActive: true },
      include: { category: true },
      take: 30,
    }),

    listProducts({
      featured: true,
      take: 8,
    }),

    db.productVariant.findMany({
      where: {
        mrpPaise: { not: null },
        isAvailable: true,
        product: {
          archivedAt: null,
          isAvailable: true,
        },
      },
      include: {
        product: {
          include: {
            category: true,
            shop: true,
            variants: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
      take: 40,
    }),

    db.coupon.findMany({
      where: { isActive: true },
      take: 2,
    }),
  ]);

  const categoryBySlug = new Map(
    categories.map((category) => [
      normalizeSlug(category.slug),
      category,
    ]),
  );

  const categoryCards = CATEGORY_CONFIG.map((config) => {
    const category = config.aliases
      .map((alias) => categoryBySlug.get(alias))
      .find(Boolean);

    return {
      ...config,
      href: `/c/${category?.slug ?? config.slug}`,
    };
  });

  const dealProducts = Array.from(
    new Map(
      deals
        .filter(
          (variant) =>
            variant.mrpPaise !== null &&
            variant.mrpPaise > variant.pricePaise,
        )
        .map((variant) => [
          variant.product.id,
          variant.product,
        ]),
    ).values(),
  ).slice(0, 4);

  const restaurantShops = shops.filter((shop) =>
    ['food', 'restaurant', 'restaurants'].includes(
      normalizeSlug(shop.category.slug),
    ),
  );

  const meatShops = shops.filter((shop) =>
    ['meat', 'chicken-fish', 'chicken', 'fish', 'seafood'].includes(
      normalizeSlug(shop.category.slug),
    ),
  );

  return (
    <main className="space-y-10 sm:space-y-12">
      {/* HERO SECTION */}
      <section className="grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-center">
        <div>
          <p className="mb-3 font-bold uppercase tracking-widest text-green-700">
            Your local delivery store
          </p>

          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
            {settings.tagline}
          </h1>

          <p className="mt-4 max-w-prose text-ink/70">
            Fresh vegetables, groceries, delicious food, chicken,
            fish and pharmacy essentials delivered to your doorstep.
          </p>

          <form
            action="/search"
            className="mt-5 flex max-w-xl gap-2"
            role="search"
          >
            <input
              name="q"
              className="input min-w-0 flex-1"
              placeholder="Search rice, tomatoes, chicken..."
              aria-label="Search products"
            />

            <button type="submit" className="btn-primary">
              Search
            </button>
          </form>
        </div>

        <div className="rounded-3xl bg-green-50 p-6">
          <div className="mb-3 text-4xl" aria-hidden="true">
            🛵
          </div>

          <h2 className="font-display text-xl font-bold">
            Delivery information
          </h2>

          <ul className="mt-3 space-y-2 text-sm text-ink/80">
            <li>
              <strong>Service area:</strong> {settings.serviceArea}
            </li>

            <li>
              <strong>Delivery fee:</strong>{' '}
              {formatINR(settings.deliveryFeePaise)}
              {settings.freeDeliveryAbovePaise
                ? `, free above ${formatINR(
                    settings.freeDeliveryAbovePaise,
                  )}`
                : ''}
            </li>

            <li>
              <strong>Minimum order:</strong>{' '}
              {formatINR(settings.minOrderPaise)}
            </li>
          </ul>

          <div className="mt-4">
            <ContactActions settings={settings} />
          </div>
        </div>
      </section>

      {/* FIVE IMAGE CATEGORIES */}
      <section aria-labelledby="categories-heading">
        <div className="mb-5">
          <h2
            id="categories-heading"
            className="text-2xl font-extrabold sm:text-3xl"
          >
            Shop by category
          </h2>

          <p className="mt-1 text-sm text-ink/60">
            Everything you need, all in one place.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {categoryCards.map((category) => (
            <Link
              key={category.slug}
              href={category.href}
              className="group overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div
                className={`relative aspect-[4/3] overflow-hidden ${category.color}`}
              >
                <img
                  src={category.image}
                  alt={category.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                />

                <span className="absolute bottom-2 right-2 rounded-full bg-white/95 px-2 py-1 text-xl shadow-sm">
                  {category.emoji}
                </span>
              </div>

              <div className="p-3">
                <h3 className="font-display text-base font-bold leading-snug">
                  {category.title}
                </h3>

                <p className="mt-1 text-xs leading-relaxed text-ink/60">
                  {category.description}
                </p>

                <span className="mt-3 inline-block text-sm font-bold text-green-700">
                  Explore →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* COUPONS */}
      {coupons.length > 0 && (
        <section aria-label="Available offers">
          <h2 className="mb-4 text-2xl font-bold">
            Offers for you
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className="rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 p-5"
              >
                <p className="text-sm text-ink/70">
                  {coupon.description}
                </p>

                <p className="mt-1 text-xl font-extrabold">
                  Use code {coupon.code}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* DISCOUNTED PRODUCTS */}
      {dealProducts.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-2xl font-extrabold">
              Discounted today
            </h2>

            <p className="mt-1 text-sm text-ink/60">
              Explore products with current offers.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {dealProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                blockCheckoutNote={
                  product.category.slug === 'medicine' &&
                  !settings.medicineEnabled
                    ? 'Medicine checkout is not enabled yet.'
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* POPULAR PRODUCTS */}
      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-extrabold">
            Popular picks
          </h2>

          <p className="mt-1 text-sm text-ink/60">
            Customer favourites from your local shops.
          </p>
        </div>

        {popular.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 p-6 text-ink/60">
            No featured products yet. Add products in the admin
            panel and mark them as featured.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {popular.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                blockCheckoutNote={
                  product.category.slug === 'medicine' &&
                  !settings.medicineEnabled
                    ? 'Medicine checkout is not enabled yet.'
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* RESTAURANTS */}
      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-extrabold">
            Restaurants near you
          </h2>

          <p className="mt-1 text-sm text-ink/60">
            Choose a restaurant and explore its menu.
          </p>
        </div>

        {restaurantShops.length === 0 ? (
          <p className="rounded-xl bg-gray-50 p-5 text-sm text-ink/60">
            No active restaurants found yet. Add restaurants
            under the Food category in your admin panel.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {restaurantShops.slice(0, 3).map((shop, index) => (
              <Link
                key={shop.id}
                href={`/shop/${shop.slug}`}
                className="group overflow-hidden rounded-2xl border border-ink/10 bg-white transition hover:shadow-lg"
              >
                <div className="aspect-[16/9] overflow-hidden bg-orange-50">
                  <img
                    src={SHOP_IMAGES[index % SHOP_IMAGES.length]}
                    alt={shop.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>

                <div className="p-4">
                  <h3 className="font-display text-lg font-bold">
                    {shop.name}
                  </h3>

                  <p className="mt-1 text-sm text-ink/70">
                    {shop.description}
                  </p>

                  <p className="mt-3 text-xs text-ink/60">
                    {shop.opensAt}–{shop.closesAt}
                    {' · '}
                    About {shop.deliveryEtaMin} min
                  </p>

                  <span className="mt-3 inline-block font-bold text-green-700">
                    View menu →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* CHICKEN AND FISH SHOPS */}
      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-extrabold">
            Chicken & Fish shops
          </h2>

          <p className="mt-1 text-sm text-ink/60">
            Select a shop to browse its available cuts and fish.
          </p>
        </div>

        {meatShops.length === 0 ? (
          <p className="rounded-xl bg-gray-50 p-5 text-sm text-ink/60">
            No active chicken or fish shops found yet. Add two
            active shops under the Meat category in your admin panel.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {meatShops.slice(0, 2).map((shop, index) => (
              <Link
                key={shop.id}
                href={`/shop/${shop.slug}`}
                className="group overflow-hidden rounded-2xl border border-ink/10 bg-white transition hover:shadow-lg"
              >
                <div className="aspect-[16/9] overflow-hidden bg-rose-50">
                  <img
                    src={
                      index === 0
                        ? 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=900&q=85'
                        : 'https://images.unsplash.com/photo-1510130387422-82bed34b37e9?auto=format&fit=crop&w=900&q=85'
                    }
                    alt={shop.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>

                <div className="p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-700">
                    Shop {index + 1}
                  </p>

                  <h3 className="mt-1 font-display text-xl font-bold">
                    {shop.name}
                  </h3>

                  <p className="mt-2 text-sm text-ink/70">
                    {shop.description}
                  </p>

                  <p className="mt-3 text-xs text-ink/60">
                    Delivery in about {shop.deliveryEtaMin} min
                  </p>

                  <span className="mt-3 inline-block font-bold text-green-700">
                    Browse chicken & fish →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

