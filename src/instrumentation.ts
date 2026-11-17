/**
 * تشغيل التحقق من التهيئة مرة واحدة عند إقلاع الخادم (Next instrumentation).
 * لا يعمل أثناء البناء، ولا يمسّ وضع العرض التجريبي.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { assertRuntimeConfig } = await import("./lib/env");
  assertRuntimeConfig();
}
