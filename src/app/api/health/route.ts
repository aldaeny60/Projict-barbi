import { db } from "@/db";
import { sql } from "drizzle-orm";
import { adminPinIsDefault } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * فحص صحة. قائمة التحذيرات (ما الذي ينقص من التهيئة) تظهر في التطوير فقط،
 * ولا تُكشف للعامة في الإنتاج.
 */
export async function GET() {
  const warnings: string[] = [];
  if (adminPinIsDefault()) warnings.push("ADMIN_PIN غير مضبوط — يُستخدم رمز التطوير");
  if (!process.env.ADMIN_SESSION_SECRET) warnings.push("ADMIN_SESSION_SECRET غير مضبوط");
  if (!process.env.SMS_PROVIDER_URL || !process.env.SMS_PROVIDER_API_KEY) warnings.push("مزود SMS غير مهيّأ");
  if (!process.env.SERPER_API_KEY) warnings.push("SERPER_API_KEY غير مضبوط — رصد السوق معطّل");
  if (!process.env.UPSTASH_REDIS_REST_URL) warnings.push("حد المعدل في الذاكرة فقط (بلا Upstash)");
  if (!process.env.CUSTOMER_SESSION_SECRET || !process.env.STAFF_SESSION_SECRET) {
    warnings.push("أسرار جلسات الزبون/الموظف مشتقة من سر الإدارة — يُفضّل سر منفصل لكل نوع");
  }
  const showWarnings = process.env.NODE_ENV !== "production";

  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, ...(showWarnings ? { warnings } : {}) });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
