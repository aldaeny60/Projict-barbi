import { db } from "@/db";
import { categories, customers, favorites, products } from "@/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { customerFromRequest, isSameOrigin } from "@/lib/session";
import { toProductDTO } from "@/lib/dto";
import { checkRateLimit, clientKey, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** GET — مفضلة الزبون الحالي بالأسعار والمخزون الحالي من الخادم */
export async function GET(req: NextRequest) {
  const session = customerFromRequest(req);
  if (!session) return Response.json({ favorites: [] });

  const [customer] = await db.select().from(customers).where(eq(customers.phone, session.phone)).limit(1);
  if (!customer) return Response.json({ favorites: [] });

  const rows = await db
    .select({ p: products, c: categories })
    .from(favorites)
    .innerJoin(products, eq(favorites.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(favorites.customerId, customer.id))
    .orderBy(asc(favorites.createdAt));
  return Response.json({ favorites: rows.map((r) => toProductDTO(r.p, r.c)) });
}

/** POST { productId, action } — action = "remove" لحذفها، وأي قيمة أخرى تضيفها */
export async function POST(req: NextRequest) {
  const session = customerFromRequest(req);
  if (!session) return Response.json({ error: "سجّل الدخول أولاً" }, { status: 401 });
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });
  const rl = checkRateLimit(clientKey(req, "favorites"), 60, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);

  const body = (await req.json().catch(() => ({}))) as { productId?: number; action?: string };
  const productId = Number(body.productId);
  if (!Number.isFinite(productId)) return Response.json({ error: "معرّف المنتج مطلوب" }, { status: 400 });

  const [customer] = await db.select().from(customers).where(eq(customers.phone, session.phone)).limit(1);
  if (!customer) return Response.json({ error: "الحساب غير موجود" }, { status: 404 });

  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product) return Response.json({ error: "المنتج غير موجود" }, { status: 404 });

  if (body.action === "remove") {
    await db.delete(favorites).where(and(eq(favorites.customerId, customer.id), eq(favorites.productId, productId)));
  } else {
    await db.insert(favorites).values({ customerId: customer.id, productId }).onConflictDoNothing();
  }

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(favorites)
    .where(eq(favorites.customerId, customer.id));
  return Response.json({ ok: true, count: Number(n) });
}
