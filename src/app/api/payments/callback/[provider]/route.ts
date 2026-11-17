import { db } from "@/db";
import { orderEvents, orders, payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { ipOf, logAudit } from "@/lib/audit";
import { verifyCallback } from "@/lib/payment-gateway";
import { sendOrderNotifications } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/payments/callback/[provider]
 * يعالجه المزوّد بعد الدفع. قواعد صارمة:
 * - التوقيع يُتحقق قبل أي كتابة؛ توقيع خاطئ = 400 ولا تغيير.
 * - idempotent: نفس الإشعار مرتين لا يُغيّر شيئاً (سجل payment فريد + حالة مدفوعة).
 * - لا يُعتبر الطلب مدفوعاً إلا بمبلغ مطابق لإجمالي الطلب.
 * - يوجّه الزبون لصفحة نتيجة عربية بدل JSON.
 */
async function handle(req: NextRequest, provider: string) {
  const result = await verifyCallback(provider, req);
  if (!result) {
    await logAudit({ actor: "gateway", role: "system", ip: ipOf(req) }, "payment.callback.invalid", provider);
    return NextResponse.redirect(new URL("/checkout/payment?status=invalid", req.url), 303);
  }

  const [order] = await db.select().from(orders).where(eq(orders.code, result.orderCode)).limit(1);
  if (!order) {
    await logAudit({ actor: "gateway", role: "system", ip: ipOf(req) }, "payment.callback.unknown-order", provider);
    return NextResponse.redirect(new URL("/checkout/payment?status=unknown", req.url), 303);
  }

  // مبلغ غير مطابق: نسجّل فشلاً ولا نمنح الطلب صفة «مدفوع»
  const amountOk = result.status === "paid" && result.amount === order.total;
  const finalStatus = amountOk ? "paid" : "failed";

  const [existing] = result.providerRef
    ? await db.select().from(payments).where(eq(payments.providerRef, result.providerRef)).limit(1)
    : [];

  if (existing?.status === "paid" || order.paymentStatus === "paid") {
    return NextResponse.redirect(new URL(`/checkout/payment?status=paid&code=${order.code}`, req.url), 303);
  }

  if (existing) {
    await db
      .update(payments)
      .set({ status: finalStatus, payload: result.raw, updatedAt: new Date() })
      .where(eq(payments.id, existing.id));
  } else {
    await db.insert(payments).values({
      orderId: order.id,
      provider,
      status: finalStatus,
      amount: result.amount,
      providerRef: result.providerRef || null,
      payload: result.raw,
    });
  }

  await db.update(orders).set({ paymentStatus: finalStatus }).where(eq(orders.id, order.id));

  if (amountOk) {
    await db.insert(orderEvents).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      actor: provider,
      role: "system",
      note: `دفع إلكتروني مؤكد بمبلغ ${result.amount.toLocaleString("en-US")} د.ع`,
    });
    await sendOrderNotifications({
      phone: order.phone,
      customerName: order.customerName,
      code: order.code,
      total: order.total,
    });
  }

  await logAudit(
    { actor: "gateway", role: "system", ip: ipOf(req) },
    amountOk ? "payment.paid" : "payment.failed",
    `order:${order.id}`,
    { provider, amount: result.amount, expected: order.total, ref: result.providerRef }
  );

  return NextResponse.redirect(
    new URL(`/checkout/payment?status=${finalStatus}&code=${order.code}`, req.url),
    303
  );
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  return handle(req, provider);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  return handle(req, provider);
}
