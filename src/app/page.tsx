import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { desc, eq, isNotNull } from "drizzle-orm";
import { toProductDTO } from "@/lib/dto";
import { HomeClient } from "@/components/HomeClient";
import { AutoSeed } from "@/components/AutoSeed";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cats = await db.select().from(categories);
  if (cats.length === 0) {
    return <AutoSeed demo={env.demoMode} />;
  }
  const catById = new Map(cats.map((c) => [c.id, c]));

  const [deals, newArrivals, best] = await Promise.all([
    db.select().from(products).where(isNotNull(products.compareAtPrice)).orderBy(desc(products.soldCount)).limit(8),
    db.select().from(products).where(eq(products.isNew, true)).orderBy(desc(products.createdAt)).limit(8),
    db.select().from(products).orderBy(desc(products.soldCount)).limit(8),
  ]);

  return (
    <HomeClient
      deals={deals.map((p) => toProductDTO(p, catById.get(p.categoryId)))}
      newArrivals={newArrivals.map((p) => toProductDTO(p, catById.get(p.categoryId)))}
      best={best.map((p) => toProductDTO(p, catById.get(p.categoryId)))}
      categories={cats.map((c) => ({
        id: c.id,
        slug: c.slug,
        nameAr: c.nameAr,
        section: c.section as "boys" | "girls" | "newborn",
        tint: c.tint,
        sort: c.sort,
      }))}
    />
  );
}
