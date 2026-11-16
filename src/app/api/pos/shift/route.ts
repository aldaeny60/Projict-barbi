import { db } from "@/db";
import { branches, shifts, staffUsers } from "@/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { ipOf, logAudit } from "@/lib/audit";
import { checkRateLimitShared, clientKey, rateLimited } from "@/lib/rate-limit";
import {
  clearStaffCookie,
  isSameOrigin,
  isStaffRole,
  setStaffCookie,
  staffFromRequest,
  type StaffRole,
} from "@/lib/session";
import { isValidPin, verifyPin } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

const toDTO = (s: typeof shifts.$inferSelect) => ({
  id: s.id,
  branchId: s.branchId,
  staffName: s.staffName,
  role: s.role,
  status: s.status,
  openingCash: s.openingCash,
  closingCash: s.closingCash,
  openedAt: s.openedAt.toISOString(),
  closedAt: s.closedAt?.toISOString() ?? null,
});

/** GET ?branchId= → الوردية المفتوحة + الفروع + حسابات موظفي الفرع (بلا رموز) + الجلسة */
export async function GET(req: NextRequest) {
  const branchId = Number(req.nextUrl.searchParams.get("branchId")) || 1;
  const [openShift] = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.branchId, branchId), eq(shifts.status, "open")))
    .orderBy(desc(shifts.openedAt))
    .limit(1);
  const allBranches = await db.select().from(branches);
  const staff = await db
    .select({ id: staffUsers.id, name: staffUsers.name, role: staffUsers.role })
    .from(staffUsers)
    .where(and(eq(staffUsers.branchId, branchId), eq(staffUsers.active, true)))
    .orderBy(asc(staffUsers.name));
  return Response.json({
    shift: openShift ? toDTO(openShift) : null,
    branches: allBranches.map((b) => ({
      id: b.id,
      name: b.name,
      city: b.city,
      phone: b.phone,
      address: b.address,
    })),
    // قائمة بلا أي hash — تُستخدم لاختيار الحساب في شاشة الكاشير
    staff,
    session: staffFromRequest(req),
  });
}

/**
 * POST { action: "open" | "close" }
 *
 * الفتح بحساب موظف: { staffId, pin } — يُتحقق من الرمز المُجزّأ (scrypt)،
 * ويُشتق الاسم والدور من الحساب لا من جسم الطلب. إذا كان للفرع حسابات
 * مفعّلة فالفتح بالاسم وحده مرفوض (لا تجاوز للصلاحيات).
 *
 * الفتح بالاسم يبقى متاحاً فقط لفرع بلا حسابات (تهيئة أولى/تطوير)،
 * ودور «مدير» فيه يتطلب جلسة إدارة.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });
  const rl = await checkRateLimitShared(clientKey(req, "pos-shift"), 30, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    branchId?: number;
    shiftId?: number;
    staffId?: number;
    pin?: string;
    staffName?: string;
    role?: string;
    openingCash?: number;
    closingCash?: number;
  };

  if (body.action === "open") {
    const admin = isAdminAuthed(req);
    const existing = staffFromRequest(req);
    const branchId = Number(body.branchId) || existing?.branchId || 1;

    let staffName: string;
    let role: StaffRole;
    let authenticated = false;
    let staffUserId: number | null = null;

    const staffId = Number(body.staffId) || 0;
    if (staffId) {
      const [account] = await db.select().from(staffUsers).where(eq(staffUsers.id, staffId)).limit(1);
      if (!account) return Response.json({ error: "حساب الموظف غير موجود" }, { status: 404 });
      if (!account.active) return Response.json({ error: "هذا الحساب موقوف — راجع الإدارة" }, { status: 403 });
      if (account.branchId && account.branchId !== branchId) {
        return Response.json({ error: "هذا الحساب ليس لفرعك" }, { status: 403 });
      }
      const pin = String(body.pin ?? "");
      if (!isValidPin(pin) || !verifyPin(pin, account.pinHash)) {
        await logAudit(
          { actor: account.name, role: account.role, ip: ipOf(req) },
          "pos.shift.denied",
          `staff:${account.id}`,
          { branchId, reason: "wrong-pin" }
        );
        return Response.json({ error: "رمز الموظف غير صحيح" }, { status: 401 });
      }
      staffName = account.name;
      role = isStaffRole(account.role) ? account.role : "cashier";
      authenticated = true;
      staffUserId = account.id;
    } else {
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)` })
        .from(staffUsers)
        .where(and(eq(staffUsers.branchId, branchId), eq(staffUsers.active, true)));
      if (Number(n ?? 0) > 0) {
        return Response.json(
          { error: "هذا الفرع يستخدم حسابات موظفين — اختر حسابك وأدخل رمزك" },
          { status: 403 }
        );
      }
      role = isStaffRole(body.role) ? body.role : "cashier";
      // منح دور "مدير فرع" يتطلب جلسة إدارة — الكاشير لا يرفع صلاحيته بنفسه
      if (role === "manager" && !admin) {
        return Response.json({ error: "فتح وردية بصلاحية مدير يتطلب دخول الإدارة" }, { status: 403 });
      }
      staffName = String(body.staffName ?? "").trim() || "كاشير";
    }

    await db
      .update(shifts)
      .set({ status: "closed", closedAt: new Date() })
      .where(and(eq(shifts.branchId, branchId), eq(shifts.status, "open")));
    const [row] = await db
      .insert(shifts)
      .values({
        branchId,
        staffName,
        role,
        openingCash: Math.max(0, Math.round(Number(body.openingCash) || 0)),
      })
      .returning();

    await logAudit(
      { actor: staffName, role, ip: ipOf(req) },
      "pos.shift.open",
      `shift:${row.id}`,
      { branchId, authenticated, staffUserId }
    );

    const res = NextResponse.json({ shift: toDTO(row), session: { authenticated } });
    setStaffCookie(res, { staffName: row.staffName, role, branchId, shiftId: row.id });
    return res;
  }

  if (body.action === "close") {
    const session = staffFromRequest(req);
    const shiftId = Number(body.shiftId) || session?.shiftId;
    if (!shiftId) return Response.json({ error: "لا توجد وردية مفتوحة" }, { status: 400 });
    const [target] = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
    if (!target) return Response.json({ error: "الوردية غير موجودة" }, { status: 404 });
    // إغلاق الصندوق لمشرف أو مدير (أو الإدارة) — الكاشير لا يغلق صندوقه بنفسه
    const isAdmin = isAdminAuthed(req);
    const mayClose =
      isAdmin ||
      (session?.shiftId === shiftId && (session.role === "manager" || session.role === "supervisor"));
    if (!mayClose) {
      return Response.json({ error: "إغلاق الصندوق يتطلب صلاحية مشرف أو مدير" }, { status: 403 });
    }
    const [row] = await db
      .update(shifts)
      .set({
        status: "closed",
        closedAt: new Date(),
        closingCash: Math.max(0, Math.round(Number(body.closingCash) || 0)),
      })
      .where(eq(shifts.id, shiftId))
      .returning();

    await logAudit(
      {
        actor: session?.staffName ?? "admin",
        role: isAdmin ? "admin" : (session?.role ?? "cashier"),
        ip: ipOf(req),
      },
      "pos.shift.close",
      `shift:${shiftId}`,
      { branchId: row.branchId, closingCash: row.closingCash }
    );

    const res = NextResponse.json({ shift: toDTO(row) });
    clearStaffCookie(res);
    return res;
  }

  return Response.json({ error: "إجراء غير معروف" }, { status: 400 });
}
