import { db } from "@/db";
import { sql } from "drizzle-orm";
import { env, envWarnings } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * فحص صحة. قائمة التحذيرات (ما الذي ينقص من التهيئة) تظهر في التطوير فقط،
 * ولا تُكشف للعامة في الإنتاج. المصدر الوحيد للمتغيرات هو `lib/env.ts`.
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({
      ok: true,
      mode: env.demoMode ? "demo" : "production",
      ...(env.isProd ? {} : { warnings: envWarnings() }),
    });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
