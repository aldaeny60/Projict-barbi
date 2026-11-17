import type { NextRequest, NextResponse } from "next/server";
import { signToken, verifyToken } from "./session";

export const ADMIN_COOKIE = "barbi_admin";
export const ADMIN_TTL_SEC = 12 * 60 * 60;
/** dev fallback only — override via ADMIN_PIN in .env for any real deployment */
const DEV_PIN = "2024";

export type AdminRole = "owner" | "manager";
export type AdminSession = { name: string; role: AdminRole };

export function adminPin(): string {
  return process.env.ADMIN_PIN || DEV_PIN;
}

function adminSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || "barbi-dev-secret-change-me";
}

/** هل الرمز الافتراضي مستخدم؟ /api/health يُظهر تحذيراً ولا يُخفيه */
export function adminPinIsDefault(): boolean {
  return !process.env.ADMIN_PIN;
}

/**
 * جلسة إدارة موقّعة بصلاحية 12 ساعة — تحمل اسم صاحبها ودوره،
 * فتظهر كل عملية في سجل التدقيق باسم شخص لا «admin» مجهول.
 */
export function adminToken(session: AdminSession = { name: "admin", role: "owner" }, ttlSec = ADMIN_TTL_SEC): string {
  return signToken({ t: "admin", name: session.name, role: session.role }, adminSecret(), ttlSec);
}

export function adminSession(req: NextRequest): AdminSession | null {
  const payload = verifyToken<{ t?: string; name?: string; role?: string }>(
    req.cookies.get(ADMIN_COOKIE)?.value,
    adminSecret()
  );
  if (!payload || payload.t !== "admin") return null;
  return { name: payload.name || "admin", role: payload.role === "manager" ? "manager" : "owner" };
}

export function isAdminAuthed(req: NextRequest): boolean {
  return Boolean(adminSession(req));
}

/** صلاحية المالك فقط (إدارة حسابات الإدارة) */
export function isAdminOwner(req: NextRequest): boolean {
  return adminSession(req)?.role === "owner";
}

export function setAdminCookie(res: NextResponse, session: AdminSession = { name: "admin", role: "owner" }, ttlSec = ADMIN_TTL_SEC) {
  res.cookies.set(ADMIN_COOKIE, adminToken(session, ttlSec), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ttlSec,
    secure: process.env.NODE_ENV === "production",
  });
}

export function adminUnauthorized() {
  return Response.json(
    { error: "وصول غير مصرّح — هذه النقطة مخصصة للإدارة فقط" },
    { status: 401 }
  );
}

export function adminForbidden() {
  return Response.json({ error: "هذه العملية للمالك فقط" }, { status: 403 });
}
