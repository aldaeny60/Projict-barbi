import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { env, sessionSecret } from "./env";

/**
 * جلسات موقّعة (HMAC-SHA256) بصلاحية زمنية — بلا مكتبات خارجية.
 * ثلاثة أنواع: إدارة، موظف كاشير، زبون. كل نوع سرّه الخاص (من `env.ts`).
 */

function secretFor(kind: "customer" | "staff"): string {
  return sessionSecret(kind);
}

const hmac = (data: string, secret: string) =>
  createHmac("sha256", secret).update(data).digest("base64url");

export function signToken(data: Record<string, unknown>, secret: string, ttlSec: number): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + ttlSec * 1000 })).toString("base64url");
  return `${body}.${hmac(body, secret)}`;
}

export function verifyToken<T extends object>(token: string | undefined | null, secret: string): (T & { exp: number }) | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(body, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/* ───────────── جلسة الزبون (بعد تحقق OTP) ───────────── */

export const CUSTOMER_COOKIE = "barbi_cust";
export const CUSTOMER_TTL_SEC = 30 * 24 * 60 * 60;

export type CustomerSession = { phone: string; name: string };

export function customerFromRequest(req: NextRequest): CustomerSession | null {
  return verifyToken<CustomerSession>(req.cookies.get(CUSTOMER_COOKIE)?.value, secretFor("customer"));
}

export function setCustomerCookie(res: NextResponse, session: CustomerSession) {
  res.cookies.set(CUSTOMER_COOKIE, signToken(session, secretFor("customer"), CUSTOMER_TTL_SEC), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: CUSTOMER_TTL_SEC,
    secure: env.isProd,
  });
}

export function clearCustomerCookie(res: NextResponse) {
  res.cookies.set(CUSTOMER_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/* ───────────── جلسة موظف الكاشير (بعد فتح الوردية) ───────────── */

export const STAFF_COOKIE = "barbi_staff";
export const STAFF_TTL_SEC = 16 * 60 * 60;

export type StaffRole = "cashier" | "supervisor" | "manager";
export type StaffSession = {
  staffName: string;
  role: StaffRole;
  branchId: number;
  shiftId: number;
};

export const STAFF_ROLE_RANK: Record<StaffRole, number> = { cashier: 1, supervisor: 2, manager: 3 };

export function isStaffRole(v: unknown): v is StaffRole {
  return v === "cashier" || v === "supervisor" || v === "manager";
}

export function staffFromRequest(req: NextRequest): StaffSession | null {
  return verifyToken<StaffSession>(req.cookies.get(STAFF_COOKIE)?.value, secretFor("staff"));
}

export function setStaffCookie(res: NextResponse, session: StaffSession) {
  res.cookies.set(STAFF_COOKIE, signToken(session, secretFor("staff"), STAFF_TTL_SEC), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: STAFF_TTL_SEC,
    secure: env.isProd,
  });
}

export function clearStaffCookie(res: NextResponse) {
  res.cookies.set(STAFF_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export function staffAtLeast(req: NextRequest, role: StaffRole): StaffSession | null {
  const s = staffFromRequest(req);
  if (!s) return null;
  return STAFF_ROLE_RANK[s.role] >= STAFF_ROLE_RANK[role] ? s : null;
}

/* ───────────── حماية CSRF للطلبات المعدِّلة ───────────── */

/** يتحقق أن الطلب جاء من نفس أصل الموقع (لا من صفحة خارجية) */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export function forbidden(message = "وصول غير مصرّح لهذه العملية"): Response {
  return Response.json({ error: message }, { status: 403 });
}
