import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { clearCustomerCookie, customerFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * جلسة الزبون الحالية — مصدر الحقيقة للمتصفح: الكوكي الموقّعة، لا localStorage.
 * GET → { customer } أو { customer: null }
 * DELETE → خروج
 */
export async function GET(req: NextRequest) {
  const session = customerFromRequest(req);
  if (!session) return Response.json({ customer: null });

  const [row] = await db.select().from(customers).where(eq(customers.phone, session.phone)).limit(1);
  if (!row) {
    // جلسة صالحة لحساب لم يعد موجوداً — نُبطلها بدل تركها معلّقة
    const res = NextResponse.json({ customer: null });
    clearCustomerCookie(res);
    return res;
  }
  return Response.json({ customer: { id: row.id, name: row.name, phone: row.phone } });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  clearCustomerCookie(res);
  return res;
}
