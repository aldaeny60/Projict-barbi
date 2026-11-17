import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { apiUnauthorized, authenticateApiKey } from "@/lib/api-key";
import { arabicLike } from "@/lib/arabic";
import { toProductDTO } from "@/lib/dto";
import { sizeStockMap } from "@/lib/stock";
import { checkRateLimitShared, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/products — كتالوج عام للقراءة فقط (بمفتاح API).
 * لا يعيد سعر التكلفة ولا أي بيانات زبائن، ويحمل `sizeStock` لكل منتج.
 * فلاتر: section, category, q, sort, deals, new, minPrice, maxPrice, size, color, limit, offset
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) return apiUnauthorized();

  const rl = await checkRateLimitShared(`api-key:${auth.id}`, 120, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);

  const sp = req.nextUrl.searchParams;
  const section = sp.get("section");
  const categorySlug = sp.get("category");
  const q = sp.get("q")?.trim();
  const sort = sp.get("sort") ?? "newest";
  const minPrice = Number(sp.get("minPrice"));
  const maxPrice = Number(sp.get("maxPrice"));
  const size = sp.get("size")?.trim();
  const color = sp.get("color")?.trim();
  const limit = Math.min(Number(sp.get("limit")) || 24, 100);
  const offset = Math.max(0, Number(sp.get("offset")) || 0);

  const allCats = await db.select().from(categories);
  const catById = new Map(allCats.map((c) => [c.id, c]));

  const conds = [];
  if (section) {
    const ids = allCats.filter((c) => c.section === section).map((c) => c.id);
    conds.push(ids.length ? inArray(products.categoryId, ids) : isNull(products.id));
  }
  if (categorySlug) {
    const cat = allCats.find((c) => c.slug === categorySlug);
    if (cat) conds.push(eq(products.categoryId, cat.id));
  }
  if (q) conds.push(or(arabicLike(products.name, q), arabicLike(products.description, q)));
  if (sp.get("deals") === "1") conds.push(isNotNull(products.compareAtPrice));
  if (sp.get("new") === "1") conds.push(eq(products.isNew, true));
  if (Number.isFinite(minPrice) && minPrice > 0) conds.push(gte(products.price, Math.round(minPrice)));
  if (Number.isFinite(maxPrice) && maxPrice > 0) conds.push(lte(products.price, Math.round(maxPrice)));
  if (size) conds.push(sql`${products.sizes}::jsonb @> ${JSON.stringify([size])}::jsonb`);
  if (color) conds.push(sql`${products.colors}::jsonb @> ${JSON.stringify([{ name: color }])}::jsonb`);

  const orderBy =
    sort === "price_asc"
      ? [asc(products.price)]
      : sort === "price_desc"
        ? [desc(products.price)]
        : sort === "best"
          ? [desc(products.soldCount)]
          : sort === "rating"
            ? [desc(products.rating)]
            : [desc(products.createdAt)];

  const rows = await db
    .select()
    .from(products)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  const sizeMap = await sizeStockMap(rows.map((p) => p.id));
  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(products)
    .where(conds.length ? and(...conds) : undefined);

  return Response.json({
    products: rows.map((p) => toProductDTO(p, catById.get(p.categoryId), sizeMap.get(p.id), false)),
    total: Number(countRow?.n ?? rows.length),
    limit,
    offset,
  });
}
