import type { NextRequest, NextResponse } from "next/server";
import { signToken, verifyToken } from "./session";

export const ADMIN_COOKIE = "barbi_admin";
export const ADMIN_TTL_SEC = 12 * 60 * 60;
/** dev fallback only — override via ADMIN_PIN in .env for any real deployment */
const DEV_PIN = "2024";

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

/** جلسة إدارة موقّعة بصلاحية 12 ساعة — تختلف عن الرمز نفسه فلا تُعاد استخدامه بنسخ آخر */
export function adminToken(ttlSec = ADMIN_TTL_SEC): string {
  return signToken({ t: "admin" }, adminSecret(), ttlSec);
}

export function isAdminAuthed(req: NextRequest): boolean {
  return Boolean(verifyToken(req.cookies.get(ADMIN_COOKIE)?.value, adminSecret()));
}

export function setAdminCookie(res: NextResponse, ttlSec = ADMIN_TTL_SEC) {
  res.cookies.set(ADMIN_COOKIE, adminToken(ttlSec), {
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
