import { db } from "@/db";
import { coupons } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { adminUnauthorized, isAdminAuthed } from "@/lib/admin-auth";
import { adminActor, logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/session";

export const dynamic = "force-dynamic";

/** GET — للعامة: الكوبونات الصالحة فقط. للإدارة: كل الكوبونات مع حدود الاستخدام. */
export async function GET(req: NextRequest) {
  const rows = await db.select().from(coupons).orderBy(asc(coupons.id));
  const admin = isAdminAuthed(req);
  const now = new Date();
  const visible = admin
    ? rows
    : rows.filter(
        (c) =>
          c.active &&
          (!c.expiresAt || c.expiresAt > now) &&
          (c.maxUses === null || c.usedCount < c.maxUses)
      );
  return Response.json({
    coupons: visible.map((c) => ({
      id: c.id,
      code: c.code,
      type: c.type as "percent" | "fixed",
      value: c.value,
      minSubtotal: c.minSubtotal,
      description: c.description,
      active: c.active,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      ...(admin ? { maxUses: c.maxUses, usedCount: c.usedCount, oncePerCustomer: c.oncePerCustomer } : {}),
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });
  try {
    const body = await req.json();
    const code = String(body.code ?? "").trim().toUpperCase();
    if (!code || !body.value) return Response.json({ error: "الكود والقيمة مطلوبان" }, { status: 400 });
    const maxUses =
      body.maxUses === undefined || body.maxUses === null || body.maxUses === ""
        ? null
        : Math.max(1, Math.round(Number(body.maxUses)));
    const [row] = await db
      .insert(coupons)
      .values({
        code,
        type: body.type === "fixed" ? "fixed" : "percent",
        value: Math.round(Number(body.value)),
        minSubtotal: Math.round(Number(body.minSubtotal ?? 0)),
        description: body.description ?? null,
        active: true,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        maxUses,
        oncePerCustomer: Boolean(body.oncePerCustomer),
      })
      .returning();
    await logAudit(adminActor(req), "coupon.create", `coupon:${row.id}`, {
      code: row.code,
      type: row.type,
      value: row.value,
      maxUses: row.maxUses,
    });
    return Response.json({ coupon: row });
  } catch {
    return Response.json({ error: "الكود موجود مسبقاً أو خطأ في الإدخال" }, { status: 400 });
  }
}

/** PATCH { id, active?, maxUses? } — تفعيل/إيقاف وتعديل حد الاستخدام */
export async function PATCH(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as {
    id?: number;
    active?: boolean;
    maxUses?: number | null;
    oncePerCustomer?: boolean;
  };
  const id = Number(body.id);
  if (!id) return Response.json({ error: "معرّف مطلوب" }, { status: 400 });
  const patch: Partial<typeof coupons.$inferInsert> = {};
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.oncePerCustomer !== undefined) patch.oncePerCustomer = Boolean(body.oncePerCustomer);
  if (body.maxUses !== undefined) {
    patch.maxUses = body.maxUses === null ? null : Math.max(1, Math.round(Number(body.maxUses)));
  }
  if (!Object.keys(patch).length) return Response.json({ error: "لا يوجد تغيير" }, { status: 400 });
  const [row] = await db.update(coupons).set(patch).where(eq(coupons.id, id)).returning();
  await logAudit(adminActor(req), "coupon.update", `coupon:${id}`, {
    fields: Object.keys(patch),
  });
  return Response.json({ coupon: row });
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return Response.json({ error: "معرّف مطلوب" }, { status: 400 });
  const [row] = await db.delete(coupons).where(eq(coupons.id, id)).returning();
  await logAudit(adminActor(req), "coupon.delete", `coupon:${id}`, { code: row?.code ?? null });
  return Response.json({ deleted: true });
}
