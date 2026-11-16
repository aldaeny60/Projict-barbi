import { db } from "@/db";
import { coupons } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { formatIQD } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { code?: string; subtotal?: number };
  const code = (body.code ?? "").trim().toUpperCase();
  const subtotal = Math.round(Number(body.subtotal ?? 0));
  if (!code) return Response.json({ valid: false, message: "أدخل كود الخصم" });

  const [c] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
  if (!c) return Response.json({ valid: false, message: "كود الخصم غير موجود" });
  if (!c.active) return Response.json({ valid: false, message: "هذا الكود غير مفعّل حالياً" });
  if (c.expiresAt && c.expiresAt < new Date())
    return Response.json({ valid: false, message: "انتهت صلاحية هذا الكود" });
  if (subtotal < c.minSubtotal)
    return Response.json({
      valid: false,
      message: `هذا الكود يتطلب حد أدنى للطلب ${formatIQD(c.minSubtotal)}`,
    });

  const discount = c.type === "percent" ? Math.round((subtotal * c.value) / 100) : c.value;
  return Response.json({
    valid: true,
    discount: Math.min(discount, subtotal),
    code: c.code,
    description: c.description,
    message:
      c.type === "percent"
        ? `تم تطبيق خصم ${c.value}% بنجاح`
        : `تم تطبيق خصم ${formatIQD(c.value)} بنجاح`,
  });
}
