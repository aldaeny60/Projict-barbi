import { db } from "@/db";
import { branches, staffUsers } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { adminUnauthorized, isAdminAuthed } from "@/lib/admin-auth";
import { adminActor, logAudit } from "@/lib/audit";
import { isStaffRole, isSameOrigin } from "@/lib/session";
import { hashPin, isValidPin } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

/**
 * حسابات الموظفين (RBAC) — إدارة فقط.
 * GET    → القائمة مع فروعها (بلا أي hash)
 * POST   { name, role, branchId, pin } → إنشاء حساب
 * PATCH  { id, name?, role?, branchId?, active?, pin? } → تعديل/إيقاف/إعادة تعيين الرمز
 * DELETE ?id= → حذف الحساب (يبقى سجل تدقيقه)
 */

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  const rows = await db
    .select({ s: staffUsers, branchName: branches.name })
    .from(staffUsers)
    .leftJoin(branches, eq(staffUsers.branchId, branches.id))
    .orderBy(asc(staffUsers.id));
  return Response.json({
    staff: rows.map(({ s, branchName }) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      branchId: s.branchId,
      branchName: branchName ?? null,
      active: s.active,
      createdAt: s.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    role?: string;
    branchId?: number | null;
    pin?: string;
  };
  const name = String(body.name ?? "").trim();
  const pin = String(body.pin ?? "");
  if (name.length < 2) return Response.json({ error: "اسم الموظف مطلوب" }, { status: 400 });
  if (!isStaffRole(body.role)) {
    return Response.json({ error: "الدور غير صالح — كاشير أو مشرف أو مدير" }, { status: 400 });
  }
  if (!isValidPin(pin)) {
    return Response.json({ error: "رمز الموظف يجب أن يكون 4 إلى 8 أرقام" }, { status: 400 });
  }

  const branchId = body.branchId === null || body.branchId === undefined ? null : Number(body.branchId);
  const [row] = await db
    .insert(staffUsers)
    .values({ name, role: body.role, branchId, pinHash: hashPin(pin) })
    .returning();

  await logAudit(adminActor(req), "staff.create", `staff:${row.id}`, { name, role: row.role, branchId });
  return Response.json({
    staff: { id: row.id, name: row.name, role: row.role, branchId: row.branchId, active: row.active },
  });
}

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    id?: number;
    name?: string;
    role?: string;
    branchId?: number | null;
    active?: boolean;
    pin?: string;
  };
  const id = Number(body.id);
  if (!id) return Response.json({ error: "معرّف الموظف مطلوب" }, { status: 400 });

  const patch: Partial<typeof staffUsers.$inferInsert> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2) return Response.json({ error: "الاسم قصير جداً" }, { status: 400 });
    patch.name = name;
  }
  if (body.role !== undefined) {
    if (!isStaffRole(body.role)) return Response.json({ error: "الدور غير صالح" }, { status: 400 });
    patch.role = body.role;
  }
  if (body.branchId !== undefined) {
    patch.branchId = body.branchId === null ? null : Number(body.branchId);
  }
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.pin !== undefined) {
    const pin = String(body.pin);
    if (!isValidPin(pin)) return Response.json({ error: "الرمز يجب أن يكون 4 إلى 8 أرقام" }, { status: 400 });
    patch.pinHash = hashPin(pin);
  }
  if (!Object.keys(patch).length) return Response.json({ error: "لا يوجد تغيير" }, { status: 400 });

  const [row] = await db.update(staffUsers).set(patch).where(eq(staffUsers.id, id)).returning();
  if (!row) return Response.json({ error: "الموظف غير موجود" }, { status: 404 });

  await logAudit(adminActor(req), "staff.update", `staff:${id}`, {
    fields: Object.keys(patch).filter((k) => k !== "pinHash"),
    pinReset: Boolean(patch.pinHash),
    active: row.active,
  });
  return Response.json({
    staff: { id: row.id, name: row.name, role: row.role, branchId: row.branchId, active: row.active },
  });
}

export async function DELETE(req: NextRequest) {
  if (!adminAuthed(req)) return adminUnauthorized();
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return Response.json({ error: "معرّف مطلوب" }, { status: 400 });
  const [row] = await db.delete(staffUsers).where(eq(staffUsers.id, id)).returning();
  if (!row) return Response.json({ error: "الموظف غير موجود" }, { status: 404 });
  await logAudit(adminActor(req), "staff.delete", `staff:${id}`, { name: row.name, role: row.role });
  return Response.json({ deleted: true });
}
