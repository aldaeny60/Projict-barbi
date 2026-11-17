import { db } from "@/db";
import { coupons } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { formatIQD } from "@/lib/format";
import { getCouponDiscount } from "@/lib/order-utils";

export const dynamic = "force-dynamic";

/** تحقق من كود خصم — يستخدم نفس منطق الخادم عند إنشاء الطلب (حد استخدام + انتهاء) */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { code?: string; subtotal?: number; phone?: string };
  const code = (body.code ?? "").trim().toUpperCase();
  const subtotal = Math.round(Number(body.subtotal ?? 0));
  if (!code) return Response.json({ valid: false, message: "أدخل كود الخصم" });

  const [c] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
  if (!c) return Response.json({ valid: false, message: "كود الخصم غير موجود" });

  const { discount, reason } = await getCouponDiscount(code, subtotal, { phone: body.phone ?? null });
  if (!discount) {
    const message =
      reason === "الطلب أقل من الحد الأدنى للكود"
        ? `هذا الكود يتطلب حد أدنى للطلب ${formatIQD(c.minSubtotal)}`
        : reason ?? "هذا الكود غير صالح";
    return Response.json({ valid: false, message });
  }

  return Response.json({
    valid: true,
    discount,
    code: c.code,
    description: c.description,
    message:
      c.type === "percent"
        ? `تم تطبيق خصم ${c.value}% بنجاح`
        : `تم تطبيق خصم ${formatIQD(c.value)} بنجاح`,
  });
}
