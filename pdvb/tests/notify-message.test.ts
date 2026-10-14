import { describe, it, expect } from 'vitest';
import { buildOrderText, buildTemplateParams, sanitizeParam, type MessageOrder } from '@/lib/notify-message';

const order = (over: Partial<MessageOrder> = {}): MessageOrder => ({
  number: 'PDVB-260101-AB12C', customerName: 'Test Customer', phone: '9876543210', addressLine: '12 Main Road', locality: 'Sample Nagar', pincode: '110001',
  instructions: null, paymentMethod: 'ONLINE', subtotalPaise: 24000, discountPaise: 0, deliveryFeePaise: 3000, taxPaise: 0, totalPaise: 27000, createdAt: new Date('2026-01-01T05:00:00Z'),
  items: [{ name: 'Chicken Biryani', variantLabel: 'Full', qty: 1, lineTotalPaise: 24000, categorySlug: 'food' }], payment: { status: 'PAID', providerPaymentId: 'pay_123' }, ...over,
});

describe('WhatsApp message', () => {
  it('labels online orders PAID with the payment reference', () => {
    const t = buildOrderText(order(), 'ORDER_PAID');
    expect(t).toContain('NEW PAID ORDER'); expect(t).toContain('Payment Status: PAID'); expect(t).toContain('pay_123'); expect(t).toContain('₹270');
  });
  it('never labels COD orders as paid', () => {
    const t = buildOrderText(order({ paymentMethod: 'COD', payment: { status: 'PENDING', providerPaymentId: null } }), 'ORDER_COD');
    expect(t).toContain('NOT YET PAID'); expect(t).not.toContain('Payment Status: PAID'); expect(t).not.toContain('Total Paid');
  });
  it('template params have no newlines and are 8 long', () => {
    const p = buildTemplateParams(order({ instructions: 'Ring\nthe bell' }), 'ORDER_PAID');
    expect(p).toHaveLength(8); p.forEach((x) => expect(x).not.toMatch(/[\n\t]/));
  });
  it('sanitizeParam never returns empty', () => expect(sanitizeParam('')).toBe('-'));
});
