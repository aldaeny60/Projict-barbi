import { db } from "@/db";
import { orderItems, orders, products, ORDER_STATUSES } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { ipOf, logAudit, type AuditActor } from "@/lib/audit";
import { checkRateLimit, clientKey, rateLimited } from "@/lib/rate-limit";
import { customerFromRequest, isSameOrigin, staffFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** الحالات التي يملكها العميل بنفسه — الباقي للإدارة فقط */
const CUSTOMER_OWNED = new Set(["cancelled", "return_requested"]);
/** ما بعد الشحن لا يُلغى من الزبون — يُطلب إرجاع فقط */
const PRE_SHIP = new Set(["pending", "processing"]);

type TxResult =
  | { row: typeof orders.$inferSelect; prevStatus: string }
  | { error: string; code: 403 | 404 | 409 };

/**
 * PATCH { status } — ثلاثة مسارات صلاحيات:
 *  1) الإدارة (كوكي إدارة)   → أي حالة
 *  2) الكاشير (كوكي وردية)  → مرتجع فقط لفاتورة نفس الفرع
 *  3) الزبون (كوكي OTP)     → إلغاء قبل الشحن، أو طلب إرجاع بعد التسليم
 * لا توجد طريق رابعة: بلا كوكي = 401.
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

  const TERMINAL = ["cancelled", "returned"];
  const result = await db.transaction<TxResult>(async (tx) => {
    const [prev] = await tx.select().from(orders).where(eq(orders.id, numId)).limit(1);
    if (!prev) return { error: "الطلب غير موجود", code: 404 };

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
        if (nextStatus === "cancelled") {
          if (prev.status === "cancelled") return { error: "الطلب ملغي أصلاً", code: 409 };
          if (!PRE_SHIP.has(prev.status)) {
            return { error: "ما عاد يمكن الإلغاء بعد الشحن — اطلب إرجاعاً بدلاً منه", code: 409 };
          }
        }
        if (nextStatus === "return_requested" && prev.status !== "delivered") {
          return { error: "الإرجاع يُطلب بعد التسليم فقط", code: 409 };
        }
      }
    }

    const [row] = await tx.update(orders).set({ status: nextStatus }).where(eq(orders.id, numId)).returning();
    // إعادة المخزون ذرّياً عند أول انتقال طرفي فقط — بلا ازدواج
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
    return { row, prevStatus: prev.status };
  });

  if ("error" in result) return Response.json({ error: result.error }, { status: result.code });

  const actor: AuditActor = admin
    ? { actor: "admin", role: "admin", ip: ipOf(req) }
    : staff
      ? { actor: staff.staffName, role: staff.role, ip: ipOf(req) }
      : { actor: customer?.phone ?? "customer", role: "customer", ip: ipOf(req) };
  await logAudit(actor, "order.status", `order:${numId}`, {
    from: result.prevStatus,
    to: nextStatus,
  });

  return Response.json({ ok: true, order: { id: result.row.id, status: result.row.status } });
}

/**
 * GET — تفاصيل طلب واحد. مالكه (كوكي الزبون) أو الإدارة/الكاشير فقط.
 * لا يكفي معرفة الرقم: بيانات الطلب تحمل الاسم والعنوان والهاتف.
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
  return Response.json({
    order: { ...row, createdAt: row.createdAt.toISOString(), items },
  });
}
