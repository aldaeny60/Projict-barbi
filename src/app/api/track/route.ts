import { db } from "@/db";
import { orderEvents, orderItems, orders } from "@/db/schema";
import { asc, desc, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { isValidIraqiPhone, maskPhone } from "@/lib/format";
import { customerFromRequest } from "@/lib/session";
import { checkRateLimit, clientKey, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * تتبع الطلب — مستويان:
 *  1) جلسة OTP موثّقة → كل طلبات الزبون بالتفاصيل والإجمالي.
 *  2) بلا جلسة → يلزم رقم الهاتف + رقم الطلب المطابق، والرد مخفّف:
 *     الحالة والمحافظة وعدد القطع وأسماء القطع، بلا اسم ولا عنوان ولا إجمالي،
 *     والهاتف مُقنّع. هكذا لا يستطيع أحد تعداد طلبات الآخرين.
 */
export async function GET(req: NextRequest) {
  const rl = checkRateLimit(clientKey(req, "track"), 30, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);

  const session = customerFromRequest(req);
  if (session) {
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.phone, session.phone))
      .orderBy(desc(orders.createdAt))
      .limit(50);
    if (!rows.length) return Response.json({ verified: true, orders: [] });
    const items = await db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, rows.map((r) => r.id)));
    const events = await db
      .select()
      .from(orderEvents)
      .where(inArray(orderEvents.orderId, rows.map((r) => r.id)));
    return Response.json({
      verified: true,
      orders: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        items: items.filter((i) => i.orderId === r.id),
        events: events
          .filter((e) => e.orderId === r.id)
          .map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
      })),
    });
  }

  const sp = req.nextUrl.searchParams;
  const phone = (sp.get("phone") ?? "").replace(/\s/g, "");
  const code = (sp.get("code") ?? "").trim();
  if (!code || !isValidIraqiPhone(phone)) {
    return Response.json(
      {
        orders: [],
        needsVerification: true,
        message: "أدخلي رقم الهاتف ورقم الطلب، أو وثّقي رقمك برمز SMS لعرض كل طلباتك",
      },
      { status: 401 }
    );
  }
  // لا يُستدل بوجود الطلب على صحة الرقم: الرد موحّد عند عدم التطابق
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ error: "طلب غير موثوق" }, { status: 403 });
  }
  const [row] = await db.select().from(orders).where(eq(orders.code, code)).limit(1);
  if (!row || row.phone !== phone) {
    return Response.json({ error: "ما لقينا طلباً مطابقاً — تأكدي من رقم الطلب والهاتف" }, { status: 404 });
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, row.id));
  const history = await db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, row.id))
    .orderBy(asc(orderEvents.createdAt));
  return Response.json({
    verified: false,
    masked: true,
    orders: [
      {
        code: row.code,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        governorate: row.governorate,
        phone: maskPhone(row.phone),
        itemsPreview: items.map((i) => ({ name: i.name, qty: i.qty })),
        history: history.map((e) => ({ toStatus: e.toStatus, createdAt: e.createdAt.toISOString() })),
      },
    ],
  });
}
