import { db } from './db';
import { getSettings } from './settings';
import { computeTotals, validateCoupon, type Totals } from './pricing';

export type QuoteInput = {
  items: { variantId: string; qty: number }[];
  couponCode?: string;
  pincode?: string;
  paymentMethod?: 'ONLINE' | 'COD';
};

export type QuoteLine = {
  variantId: string;
  productId: string;
  name: string;
  variantLabel: string;
  categorySlug: string;
  shopId: string | null;
  shopName: string | null;
  unitPricePaise: number;
  mrpPaise: number | null;
  qty: number;
  lineTotalPaise: number;
  requiresPrescription: boolean;
};

export type Quote = {
  lines: QuoteLine[];
  totals: Totals;
  couponCode: string | null;
  shopId: string | null;
  codAllowed: boolean;
  errors: string[];
};

const MAX_QTY = 20;

/**
 * The single source of truth for prices. Used by the cart preview AND by checkout.
 * The browser only sends variant IDs and quantities; it never sends prices.
 */
export async function buildQuote(input: QuoteInput, now = new Date()): Promise<Quote> {
  const settings = await getSettings();
  const errors: string[] = [];

  const ids = Array.from(new Set(input.items.map((i) => i.variantId)));
  const variants = await db.productVariant.findMany({
    where: { id: { in: ids } },
    include: { product: { include: { category: true, shop: true } } },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const lines: QuoteLine[] = [];
  for (const item of input.items) {
    const v = byId.get(item.variantId);
    if (!v || v.product.archivedAt) {
      errors.push('An item in your cart is no longer sold. Please remove it.');
      continue;
    }
    const qty = Math.max(1, Math.min(MAX_QTY, Math.floor(item.qty)));
    const shopOpen = !v.product.shop || v.product.shop.isActive;
    if (!v.isAvailable || !v.product.isAvailable || !shopOpen) {
      errors.push(`${v.product.name} (${v.label}) is currently unavailable.`);
    } else if (v.stockQty < qty) {
      errors.push(`Only ${v.stockQty} of ${v.product.name} (${v.label}) left in stock.`);
    }
    lines.push({
      variantId: v.id,
      productId: v.productId,
      name: v.product.name,
      variantLabel: v.label,
      categorySlug: v.product.category.slug,
      shopId: v.product.shopId,
      shopName: v.product.shop?.name ?? null,
      unitPricePaise: v.pricePaise,
      mrpPaise: v.mrpPaise,
      qty,
      lineTotalPaise: v.pricePaise * qty,
      requiresPrescription: v.product.requiresPrescription,
    });
  }

  // Food: one shop per order (each shop prepares and dispatches separately).
  const foodShops = new Set(lines.filter((l) => l.categorySlug === 'food' && l.shopId).map((l) => l.shopId));
  if (foodShops.size > 1) {
    errors.push('Food from different shops needs separate orders. Please order from one shop at a time.');
  }
  const shopId = foodShops.size === 1 ? Array.from(foodShops)[0]! : null;

  // Medicine rules.
  const medicineLines = lines.filter((l) => l.categorySlug === 'medicine');
  if (medicineLines.length > 0) {
    if (!settings.medicineEnabled) {
      errors.push('Medicine ordering is not enabled yet. Please contact our partner pharmacy directly.');
    } else if (medicineLines.some((l) => l.requiresPrescription)) {
      errors.push('Prescription medicines can only be ordered after a pharmacist verifies your prescription. Please contact the pharmacy.');
    }
  }

  // Coupon.
  const subtotalPreview = lines.reduce((s, l) => s + l.lineTotalPaise, 0);
  let discountPaise = 0;
  let couponCode: string | null = null;
  if (input.couponCode?.trim()) {
    const coupon = await db.coupon.findUnique({ where: { code: input.couponCode.trim().toUpperCase() } });
    if (!coupon) {
      errors.push('That coupon code is not valid.');
    } else {
      const res = validateCoupon(coupon, subtotalPreview, now);
      if (res.ok) {
        discountPaise = res.discountPaise;
        couponCode = coupon.code;
      } else {
        errors.push(res.reason);
      }
    }
  }

  // Delivery zone & fee.
  const shop = shopId ? await db.shop.findUnique({ where: { id: shopId } }) : null;
  const zone = input.pincode ? await db.deliveryZone.findUnique({ where: { pincode: input.pincode } }) : null;
  if (input.pincode && (!zone || !zone.isActive)) {
    errors.push(`We do not deliver to PIN code ${input.pincode} yet. Our service area: ${settings.serviceArea}.`);
  }
  const deliveryFeePaise = zone?.deliveryFeePaise ?? shop?.deliveryFeePaise ?? settings.deliveryFeePaise;

  const totals = computeTotals({
    lines,
    discountPaise,
    deliveryFeePaise,
    freeDeliveryAbovePaise: settings.freeDeliveryAbovePaise,
    taxBps: settings.taxBps,
  });

  const minOrder = Math.max(settings.minOrderPaise, shop?.minOrderPaise ?? 0);
  if (lines.length > 0 && totals.subtotalPaise < minOrder) {
    errors.push(`Minimum order is ₹${minOrder / 100}. Add items worth ₹${Math.ceil((minOrder - totals.subtotalPaise) / 100)} more.`);
  }

  const codAllowed =
    settings.codEnabled && totals.totalPaise <= settings.codMaxPaise && (zone ? zone.codAllowed : true) &&
    medicineLines.length === 0;
  if (input.paymentMethod === 'COD' && !codAllowed) {
    errors.push('Cash on Delivery is not available for this order. Please pay online.');
  }

  if (lines.length === 0) errors.push('Your cart is empty.');

  return { lines, totals, couponCode, shopId, codAllowed, errors };
}
