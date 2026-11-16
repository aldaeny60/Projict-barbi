import { db } from "@/db";
import { branches, orderItems, orders } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { baghdadDayKey, baghdadDayRange, baghdadTodayKey } from "@/lib/format";

export const dynamic = "force-dynamic";

/** GET ?date=YYYY-MM-DD&branchId= → تقرير الصندوق اليومي */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const date = sp.get("date") || baghdadTodayKey();
  const branchId = Number(sp.get("branchId")) || 0;
  const { start, end } = baghdadDayRange(date);

  const all = await db.select().from(orders);
  const dayOrders = all.filter((o) => {
    const t = o.createdAt.getTime();
    return t >= start.getTime() && t < end.getTime() && (!branchId || o.branchId === branchId);
  });
  const posOrders = dayOrders.filter((o) => o.source === "pos");

  const activeOrders = posOrders.filter((o) => o.status !== "returned" && o.status !== "cancelled");
  const returned = posOrders.filter((o) => o.status === "returned");

  const byPayment = new Map<string, number>();
  for (const o of activeOrders) {
    const parts = o.payments.length ? o.payments : [{ method: o.paymentMethod, amount: o.total }];
    for (const p of parts) byPayment.set(p.method, (byPayment.get(p.method) ?? 0) + p.amount);
  }
  const byBranch = new Map<number, number>();
  for (const o of activeOrders) {
    if (o.branchId) byBranch.set(o.branchId, (byBranch.get(o.branchId) ?? 0) + o.total);
  }

  const ids = activeOrders.map((o) => o.id);
  const items = ids.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids)) : [];
  const topMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const it of items) {
    const cur = topMap.get(it.name) ?? { name: it.name, qty: 0, revenue: 0 };
    cur.qty += it.qty;
    cur.revenue += it.price * it.qty;
    topMap.set(it.name, cur);
  }

  const allBranches = await db.select().from(branches);
  const gross = activeOrders.reduce((s, o) => s + o.total, 0);
  const returnsTotal = returned.reduce((s, o) => s + o.total, 0);
  const discounts = activeOrders.reduce((s, o) => s + o.discountTotal, 0);

  return Response.json({
    date,
    dateLabel: baghdadDayKey(start),
    invoicesCount: activeOrders.length,
    gross,
    discounts,
    returnsCount: returned.length,
    returnsTotal,
    net: gross - returnsTotal,
    byPayment: [...byPayment.entries()].map(([method, amount]) => ({ method, amount })),
    byBranch: [...byBranch.entries()].map(([id, amount]) => ({
      branchId: id,
      branchName: allBranches.find((b) => b.id === id)?.name ?? `فرع ${id}`,
      amount,
    })),
    topItems: [...topMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 6),
    recentSales: posOrders
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 12)
      .map((o) => ({
        id: o.id,
        code: o.code,
        total: o.total,
        status: o.status,
        staffName: o.staffName,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt.toISOString(),
      })),
  });
}
