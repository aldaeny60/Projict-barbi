/** مفتاح فريد للعملية من المتصفح — يمنع تكرار الطلب/الفاتورة عند إعادة الإرسال */

export function newRequestId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
