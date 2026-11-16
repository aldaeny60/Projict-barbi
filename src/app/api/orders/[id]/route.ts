import { db } from "@/db";
import { orderItems, orders, products, ORDER_STATUSES } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) return Response.json({ error: "معرّف غير صالح" }, { status: 400 });
  const body = (await req.json()) as { status?: string };
  if (!body.status || !ORDER_STATUSES.includes(body.status as (typeof ORDER_STATUSES)[number])) {
    return Response.json({ error: "حالة غير صالحة" }, { status: 400 });
  }
  const nextStatus: string = body.status;
  const TERMINAL = ["cancelled", "returned"];
  const result = await db.transaction(async (tx) => {
    const [prev] = await tx.select().from(orders).where(eq(orders.id, numId)).limit(1);
    if (!prev) return null;
    const [row] = await tx.update(orders).set({ status: nextStatus }).where(eq(orders.id, numId)).returning();
    // إعادة المخزون ذرّياً عند الإلغاء/الإرجاع لأول مرة — بدون تكرار
    if (TERMINAL.includes(nextStatus) && !TERMINAL.includes(prev.status)) {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, numId));
      for (const it of items) {
        if (!it.productId) continue;
        await tx
          .update(products)
          .set({
            stock: sql`${products.stock} + ${it.qty}`,
            soldCount: sql`GREATEST(${products.soldCount} - ${it.qty}, 0)`,
          })
          .where(eq(products.id, it.productId));
      }
    }
    return row;
  });
  if (!result) return Response.json({ error: "الطلب غير موجود" }, { status: 404 });
  return Response.json({ ok: true, order: { id: result.id, status: result.status } });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) return Response.json({ error: "معرّف غير صالح" }, { status: 400 });
  const [row] = await db.select().from(orders).where(eq(orders.id, numId)).limit(1);
  if (!row) return Response.json({ error: "الطلب غير موجود" }, { status: 404 });
  return Response.json({ order: { ...row, createdAt: row.createdAt.toISOString() } });
}
