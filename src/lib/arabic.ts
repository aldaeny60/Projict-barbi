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

/** صيغ الكلمة المحتملة (حد أقصى 12 صيغة لتجنّب استعلام ضخم) */
export function arabicVariants(raw: string): string[] {
  const base = normalizeArabic(raw);
  if (!base) return [];

  const groups: { re: RegExp; forms: string[] }[] = [
    { re: /[أإآٱ]/, forms: ["ا", "أ", "إ", "آ"] },
    { re: /ة/, forms: ["ة", "ه"] },
    { re: /ى/, forms: ["ى", "ي"] },
    { re: /ؤ/, forms: ["ؤ", "و"] },
    { re: /ئ/, forms: ["ئ", "ي"] },
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
