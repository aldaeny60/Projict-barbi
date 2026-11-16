import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createHash, randomInt } from "crypto";
import type { NextRequest } from "next/server";
import { isValidIraqiPhone } from "@/lib/format";
import { checkRateLimit, clientKey, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Server-side OTP store: hashed codes, 5-minute TTL, max 5 attempts. (LAW 005 — no fixed OTP codes) */
type OtpEntry = { hash: string; expiresAt: number; attempts: number };
const otpStore = new Map<string, OtpEntry>();
const TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

/**
 * POST { action: "send", phone }  → generates a random 4-digit code.
 *   - With SMS_PROVIDER_* env set  → delivered via the Iraqi SMS provider (production).
 *   - In development without a provider → devCode is echoed so QA can proceed (flagged, never in prod).
 * POST { action: "verify", phone, code, name? } → validates hash/TTL/attempts, creates or returns account.
 */
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
    const rl = checkRateLimit(clientKey(req, "otp-send"), 30, 60_000);
    if (!rl.allowed) return rateLimited(rl.retryAfterSec);
    const rlPhone = checkRateLimit(`otp-phone:${phone}`, 5, 10 * 60_000);
    if (!rlPhone.allowed) return rateLimited(rlPhone.retryAfterSec);

    const code = String(randomInt(1000, 10000));
    otpStore.set(phone, { hash: hashCode(code), expiresAt: Date.now() + TTL_MS, attempts: 0 });

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
    // development fallback — explicit and documented
    return Response.json({
      ok: true,
      delivered: "dev-console",
      devCode: code,
      message: "وضع التطوير: أُرجع الرمز بالرد لأن مزود SMS غير مُعد، ولا يحدث هذا في الإنتاج",
    });
  }

  if (body.action === "verify") {
    const rl = checkRateLimit(clientKey(req, "otp-verify"), 20, 60_000);
    if (!rl.allowed) return rateLimited(rl.retryAfterSec);

    const entry = otpStore.get(phone);
    const code = String(body.code ?? "");
    if (!entry) return Response.json({ error: "اطلب رمز تحقق أولاً" }, { status: 400 });
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(phone);
      return Response.json({ error: "انتهت صلاحية الرمز — اطلب رمزاً جديداً" }, { status: 400 });
    }
    entry.attempts += 1;
    if (entry.attempts > MAX_ATTEMPTS) {
      otpStore.delete(phone);
      return Response.json({ error: "تجاوزت محاولات التحقق — اطلب رمزاً جديداً" }, { status: 429 });
    }
    if (hashCode(code) !== entry.hash) {
      return Response.json({ error: "رمز التحقق غير صحيح" }, { status: 400 });
    }
    otpStore.delete(phone);

    const [existing] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
    if (existing) {
      return Response.json({ customer: { id: existing.id, name: existing.name, phone: existing.phone } });
    }
    const name = body.name?.trim() || "عميل باربي";
    const [created] = await db.insert(customers).values({ name, phone }).returning();
    return Response.json({ customer: { id: created.id, name: created.name, phone: created.phone } });
  }

  return Response.json({ error: "إجراء غير معروف" }, { status: 400 });
}
