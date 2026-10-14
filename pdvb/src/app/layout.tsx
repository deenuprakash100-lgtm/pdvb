import type { Metadata } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';
import { getSettings } from '@/lib/settings';
import { CartProvider } from '@/components/CartProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display' });
const body = Figtree({ subsets: ['latin'], variable: '--font-body' });

// Pages read live data (prices, stock, settings), so render on demand.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return { title: { default: `${s.businessName} - local delivery`, template: `%s | ${s.businessName}` }, description: s.tagline };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable}`}>
      <body>
        <CartProvider>
          <Header settings={settings} />
          <main className="mx-auto min-h-[60vh] max-w-6xl px-4 py-6">{children}</main>
          <Footer settings={settings} />
        </CartProvider>
      </body>
    </html>
  );
}
