import { db } from "@/db";
import { branches, coupons, orderEvents, orderItems, orders, products, productSizeStock } from "@/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { cleanRequestKey, getCouponDiscount, nextOrderCode } from "@/lib/order-utils";
import { ipOf, logAudit } from "@/lib/audit";
import { checkRateLimit, clientKey, rateLimited } from "@/lib/rate-limit";
import { isSameOrigin, staffAtLeast, staffFromRequest } from "@/lib/session";
import { sendSms } from "@/lib/notify";

export const dynamic = "force-dynamic";

type PosLine = { productId: number; qty: number; size?: string; color?: string };
type PosPayment = { method: string; amount: number };

/** فاتورة موجودة مسبقاً بنفس مفتاح الطلب — لا نبيع مرتين */
async function duplicateSale(order: typeof orders.$inferSelect) {
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const [branch] = order.branchId
    ? await db.select().from(branches).where(eq(branches.id, order.branchId)).limit(1)
    : [];
  return Response.json({
    ok: true,
    duplicate: true,
    invoice: {
      code: order.code,
      branch: branch?.name ?? "فرع باربي",
      staffName: order.staffName ?? "كاشير",
      items,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      couponCode: order.couponCode,
      total: order.total,
      payments: order.payments,
      changeDue: 0,
      createdAt: order.createdAt.toISOString(),
    },
    notifications: {
      sms: "skipped",
      whatsapp: "link",
      message: `الفاتورة ${order.code} مسجّلة مسبقاً — لم تُنشأ فاتورة جديدة`,
      reason: "duplicate-request",
    },
  });
}

/**
 * POST — إنشاء فاتورة كاشير
 * body: { branchId, shiftId?, staffName, items: PosLine[], discount? {mode:'percent'|'fixed',value},
 *         couponCode?, payments: PosPayment[], customerName?, phone? }
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKey(req, "pos-sale"), 120, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });

  // البيع يتطلب وردية مفتوحة بجلسة موقّعة — الاسم/الفرع من الجلسة لا من جسم الطلب
  const session = staffAtLeast(req, "cashier");
  if (!session) {
    return Response.json({ error: "افتح وردية أولاً — البيع يتطلب جلسة كاشير" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const branchId = session.branchId;
    const shiftId = session.shiftId;
    const staffName = session.staffName;
    const rawItems = (body.items ?? []) as PosLine[];
    const payments = (body.payments ?? []) as PosPayment[];
    const manual = body.discount as { mode?: string; value?: number } | undefined;
    const requestKey = cleanRequestKey(body.requestId);

    if (!rawItems.length) return Response.json({ error: "أضف منتجات للفاتورة أولاً" }, { status: 400 });

    // إعادة إرسال نفس الفاتورة (من طابور الأوفلاين أو ضغط مزدوج) لا تبيع مرتين
    if (requestKey) {
      const [existing] = await db.select().from(orders).where(eq(orders.requestKey, requestKey)).limit(1);
      if (existing) return duplicateSale(existing);
    }

    // الخصم اليدوي صلاحية مشرف/مدير — الكاشير لا يخصم بنفسه
    if (manual?.value) {
      if (!staffAtLeast(req, "supervisor")) {
        return Response.json({ error: "الخصم اليدوي يتطلب صلاحية مشرف" }, { status: 403 });
      }
    }

    const ids = [...new Set(rawItems.map((i) => Number(i.productId)).filter(Boolean))];
    const rows = await db.select().from(products).where(inArray(products.id, ids));
    const byId = new Map(rows.map((p) => [p.id, p]));
    const lines = rawItems
      .map((i) => {
        const p = byId.get(Number(i.productId));
        if (!p) return null;
        const qty = Math.max(1, Math.min(20, Math.round(Number(i.qty) || 1)));
        return {
          productId: p.id,
          name: p.name,
          image: p.images[0] ?? null,
          price: p.price,
          costPrice: p.costPrice,
          qty,
          size: i.size ?? p.sizes[0] ?? null,
          color: i.color ?? p.colors[0]?.name ?? null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    if (!lines.length) return Response.json({ error: "المنتجات غير متوفرة" }, { status: 400 });

    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const manualDiscount = manual?.value
      ? manual.mode === "percent"
        ? Math.round((subtotal * Number(manual.value)) / 100)
        : Math.round(Number(manual.value))
      : 0;
    const afterManual = Math.max(0, subtotal - Math.min(manualDiscount, subtotal));
    const coupon = await getCouponDiscount(body.couponCode ?? null, afterManual, { phone: body.phone ?? null });
    const couponDiscount = coupon.discount;
    const discountTotal = Math.min(manualDiscount + couponDiscount, subtotal);
    const total = subtotal - discountTotal;

    const cleanPayments = payments
      .map((p) => ({ method: String(p.method), amount: Math.max(0, Math.round(Number(p.amount) || 0)) }))
      .filter((p) => p.amount > 0);
    const paid = cleanPayments.reduce((s, p) => s + p.amount, 0);
    if (paid < total) {
      return Response.json({ error: "المبلغ المدفوع أقل من الإجمالي" }, { status: 400 });
    }

    const [branch] = await db.select().from(branches).where(eq(branches.id, branchId)).limit(1);
    const code = await nextOrderCode("POS");

    // معاملة ذرّية: بيع الكاشير مع قفل المخزون — تمنع البيع فوق المتاح
    let order: typeof orders.$inferSelect;
    try {
      order = await db.transaction(async (tx) => {
        for (const l of lines) {
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
            if (!sizeOk.length) {
              const [hasRows] = await tx
                .select({ size: productSizeStock.size })
                .from(productSizeStock)
                .where(eq(productSizeStock.productId, l.productId))
                .limit(1);
              if (hasRows) throw new Error(`OUT_OF_STOCK:${l.name} (${l.size})`);
            }
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
            source: "pos",
            status: "delivered",
            customerName: body.customerName?.trim() || "زبون كاشير",
            phone: body.phone?.trim() || "—",
            governorate: branch?.city ?? null,
            address: branch?.name ?? null,
            paymentMethod: cleanPayments.length > 1 ? "split" : cleanPayments[0]?.method ?? "cash",
            payments: cleanPayments,
            subtotal,
            discountTotal,
            couponCode: body.couponCode && couponDiscount > 0 ? String(body.couponCode).toUpperCase() : null,
            deliveryFee: 0,
            total,
            branchId,
            shiftId,
            staffName,
            requestKey,
          })
          .returning();
        await tx.insert(orderItems).values(lines.map((l) => ({ ...l, orderId: ord.id })));
        await tx.insert(orderEvents).values({
          orderId: ord.id,
          fromStatus: null,
          toStatus: "delivered",
          actor: staffName,
          role: session.role,
        });
        // استهلاك الكوبون في نفس المعاملة — يحفظ حد الاستخدام موحّداً بين الويب والكاشير
        if (couponDiscount > 0 && coupon.coupon) {
          await tx
            .update(coupons)
            .set({ usedCount: sql`${coupons.usedCount} + 1` })
            .where(eq(coupons.id, coupon.coupon.id));
        }
        return ord;
      });
    } catch (e) {
      if ((e as Error).message.startsWith("OUT_OF_STOCK:")) {
        return Response.json({ error: `المخزون لا يكفي: ${(e as Error).message.split(":")[1]}` }, { status: 409 });
      }
      if (requestKey && (e as { code?: string }).code === "23505") {
        const [existing] = await db.select().from(orders).where(eq(orders.requestKey, requestKey)).limit(1);
        if (existing) return duplicateSale(existing);
      }
      throw e;
    }

    // إشعار SMS حقيقي عند وجود رقم — والحالة تُبلَّغ كما هي بلا ادعاء
    const smsStatus = body.phone
      ? await sendSms(
          String(body.phone),
          `باربي ${branch?.name ?? ""}: فاتورتك ${code} بقيمة ${total.toLocaleString("en-US")} د.ع. شكراً لتسوقك معنا!`
        )
      : null;

    await logAudit({ actor: staffName, role: session.role, ip: ipOf(req) }, "pos.sale", `order:${order.id}`, {
      code,
      total,
      branchId,
      payments: cleanPayments.map((p) => p.method),
    });

    return Response.json({
      ok: true,
      invoice: {
        code,
        branch: branch?.name ?? "فرع باربي",
        staffName,
        items: lines,
        subtotal,
        discountTotal,
        couponCode: order.couponCode,
        total,
        payments: cleanPayments,
        changeDue: Math.max(0, paid - total),
        createdAt: order.createdAt.toISOString(),
      },
      notifications: body.phone
        ? {
            sms: smsStatus,
            whatsapp: "link",
            message: `باربي: فاتورتك ${code} بقيمة ${total.toLocaleString("en-US")} د.ع.`,
            reason:
              smsStatus === "skipped"
                ? "مزود SMS غير مهيّأ — أرسل الفاتورة عبر واتساب"
                : smsStatus === "failed"
                  ? "تعذر إرسال SMS — أرسل الفاتورة عبر واتساب"
                  : undefined,
          }
        : null,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "حدث خطأ أثناء إتمام البيع" }, { status: 500 });
  }
}

/**
 * GET ?branchId=&take= — آخر فواتير الكاشير (للمرتجعات).
 * تتطلب جلسة كاشير، وتُقيَّد بفرع الجلسة: لا يرى كاشير فرعٍ فواتير فرع آخر.
 */
export async function GET(req: NextRequest) {
  const session = staffFromRequest(req);
  if (!session) {
    return Response.json({ error: "افتح وردية أولاً لعرض الفواتير" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const requested = Number(sp.get("branchId")) || session.branchId;
  const branchId = requested === session.branchId ? requested : session.branchId;
  const take = Math.min(Number(sp.get("take")) || 20, 50);
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.branchId, branchId))
    .orderBy(desc(orders.createdAt))
    .limit(take);
  const posRows = rows.filter((r) => r.source === "pos");
  const ids = posRows.map((r) => r.id);
  const items = ids.length
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids))
    : [];
  return Response.json({
    sales: posRows.map((r) => ({
      id: r.id,
      code: r.code,
      status: r.status,
      total: r.total,
      payments: r.payments,
      staffName: r.staffName,
      createdAt: r.createdAt.toISOString(),
      items: items.filter((i) => i.orderId === r.id),
    })),
  });
}
