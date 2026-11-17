import { db } from "@/db";
import { orderEvents, orders, payments } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { adminActor, logAudit } from "@/lib/audit";
import { adminForbidden, adminUnauthorized, isAdminAuthed, isAdminOwner } from "@/lib/admin-auth";
import { isSameOrigin } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * مطابقة الدفع يدوياً — للحالات التي يصل فيها المبلغ للبوابة ولا يصل الإشعار.
 * المالك فقط، مع سبب إلزامي، ويُسجَّل في سجل التدقيق والطلب. لا يُنشئ «دفعاً وهمياً»:
 * المبلغ المسجَّل هو إجمالي الطلب، والمصدر يُذكر صريحاً (manual).
 */

type Body = { orderId?: number; status?: string; note?: string; providerRef?: string };

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  const orderId = Number(req.nextUrl.searchParams.get("orderId"));
  if (!orderId) return Response.json({ error: "معرّف الطلب مطلوب" }, { status: 400 });
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(desc(payments.createdAt));
  return Response.json({
    payments: rows.map((p) => ({
      id: p.id,
      provider: p.provider,
      status: p.status,
      amount: p.amount,
      providerRef: p.providerRef,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  if (!isAdminOwner(req)) return adminForbidden();
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const orderId = Number(body.orderId);
  const status = String(body.status ?? "");
  const note = String(body.note ?? "").trim();
  const providerRef = String(body.providerRef ?? "").trim();

  if (!orderId) return Response.json({ error: "معرّف الطلب مطلوب" }, { status: 400 });
  if (!["paid", "failed"].includes(status)) {
    return Response.json({ error: "الحالة يجب أن تكون paid أو failed" }, { status: 400 });
  }
  if (note.length < 5) {
    return Response.json({ error: "اكتب سبباً واضحاً للمطابقة اليدوية (5 أحرف على الأقل)" }, { status: 400 });
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return Response.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (order.paymentStatus === status) {
    return Response.json({ error: `الطلب مسجَّل مسبقاً كـ ${status}` }, { status: 409 });
  }

  await db.transaction(async (tx) => {
    await tx.insert(payments).values({
      orderId,
      provider: "manual",
      status,
      amount: order.total,
      providerRef: providerRef || null,
      requestKey: `manual-${order.code}-${randomUUID()}`,
      payload: { note, by: adminActor(req).actor },
    });
    await tx.update(orders).set({ paymentStatus: status }).where(eq(orders.id, orderId));
    await tx.insert(orderEvents).values({
      orderId,
      fromStatus: order.status,
      toStatus: order.status,
      actor: adminActor(req).actor,
      role: "admin",
      note:
        status === "paid"
          ? `مطابقة دفع يدوية: تم تأكيد استلام ${order.total.toLocaleString("en-US")} د.ع — ${note}`
          : `مطابقة دفع يدوية: تسجيل فشل الدفع — ${note}`,
    });
  });

  await logAudit(adminActor(req), "payment.reconcile", `order:${orderId}`, {
    status,
    amount: order.total,
    providerRef: providerRef || null,
    note,
  });

  return Response.json({ ok: true, order: { id: orderId, paymentStatus: status } });
}
