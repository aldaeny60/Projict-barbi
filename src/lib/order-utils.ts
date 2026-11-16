import { db } from "@/db";
import { coupons, deliveryFees, orders } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function getCouponDiscount(code: string | null | undefined, subtotal: number) {
  if (!code) return { discount: 0, coupon: null };
  const [c] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase())).limit(1);
  if (!c || !c.active) return { discount: 0, coupon: null };
  if (c.expiresAt && c.expiresAt < new Date()) return { discount: 0, coupon: null };
  if (subtotal < c.minSubtotal) return { discount: 0, coupon: null };
  const discount = c.type === "percent" ? Math.round((subtotal * c.value) / 100) : c.value;
  return { discount: Math.min(discount, subtotal), coupon: c };
}

export async function computeDeliveryFee(governorate: string | null | undefined) {
  if (!governorate) return 0;
  const [row] = await db
    .select()
    .from(deliveryFees)
    .where(eq(deliveryFees.governorate, governorate))
    .limit(1);
  return row?.fee ?? 5000;
}

export async function nextOrderCode(prefix: string) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(orders);
  return `${prefix}-${10001 + Number(n)}`;
}
