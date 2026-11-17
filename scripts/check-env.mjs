#!/usr/bin/env node
/**
 * فحص التهيئة قبل التشغيل: يقرأ .env ويقول ما ينقص بوضوح.
 * التشغيل: npm run env:check
 */
import { readFileSync, existsSync } from "node:fs";

const problems = [];
const notes = [];

if (!existsSync(".env")) {
  problems.push("ملف .env غير موجود — انسخ .env.example إليه.");
}

const env = {};
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const has = (k) => Boolean(env[k] && env[k].trim());

if (!has("DATABASE_URL")) problems.push("DATABASE_URL مطلوب (أو شغّل بوضع العرض بلا DATABASE_URL).");
if (!has("ADMIN_PIN")) problems.push("ADMIN_PIN مطلوب للإنتاج.");
else if (env.ADMIN_PIN === "2024") problems.push("ADMIN_PIN = 2024 — رمز معروف، غيّره.");
for (const k of ["ADMIN_SESSION_SECRET", "CUSTOMER_SESSION_SECRET", "STAFF_SESSION_SECRET"]) {
  if (!has(k)) problems.push(`${k} مطلوب — يمكن توليده بـ: openssl rand -base64 32`);
  else if (env[k].length < 24) problems.push(`${k} قصير (أقل من 24 حرفاً).`);
}
if (!has("NEXT_PUBLIC_BASE_URL")) notes.push("NEXT_PUBLIC_BASE_URL غير مضبوط — sitemap سيكون محلياً.");
if (!has("SMS_PROVIDER_URL") || !has("SMS_PROVIDER_API_KEY")) notes.push("مزود SMS غير مهيّأ — OTP/إشعارات ستُرجع skipped.");
if (!has("UPSTASH_REDIS_REST_URL")) notes.push("Upstash غير مضبوط — حد المعدل في ذاكرة كل نسخة.");
if (!has("SERPER_API_KEY")) notes.push("SERPER_API_KEY غير مضبوط — رصد السوق معطّل.");

for (const n of notes) console.log(`• ملاحظة: ${n}`);
if (problems.length) {
  console.error("\n✗ التهيئة غير مكتملة:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("\n✓ التهيئة جاهزة للتشغيل.");
