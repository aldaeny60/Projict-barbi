import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getProductDetail } from "@/lib/server-queries";
import { adminUnauthorized, isAdminAuthed } from "@/lib/admin-auth";
import { adminActor, logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const data = await getProductDetail(id);
  if (!data) return Response.json({ error: "المنتج غير موجود" }, { status: 404 });
  return Response.json(data);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) return Response.json({ error: "معرّف غير صالح" }, { status: 400 });
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "description", "slug", "barcode"] as const) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  for (const k of ["price", "compareAtPrice", "stock", "categoryId", "soldCount"] as const) {
    if (body[k] !== undefined) patch[k] = body[k] === null ? null : Math.round(Number(body[k]));
  }
  for (const k of ["images", "colors", "sizes"] as const) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  if (body.isNew !== undefined) patch.isNew = Boolean(body.isNew);
  const [row] = await db.update(products).set(patch).where(eq(products.id, numId)).returning();
  await logAudit(adminActor(req), "product.update", `product:${numId}`, {
    fields: Object.keys(patch),
  });
  return Response.json({ product: row });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) return Response.json({ error: "معرّف غير صالح" }, { status: 400 });
  await db.delete(products).where(eq(products.id, numId));
  await logAudit(adminActor(req), "product.delete", `product:${numId}`, {});
  return Response.json({ deleted: true });
}
