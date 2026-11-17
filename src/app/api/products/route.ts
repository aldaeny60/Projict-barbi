import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { toProductDTO } from "@/lib/dto";
import { arabicLike } from "@/lib/arabic";
import { sizeStockMap, distributeStock, replaceSizeStock } from "@/lib/stock";
import { adminUnauthorized, isAdminAuthed } from "@/lib/admin-auth";
import { adminActor, logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const section = sp.get("section");
  const categorySlug = sp.get("category");
  const q = sp.get("q")?.trim();
  const sort = sp.get("sort") ?? "newest";
  const deals = sp.get("deals") === "1";
  const isNew = sp.get("new") === "1";
  const minPrice = Number(sp.get("minPrice"));
  const maxPrice = Number(sp.get("maxPrice"));
  const size = sp.get("size")?.trim();
  const color = sp.get("color")?.trim();
  const limit = Math.min(Number(sp.get("limit")) || 48, 100);
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
  if (q) {
    // تطبيع عربي على طرفي المقارنة (همزات/تاء مربوطة/تشكيل) — لا مطابقة حرفية
    conds.push(or(arabicLike(products.name, q), arabicLike(products.description, q)));
  }
  if (deals) conds.push(isNotNull(products.compareAtPrice));
  if (isNew) conds.push(eq(products.isNew, true));
  if (Number.isFinite(minPrice) && minPrice > 0) conds.push(gte(products.price, Math.round(minPrice)));
  if (Number.isFinite(maxPrice) && maxPrice > 0) conds.push(lte(products.price, Math.round(maxPrice)));
  // jsonb containment: المقاس داخل مصفوفة sizes، واللون ككائن جزئي داخل colors
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
  // التكلفة تُعاد للإدارة فقط — لا تتسرب للكتالوج العام
  const includeCost = isAdminAuthed(req);
  let dtos = rows.map((p) =>
    toProductDTO(p, catById.get(p.categoryId), sizeMap.get(p.id), includeCost)
  );
  if (sort === "deals" || deals) {
    dtos = dtos.sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0) || b.soldCount - a.soldCount);
  }
  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(products)
    .where(conds.length ? and(...conds) : undefined);
  return Response.json({
    products: dtos,
    total: Number(countRow?.n ?? dtos.length),
    offset,
    limit,
  });
}

/* Admin: create product — مخصصة للإدارة */
export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  try {
    const body = await req.json();
    if (!body.name || !body.price || !body.categoryId) {
      return Response.json({ error: "الاسم والسعر والتصنيف مطلوبة" }, { status: 400 });
    }
    const [row] = await db
      .insert(products)
      .values({
        slug: body.slug || `p-${Date.now().toString(36)}`,
        name: body.name,
        description: body.description ?? "",
        price: Math.round(Number(body.price)),
        costPrice: Math.max(0, Math.round(Number(body.costPrice ?? 0))),
        compareAtPrice: body.compareAtPrice ? Math.round(Number(body.compareAtPrice)) : null,
        images: Array.isArray(body.images) ? body.images.filter(Boolean) : [],
        colors: Array.isArray(body.colors) ? body.colors : [],
        sizes: Array.isArray(body.sizes) ? body.sizes : [],
        categoryId: Number(body.categoryId),
        barcode: body.barcode || `62${String(Date.now()).slice(-11)}`,
        stock: Math.round(Number(body.stock ?? 0)),
        isNew: Boolean(body.isNew),
      })
      .returning();
    // مخزون المقاسات يبدأ موزّعاً على الإجمالي
    const sizes = Array.isArray(row.sizes) ? row.sizes : [];
    if (sizes.length) await replaceSizeStock(row.id, distributeStock(row.stock, sizes));
    await logAudit(adminActor(req), "product.create", `product:${row.id}`, {
      name: row.name,
      price: row.price,
      stock: row.stock,
    });
    return Response.json({ product: row });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
