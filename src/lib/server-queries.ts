import { db } from "@/db";
import { categories, products, reviews } from "@/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import { toProductDTO } from "./dto";

/** Full product detail: DTO + similar + reviews (server-side, no HTTP) */
export async function getProductDetail(idOrSlug: string) {
  const numId = Number(idOrSlug);
  const [row] = await db
    .select()
    .from(products)
    .where(Number.isFinite(numId) ? eq(products.id, numId) : eq(products.slug, idOrSlug))
    .limit(1);
  if (!row) return null;

  const [cat] = await db.select().from(categories).where(eq(categories.id, row.categoryId)).limit(1);

  let similar = await db
    .select()
    .from(products)
    .where(and(eq(products.categoryId, row.categoryId), ne(products.id, row.id)))
    .orderBy(desc(products.soldCount))
    .limit(4);
  if (similar.length < 4 && cat) {
    const more = await db
      .select({ p: products, c: categories })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(categories.section, cat.section), ne(products.id, row.id)))
      .orderBy(desc(products.soldCount))
      .limit(8);
    for (const m of more) {
      if (!similar.find((s) => s.id === m.p.id) && similar.length < 4) similar.push(m.p);
    }
  }

  const productReviews = await db
    .select()
    .from(reviews)
    .where(eq(reviews.productId, row.id))
    .orderBy(desc(reviews.createdAt))
    .limit(20);

  const catById = new Map([[cat?.id ?? -1, cat]]);
  return {
    product: toProductDTO(row, cat),
    similar: similar.map((p) => toProductDTO(p, catById.get(p.categoryId) ?? cat)),
    reviews: productReviews.map((r) => ({
      id: r.id,
      author: r.author,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
