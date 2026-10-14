import Link from 'next/link';
import type { SiteSettings } from '@/lib/settings';
import { ContactActions } from './ContactActions';

export function Footer({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="mt-12 bg-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="font-display text-xl font-bold">{settings.businessName}</p>
          <p className="mt-2 text-sm text-white/70">{settings.address}</p>
          <p className="mt-1 text-sm text-white/70">Delivery area: {settings.serviceArea}</p>
          <p className="mt-1 text-sm text-white/70">Hours: {settings.storeOpensAt} to {settings.storeClosesAt}</p>
        </div>
        <nav aria-label="Company" className="text-sm">
          <ul className="space-y-2">
            {[['/about', 'About us'], ['/contact', 'Contact'], ['/policies/terms', 'Terms and conditions'], ['/policies/privacy', 'Privacy policy'], ['/policies/refunds', 'Refund and cancellation policy'], ['/policies/delivery', 'Delivery policy']].map(([h, t]) => (
              <li key={h}><Link className="text-white/80 hover:text-white" href={h!}>{t}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="text-ink">
          <p className="mb-2 text-sm text-white/80">Need help with an order?</p>
          <ContactActions settings={settings} />
        </div>
      </div>
    </footer>
  );
}
