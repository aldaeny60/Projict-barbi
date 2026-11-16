import { db } from "@/db";
import { branches, orderItems, orders, products } from "@/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getCouponDiscount, nextOrderCode } from "@/lib/order-utils";
import { checkRateLimit, clientKey, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type PosLine = { productId: number; qty: number; size?: string; color?: string };
type PosPayment = { method: string; amount: number };

/**
 * POST — إنشاء فاتورة كاشير
 * body: { branchId, shiftId?, staffName, items: PosLine[], discount? {mode:'percent'|'fixed',value},
 *         couponCode?, payments: PosPayment[], customerName?, phone? }
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKey(req, "pos-sale"), 120, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);
  try {
    const body = await req.json();
    const branchId = Number(body.branchId) || 1;
    const shiftId = body.shiftId ? Number(body.shiftId) : null;
    const staffName = String(body.staffName ?? "كاشير");
    const rawItems = (body.items ?? []) as PosLine[];
    const payments = (body.payments ?? []) as PosPayment[];
    const manual = body.discount as { mode?: string; value?: number } | undefined;

    if (!rawItems.length) return Response.json({ error: "أضف منتجات للفاتورة أولاً" }, { status: 400 });

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
    const { discount: couponDiscount } = await getCouponDiscount(body.couponCode ?? null, afterManual);
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
          })
          .returning();
        await tx.insert(orderItems).values(lines.map((l) => ({ ...l, orderId: ord.id })));
        return ord;
      });
    } catch (e) {
      if ((e as Error).message.startsWith("OUT_OF_STOCK:")) {
        return Response.json({ error: `المخزون لا يكفي: ${(e as Error).message.split(":")[1]}` }, { status: 409 });
      }
      throw e;
    }

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
        ? { sms: true, whatsapp: true, message: `باربي ${branch?.name ?? ""}: فاتورتك ${code} بقيمة ${total.toLocaleString("en-US")} د.ع. شكراً لتسوقك معنا!` }
        : null,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "حدث خطأ أثناء إتمام البيع" }, { status: 500 });
  }
}

/** GET ?branchId=&take= — latest POS sales (for returns) */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const branchId = Number(sp.get("branchId")) || undefined;
  const take = Math.min(Number(sp.get("take")) || 20, 50);
  const rows = branchId
    ? await db.select().from(orders).where(eq(orders.branchId, branchId)).orderBy(desc(orders.createdAt)).limit(take)
    : await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(take);
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
