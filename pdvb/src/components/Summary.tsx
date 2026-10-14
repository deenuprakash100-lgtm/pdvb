import { formatINR } from '@/lib/money';
import type { Quote } from '@/lib/quote';

export function Summary({ quote }: { quote: Quote }) {
  const t = quote.totals;
  const row = (l: string, v: string, cls = '') => <div className={`flex justify-between py-1 ${cls}`}><dt>{l}</dt><dd>{v}</dd></div>;
  return (
    <dl className="text-sm">
      {row('Subtotal', formatINR(t.subtotalPaise))}
      {t.discountPaise > 0 && row(`Discount${quote.couponCode ? ` (${quote.couponCode})` : ''}`, `-${formatINR(t.discountPaise)}`, 'text-leaf')}
      {row('Delivery fee', t.deliveryFeePaise === 0 ? 'Free' : formatINR(t.deliveryFeePaise))}
      {t.taxPaise > 0 && row('Tax', formatINR(t.taxPaise))}
      {row('Total', formatINR(t.totalPaise), 'mt-1 border-t border-ink/10 pt-2 text-lg font-bold')}
    </dl>
  );
}
