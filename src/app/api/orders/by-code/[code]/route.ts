import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { checkRateLimit, clientKey, rateLimited } from "@/lib/rate-limit";
import { customerFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/by-code/[code]
 * يُرجع معرّف الطلب وحالة دفعه لصاحبه فقط (جلسة OTP) — تحتاجه صفحة نتيجة الدفع
 * لإعادة المحاولة. لا يكشف أي بيانات أخرى، ويمنع تعداد الأكواد بحدّ معدل.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const rl = checkRateLimit(clientKey(req, "order-by-code"), 30, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);

  const session = customerFromRequest(req);
  if (!session) {
    return Response.json({ error: "سجّلي برقمك لعرض الطلب" }, { status: 401 });
  }

  const [order] = await db
    .select({ id: orders.id, phone: orders.phone, paymentStatus: orders.paymentStatus, paymentMethod: orders.paymentMethod })
    .from(orders)
    .where(eq(orders.code, code))
    .limit(1);

  if (!order || order.phone !== session.phone) {
    return Response.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  return Response.json({
    order: {
      id: order.id,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
    },
  });
}
