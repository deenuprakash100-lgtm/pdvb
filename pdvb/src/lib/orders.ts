import { db } from './db';
import type { OrderStatus, Prisma } from '@prisma/client';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: 'Pending confirmation',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready for pickup',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const STATUS_FLOW: OrderStatus[] = ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export async function addHistory(
  tx: Prisma.TransactionClient,
  orderId: string,
  from: OrderStatus | null,
  to: OrderStatus,
  actorLabel: string,
  actorId?: string,
  note?: string,
) {
  await tx.orderStatusHistory.create({ data: { orderId, fromStatus: from, toStatus: to, actorLabel, actorId, note } });
}

/** Cancels an order and returns stock. Does NOT refund money: refunds go through the payment provider (see admin). */
export async function cancelOrder(orderId: string, actorLabel: string, actorId: string | undefined, note: string) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    if (order.status === 'CANCELLED' || order.status === 'DELIVERED') return false;
    for (const item of order.items) {
      await tx.productVariant.update({ where: { id: item.variantId }, data: { stockQty: { increment: item.qty } } });
    }
    if (order.couponCode) {
      await tx.coupon.updateMany({ where: { code: order.couponCode, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
    }
    await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
    await addHistory(tx, orderId, order.status, 'CANCELLED', actorLabel, actorId, note);
    return true;
  });
}
