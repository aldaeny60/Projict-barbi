import { db } from "@/db";
import { categories, orderEvents, orderItems, orderReturns, orderReturnItems, orders, products } from "@/db/schema";
import { desc, eq, inArray, lte, sql } from "drizzle-orm";
import { baghdadDayKey, baghdadTodayKey } from "@/lib/format";
import { gatewayById } from "@/lib/payments";
import { toProductDTO } from "@/lib/dto";
import { adminUnauthorized, isAdminAuthed } from "@/lib/admin-auth";
import { adminActor, logAudit } from "@/lib/audit";
import { alignSizeStockToTotal } from "@/lib/stock";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const METHOD_NAMES: Record<string, string> = {
  cash: "نقدي",
  split: "دفع مقسّم",
};
const methodName = (id: string) => METHOD_NAMES[id] ?? gatewayById(id).name;

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(600);
  const todayKey = baghdadTodayKey();

  const active = allOrders.filter((o) => o.status !== "cancelled" && o.status !== "returned");
  const monthAgo = Date.now() - 30 * 86400000;
  const monthOrders = active.filter((o) => o.createdAt.getTime() >= monthAgo);
  const todayOrders = active.filter((o) => baghdadDayKey(o.createdAt) === todayKey);

  // 14-day sales series (Baghdad days)
  const series: { day: string; label: string; total: number; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = baghdadDayKey(d);
    const dayOrders = active.filter((o) => baghdadDayKey(o.createdAt) === key);
    series.push({
      day: key,
      label: key.slice(5),
      total: dayOrders.reduce((s, o) => s + o.total, 0),
      count: dayOrders.length,
    });
  }

  // payment breakdown
  const payMap = new Map<string, number>();
  for (const o of monthOrders) {
    const parts = o.payments.length ? o.payments : [{ method: o.paymentMethod, amount: o.total }];
    for (const p of parts) payMap.set(p.method, (payMap.get(p.method) ?? 0) + p.amount);
  }

  // governorates
  const govMap = new Map<string, number>();
  for (const o of monthOrders) {
    if (o.source === "web" && o.governorate) govMap.set(o.governorate, (govMap.get(o.governorate) ?? 0) + o.total);
  }

  // web vs pos
  const webTotal = monthOrders.filter((o) => o.source === "web").reduce((s, o) => s + o.total, 0);
  const posTotal = monthOrders.filter((o) => o.source === "pos").reduce((s, o) => s + o.total, 0);

  // top products by qty
  const ids = monthOrders.map((o) => o.id);
  const items = ids.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids)) : [];
  const prodMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const it of items) {
    const cur = prodMap.get(it.name) ?? { name: it.name, qty: 0, revenue: 0 };
    cur.qty += it.qty;
    cur.revenue += it.qty * it.price;
    prodMap.set(it.name, cur);
  }

  // الربح التقديري: (سعر البيع − تكلفة وقت البيع) للقطع غير المسترجعة
  const returnLines = ids.length
    ? await db
        .select({ orderItemId: orderReturnItems.orderItemId, qty: orderReturnItems.qty, orderId: orderReturns.orderId })
        .from(orderReturnItems)
        .innerJoin(orderReturns, eq(orderReturnItems.returnId, orderReturns.id))
        .where(inArray(orderReturns.orderId, ids))
    : [];
  const returnedByItem = new Map<number, number>();
  for (const l of returnLines) returnedByItem.set(l.orderItemId, (returnedByItem.get(l.orderItemId) ?? 0) + l.qty);

  let profit = 0;
  let itemsRevenue = 0;
  for (const it of items) {
    const sold = Math.max(0, it.qty - (returnedByItem.get(it.id) ?? 0));
    profit += (it.price - (it.costPrice ?? 0)) * sold;
    itemsRevenue += it.price * sold;
  }
  const marginPct = itemsRevenue > 0 ? Math.round((profit / itemsRevenue) * 100) : 0;

  const lowStock = await db.select().from(products).where(lte(products.stock, 8)).orderBy(products.stock).limit(10);
  const cats = await db.select().from(categories);
  const catById = new Map(cats.map((c) => [c.id, c]));

  const statusCounts = new Map<string, number>();
  for (const o of allOrders) statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1);

  return Response.json({
    cards: {
      todayRevenue: todayOrders.reduce((s, o) => s + o.total, 0),
      todayOrders: todayOrders.length,
      monthRevenue: monthOrders.reduce((s, o) => s + o.total, 0),
      monthOrders: monthOrders.length,
      avgOrder: monthOrders.length ? Math.round(monthOrders.reduce((s, o) => s + o.total, 0) / monthOrders.length) : 0,
      pendingOrders: statusCounts.get("pending") ?? 0,
      returns: statusCounts.get("returned") ?? 0,
      webTotal,
      posTotal,
      profit,
      marginPct,
    },
    series,
    payments: [...payMap.entries()].map(([id, value]) => ({ id, name: methodName(id), value })),
    governorates: [...govMap.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    topProducts: [...prodMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 6),
    statusBreakdown: [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
    lowStock: lowStock.map((p) => toProductDTO(p, catById.get(p.categoryId))),
    recentOrders: allOrders.slice(0, 10).map((o) => ({
      id: o.id,
      code: o.code,
      source: o.source,
      customerName: o.customerName,
      governorate: o.governorate,
      total: o.total,
      status: o.status,
      paymentMethod: o.paymentMethod,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}

/** lightweight — order rows for admin orders tab (with timeline + returned quantities) */
export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  const body = (await req.json().catch(() => ({}))) as { status?: string };
  const all = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(200);
  const filtered = body.status && body.status !== "all" ? all.filter((o) => o.status === body.status) : all;
  const ids = filtered.map((o) => o.id);

  const items = ids.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids)) : [];
  const events = ids.length ? await db.select().from(orderEvents).where(inArray(orderEvents.orderId, ids)) : [];
  const returns = ids.length ? await db.select().from(orderReturns).where(inArray(orderReturns.orderId, ids)) : [];
  const returnIds = returns.map((r) => r.id);
  const returnLines = returnIds.length
    ? await db.select().from(orderReturnItems).where(inArray(orderReturnItems.returnId, returnIds))
    : [];
  const returnedByItem = new Map<number, number>();
  for (const l of returnLines) returnedByItem.set(l.orderItemId, (returnedByItem.get(l.orderItemId) ?? 0) + l.qty);
  const refundByOrder = new Map<number, number>();
  for (const r of returns) refundByOrder.set(r.orderId, (refundByOrder.get(r.orderId) ?? 0) + r.amount);

  return Response.json({
    orders: filtered.slice(0, 100).map((o) => ({
      ...o,
      createdAt: o.createdAt.toISOString(),
      items: items
        .filter((i) => i.orderId === o.id)
        .map((i) => ({ ...i, returnedQty: returnedByItem.get(i.id) ?? 0 })),
      events: events
        .filter((e) => e.orderId === o.id)
        .map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
      refundTotal: refundByOrder.get(o.id) ?? 0,
    })),
  });
}

/** patch low stock quickly: { productId, add } */
export async function PATCH(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  const body = (await req.json()) as { productId?: number; add?: number };
  if (!body.productId) return Response.json({ error: "معرّف مطلوب" }, { status: 400 });
  const [row] = await db
    .update(products)
    .set({ stock: sql`${products.stock} + ${Math.round(Number(body.add) || 0)}` })
    .where(eq(products.id, body.productId))
    .returning();
  await logAudit(adminActor(req), "stock.restock", `product:${body.productId}`, {
    add: Math.round(Number(body.add) || 0),
    stock: row?.stock ?? null,
  });
  // يبقى مجموع مخزون المقاسات مساوياً للإجمالي
  if (row) await alignSizeStockToTotal(row.id, row.stock);
  return Response.json({ product: row });
}
