import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { toProductDTO } from "@/lib/dto";
import { adminUnauthorized, isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const section = sp.get("section");
  const categorySlug = sp.get("category");
  const q = sp.get("q")?.trim();
  const sort = sp.get("sort") ?? "newest";
  const deals = sp.get("deals") === "1";
  const isNew = sp.get("new") === "1";
  const limit = Math.min(Number(sp.get("limit")) || 48, 100);

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
    conds.push(or(ilike(products.name, `%${q}%`), ilike(products.description, `%${q}%`)));
  }
  if (deals) conds.push(isNotNull(products.compareAtPrice));
  if (isNew) conds.push(eq(products.isNew, true));

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
    .limit(limit);

  let dtos = rows.map((p) => toProductDTO(p, catById.get(p.categoryId)));
  if (sort === "deals" || deals) {
    dtos = dtos.sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0) || b.soldCount - a.soldCount);
  }
  return Response.json({
    products: dtos,
    total: (await db.select({ n: sql<number>`count(*)` }).from(products))[0]?.n ?? rows.length,
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
    return Response.json({ product: row });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
