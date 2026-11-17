import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { ipOf, logAudit } from "@/lib/audit";
import { initPayment, providerConfigured, type ProviderId } from "@/lib/payment-gateway";
import { checkRateLimit, clientKey, rateLimited } from "@/lib/rate-limit";
import { customerFromRequest, isSameOrigin } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/payments/init { orderId, provider }
 * ينشئ محاولة دفع ويعيد رابط التوجيه للبوابة.
 * - المزوّد غير المهيّأ → 503 برسالة صريحة (لا دفع وهمي).
 * - الطلب المدفوع مسبقاً → 409.
 * - لا يتجاوز الزبون طلباته: الجلسة (إن وُجدت) يجب أن تطابق هاتف الطلب.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });
  const rl = checkRateLimit(clientKey(req, "payment-init"), 20, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);

  const body = (await req.json().catch(() => ({}))) as { orderId?: number; provider?: string };
  const orderId = Number(body.orderId);
  const provider = String(body.provider ?? "") as ProviderId;
  if (!orderId) return Response.json({ error: "معرّف الطلب مطلوب" }, { status: 400 });

  if (!["zaincash", "sandbox"].includes(provider)) {
    return Response.json({ error: "مزوّد الدفع غير مدعوم" }, { status: 400 });
  }
  if (!providerConfigured(provider)) {
    return Response.json(
      {
        error:
          provider === "zaincash"
            ? "زين كاش غير مفعّل على هذا المتجر بعد — اختر الدفع عند الاستلام أو تواصل معنا"
            : "مزوّد الاختبار غير مفعّل",
        providerConfigured: false,
      },
      { status: 503 }
    );
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return Response.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (order.paymentStatus === "paid") {
    return Response.json({ error: "هذا الطلب مدفوع مسبقاً" }, { status: 409 });
  }
  const session = customerFromRequest(req);
  if (session && session.phone !== order.phone) {
    return Response.json({ error: "هذا الطلب ليس لك" }, { status: 403 });
  }

  const publicBase =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "") || req.nextUrl.origin;

  const requestKey = `pay-${order.code}-${randomUUID()}`;
  try {
    const result = await initPayment(provider, {
      orderId: order.id,
      orderCode: order.code,
      amount: order.total,
      baseUrl: publicBase,
    });

    await db.insert(payments).values({
      orderId: order.id,
      provider,
      status: "pending",
      amount: order.total,
      providerRef: result.providerRef,
      requestKey,
      payload: { redirectUrl: result.redirectUrl },
    });
    await db.update(orders).set({ paymentStatus: "pending" }).where(eq(orders.id, order.id));
    await logAudit(
      { actor: order.phone, role: "customer", ip: ipOf(req) },
      "payment.init",
      `order:${order.id}`,
      { provider, amount: order.total }
    );

    return Response.json({ ok: true, redirectUrl: result.redirectUrl, provider });
  } catch (e) {
    await logAudit(
      { actor: order.phone, role: "customer", ip: ipOf(req) },
      "payment.init.failed",
      `order:${order.id}`,
      { provider, reason: e instanceof Error ? e.message : "unknown" }
    );
    return Response.json(
      { error: e instanceof Error ? e.message : "تعذر بدء الدفع" },
      { status: 502 }
    );
  }
}
