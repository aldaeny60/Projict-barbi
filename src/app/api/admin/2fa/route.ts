import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { adminSession, adminUnauthorized } from "@/lib/admin-auth";
import { adminActor, logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/session";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";

export const dynamic = "force-dynamic";

/**
 * التحقق بخطوتين لحساب الإدارة الحالي — يفعّله صاحب الحساب بنفسه:
 * POST   → يولّد سرّاً ويعيد otpauth:// (لم يُفعَّل بعد)
 * PUT    { code } → يتحقق من رمز التطبيق ثم يفعّل
 * DELETE { code } → يعطّل (يتطلب رمزاً صالحاً حتى لا يُعطّله مختطف جلسة)
 *
 * جلسة الإدارة الموقّعة لا تحمل معرّف الحساب، لذا نطابق الاسم من الجلسة.
 */

async function currentUser(req: NextRequest) {
  const session = adminSession(req);
  if (!session) return null;
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.name, session.name)).limit(1);
  return user ?? null;
}

export async function GET(req: NextRequest) {
  const session = adminSession(req);
  if (!session) return adminUnauthorized();
  const user = await currentUser(req);
  return Response.json({
    name: session.name,
    role: session.role,
    twoFactor: Boolean(user?.totpEnabled),
    available: Boolean(user),
  });
}

export async function POST(req: NextRequest) {
  const session = adminSession(req);
  if (!session) return adminUnauthorized();
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });
  const user = await currentUser(req);
  if (!user) {
    return Response.json(
      { error: "التحقق بخطوتين متاح للحسابات الإدارية الفردية — ادخل باسم حسابك لا برمز ADMIN_PIN" },
      { status: 400 }
    );
  }
  const secret = generateTotpSecret();
  await db.update(adminUsers).set({ totpSecret: secret, totpEnabled: false }).where(eq(adminUsers.id, user.id));
  await logAudit(adminActor(req), "admin.2fa.start", `admin:${user.id}`, {});
  return Response.json({
    secret,
    otpauth: otpauthUri(secret, user.name),
    hint: "أضف السرّ في Google Authenticator ثم أدخل الرمز لتأكيد التفعيل",
  });
}

export async function PUT(req: NextRequest) {
  const session = adminSession(req);
  if (!session) return adminUnauthorized();
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });
  const user = await currentUser(req);
  if (!user?.totpSecret) return Response.json({ error: "ابدأ التفعيل أولاً" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { code?: string };
  if (!verifyTotp(user.totpSecret, String(body.code ?? ""))) {
    return Response.json({ error: "رمز التحقق غير صحيح" }, { status: 400 });
  }
  await db.update(adminUsers).set({ totpEnabled: true }).where(eq(adminUsers.id, user.id));
  await logAudit(adminActor(req), "admin.2fa.enable", `admin:${user.id}`, {});
  return Response.json({ ok: true, twoFactor: true });
}

export async function DELETE(req: NextRequest) {
  const session = adminSession(req);
  if (!session) return adminUnauthorized();
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });
  const user = await currentUser(req);
  if (!user) return Response.json({ error: "الحساب غير موجود" }, { status: 404 });
  if (!user.totpEnabled) return Response.json({ ok: true, twoFactor: false });

  const body = (await req.json().catch(() => ({}))) as { code?: string };
  if (!user.totpSecret || !verifyTotp(user.totpSecret, String(body.code ?? ""))) {
    return Response.json({ error: "أدخل رمزاً صالحاً من تطبيق المصادقة للتعطيل" }, { status: 400 });
  }
  await db
    .update(adminUsers)
    .set({ totpEnabled: false, totpSecret: null })
    .where(eq(adminUsers.id, user.id));
  await logAudit(adminActor(req), "admin.2fa.disable", `admin:${user.id}`, {});
  return Response.json({ ok: true, twoFactor: false });
}
