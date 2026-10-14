import { notFound } from 'next/navigation';
import { getSettings } from '@/lib/settings';

const TITLES: Record<string, string> = { terms: 'Terms and conditions', privacy: 'Privacy policy', refunds: 'Refund and cancellation policy', delivery: 'Delivery policy' };

export default async function Policy({ params }: { params: { slug: string } }) {
  const title = TITLES[params.slug];
  if (!title) notFound();
  const s = await getSettings();
  return (
    <article className="max-w-prose space-y-3">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="rounded-lg bg-saffron/20 p-3 text-sm"><strong>Template text.</strong> Replace this with policies reviewed by a qualified professional before launch. They must reflect how {s.businessName} actually operates.</p>
      {params.slug === 'delivery' && <p>We deliver within: {s.serviceArea}. Delivery fee ₹{s.deliveryFeePaise / 100}{s.freeDeliveryAbovePaise ? `, free above ₹${s.freeDeliveryAbovePaise / 100}` : ''}. Minimum order ₹{s.minOrderPaise / 100}.</p>}
      {params.slug === 'refunds' && <p>Describe cancellation windows, how refunds are processed through the original payment method, and how long they take.</p>}
      {params.slug === 'privacy' && <p>Describe what customer data you collect (name, phone, address, order history), why, who can access it, and how long you keep it. We do not sell personal data.</p>}
      {params.slug === 'terms' && <p>Describe ordering, pricing, availability, cancellation, and liability terms. Medicines are sold only through an authorised pharmacy and only against valid prescriptions where required.</p>}
    </article>
  );
}
