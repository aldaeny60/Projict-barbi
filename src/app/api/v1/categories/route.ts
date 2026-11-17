import { db } from "@/db";
import { categories } from "@/db/schema";
import { asc } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { apiUnauthorized, authenticateApiKey } from "@/lib/api-key";
import { checkRateLimitShared, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** GET /api/v1/categories — التصنيفات العامة (بمفتاح API) */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) return apiUnauthorized();

  const rl = await checkRateLimitShared(`api-key:${auth.id}`, 120, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);

  const rows = await db.select().from(categories).orderBy(asc(categories.sort));
  return Response.json({
    categories: rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      nameAr: c.nameAr,
      section: c.section,
      tint: c.tint,
      sort: c.sort,
    })),
  });
}
