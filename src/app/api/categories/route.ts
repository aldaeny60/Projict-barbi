import { db } from "@/db";
import { categories } from "@/db/schema";
import { asc } from "drizzle-orm";
import { adminUnauthorized, isAdminAuthed } from "@/lib/admin-auth";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
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

/* Admin: create category — مخصصة للإدارة */
export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  try {
    const body = await req.json();
    if (!body.nameAr || !body.section) {
      return Response.json({ error: "الاسم والقسم مطلوبان" }, { status: 400 });
    }
    const [row] = await db
      .insert(categories)
      .values({
        slug: body.slug || `c-${Date.now().toString(36)}`,
        nameAr: body.nameAr,
        section: body.section,
        tint: body.tint ?? "blush",
        sort: Math.round(Number(body.sort ?? 99)),
      })
      .returning();
    return Response.json({ category: row });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
