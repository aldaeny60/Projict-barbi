import { db } from "@/db";
import { categories, products } from "@/db/schema";
import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.baseUrl.replace(/\/+$/, "");
  let productUrls: MetadataRoute.Sitemap = [];
  let categoryUrls: MetadataRoute.Sitemap = [];
  try {
    const rows = await db
      .select({ id: products.id, slug: products.slug, createdAt: products.createdAt })
      .from(products);
    productUrls = rows.map((p) => ({
      url: `${base}/product/${p.slug || p.id}`,
      lastModified: p.createdAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    const cats = await db.select({ slug: categories.slug }).from(categories);
    categoryUrls = cats.map((c) => ({
      url: `${base}/shop?category=${c.slug}`,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch {
    /* db not ready */
  }
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/shop?section=boys`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/shop?section=girls`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/shop?section=newborn`, changeFrequency: "weekly", priority: 0.8 },
    ...categoryUrls,
    { url: `${base}/track`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/policies/returns`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/policies/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/policies/terms`, changeFrequency: "yearly", priority: 0.3 },
    ...productUrls,
  ];
}
