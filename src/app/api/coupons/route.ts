import { db } from "@/db";
import { coupons } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { adminUnauthorized, isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(coupons).orderBy(asc(coupons.id));
  return Response.json({
    coupons: rows.map((c) => ({
      id: c.id,
      code: c.code,
      type: c.type as "percent" | "fixed",
      value: c.value,
      minSubtotal: c.minSubtotal,
      description: c.description,
      active: c.active,
      expiresAt: c.expiresAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  try {
    const body = await req.json();
    const code = String(body.code ?? "").trim().toUpperCase();
    if (!code || !body.value) return Response.json({ error: "الكود والقيمة مطلوبان" }, { status: 400 });
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
      })
      .returning();
    return Response.json({ coupon: row });
  } catch (err) {
    return Response.json({ error: "الكود موجود مسبقاً أو خطأ في الإدخال" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  const body = await req.json();
  const id = Number(body.id);
  if (!id) return Response.json({ error: "معرّف مطلوب" }, { status: 400 });
  const [row] = await db.update(coupons).set({ active: Boolean(body.active) }).where(eq(coupons.id, id)).returning();
  return Response.json({ coupon: row });
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return Response.json({ error: "معرّف مطلوب" }, { status: 400 });
  await db.delete(coupons).where(eq(coupons.id, id));
  return Response.json({ deleted: true });
}
