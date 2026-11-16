import { db } from "@/db";
import { coupons, deliveryFees, orders } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function getCouponDiscount(code: string | null | undefined, subtotal: number) {
  if (!code) return { discount: 0, coupon: null, reason: null as string | null };
  const [c] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase())).limit(1);
  if (!c || !c.active) return { discount: 0, coupon: null, reason: "كود الخصم غير موجود أو غير مفعّل" };
  if (c.expiresAt && c.expiresAt < new Date())
    return { discount: 0, coupon: null, reason: "انتهت صلاحية هذا الكود" };
  if (c.maxUses !== null && c.usedCount >= c.maxUses)
    return { discount: 0, coupon: null, reason: "انتهى عدد استخدامات هذا الكود" };
  if (subtotal < c.minSubtotal)
    return { discount: 0, coupon: null, reason: "الطلب أقل من الحد الأدنى للكود" };
  const discount = c.type === "percent" ? Math.round((subtotal * c.value) / 100) : c.value;
  return { discount: Math.min(discount, subtotal), coupon: c, reason: null as string | null };
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

/**
 * مفتاح تقرير التكرار من العميل: يُقبل إن كان 8–64 حرفاً آمنة، وإلا يُهمَل
 * (لا نرفض الطلب بسبب مفتاح تالف — نتعامل معه كطلب بلا مفتاح).
 */
export function cleanRequestKey(value: unknown): string | null {
  const key = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(key)) return null;
  return key;
}
