import { formatINR } from './money';

export type MessageOrder = {
  number: string;
  customerName: string;
  phone: string;
  addressLine: string;
  locality: string;
  pincode: string;
  instructions: string | null;
  paymentMethod: 'ONLINE' | 'COD';
  subtotalPaise: number;
  discountPaise: number;
  deliveryFeePaise: number;
  taxPaise: number;
  totalPaise: number;
  createdAt: Date;
  items: { name: string; variantLabel: string; qty: number; lineTotalPaise: number; categorySlug: string }[];
  payment: { status: string; providerPaymentId: string | null } | null;
};

const CATEGORY_NAMES: Record<string, string> = {
  food: 'Food Delivery', groceries: 'Groceries', vegetables: 'Vegetables', meat: 'Chicken & Meat', medicine: 'Medicine',
};

export function categoriesOf(o: MessageOrder): string {
  return Array.from(new Set(o.items.map((i) => CATEGORY_NAMES[i.categorySlug] ?? i.categorySlug))).join(', ');
}

const fmtTime = (d: Date) => d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

/** Full multi-line text. Used for demo logs, click-to-chat, and free-form text messages. */
export function buildOrderText(o: MessageOrder, kind: 'ORDER_PAID' | 'ORDER_COD'): string {
  const paid = kind === 'ORDER_PAID';
  const lines = [
    paid ? 'PDVB - NEW PAID ORDER' : 'PDVB - NEW COD ORDER (NOT YET PAID)',
    '',
    `Order ID: ${o.number}`,
    `Customer: ${o.customerName}`,
    `Phone: ${o.phone}`,
    `Address: ${o.addressLine}, ${o.locality} - ${o.pincode}`,
    `Category: ${categoriesOf(o)}`,
    '',
    'Items:',
    ...o.items.map((i) => `${i.name} (${i.variantLabel}) x ${i.qty} - ${formatINR(i.lineTotalPaise)}`),
    '',
    `Subtotal: ${formatINR(o.subtotalPaise)}`,
    `Discount: ${formatINR(o.discountPaise)}`,
    `Delivery Fee: ${formatINR(o.deliveryFeePaise)}`,
    ...(o.taxPaise ? [`Tax: ${formatINR(o.taxPaise)}`] : []),
    paid ? `Total Paid: ${formatINR(o.totalPaise)}` : `Total Due (collect cash): ${formatINR(o.totalPaise)}`,
    `Payment Method: ${paid ? 'Online' : 'Cash on Delivery'}`,
    `Payment Status: ${paid ? 'PAID' : 'NOT YET PAID'}`,
    ...(paid ? [`Payment Reference: ${o.payment?.providerPaymentId ?? '-'}`] : []),
    `Order Time: ${fmtTime(o.createdAt)}`,
    `Instructions: ${o.instructions || 'None'}`,
  ];
  return lines.join('\n');
}

/** WhatsApp template parameters cannot contain newlines/tabs or runs of 4+ spaces. */
export function sanitizeParam(s: string, max = 900): string {
  return s.replace(/[\r\n\t]+/g, ' | ').replace(/ {4,}/g, '   ').trim().slice(0, max) || '-';
}

/**
 * Parameters for the approved template (see README for the exact template body):
 * {{1}} headline  {{2}} order id  {{3}} customer  {{4}} phone  {{5}} address
 * {{6}} items     {{7}} total + payment line   {{8}} instructions
 */
export function buildTemplateParams(o: MessageOrder, kind: 'ORDER_PAID' | 'ORDER_COD'): string[] {
  const paid = kind === 'ORDER_PAID';
  return [
    paid ? 'NEW PAID ORDER' : 'NEW COD ORDER - NOT YET PAID',
    o.number,
    o.customerName,
    o.phone,
    `${o.addressLine}, ${o.locality} - ${o.pincode}`,
    o.items.map((i) => `${i.name} (${i.variantLabel}) x ${i.qty} = ${formatINR(i.lineTotalPaise)}`).join('; '),
    paid
      ? `Total Paid ${formatINR(o.totalPaise)} | Online | PAID | Ref ${o.payment?.providerPaymentId ?? '-'}`
      : `Total Due ${formatINR(o.totalPaise)} | COD | NOT YET PAID`,
    o.instructions || 'None',
  ].map((p) => sanitizeParam(p));
}
