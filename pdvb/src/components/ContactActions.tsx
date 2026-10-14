import { contactLinks, type SiteSettings } from '@/lib/settings';
import { ChatIcon, MailIcon, PhoneIcon } from './Icons';

export function ContactActions({ settings, orderNumber }: { settings: SiteSettings; orderNumber?: string }) {
  const l = contactLinks(settings, orderNumber);
  return (
    <div className="flex flex-wrap gap-2">
      <a className="btn-ghost" href={l.tel}><PhoneIcon /> Call</a>
      <a className="btn-ghost" href={l.whatsapp} target="_blank" rel="noopener noreferrer"><ChatIcon /> WhatsApp</a>
      <a className="btn-ghost" href={l.mailto}><MailIcon /> Email</a>
    </div>
  );
}
