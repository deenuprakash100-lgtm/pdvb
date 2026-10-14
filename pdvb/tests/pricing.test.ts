import { describe, it, expect } from 'vitest';
import { computeTotals, validateCoupon, type CouponRule } from '@/lib/pricing';

const base: CouponRule = { code: 'X', type: 'PERCENT', value: 10, maxDiscountPaise: 10000, minOrderPaise: 50000, startsAt: null, expiresAt: null, usageLimit: null, usedCount: 0, isActive: true };

describe('computeTotals', () => {
  it('adds delivery fee below free-delivery threshold', () => {
    const t = computeTotals({ lines: [{ unitPricePaise: 10000, qty: 2 }], deliveryFeePaise: 3000, freeDeliveryAbovePaise: 49900, taxBps: 0 });
    expect(t).toMatchObject({ subtotalPaise: 20000, deliveryFeePaise: 3000, totalPaise: 23000 });
  });
  it('waives delivery at the threshold', () => {
    const t = computeTotals({ lines: [{ unitPricePaise: 49900, qty: 1 }], deliveryFeePaise: 3000, freeDeliveryAbovePaise: 49900, taxBps: 0 });
    expect(t.deliveryFeePaise).toBe(0);
  });
  it('applies discount before tax and never goes negative', () => {
    const t = computeTotals({ lines: [{ unitPricePaise: 10000, qty: 1 }], discountPaise: 99999, deliveryFeePaise: 0, freeDeliveryAbovePaise: null, taxBps: 500 });
    expect(t.discountPaise).toBe(10000);
    expect(t.totalPaise).toBe(0);
  });
  it('uses integer rounding for tax', () => {
    const t = computeTotals({ lines: [{ unitPricePaise: 3333, qty: 1 }], deliveryFeePaise: 0, freeDeliveryAbovePaise: null, taxBps: 500 });
    expect(t.taxPaise).toBe(167);
    expect(Number.isInteger(t.totalPaise)).toBe(true);
  });
});

describe('validateCoupon', () => {
  it('caps percent discounts', () => expect(validateCoupon(base, 200000)).toEqual({ ok: true, discountPaise: 10000 }));
  it('enforces minimum order', () => expect(validateCoupon(base, 1000).ok).toBe(false));
  it('rejects expired coupons', () => expect(validateCoupon({ ...base, expiresAt: new Date('2020-01-01') }, 60000).ok).toBe(false));
  it('rejects exhausted coupons', () => expect(validateCoupon({ ...base, usageLimit: 5, usedCount: 5 }, 60000).ok).toBe(false));
  it('rejects inactive coupons', () => expect(validateCoupon({ ...base, isActive: false }, 60000).ok).toBe(false));
  it('flat coupon cannot exceed subtotal', () => expect(validateCoupon({ ...base, type: 'FLAT', value: 99999, maxDiscountPaise: null, minOrderPaise: 0 }, 5000)).toEqual({ ok: true, discountPaise: 5000 }));
});
