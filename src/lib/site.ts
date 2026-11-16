/**
 * هوية المتجر العامة — تُقرأ من متغيرات البيئة (.env) مع قيم افتراضية آمنة.
 * كل ما يبدأ بـ NEXT_PUBLIC_ يصل للمتصفح، لذا لا يُوضع هنا أي سر.
 */

const DEFAULT_SUPPORT_PHONE = "07700001122";

export const SITE = {
  /** النطاق العام — يستخدم في السيو وsitemap وحمولة المشاركة */
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? "https://sighar.iq",
  /** رقم الدعم للاتصال والواتساب (صيغة محلية 07XXXXXXXXX أو دولية 964...) */
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? DEFAULT_SUPPORT_PHONE,
  whatsappPhone:
    process.env.NEXT_PUBLIC_WHATSAPP_PHONE ??
    process.env.NEXT_PUBLIC_SUPPORT_PHONE ??
    DEFAULT_SUPPORT_PHONE,
} as const;

/** يحوّل الرقم المحلي إلى صيغة واتساب الدولية: 07700001122 → 9647700001122 */
export function whatsappNumber(phone: string = SITE.whatsappPhone): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `964${digits.slice(1)}` : digits;
}

/** رابط محادثة واتساب جاهز مع نص افتراضي */
export function whatsappLink(text = "مرحباً باربي، أحتاج مساعدة بخصوص طلبي"): string {
  return `https://wa.me/${whatsappNumber()}?text=${encodeURIComponent(text)}`;
}
