import { sql, type AnyColumn, type SQL } from "drizzle-orm";

/**
 * تطبيع البحث العربي — نفس القواعد على طرفي المقارنة:
 * إزالة التشكيل والتطويل (بما فيه الهمزة المركبة U+0654/U+0655)،
 * وتوحيد (أ إ آ ٱ)→ا، (ة)→ه، (ى)→ي، (ؤ)→و، (ئ)→ي.
 *
 * السبب: الاسم قد يُخزَّن بصيغة مركبة (ا + همزة) فلا يطابق أي صيغة مكتوبة مسبقاً،
 * لذلك نطبّع عمود القاعدة والكلمة المبحوث عنها بنفس الدالة بدل تعداد صيغ.
 */

const MARKS = /[\u064B-\u065F\u0670\u0640]/g;

export function normalizeArabic(raw: string): string {
  return raw
    .replace(MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** تعبير SQL يطبّع العمود بنفس قواعد normalizeArabic */
export function normalizedColumn(column: AnyColumn): SQL {
  return sql`translate(regexp_replace(lower(${column}), '[\u064B-\u065F\u0670\u0640]', '', 'g'), 'أإآٱةىؤئ', 'ااااهيوي')`;
}

/** شرط «يحتوي» عربي متسامح مع الهمزات والتاء المربوطة والياء */
export function arabicLike(column: AnyColumn, term: string): SQL {
  return sql`${normalizedColumn(column)} LIKE ${`%${normalizeArabic(term)}%`}`;
}
