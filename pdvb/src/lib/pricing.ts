/**
 * Pure pricing logic (no database, no browser input trusted).
 * All amounts are integer paise.
 */
export type CouponRule = {
  code: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  maxDiscountPaise: number | null;
  minOrderPaise: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
};

export type CouponResult = { ok: true; discountPaise: number } | { ok: false; reason: string };

export function validateCoupon(rule: CouponRule, subtotalPaise: number, now: Date = new Date()): CouponResult {
  if (!rule.isActive) return { ok: false, reason: 'This coupon is not active.' };
  if (rule.startsAt && now < rule.startsAt) return { ok: false, reason: 'This coupon is not valid yet.' };
  if (rule.expiresAt && now > rule.expiresAt) return { ok: false, reason: 'This coupon has expired.' };
  if (rule.usageLimit !== null && rule.usedCount >= rule.usageLimit) return { ok: false, reason: 'This coupon has reached its usage limit.' };
  if (subtotalPaise < rule.minOrderPaise) {
    return { ok: false, reason: `Add items worth ₹${Math.ceil((rule.minOrderPaise - subtotalPaise) / 100)} more to use this coupon.` };
  }
  let discount = rule.type === 'PERCENT' ? Math.floor((subtotalPaise * rule.value) / 100) : rule.value;
  if (rule.maxDiscountPaise !== null) discount = Math.min(discount, rule.maxDiscountPaise);
  discount = Math.max(0, Math.min(discount, subtotalPaise));
  return { ok: true, discountPaise: discount };
}

export type TotalsInput = {
  lines: { unitPricePaise: number; qty: number }[];
  discountPaise?: number;
  deliveryFeePaise: number;
  freeDeliveryAbovePaise: number | null; // null = never free
  taxBps: number;                         // 0 = prices already include tax; 500 = 5% added on top
};

export type Totals = {
  subtotalPaise: number;
  discountPaise: number;
  deliveryFeePaise: number;
  taxPaise: number;
  totalPaise: number;
};

export function computeTotals(input: TotalsInput): Totals {
  const subtotalPaise = input.lines.reduce((sum, l) => sum + l.unitPricePaise * l.qty, 0);
  const discountPaise = Math.min(input.discountPaise ?? 0, subtotalPaise);
  const taxable = subtotalPaise - discountPaise;
  const free = input.freeDeliveryAbovePaise !== null && taxable >= input.freeDeliveryAbovePaise;
  const deliveryFeePaise = subtotalPaise === 0 || free ? 0 : input.deliveryFeePaise;
  const taxPaise = Math.round((taxable * input.taxBps) / 10000);
  return {
    subtotalPaise,
    discountPaise,
    deliveryFeePaise,
    taxPaise,
    totalPaise: taxable + deliveryFeePaise + taxPaise,
  };
}
