import { db } from "@/db";
import {
  orderEvents,
  orderItems,
  orderReturns,
  orderReturnItems,
  orders,
  products,
  productSizeStock,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { ipOf, logAudit } from "@/lib/audit";
import { checkRateLimit, clientKey, rateLimited } from "@/lib/rate-limit";
import { isSameOrigin, staffFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

type Body = { items?: { orderItemId?: number; qty?: number }[]; reason?: string };

/**
 * POST — إرجاع جزئي (أو إكمال مرتجع) لطلب مُسلَّم.
 * body: { items: [{ orderItemId, qty }], reason? }
 *
 * - لا تُقبل كمية أكبر من المتبقي غير المسترجع.
 * - المخزون يُعاد للكمية المسترجعة فقط، والمال المسترد يُحسب من أسعار الفاتورة.
 * - إذا استُرجع كامل الطلب تتحول حالته إلى «مرتجع» تلقائياً.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) return Response.json({ error: "معرّف غير صالح" }, { status: 400 });
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });

  const rl = checkRateLimit(clientKey(req, "order-return"), 30, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);

  const admin = isAdminAuthed(req);
  const staff = staffFromRequest(req);
  if (!admin && !staff) {
    return Response.json({ error: "الإرجاع يتطلب جلسة إدارة أو كاشير" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const requested = (body.items ?? [])
    .map((i) => ({ orderItemId: Number(i.orderItemId), qty: Math.round(Number(i.qty)) }))
    .filter((i) => Number.isFinite(i.orderItemId) && Number.isFinite(i.qty) && i.qty > 0);
  if (!requested.length) {
    return Response.json({ error: "حدّد القطع والكميات المرتجعة" }, { status: 400 });
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, numId)).limit(1);
  if (!order) return Response.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (!["delivered", "return_requested"].includes(order.status)) {
    return Response.json({ error: "الإرجاع الجزئي بعد التسليم فقط" }, { status: 409 });
  }
  if (staff && !admin) {
    if (order.source !== "pos" || order.branchId !== staff.branchId) {
      return Response.json({ error: "الفاتورة ليست لفرعك" }, { status: 403 });
    }
  }

  const actor = admin
    ? { actor: "admin", role: "admin" }
    : { actor: staff!.staffName, role: staff!.role };

  type TxResult =
    | { ok: true; refund: number; fullyReturned: boolean; status: string }
    | { ok: false; error: string; code: 400 | 409 };

  const result = await db.transaction<TxResult>(async (tx) => {
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, numId));
    if (!items.length) return { ok: false, error: "الطلب بلا قطع", code: 409 };
    const byId = new Map(items.map((i) => [i.id, i]));

    const returnedRows = await tx
      .select({
        orderItemId: orderReturnItems.orderItemId,
        qty: sql<number>`coalesce(sum(${orderReturnItems.qty}), 0)`,
      })
      .from(orderReturnItems)
      .innerJoin(orderReturns, eq(orderReturnItems.returnId, orderReturns.id))
      .where(eq(orderReturns.orderId, numId))
      .groupBy(orderReturnItems.orderItemId);
    const already = new Map(returnedRows.map((r) => [r.orderItemId, Number(r.qty)]));

    // تحقق من كل سطر قبل أي كتابة
    const lines: {
      orderItemId: number;
      qty: number;
      amount: number;
      productId: number | null;
      size: string | null;
    }[] = [];
    for (const reqLine of requested) {
      const item = byId.get(reqLine.orderItemId);
      if (!item) return { ok: false, error: "سطر غير موجود في الفاتورة", code: 400 };
      const remaining = item.qty - (already.get(item.id) ?? 0);
      if (reqLine.qty > remaining) {
        return {
          ok: false,
          error: `الكمية المطلوبة أكبر من المتبقي (${remaining}) للقطعة «${item.name}»`,
          code: 409,
        };
      }
      lines.push({
        orderItemId: item.id,
        qty: reqLine.qty,
        amount: item.price * reqLine.qty,
        productId: item.productId,
        size: item.size,
      });
    }

    const refund = lines.reduce((s, l) => s + l.amount, 0);
    const [ret] = await tx
      .insert(orderReturns)
      .values({
        orderId: numId,
        amount: refund,
        reason: body.reason?.trim() || null,
        actor: actor.actor,
        role: actor.role,
      })
      .returning();
    await tx.insert(orderReturnItems).values(
      lines.map((l) => ({ returnId: ret.id, orderItemId: l.orderItemId, qty: l.qty, amount: l.amount }))
    );

    for (const l of lines) {
      if (!l.productId) continue;
      await tx
        .update(products)
        .set({
          stock: sql`${products.stock} + ${l.qty}`,
          soldCount: sql`GREATEST(${products.soldCount} - ${l.qty}, 0)`,
        })
        .where(eq(products.id, l.productId));
      if (l.size) {
        await tx
          .update(productSizeStock)
          .set({ stock: sql`${productSizeStock.stock} + ${l.qty}` })
          .where(
            and(eq(productSizeStock.productId, l.productId), eq(productSizeStock.size, l.size))
          );
      }
    }

    // هل استُرجع كل شيء؟
    const afterMap = new Map(already);
    for (const l of lines) afterMap.set(l.orderItemId, (afterMap.get(l.orderItemId) ?? 0) + l.qty);
    const fullyReturned = items.every((i) => (afterMap.get(i.id) ?? 0) >= i.qty);

    let status = order.status;
    if (fullyReturned) {
      status = "returned";
      await tx.update(orders).set({ status }).where(eq(orders.id, numId));
      await tx.insert(orderEvents).values({
        orderId: numId,
        fromStatus: order.status,
        toStatus: "returned",
        actor: actor.actor,
        role: actor.role,
        note: body.reason?.trim() || null,
      });
    } else {
      await tx.insert(orderEvents).values({
        orderId: numId,
        fromStatus: order.status,
        toStatus: order.status,
        actor: actor.actor,
        role: actor.role,
        note: `إرجاع جزئي بقيمة ${refund.toLocaleString("en-US")} د.ع`,
      });
    }

    return { ok: true, refund, fullyReturned, status };
  });

  if (!result.ok) return Response.json({ error: result.error }, { status: result.code });

  await logAudit(
    { ...actor, ip: ipOf(req) },
    "order.return",
    `order:${numId}`,
    { refund: result.refund, fullyReturned: result.fullyReturned, status: result.status }
  );

  return Response.json({
    ok: true,
    refund: result.refund,
    fullyReturned: result.fullyReturned,
    order: { id: numId, status: result.status },
  });
}
