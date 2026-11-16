import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminPin, adminTokenFor } from "@/lib/admin-auth";
import { checkRateLimit, clientKey, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST { pin } → sets HttpOnly admin session cookie. Fixed PINs are forbidden: value comes from ADMIN_PIN env. */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKey(req, "admin-login"), 10, 60_000);
  if (!rl.allowed) return rateLimited(rl.retryAfterSec);
  const body = (await req.json().catch(() => ({}))) as { pin?: string };
  const pin = String(body.pin ?? "").replace(/\D/g, "");
  if (pin !== adminPin()) {
    return NextResponse.json({ error: "رمز الدخول غير صحيح" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, adminTokenFor(pin), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

/** DELETE → logout */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
