import { db } from "@/db";
import { customers, otpCodes } from "@/db/schema";
import { eq, lt } from "drizzle-orm";
import { createHash, randomInt } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isValidIraqiPhone } from "@/lib/format";
import { checkRateLimitShared, clientKey, rateLimited } from "@/lib/rate-limit";
import { setCustomerCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * OTP مخزَّن في قاعدة البيانات (لا في الذاكرة): يبقى صالحاً بعد إعادة التشغيل
 * ويعمل مع أكثر من نسخة من التطبيق.
 *
 * POST { action: "send", phone }  → رمز عشوائي 4 أرقام، مُجزّأ SHA-256، صالح 5 دقائق.
 * POST { action: "verify", phone, code, name? } → يتحقق ويُنشئ جلسة زبون موقّعة (كوكي).
 *
 * LAW 005: لا رمز ثابت. ولا يُعاد الرمز في الرد إلا في التطوير أو عند
 * OTP_DEV_ECHO=1 صراحةً — والإنتاج بلا مزود SMS يفشل بصراحة (503) لا بثغرة.
 */

const TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

function mayEchoCode(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.OTP_DEV_ECHO === "1";
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    phone?: string;
    code?: string;
    name?: string;
  };
  const phone = (body.phone ?? "").replace(/\s/g, "");
  if (!isValidIraqiPhone(phone)) {
    return Response.json(
      { error: "أدخل رقماً عراقياً صحيحاً يبدأ بـ 075X أو 077X أو 078X أو 079X" },
      { status: 400 }
    );
  }

  if (body.action === "send") {
    const rl = await checkRateLimitShared(clientKey(req, "otp-send"), 30, 60_000);
    if (!rl.allowed) return rateLimited(rl.retryAfterSec);
    const rlPhone = await checkRateLimitShared(`otp-phone:${phone}`, 5, 10 * 60_000);
    if (!rlPhone.allowed) return rateLimited(rlPhone.retryAfterSec);

    const code = String(randomInt(1000, 10000));
    const hash = hashCode(code);
    const expiresAt = new Date(Date.now() + TTL_MS);
    await db
      .insert(otpCodes)
      .values({ phone, hash, attempts: 0, expiresAt })
      .onConflictDoUpdate({
        target: otpCodes.phone,
        set: { hash, attempts: 0, expiresAt, createdAt: new Date() },
      });
    // تنظيف الأكواد المنتهية — يحفظ الجدول صغيراً
    await db.delete(otpCodes).where(lt(otpCodes.expiresAt, new Date(Date.now() - 86400000)));

    const smsUrl = process.env.SMS_PROVIDER_URL;
    const smsKey = process.env.SMS_PROVIDER_API_KEY;
    if (smsUrl && smsKey) {
      try {
        await fetch(smsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${smsKey}` },
          body: JSON.stringify({
            sender: process.env.SMS_SENDER_ID || "BARBI",
            to: phone,
            text: `باربي: رمز التحقق الخاص بك هو ${code} — صالح 5 دقائق.`,
          }),
        });
        return Response.json({ ok: true, delivered: "sms", message: "تم إرسال رمز التحقق عبر SMS" });
      } catch {
        return Response.json({ error: "تعذر إرسال SMS — جرب لاحقاً" }, { status: 502 });
      }
    }

    // لا مزود SMS: الإنتاج يفشل بصراحة بدل تسريب الرمز في الرد
    if (!mayEchoCode()) {
      return Response.json(
        { error: "خدمة الرسائل غير مُهيّأة على هذا الخادم — تواصل مع الدعم" },
        { status: 503 }
      );
    }
    return Response.json({
      ok: true,
      delivered: "dev-echo",
      devCode: code,
      message: "وضع التطوير: أُرجع الرمز بالرد لأن مزود SMS غير مُعد — لا يحدث هذا في الإنتاج",
    });
  }

  if (body.action === "verify") {
    const rl = await checkRateLimitShared(clientKey(req, "otp-verify"), 20, 60_000);
    if (!rl.allowed) return rateLimited(rl.retryAfterSec);

    const [entry] = await db.select().from(otpCodes).where(eq(otpCodes.phone, phone)).limit(1);
    const code = String(body.code ?? "");
    if (!entry) return Response.json({ error: "اطلب رمز تحقق أولاً" }, { status: 400 });
    if (Date.now() > entry.expiresAt.getTime()) {
      await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
      return Response.json({ error: "انتهت صلاحية الرمز — اطلب رمزاً جديداً" }, { status: 400 });
    }
    if (entry.attempts >= MAX_ATTEMPTS) {
      await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
      return Response.json({ error: "تجاوزت محاولات التحقق — اطلب رمزاً جديداً" }, { status: 429 });
    }
    if (hashCode(code) !== entry.hash) {
      await db.update(otpCodes).set({ attempts: entry.attempts + 1 }).where(eq(otpCodes.phone, phone));
      return Response.json({ error: "رمز التحقق غير صحيح" }, { status: 400 });
    }
    await db.delete(otpCodes).where(eq(otpCodes.phone, phone));

    const [existing] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
    let customer = existing ? { id: existing.id, name: existing.name, phone: existing.phone } : null;
    if (!customer) {
      const [created] = await db
        .insert(customers)
        .values({ name: body.name?.trim() || "عميل باربي", phone })
        .returning();
      customer = { id: created.id, name: created.name, phone: created.phone };
    }

    const res = NextResponse.json({ customer });
    setCustomerCookie(res, { phone: customer.phone, name: customer.name });
    return res;
  }

  return Response.json({ error: "إجراء غير معروف" }, { status: 400 });
}

/** DELETE → خروج الزبون (يمسح كوكي الجلسة) */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("barbi_cust", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
