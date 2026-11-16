import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { desc, ilike, or, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { adminUnauthorized, isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * الزبائن مع مؤشراتهم — من يشتري فعلاً وكم.
 * GET ?q= → قائمة (اسم/هاتف) مع عدد الطلبات، الإنفاق الصافي، وآخر طلب.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  const q = req.nextUrl.searchParams.get("q")?.trim();

  const rows = await db
    .select()
    .from(customers)
    .where(q ? or(ilike(customers.name, `%${q}%`), ilike(customers.phone, `%${q}%`)) : undefined)
    .orderBy(desc(customers.createdAt))
    .limit(300);

  const stats = await db
    .select({
      phone: orders.phone,
      ordersCount: sql<number>`count(*)`,
      totalSpent: sql<number>`coalesce(sum(case when ${orders.status} not in ('cancelled','returned') then ${orders.total} else 0 end), 0)`,
      lastOrderAt: sql<string>`max(${orders.createdAt})`,
    })
    .from(orders)
    .groupBy(orders.phone);
  const byPhone = new Map(stats.map((s) => [s.phone, s]));

  return Response.json({
    customers: rows.map((c) => {
      const s = byPhone.get(c.phone);
      const last = s?.lastOrderAt ? new Date(s.lastOrderAt) : null;
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        createdAt: c.createdAt.toISOString(),
        ordersCount: Number(s?.ordersCount ?? 0),
        totalSpent: Number(s?.totalSpent ?? 0),
        lastOrderAt: last && !Number.isNaN(last.getTime()) ? last.toISOString() : null,
      };
    }),
  });
}
