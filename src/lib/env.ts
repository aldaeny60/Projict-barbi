import { randomBytes } from "crypto";

/**
 * مصدر واحد لكل متغيرات البيئة على الخادم — لا `process.env` مبعثراً في الملفات.
 *
 * قواعد:
 * - لا تُقرأ هنا أي `NEXT_PUBLIC_*`؛ تلك تُقرأ في `site.ts` بشكل مباشر حتى
 *   يحقنها Next في حزمة المتصفح (الوصول الديناميكي لا يُحقن).
 * - سرّ الجلسة: إن لم يُضبط في الإنتاج نولّد سراً عشوائياً لكل عملية بدل
 *   الرجوع لسر معروف يمكن تزوير الكوكي به. النتيجة: الجلسات تُبطل مع إعادة
 *   التشغيل — لذلك يُضبط السر في الإنتاج.
 */

const isProd = process.env.NODE_ENV === "production";

function read(name: string, fallback = ""): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

/** سر مؤقت لكل عملية — يُستخدم فقط عند غياب السر في الإنتاج */
const ephemeralSecret = randomBytes(32).toString("base64url");
const warned = new Set<string>();

export type SessionKind = "admin" | "customer" | "staff";

const SECRET_ENV: Record<SessionKind, string> = {
  admin: "ADMIN_SESSION_SECRET",
  customer: "CUSTOMER_SESSION_SECRET",
  staff: "STAFF_SESSION_SECRET",
};

export function sessionSecret(kind: SessionKind): string {
  const explicit = read(SECRET_ENV[kind]);
  if (explicit) return explicit;
  if (isProd) {
    if (!warned.has(kind)) {
      warned.add(kind);
      console.warn(
        `[env] ${SECRET_ENV[kind]} غير مضبوط — استُخدم سر عشوائي مؤقت؛ الجلسات تُبطل مع إعادة التشغيل.`
      );
    }
    return ephemeralSecret;
  }
  return "barbi-dev-secret-change-me";
}

export const env = {
  isProd,
  /** وضع العرض: قاعدة مؤقتة داخل الحاوية وبيانات توضيحية */
  demoMode: process.env.DEMO_MODE === "1",
  databaseUrl: read("DATABASE_URL"),

  adminPin: read("ADMIN_PIN", "2024"),
  adminPinIsDefault: !read("ADMIN_PIN"),

  serperApiKey: read("SERPER_API_KEY"),

  sms: {
    url: read("SMS_PROVIDER_URL"),
    key: read("SMS_PROVIDER_API_KEY"),
    sender: read("SMS_SENDER_ID", "BARBI"),
    get configured(): boolean {
      return Boolean(read("SMS_PROVIDER_URL") && read("SMS_PROVIDER_API_KEY"));
    },
  },

  upstash: {
    url: read("UPSTASH_REDIS_REST_URL"),
    token: read("UPSTASH_REDIS_REST_TOKEN"),
    get configured(): boolean {
      return Boolean(read("UPSTASH_REDIS_REST_URL") && read("UPSTASH_REDIS_REST_TOKEN"));
    },
  },

  /** إظهار رمز OTP في الرد — تطوير فقط أو بموافقة صريحة */
  canEchoOtp: !isProd || process.env.OTP_DEV_ECHO === "1",

  /** أجرة توصيل افتراضية لمحافظة غير مسجّلة في جدول الرسوم */
  defaultDeliveryFee: 5000,
} as const;

/** ملخص التهيئة — يُستخدم في /api/health بلا كشف أي قيمة سرية */
export function envWarnings(): string[] {
  const warnings: string[] = [];
  if (env.adminPinIsDefault) warnings.push("ADMIN_PIN غير مضبوط — يُستخدم رمز التطوير");
  if (!read("ADMIN_SESSION_SECRET")) warnings.push("ADMIN_SESSION_SECRET غير مضبوط");
  if (!env.sms.configured) warnings.push("مزود SMS غير مهيّأ");
  if (!env.serperApiKey) warnings.push("SERPER_API_KEY غير مضبوط — رصد السوق معطّل");
  if (!env.upstash.configured) warnings.push("حد المعدل في الذاكرة فقط (بلا Upstash)");
  if (!read("CUSTOMER_SESSION_SECRET") || !read("STAFF_SESSION_SECRET")) {
    warnings.push("أسرار جلسات الزبون/الموظف غير مضبوطة — يُفضّل سر منفصل لكل نوع");
  }
  return warnings;
}
