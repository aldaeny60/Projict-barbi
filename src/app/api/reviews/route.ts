import { db } from "@/db";
import { products, reviews } from "@/db/schema";
import { avg, count, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { checkRateLimit, clientKey, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKey(req, "reviews"), 10, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);
  const body = (await req.json()) as {
    productId?: number;
    author?: string;
    rating?: number;
    comment?: string;
  };
  const productId = Number(body.productId);
  const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating) || 5)));
  if (!productId || !body.comment?.trim()) {
    return Response.json({ error: "التقييم والتعليق مطلوبان" }, { status: 400 });
  }
  await db.insert(reviews).values({
    productId,
    author: body.author?.trim() || "عميل باربي",
    rating,
    comment: body.comment.trim(),
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
  return Response.json({ ok: true, rating: newAvg, reviewsCount: Number(agg?.n ?? 1) });
}
