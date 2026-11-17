import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { adminUnauthorized, isAdminAuthed } from "@/lib/admin-auth";
import { adminActor, logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** خلية CSV آمنة — علامات تنصيص مزدوجة عند الحاجة */
function cell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const csv = (header: string[], rows: (string | number | null)[][]) =>
  [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

/**
 * تصدير CSV للإدارة — للمحاسبة والتقارير الخارجية.
 * GET ?type=orders|customers
 * الملف يبدأ بـ BOM حتى يقرأ Excel العربية بشكل صحيح.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  const type = req.nextUrl.searchParams.get("type") === "customers" ? "customers" : "orders";

  let body: string;
  if (type === "orders") {
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(500);
    body = csv(
      ["الكود", "التاريخ", "القناة", "الحالة", "الزبون", "الهاتف", "المحافظة", "القضاء", "العنوان", "المجموع الفرعي", "الخصم", "التوصيل", "الإجمالي", "الدفع", "الكوبون", "الفرع", "الموظف"],
      rows.map((o) => [
        o.code,
        o.createdAt.toISOString(),
        o.source,
        o.status,
        o.customerName,
        o.phone,
        o.governorate,
        o.district,
        o.address,
        o.subtotal,
        o.discountTotal,
        o.deliveryFee,
        o.total,
        o.paymentMethod,
        o.couponCode,
        o.branchId,
        o.staffName,
      ])
    );
  } else {
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
    const rows = await db.select().from(customers).orderBy(desc(customers.createdAt)).limit(500);
    body = csv(
      ["الاسم", "الهاتف", "عدد الطلبات", "الإنفاق الصافي", "آخر طلب", "مسجل من"],
      rows.map((c) => {
        const s = byPhone.get(c.phone);
        return [
          c.name,
          c.phone,
          Number(s?.ordersCount ?? 0),
          Number(s?.totalSpent ?? 0),
          s?.lastOrderAt ? new Date(s.lastOrderAt).toISOString() : "",
          c.createdAt.toISOString(),
        ];
      })
    );
  }

  await logAudit(adminActor(req), "export.run", type, {});

  return new Response(`\uFEFF${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="barbi-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
