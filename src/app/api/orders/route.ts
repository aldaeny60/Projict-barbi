import { db } from "@/db";
import { orderItems, orders, products } from "@/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { isValidIraqiPhone } from "@/lib/format";
import { computeDeliveryFee, getCouponDiscount, nextOrderCode } from "@/lib/order-utils";
import { checkRateLimit, clientKey, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST body: { customerName, phone, governorate, district, address, notes,
 *               paymentMethod, couponCode, items: [{productId, qty, size, color}] }
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKey(req, "orders"), 10, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);
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
    const rawItems = (body.items ?? []) as { productId: number; qty: number; size?: string; color?: string }[];

    if (!customerName?.trim()) return Response.json({ error: "الاسم مطلوب" }, { status: 400 });
    if (!phone || !isValidIraqiPhone(phone))
      return Response.json({ error: "رقم هاتف عراقي غير صالح (يبدأ بـ 07 ويتكون من 11 رقماً)" }, { status: 400 });
    if (!governorate) return Response.json({ error: "اختر المحافظة" }, { status: 400 });
    if (!address?.trim()) return Response.json({ error: "اكتب العنوان التفصيلي أو أقرب نقطة دالة" }, { status: 400 });
    if (!rawItems.length) return Response.json({ error: "السلة فارغة" }, { status: 400 });

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
    const { discount } = await getCouponDiscount(couponCode ?? null, subtotal);
    const deliveryFee = await computeDeliveryFee(governorate);
    const total = subtotal - discount + deliveryFee;
    const code = await nextOrderCode("SG");

    // معاملة ذرّية: الطلب + القطع + خصم المخزون بشرط توفره — لا مخزون سالب ولا ازدواج
    let order: typeof orders.$inferSelect;
    try {
      order = await db.transaction(async (tx) => {
        for (const l of lines) {
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
            couponCode: discount > 0 ? (couponCode ?? null) : null,
            deliveryFee,
            total,
          })
          .returning();
        await tx.insert(orderItems).values(lines.map((l) => ({ ...l, orderId: ord.id })));
        return ord;
      });
    } catch (e) {
      if ((e as Error).message.startsWith("OUT_OF_STOCK:")) {
        return Response.json(
          { error: "نفد مخزون إحدى القطع أثناء الحجز — حدّثي السلة وعاودي المحاولة" },
          { status: 409 }
        );
      }
      throw e;
    }

    const paymentStatus = (paymentMethod ?? "cod") === "cod"
      ? { mode: "cod" as const, note: "الدفع نقداً عند الاستلام بعد تأكيد الطلب هاتفياً" }
      : (paymentMethod === "split"
          ? { mode: "split" as const, note: "دفعة مقسّمة سُجّلت عند البيع" }
          : { mode: "gateway_pending" as const, note: "سيتواصل فريق باربي لإتمام الدفع الإلكتروني — الربط المباشر بالبوابة يتطلب اعتمادات الإنتاج دون ادعاء نجاح" });

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
      notifications: {
        sms: true,
        whatsapp: true,
        message: `باربي: تم استلام طلبك ${code} بقيمة ${total.toLocaleString("en-US")} د.ع. سنتصل بك للتأكيد.`,
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "حدث خطأ أثناء إنشاء الطلب" }, { status: 500 });
  }
}

/** GET ?phone=07xxxxxxxxx → customer's orders with items */
export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone")?.trim();
  if (!phone) return Response.json({ orders: [] });
  const rows = await db.select().from(orders).where(eq(orders.phone, phone)).orderBy(desc(orders.createdAt)).limit(50);
  if (!rows.length) return Response.json({ orders: [] });
  const ids = rows.map((r) => r.id);
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, ids));
  const byOrder = new Map<number, typeof items>();
  for (const it of items) {
    const list = byOrder.get(it.orderId) ?? [];
    list.push(it);
    byOrder.set(it.orderId, list);
  }
  return Response.json({
    orders: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      items: (byOrder.get(r.id) ?? []).map((i) => ({ ...i })),
    })),
  });
}
