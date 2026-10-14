import { getSettings } from '@/lib/settings';
import { ContactActions } from '@/components/ContactActions';

export const metadata = { title: 'Contact us' };

export default async function Contact() {
  const s = await getSettings();
  return (
    <div className="max-w-xl space-y-3">
      <h1 className="text-3xl font-bold">Contact us</h1>
      <p>Phone: {s.phone}</p><p>Email: {s.email}</p><p>Address: {s.address}</p><p>Delivery area: {s.serviceArea}</p><p>Hours: {s.storeOpensAt} to {s.storeClosesAt}</p>
      <ContactActions settings={s} />
    </div>
  );
}
