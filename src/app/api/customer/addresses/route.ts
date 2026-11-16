import { db } from "@/db";
import { customerAddresses, customers } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { customerFromRequest, isSameOrigin } from "@/lib/session";
import { GOVERNORATES } from "@/lib/data";
import { checkRateLimit, clientKey, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * عناوين الزبون على الخادم — تتبع الزبونة بين الأجهزة.
 * كل عمليات هذا المسار مقيّدة بجلسة OTP الموقّعة، ولا تُقبل customerId من العميل.
 */

async function currentCustomer(req: NextRequest) {
  const session = customerFromRequest(req);
  if (!session) return null;
  const [row] = await db.select().from(customers).where(eq(customers.phone, session.phone)).limit(1);
  return row ?? null;
}

const GOVERNORATE_NAMES = new Set(GOVERNORATES.map((g) => g.name));

export async function GET(req: NextRequest) {
  const customer = await currentCustomer(req);
  if (!customer) return Response.json({ addresses: [] });
  const rows = await db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, customer.id))
    .orderBy(desc(customerAddresses.createdAt));
  return Response.json({
    addresses: rows.map((a) => ({
      id: a.id,
      governorate: a.governorate,
      district: a.district,
      detail: a.detail,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const customer = await currentCustomer(req);
  if (!customer) return Response.json({ error: "سجّل الدخول أولاً" }, { status: 401 });
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });
  const rl = checkRateLimit(clientKey(req, "addresses"), 40, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);

  const body = (await req.json().catch(() => ({}))) as {
    governorate?: string;
    district?: string;
    detail?: string;
  };
  const governorate = String(body.governorate ?? "").trim();
  const detail = String(body.detail ?? "").trim();
  if (!GOVERNORATE_NAMES.has(governorate)) {
    return Response.json({ error: "اختاري محافظة عراقية صحيحة" }, { status: 400 });
  }
  if (detail.length < 5) {
    return Response.json({ error: "اكتبي العنوان التفصيلي (5 أحرف على الأقل)" }, { status: 400 });
  }

  const [row] = await db
    .insert(customerAddresses)
    .values({
      customerId: customer.id,
      governorate,
      district: body.district?.trim() || null,
      detail,
    })
    .returning();
  return Response.json({ ok: true, address: { id: row.id, governorate: row.governorate, district: row.district, detail: row.detail } });
}

export async function DELETE(req: NextRequest) {
  const customer = await currentCustomer(req);
  if (!customer) return Response.json({ error: "سجّل الدخول أولاً" }, { status: 401 });
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) return Response.json({ error: "معرّف مطلوب" }, { status: 400 });
  await db
    .delete(customerAddresses)
    .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customer.id)));
  return Response.json({ ok: true });
}
