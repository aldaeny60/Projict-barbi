import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminPin, setAdminCookie } from "@/lib/admin-auth";
import { adminActor, logAudit } from "@/lib/audit";
import { checkRateLimitShared, clientKey, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST { pin } → جلسة إدارة موقّعة بصلاحية 12 ساعة (كوكي HttpOnly SameSite=Lax).
 * الرمز يأتي من ADMIN_PIN في البيئة — لا رمز ثابت بالكود للإنتاج (LAW 004).
 * كل محاولة تُحسب ضد حدّ المعدل وتُكتب في سجل التدقيق (نجاحاً أو فشلاً).
 */
export async function POST(req: NextRequest) {
  const rl = await checkRateLimitShared(clientKey(req, "admin-login"), 10, 60_000);
  if (!rl.allowed) {
    await logAudit(adminActor(req), "admin.login.blocked", null, { reason: "rate-limit" });
    return rateLimited(rl.retryAfterSec);
  }
  const body = (await req.json().catch(() => ({}))) as { pin?: string };
  const pin = String(body.pin ?? "").replace(/\D/g, "");
  if (pin !== adminPin()) {
    await logAudit(adminActor(req), "admin.login.failed", null, { reason: "wrong-pin" });
    return NextResponse.json({ error: "رمز الدخول غير صحيح" }, { status: 401 });
  }
  await logAudit(adminActor(req), "admin.login", null, {});
  const res = NextResponse.json({ ok: true });
  setAdminCookie(res);
  return res;
}

/** DELETE → logout */
export async function DELETE(req: NextRequest) {
  await logAudit(adminActor(req), "admin.logout");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
