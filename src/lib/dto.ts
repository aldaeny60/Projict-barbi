import type { categories, products } from "@/db/schema";
import type { ProductDTO } from "@/lib/types";

export function toProductDTO(
  p: typeof products.$inferSelect,
  c?: typeof categories.$inferSelect | null,
  sizeStock?: { size: string; stock: number }[],
  includeCost = false
): ProductDTO {
  const discountPct =
    p.compareAtPrice && p.compareAtPrice > p.price
      ? Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100)
      : null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    discountPct,
    images: p.images,
    colors: p.colors,
    sizes: p.sizes,
    barcode: p.barcode,
    stock: p.stock,
    rating: Number(p.rating),
    reviewsCount: p.reviewsCount,
    soldCount: p.soldCount,
    isNew: p.isNew,
    createdAt: p.createdAt.toISOString(),
    categoryId: p.categoryId,
    categorySlug: c?.slug ?? "",
    categoryName: c?.nameAr ?? "",
    section: (c?.section as ProductDTO["section"]) ?? "boys",
    ...(sizeStock && sizeStock.length ? { sizeStock } : {}),
    ...(includeCost ? { costPrice: p.costPrice } : {}),
  };
}
