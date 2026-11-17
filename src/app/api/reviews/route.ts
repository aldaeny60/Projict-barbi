import { db } from "@/db";
import { customers, orderItems, orders, products, reviews } from "@/db/schema";
import { and, avg, count, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { checkRateLimit, clientKey, rateLimited } from "@/lib/rate-limit";
import { customerFromRequest, isSameOrigin } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * تقييم منتج — لا يُقبل إلا من زبون **استلم** المنتج فعلاً:
 * جلسة OTP موثّقة + طلب مُسلَّم (أو مرتجع) يحتوي المنتج.
 * التقييم الواحد يُحدَّث بدل تكراره (فريد لكل منتج وهاتف)، والمعدل يُعاد حسابه.
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKey(req, "reviews"), 10, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });

  const session = customerFromRequest(req);
  if (!session) {
    return Response.json(
      { error: "سجّلي برقمك أولاً حتى تنشري تقييماً", needsVerification: true },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    productId?: number;
    rating?: number;
    comment?: string;
  };
  const productId = Number(body.productId);
  const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating) || 5)));
  const comment = String(body.comment ?? "").trim();
  if (!productId || comment.length < 3) {
    return Response.json({ error: "التقييم والتعليق مطلوبان" }, { status: 400 });
  }

  // إثبات الشراء: طلب مُسلَّم/مرتجع لنفس الهاتف يحتوي هذا المنتج
  const purchased = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.phone, session.phone),
        eq(orderItems.productId, productId),
        inArray(orders.status, ["delivered", "return_requested", "returned"])
      )
    )
    .limit(1);
  if (!purchased.length) {
    return Response.json(
      { error: "التقييم بعد استلام الطلب فقط — هذا المنتج غير موجود في طلباتك المُسلَّمة" },
      { status: 403 }
    );
  }

  const [me] = await db.select().from(customers).where(eq(customers.phone, session.phone)).limit(1);
  const author = me?.name ?? session.name ?? "عميل باربي";

  // تقييم واحد لكل زبون/منتج — التعديل يحدّث النص والنجوم
  await db
    .insert(reviews)
    .values({ productId, author, phone: session.phone, rating, comment })
    .onConflictDoUpdate({
      target: [reviews.productId, reviews.phone],
      set: { rating, comment, author },
    });

  const [agg] = await db
    .select({ a: avg(reviews.rating), n: count(reviews.id) })
    .from(reviews)
    .where(eq(reviews.productId, productId));
  const newAvg = Math.round(Number(agg?.a ?? rating) * 10) / 10;
  await db
    .update(products)
    .set({ rating: String(newAvg), reviewsCount: Number(agg?.n ?? 1) })
    .where(eq(products.id, productId));

  return Response.json({ ok: true, rating: newAvg, reviewsCount: Number(agg?.n ?? 1), author });
}

