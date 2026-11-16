import { db } from "@/db";
import { orderItems, orderReturns, orderReturnItems } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * مساعدات المرتجعات — تُستخدم في مسار الطلب وفي مسار الإرجاع الجزئي
 * حتى لا يُعاد المخزون مرتين لنفس القطعة.
 */

/** الكمية المسترجعة فعلاً لكل سطر فاتورة */
export async function returnedQtyByItem(orderId: number): Promise<Map<number, number>> {
  const rows = await db
    .select({
      orderItemId: orderReturnItems.orderItemId,
      qty: sql<number>`coalesce(sum(${orderReturnItems.qty}), 0)`,
    })
    .from(orderReturnItems)
    .innerJoin(orderReturns, eq(orderReturnItems.returnId, orderReturns.id))
    .where(eq(orderReturns.orderId, orderId))
    .groupBy(orderReturnItems.orderItemId);
  return new Map(rows.map((r) => [r.orderItemId, Number(r.qty)]));
}

/** إجمالي المبلغ المسترد لطلب */
export async function refundTotalForOrder(orderId: number): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${orderReturns.amount}), 0)` })
    .from(orderReturns)
    .where(eq(orderReturns.orderId, orderId));
  return Number(row?.total ?? 0);
}

/** كمية كل سطر في الفاتورة — للحساب خارج المعاملة */
export async function orderItemsOf(orderId: number) {
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}
