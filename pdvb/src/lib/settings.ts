import { cache } from 'react';
import { db } from './db';

export type SiteSettings = {
  businessName: string;
  tagline: string;
  logoUrl: string;
  phone: string;            // shown to customers, e.g. "+91 98765 43210"
  whatsappNumber: string;   // digits with country code, e.g. "919876543210"
  email: string;
  address: string;
  serviceArea: string;
  deliveryFeePaise: number;
  freeDeliveryAbovePaise: number | null;
  minOrderPaise: number;
  taxBps: number;
  codEnabled: boolean;
  codMaxPaise: number;
  medicineEnabled: boolean;     // keep false until you hold the required pharmacy authorisation
  pharmacyContactName: string;
  pharmacyContactPhone: string;
  storeOpensAt: string;
  storeClosesAt: string;
  // WhatsApp Business Cloud API (non-secret parts; the access token lives in env only)
  whatsappBusinessRecipient: string; // number that receives order alerts
  whatsappPhoneNumberId: string;
  whatsappApiVersion: string;
  whatsappTemplateName: string;
  whatsappTemplateLang: string;
  announcement: string;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  businessName: 'PDVB',
  tagline: 'Everything your neighbourhood needs, delivered to your door.',
  logoUrl: '',
  phone: '+91 00000 00000',
  whatsappNumber: '910000000000',
  email: 'hello@example.com',
  address: 'Add your shop address in Admin > Settings',
  serviceArea: 'Add your delivery area in Admin > Settings',
  deliveryFeePaise: 3000,
  freeDeliveryAbovePaise: 49900,
  minOrderPaise: 10000,
  taxBps: 0,
  codEnabled: true,
  codMaxPaise: 200000,
  medicineEnabled: false,
  pharmacyContactName: '',
  pharmacyContactPhone: '',
  storeOpensAt: '08:00',
  storeClosesAt: '22:00',
  whatsappBusinessRecipient: '',
  whatsappPhoneNumberId: '',
  whatsappApiVersion: 'v21.0',
  whatsappTemplateName: 'pdvb_new_order',
  whatsappTemplateLang: 'en',
  announcement: 'Free delivery on orders above ₹499',
};

export const getSettings = cache(async (): Promise<SiteSettings> => {
  const row = await db.setting.findUnique({ where: { key: 'site' } });
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<SiteSettings>) ?? {}) };
});

export async function saveSettings(patch: Partial<SiteSettings>) {
  const current = await getSettings();
  const value = { ...current, ...patch };
  await db.setting.upsert({ where: { key: 'site' }, create: { key: 'site', value }, update: { value } });
}

/** Contact links. Phone/email/WhatsApp are never hard-coded in components. */
export function contactLinks(s: SiteSettings, orderNumber?: string) {
  const digits = s.phone.replace(/[^\d+]/g, '');
  const msg = orderNumber
    ? `Hi ${s.businessName}, I need help with order ${orderNumber}.`
    : `Hi ${s.businessName}, I have a question.`;
  return {
    tel: `tel:${digits}`,
    whatsapp: `https://wa.me/${s.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`,
    mailto: `mailto:${s.email}?subject=${encodeURIComponent(orderNumber ? `Help with order ${orderNumber}` : `Question for ${s.businessName}`)}`,
  };
}
