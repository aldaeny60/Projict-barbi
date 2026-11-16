import { db } from "@/db";
import { products } from "@/db/schema";
import { ilike, or } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return Response.json({ suggestions: [] });
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      price: products.price,
      compareAtPrice: products.compareAtPrice,
      images: products.images,
    })
    .from(products)
    .where(or(ilike(products.name, `%${q}%`), ilike(products.description, `%${q}%`)))
    .limit(7);
  return Response.json({
    suggestions: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      price: r.price,
      compareAtPrice: r.compareAtPrice,
      image: r.images[0] ?? null,
    })),
  });
}
