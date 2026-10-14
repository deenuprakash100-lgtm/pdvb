'use client';
import Link from 'next/link';
import { useCart } from './CartProvider';
import { CartIcon, SearchIcon } from './Icons';
import type { SiteSettings } from '@/lib/settings';

export function Header({ settings }: { settings: SiteSettings }) {
  const { count } = useCart();
  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-white/95 backdrop-blur">
      {settings.announcement && <div className="bg-saffron px-4 py-1.5 text-center text-xs font-semibold text-ink">{settings.announcement}</div>}
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-2xl font-extrabold text-ink">
          {settings.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={settings.logoUrl} alt="" className="h-8 w-8 rounded" /> : <span className="grid h-8 w-8 place-items-center rounded bg-leaf text-sm text-white">P</span>}
          {settings.businessName}
        </Link>
        <form action="/search" className="relative ml-2 hidden flex-1 md:block" role="search">
          <input name="q" className="input pl-10" placeholder="Search products or shops" aria-label="Search products or shops" />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/50"><SearchIcon /></span>
        </form>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden rounded-lg bg-mist px-3 py-2 text-xs font-medium lg:block">Delivering in {settings.serviceArea.length > 28 ? 'your area' : settings.serviceArea}</span>
          <Link href="/track" className="btn-ghost hidden sm:inline-flex">Track order</Link>
          <Link href="/cart" className="btn-primary relative" aria-label={`Cart, ${count} items`}>
            <CartIcon /> <span>Cart</span>
            {count > 0 && <span className="ml-1 rounded-full bg-saffron px-2 text-xs text-ink">{count}</span>}
          </Link>
        </div>
      </div>
      <form action="/search" className="px-4 pb-3 md:hidden" role="search">
        <input name="q" className="input" placeholder="Search products or shops" aria-label="Search products or shops" />
      </form>
    </header>
  );
}
