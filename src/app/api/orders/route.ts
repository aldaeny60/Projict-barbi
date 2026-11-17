import { db } from "@/db";
import { coupons, orderEvents, orderItems, orderReturns, orders, products, productSizeStock } from "@/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { isValidIraqiPhone } from "@/lib/format";
import { cleanRequestKey, computeDeliveryFee, getCouponDiscount, nextOrderCode } from "@/lib/order-utils";
import { checkRateLimit, clientKey, rateLimited } from "@/lib/rate-limit";
import { customerFromRequest, isSameOrigin } from "@/lib/session";
import { sendOrderNotifications } from "@/lib/notify";

export const dynamic = "force-dynamic";

type OrderRow = typeof orders.$inferSelect;

/** رد موحّد لطلب مكرر — نعيد نفس الفاتورة بدل إنشاء طلب ثانٍ */
async function duplicateResponse(order: OrderRow) {
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return Response.json({
    ok: true,
    duplicate: true,
    payment:
      order.paymentMethod === "cod"
        ? { mode: "cod" as const, note: "الدفع نقداً عند الاستلام بعد تأكيد الطلب هاتفياً" }
        : { mode: "gateway_pending" as const, note: "سيتواصل فريق باربي لإتمام الدفع الإلكتروني" },
    order: { id: order.id, code: order.code, createdAt: order.createdAt.toISOString(), status: order.status },
    invoice: {
      code: order.code,
      customerName: order.customerName,
      phone: order.phone,
      governorate: order.governorate,
      address: order.address,
      items,
      subtotal: order.subtotal,
      discount: order.discountTotal,
      deliveryFee: order.deliveryFee,
      total: order.total,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt.toISOString(),
    },
    notifications: {
      sms: "skipped" as const,
      whatsapp: "link" as const,
      message: "هذا الطلب مسجّل مسبقاً — لم نُنشئ طلباً جديداً",
      reason: "duplicate-request",
    },
  });
}

/**
 * POST body: { customerName, phone, governorate, district, address, notes,
 *               paymentMethod, couponCode, requestId?, items: [{productId, qty, size, color}] }
 *
 * requestId (idempotency): نفس المفتاح مرتين لا يُنشئ طلبين ولا يخصم المخزون مرتين.
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKey(req, "orders"), 10, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });
  try {
    const body = await req.json();
    const { customerName, phone, governorate, district, address, notes, paymentMethod, couponCode } = body as {
      customerName?: string;
      phone?: string;
      governorate?: string;
      district?: string;
      address?: string;
      notes?: string;
      paymentMethod?: string;
      couponCode?: string;
    };
    const requestKey = cleanRequestKey(body.requestId);
    const rawItems = (body.items ?? []) as { productId: number; qty: number; size?: string; color?: string }[];

    if (!customerName?.trim()) return Response.json({ error: "الاسم مطلوب" }, { status: 400 });
    if (!phone || !isValidIraqiPhone(phone))
      return Response.json({ error: "رقم هاتف عراقي غير صالح (يبدأ بـ 07 ويتكون من 11 رقماً)" }, { status: 400 });
    if (!governorate) return Response.json({ error: "اختر المحافظة" }, { status: 400 });
    if (!address?.trim()) return Response.json({ error: "اكتب العنوان التفصيلي أو أقرب نقطة دالة" }, { status: 400 });
    if (!rawItems.length) return Response.json({ error: "السلة فارغة" }, { status: 400 });

    // إعادة الإرسال: نُعيد الطلب الموجود بنفس الفاتورة
    if (requestKey) {
      const [existing] = await db.select().from(orders).where(eq(orders.requestKey, requestKey)).limit(1);
      if (existing) return duplicateResponse(existing);
    }

    const ids = [...new Set(rawItems.map((i) => Number(i.productId)).filter(Boolean))];
    const rows = await db.select().from(products).where(inArray(products.id, ids));
    const byId = new Map(rows.map((p) => [p.id, p]));

    const lines = rawItems
      .map((i) => {
        const p = byId.get(Number(i.productId));
        if (!p) return null;
        const qty = Math.max(1, Math.min(10, Math.round(Number(i.qty) || 1)));
        return {
          productId: p.id,
          name: p.name,
          image: p.images[0] ?? null,
          price: p.price,
          qty,
          size: i.size ?? p.sizes[0] ?? null,
          color: i.color ?? p.colors[0]?.name ?? null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    if (!lines.length) return Response.json({ error: "المنتجات غير متوفرة" }, { status: 400 });

    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const coupon = await getCouponDiscount(couponCode ?? null, subtotal);
    const discount = coupon.discount;
    const deliveryFee = await computeDeliveryFee(governorate);
    const total = subtotal - discount + deliveryFee;
    const code = await nextOrderCode("SG");
    const session = customerFromRequest(req);
    const actor = session?.phone ?? phone.trim();

    // معاملة ذرّية: الطلب + القطع + خصم المخزون بشرط توفره — لا مخزون سالب ولا ازدواج
    let order: typeof orders.$inferSelect;
    try {
      order = await db.transaction(async (tx) => {
        for (const l of lines) {
          // أولاً المقاس: لا بيع لمقاس نافد حتى لو كان إجمالي المنتج متوفراً
          if (l.size) {
            const sizeOk = await tx
              .update(productSizeStock)
              .set({ stock: sql`${productSizeStock.stock} - ${l.qty}` })
              .where(
                and(
                  eq(productSizeStock.productId, l.productId),
                  eq(productSizeStock.size, l.size),
                  gte(productSizeStock.stock, l.qty)
                )
              )
              .returning({ size: productSizeStock.size });
            if (!sizeOk.length) throw new Error(`OUT_OF_STOCK:${l.name} (${l.size})`);
          }
          const updated = await tx
            .update(products)
            .set({ stock: sql`${products.stock} - ${l.qty}`, soldCount: sql`${products.soldCount} + ${l.qty}` })
            .where(and(eq(products.id, l.productId), gte(products.stock, l.qty)))
            .returning({ id: products.id });
          if (!updated.length) throw new Error(`OUT_OF_STOCK:${l.name}`);
        }
        const [ord] = await tx
          .insert(orders)
          .values({
            code,
            source: "web",
            status: "pending",
            customerName: customerName.trim(),
            phone: phone.trim(),
            governorate,
            district: district ?? null,
            address,
            notes: notes ?? null,
            paymentMethod: paymentMethod ?? "cod",
            payments: [{ method: paymentMethod ?? "cod", amount: total }],
            subtotal,
            discountTotal: discount,
            couponCode: discount > 0 ? (coupon.coupon?.code ?? null) : null,
            deliveryFee,
            total,
            requestKey,
          })
          .returning();
        await tx.insert(orderItems).values(lines.map((l) => ({ ...l, orderId: ord.id })));
        await tx.insert(orderEvents).values({
          orderId: ord.id,
          fromStatus: null,
          toStatus: "pending",
          actor,
          role: "customer",
        });
        // استهلاك الكوبون داخل نفس المعاملة — لا يتجاوز حد الاستخدام
        if (discount > 0 && coupon.coupon) {
          await tx
            .update(coupons)
            .set({ usedCount: sql`${coupons.usedCount} + 1` })
            .where(eq(coupons.id, coupon.coupon.id));
        }
        return ord;
      });
    } catch (e) {
      if ((e as Error).message.startsWith("OUT_OF_STOCK:")) {
        return Response.json(
          { error: "نفد مخزون إحدى القطع أثناء الحجز — حدّثي السلة وعاودي المحاولة" },
          { status: 409 }
        );
      }
      // سباق إعادة الإرسال: وصل نفس المفتاح مرتين بالتوازي
      if (requestKey && (e as { code?: string }).code === "23505") {
        const [existing] = await db.select().from(orders).where(eq(orders.requestKey, requestKey)).limit(1);
        if (existing) return duplicateResponse(existing);
      }
      throw e;
    }

    const paymentStatus =
      (paymentMethod ?? "cod") === "cod"
        ? { mode: "cod" as const, note: "الدفع نقداً عند الاستلام بعد تأكيد الطلب هاتفياً" }
        : { mode: "gateway_pending" as const, note: "سيتواصل فريق باربي لإتمام الدفع الإلكتروني — الربط المباشر بالبوابة يتطلب اعتمادات الإنتاج" };

    // إشعارات حقيقية: تُرسل فعلاً وتُبلَّغ نتيجتها، ولا ندّعي إرسالاً لم يحدث
    const notifications = await sendOrderNotifications({
      phone: order.phone,
      customerName: order.customerName,
      code: order.code,
      total: order.total,
    });

    return Response.json({
      ok: true,
      payment: paymentStatus,
      order: { id: order.id, code: order.code, createdAt: order.createdAt.toISOString(), status: order.status },
      invoice: {
        code: order.code,
        customerName: order.customerName,
        phone: order.phone,
        governorate: order.governorate,
        address: order.address,
        items: lines,
        subtotal,
        discount,
        deliveryFee,
        total,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt.toISOString(),
      },
      notifications,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "حدث خطأ أثناء إنشاء الطلب" }, { status: 500 });
  }
}

/**
 * GET → طلبات الزبون الحالي من جلسة OTP الموقّعة، مع خط زمني لكل طلب
 * وإجمالي المسترد من المرتجعات.
 */
export async function GET(req: NextRequest) {
  const session = customerFromRequest(req);
  if (!session) {
    return Response.json(
      { error: "وثّق رقمك أولاً برمز SMS لعرض طلباتك", needsVerification: true },
      { status: 401 }
    );
  }
  const rl = checkRateLimit(clientKey(req, "orders-list"), 60, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);

  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.phone, session.phone))
    .orderBy(desc(orders.createdAt))
    .limit(50);
  if (!rows.length) return Response.json({ orders: [] });

  const ids = rows.map((r) => r.id);
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, ids));
  const byOrder = new Map<number, typeof items>();
  for (const it of items) {
    const list = byOrder.get(it.orderId) ?? [];
    list.push(it);
    byOrder.set(it.orderId, list);
  }
  const events = await db.select().from(orderEvents).where(inArray(orderEvents.orderId, ids));
  const refunds = new Map<number, number>();
  for (const r of await db.select().from(orderReturns).where(inArray(orderReturns.orderId, ids))) {
    refunds.set(r.orderId, (refunds.get(r.orderId) ?? 0) + r.amount);
  }

  return Response.json({
    orders: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      items: byOrder.get(r.id) ?? [],
      events: events.filter((e) => e.orderId === r.id).map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
      refundTotal: refunds.get(r.id) ?? 0,
    })),
  });
}
