import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { logoutAction } from './actions';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  return (
    <div>
      {s && (
        <nav aria-label="Admin" className="mb-6 flex flex-wrap items-center gap-2 rounded-xl bg-ink p-2 text-sm text-white">
          {[['/admin', 'Dashboard'], ['/admin/orders', 'Orders'], ['/admin/products', 'Products'], ['/admin/shops', 'Shops'], ['/admin/settings', 'Settings']].map(([h, t]) => <Link key={h} href={h!} className="rounded-lg px-3 py-1.5 hover:bg-white/10">{t}</Link>)}
          <span className="ml-auto text-white/70">{s.name} ({s.role.toLowerCase()})</span>
          <form action={logoutAction}><button className="rounded-lg px-3 py-1.5 hover:bg-white/10">Sign out</button></form>
        </nav>
      )}
      {children}
    </div>
  );
}
