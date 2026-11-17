/**
 * تطبيع البحث العربي — shoppers يكتبون «اطفال» أو «أطفال» أو «فساتين» أو «فساتين» بلا همزات.
 * نولّد صيغاً مكافئة للكلمة ثم نبحث بها كلها، بدل مطابقة حرفية تفشل مع أول اختلاف إملائي.
 */

/** إزالة التشكيل والتطويل وتوحيد المسافات */
export function normalizeArabic(raw: string): string {
  return raw
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "") // تشكيل + تطويل
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * توليد صيغ الكلمة المحتملة (همزات/تاء مربوطة/ياء/واو) — حد أقصى 12 صيغة.
 * الأهم: تُولَّد كل أشكال الحرف حتى لو كتب المستخدم شكلاً واحداً،
 * فالبحث عن «اطفال» يجد «أطفال» والعكس.
 */
export function arabicVariants(raw: string): string[] {
  const base = normalizeArabic(raw);
  if (!base) return [];

  const groups: { re: RegExp; forms: string[] }[] = [
    { re: /[أإآٱا]/, forms: ["ا", "أ", "إ", "آ"] },
    { re: /[ةه]/, forms: ["ة", "ه"] },
    { re: /[ىي]/, forms: ["ي", "ى"] },
    { re: /[ؤو]/, forms: ["و", "ؤ"] },
    { re: /[ئي]/, forms: ["ي", "ئ"] },
  ];

  let variants = new Set<string>([base]);
  for (const { re, forms } of groups) {
    if (!re.test(base)) continue;
    const global = new RegExp(re.source, "g");
    const next = new Set<string>();
    for (const v of variants) {
      for (const form of forms) next.add(v.replace(global, form));
    }
    variants = next;
  }
  return [...variants].slice(0, 12);
}
