import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ADMIN_COOKIE, adminPin, setAdminCookie, type AdminRole } from "@/lib/admin-auth";
import { adminActor, logAudit } from "@/lib/audit";
import { checkRateLimitShared, clientKey, rateLimited } from "@/lib/rate-limit";
import { verifyPin } from "@/lib/staff-auth";
import { verifyTotp } from "@/lib/totp";

export const dynamic = "force-dynamic";

/**
 * POST { pin, name? }
 * — باسم حساب إداري: يُتحقق من PIN المُجزّأ (scrypt) وتُبنى الجلسة باسمه ودوره.
 * — بلا اسم: رمز ADMIN_PIN القديم (مالك) ليبقى الدخول ممكناً قبل إنشاء الحسابات.
 * كل محاولة تُحسب ضد حدّ المعدل وتُكتب في سجل التدقيق.
 */
export async function POST(req: NextRequest) {
  const rl = await checkRateLimitShared(clientKey(req, "admin-login"), 10, 60_000);
  if (!rl.allowed) {
    await logAudit(adminActor(req), "admin.login.blocked", null, { reason: "rate-limit" });
    return rateLimited(rl.retryAfterSec);
  }

  const body = (await req.json().catch(() => ({}))) as { pin?: string; name?: string; code?: string };
  const pin = String(body.pin ?? "").replace(/\D/g, "");
  const name = String(body.name ?? "").trim();
  const code = String(body.code ?? "").replace(/\D/g, "");

  if (name) {
    const [user] = await db
      .select()
      .from(adminUsers)
      .where(and(eq(adminUsers.name, name), eq(adminUsers.active, true)))
      .limit(1);
    if (!user || !verifyPin(pin, user.pinHash)) {
      await logAudit(adminActor(req), "admin.login.failed", null, { reason: "wrong-user-pin", name });
      return NextResponse.json({ error: "الاسم أو الرمز غير صحيح" }, { status: 401 });
    }

    // التحقق بخطوتين عند تفعيله لهذا الحساب
    if (user.totpEnabled) {
      if (!code) {
        return NextResponse.json(
          { error: "أدخل رمز التحقق من تطبيق المصادقة", needs2fa: true },
          { status: 401 }
        );
      }
      if (!user.totpSecret || !verifyTotp(user.totpSecret, code)) {
        await logAudit({ actor: user.name, role: "admin", ip: null }, "admin.login.failed", `admin:${user.id}`, { reason: "wrong-2fa" });
        return NextResponse.json({ error: "رمز التحقق غير صحيح", needs2fa: true }, { status: 401 });
      }
    }

    const role: AdminRole = user.role === "owner" ? "owner" : "manager";
    await logAudit(
      { actor: user.name, role: "admin", ip: null },
      "admin.login",
      `admin:${user.id}`,
      { via: "account", twoFactor: user.totpEnabled }
    );
    const res = NextResponse.json({ ok: true, name: user.name, role, twoFactor: user.totpEnabled });
    setAdminCookie(res, { name: user.name, role });
    return res;
  }

  if (pin !== adminPin()) {
    await logAudit(adminActor(req), "admin.login.failed", null, { reason: "wrong-pin" });
    return NextResponse.json({ error: "رمز الدخول غير صحيح" }, { status: 401 });
  }
  await logAudit(adminActor(req), "admin.login", null, { via: "ADMIN_PIN" });
  const res = NextResponse.json({ ok: true, name: "admin", role: "owner" as AdminRole });
  setAdminCookie(res, { name: "admin", role: "owner" });
  return res;
}

/** DELETE → logout */
export async function DELETE(req: NextRequest) {
  await logAudit(adminActor(req), "admin.logout");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
