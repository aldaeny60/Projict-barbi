import { db } from "@/db";
import {
  orderEvents,
  orderItems,
  orderReturns,
  orderReturnItems,
  orders,
  products,
  productSizeStock,
  ORDER_STATUSES,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { ipOf, logAudit, type AuditActor } from "@/lib/audit";
import { ORDER_STATUS_META, nextStatuses } from "@/lib/data";
import { checkRateLimit, clientKey, rateLimited } from "@/lib/rate-limit";
import { customerFromRequest, isSameOrigin, staffFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** الحالات التي يملكها العميل بنفسه — الباقي للإدارة فقط */
const CUSTOMER_OWNED = new Set(["cancelled", "return_requested"]);
const TERMINAL = ["cancelled", "returned"];

type TxResult =
  | { row: typeof orders.$inferSelect; prevStatus: string }
  | { error: string; code: 403 | 404 | 409 };

const label = (status: string | null) =>
  status ? (ORDER_STATUS_META[status]?.label ?? status) : "—";

/**
 * PATCH { status } — ثلاثة مسارات صلاحيات:
 *  1) الإدارة (كوكي إدارة)   → أي انتقال مسموح فقط (لا قفز عشوائي)
 *  2) الكاشير (كوكي وردية)  → مرتجع لفاتورة نفس الفرع بعد التسليم
 *  3) الزبون (كوكي OTP)     → إلغاء قبل الشحن، أو طلب إرجاع بعد التسليم
 * كل انتقال يُسجَّل في order_events، والمخزون يُعاد لغير المسترجع فقط.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) return Response.json({ error: "معرّف غير صالح" }, { status: 400 });
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });

  const rl = checkRateLimit(clientKey(req, "order-status"), 40, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);

  const body = (await req.json().catch(() => ({}))) as { status?: string };
  const nextStatus = String(body.status ?? "");
  if (!ORDER_STATUSES.includes(nextStatus as (typeof ORDER_STATUSES)[number])) {
    return Response.json({ error: "حالة غير صالحة" }, { status: 400 });
  }

  const admin = isAdminAuthed(req);
  const staff = staffFromRequest(req);
  const customer = customerFromRequest(req);
  if (!admin && !staff && !customer) {
    return Response.json({ error: "سجّل الدخول أولاً" }, { status: 401 });
  }

  const actor: AuditActor = admin
    ? { actor: "admin", role: "admin", ip: ipOf(req) }
    : staff
      ? { actor: staff.staffName, role: staff.role, ip: ipOf(req) }
      : { actor: customer?.phone ?? "customer", role: "customer", ip: ipOf(req) };

  const result = await db.transaction<TxResult>(async (tx) => {
    const [prev] = await tx.select().from(orders).where(eq(orders.id, numId)).limit(1);
    if (!prev) return { error: "الطلب غير موجود", code: 404 };
    if (prev.status === nextStatus) return { error: "الطلب بهذه الحالة أصلاً", code: 409 };
    const allowed = nextStatuses(prev.status);
    if (!allowed.includes(nextStatus)) {
      return {
        error: `انتقال غير مسموح من «${label(prev.status)}» إلى «${label(nextStatus)}»`,
        code: 409,
      };
    }

    if (!admin) {
      if (staff) {
        // الكاشير: مرتجع فقط، ولنفس الفرع
        if (nextStatus !== "returned") return { error: "الكاشير يملك المرتجعات فقط", code: 403 };
        if (prev.source !== "pos" || prev.branchId !== staff.branchId) {
          return { error: "الفاتورة ليست لفرعك", code: 403 };
        }
      } else if (customer) {
        if (prev.phone !== customer.phone) return { error: "هذا الطلب ليس لك", code: 403 };
        if (!CUSTOMER_OWNED.has(nextStatus)) {
          return { error: "هذه الحالة تُدار من الإدارة", code: 403 };
        }
        if (nextStatus === "return_requested" && prev.status !== "delivered") {
          return { error: "الإرجاع يُطلب بعد التسليم فقط", code: 409 };
        }
      }
    }

    const [row] = await tx.update(orders).set({ status: nextStatus }).where(eq(orders.id, numId)).returning();

    // إعادة المخزون ذرّياً عند أول انتقال طرفي — ولغير المسترجع جزئياً فقط
    if (TERMINAL.includes(nextStatus) && !TERMINAL.includes(prev.status)) {
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

      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, numId));
      for (const it of items) {
        if (!it.productId) continue;
        const qty = it.qty - (already.get(it.id) ?? 0);
        if (qty <= 0) continue;
        await tx
          .update(products)
          .set({
            stock: sql`${products.stock} + ${qty}`,
            soldCount: sql`GREATEST(${products.soldCount} - ${qty}, 0)`,
          })
          .where(eq(products.id, it.productId));
        if (it.size) {
          await tx
            .update(productSizeStock)
            .set({ stock: sql`${productSizeStock.stock} + ${qty}` })
            .where(
              and(eq(productSizeStock.productId, it.productId), eq(productSizeStock.size, it.size))
            );
        }
      }
    }

    await tx.insert(orderEvents).values({
      orderId: numId,
      fromStatus: prev.status,
      toStatus: nextStatus,
      actor: actor.actor,
      role: actor.role,
      note: null,
    });

    return { row, prevStatus: prev.status };
  });

  if ("error" in result) return Response.json({ error: result.error }, { status: result.code });

  await logAudit(actor, "order.status", `order:${numId}`, {
    from: result.prevStatus,
    to: nextStatus,
  });

  return Response.json({ ok: true, order: { id: result.row.id, status: result.row.status } });
}

/**
 * GET — تفاصيل طلب واحد. مالكه (كوكي الزبون) أو الإدارة/الكاشير فقط.
 * مع خط زمني للحالات، والمرتجعات (الكاملة والجزئية) وإجمالي المسترد.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) return Response.json({ error: "معرّف غير صالح" }, { status: 400 });

  const rl = checkRateLimit(clientKey(req, "order-detail"), 60, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);

  const [row] = await db.select().from(orders).where(eq(orders.id, numId)).limit(1);
  if (!row) return Response.json({ error: "الطلب غير موجود" }, { status: 404 });

  const admin = isAdminAuthed(req);
  const staff = staffFromRequest(req);
  const customer = customerFromRequest(req);
  const staffOwns = Boolean(staff && row.source === "pos" && row.branchId === staff.branchId);
  const customerOwns = Boolean(customer && row.phone === customer.phone);
  if (!admin && !staffOwns && !customerOwns) {
    return Response.json({ error: "سجّل الدخول أولاً لعرض الطلب" }, { status: 401 });
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, numId));
  const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, numId));
  const returns = await db.select().from(orderReturns).where(eq(orderReturns.orderId, numId));
  const returnIds = returns.map((r) => r.id);
  const returnLines = returnIds.length
    ? await db.select().from(orderReturnItems).where(inArray(orderReturnItems.returnId, returnIds))
    : [];
  const itemById = new Map(items.map((i) => [i.id, i]));

  return Response.json({
    order: {
      ...row,
      createdAt: row.createdAt.toISOString(),
      items,
      events: events
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
      returns: returns.map((r) => ({
        id: r.id,
        amount: r.amount,
        reason: r.reason,
        actor: r.actor,
        role: r.role,
        createdAt: r.createdAt.toISOString(),
        items: returnLines
          .filter((l) => l.returnId === r.id)
          .map((l) => ({
            orderItemId: l.orderItemId,
            qty: l.qty,
            amount: l.amount,
            name: itemById.get(l.orderItemId)?.name ?? "",
            size: itemById.get(l.orderItemId)?.size ?? null,
            color: itemById.get(l.orderItemId)?.color ?? null,
          })),
      })),
      refundTotal: returns.reduce((s, r) => s + r.amount, 0),
    },
  });
}
