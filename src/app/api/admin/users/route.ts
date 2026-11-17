import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { adminForbidden, adminSession, adminUnauthorized, isAdminAuthed, isAdminOwner } from "@/lib/admin-auth";
import { adminActor, logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/session";
import { hashPin, isValidPin } from "@/lib/staff-auth";
import { verifyTotp } from "@/lib/totp";

export const dynamic = "force-dynamic";

/**
 * حسابات الإدارة — المالك فقط.
 * GET/POST/PATCH/DELETE مع حماية آخر مالك مفعّل من الحذف أو الإيقاف.
 */

const isRole = (v: unknown): v is "owner" | "manager" => v === "owner" || v === "manager";

async function activeOwners(excludeId?: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(adminUsers)
    .where(
      excludeId
        ? and(eq(adminUsers.role, "owner"), eq(adminUsers.active, true), ne(adminUsers.id, excludeId))
        : and(eq(adminUsers.role, "owner"), eq(adminUsers.active, true))
    );
  return Number(row?.n ?? 0);
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  if (!isAdminOwner(req)) {
    return Response.json({ users: [], role: "manager", me: adminSession(req)?.name ?? null });
  }
  const rows = await db.select().from(adminUsers).orderBy(adminUsers.id);
  return Response.json({
    role: "owner",
    me: adminSession(req)?.name ?? null,
    users: rows.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      active: u.active,
      twoFactor: u.totpEnabled,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminOwner(req)) {
    return isAdminAuthed(req) ? adminForbidden() : adminUnauthorized();
  }
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { name?: string; pin?: string; role?: string };
  const name = String(body.name ?? "").trim();
  const pin = String(body.pin ?? "");
  if (name.length < 2) return Response.json({ error: "اسم الحساب مطلوب" }, { status: 400 });
  if (!isValidPin(pin)) return Response.json({ error: "الرمز يجب أن يكون 4 إلى 8 أرقام" }, { status: 400 });
  if (!isRole(body.role)) return Response.json({ error: "الدور غير صالح" }, { status: 400 });

  try {
    const [row] = await db
      .insert(adminUsers)
      .values({ name, pinHash: hashPin(pin), role: body.role })
      .returning();
    await logAudit(adminActor(req), "admin.user.create", `admin:${row.id}`, { name, role: row.role });
    return Response.json({ user: { id: row.id, name: row.name, role: row.role, active: row.active } });
  } catch {
    return Response.json({ error: "الاسم مستخدم مسبقاً" }, { status: 409 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdminOwner(req)) {
    return isAdminAuthed(req) ? adminForbidden() : adminUnauthorized();
  }
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    id?: number;
    name?: string;
    pin?: string;
    role?: string;
    active?: boolean;
    /** إدارة التحقق بخطوتين */
    resetTwoFactor?: boolean;
    enableTwoFactor?: boolean;
    code?: string;
  };
  const id = Number(body.id);
  if (!id) return Response.json({ error: "معرّف مطلوب" }, { status: 400 });

  const [target] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  if (!target) return Response.json({ error: "الحساب غير موجود" }, { status: 404 });

  const patch: Partial<typeof adminUsers.$inferInsert> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2) return Response.json({ error: "الاسم قصير" }, { status: 400 });
    patch.name = name;
  }
  if (body.role !== undefined) {
    if (!isRole(body.role)) return Response.json({ error: "الدور غير صالح" }, { status: 400 });
    patch.role = body.role;
  }
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.pin !== undefined) {
    const pin = String(body.pin);
    if (!isValidPin(pin)) return Response.json({ error: "الرمز يجب أن يكون 4 إلى 8 أرقام" }, { status: 400 });
    patch.pinHash = hashPin(pin);
  }
  // المالك يصفّر التحقق بخطوتين لحساب فقد جهازه
  if (body.resetTwoFactor) {
    patch.totpEnabled = false;
    patch.totpSecret = null;
  }
  // أو يفعّله مباشرةً برمز صالح من تطبيق الحساب نفسه
  if (body.enableTwoFactor) {
    if (!target.totpSecret) {
      return Response.json({ error: "لا يوجد سرّ تحقق لهذا الحساب — اطلب منه بدء التفعيل أولاً" }, { status: 400 });
    }
    if (!verifyTotp(target.totpSecret, String(body.code ?? ""))) {
      return Response.json({ error: "رمز التحقق غير صحيح" }, { status: 400 });
    }
    patch.totpEnabled = true;
  }
  if (!Object.keys(patch).length) return Response.json({ error: "لا يوجد تغيير" }, { status: 400 });

  // حماية آخر مالك مفعّل
  const losesOwner =
    target.role === "owner" &&
    target.active &&
    ((patch.role !== undefined && patch.role !== "owner") || patch.active === false);
  if (losesOwner && (await activeOwners(id)) === 0) {
    return Response.json({ error: "لا يمكن إيقاف أو تخفيض آخر مالك مفعّل" }, { status: 409 });
  }

  const [row] = await db.update(adminUsers).set(patch).where(eq(adminUsers.id, id)).returning();
  await logAudit(adminActor(req), "admin.user.update", `admin:${id}`, {
    fields: Object.keys(patch).filter((k) => k !== "pinHash" && k !== "totpSecret"),
    pinReset: Boolean(patch.pinHash),
    twoFactorReset: Boolean(body.resetTwoFactor),
    twoFactorEnabled: Boolean(body.enableTwoFactor),
  });
  return Response.json({
    user: { id: row.id, name: row.name, role: row.role, active: row.active, twoFactor: row.totpEnabled },
  });
}

export async function DELETE(req: NextRequest) {
  if (!isAdminOwner(req)) {
    return isAdminAuthed(req) ? adminForbidden() : adminUnauthorized();
  }
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return Response.json({ error: "معرّف مطلوب" }, { status: 400 });

  const [target] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  if (!target) return Response.json({ error: "الحساب غير موجود" }, { status: 404 });
  if (target.role === "owner" && target.active && (await activeOwners(id)) === 0) {
    return Response.json({ error: "لا يمكن حذف آخر مالك مفعّل" }, { status: 409 });
  }
  await db.delete(adminUsers).where(eq(adminUsers.id, id));
  await logAudit(adminActor(req), "admin.user.delete", `admin:${id}`, { name: target.name });
  return Response.json({ deleted: true });
}
