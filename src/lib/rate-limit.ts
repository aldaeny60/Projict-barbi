/**
 * حدّ معدل. المسار الأساسي في الذاكرة (سريع، بلا تبعية)، ومع ضبط
 * UPSTASH_REDIS_REST_URL/TOKEN يصبح العداد مشتركاً بين كل النسخ عبر Upstash REST
 * — بلا مكتبة إضافية. عند أي خطأ شبكة نرجع للذاكرة بدل تعطيل الحماية.
 */

import { env } from "./env";

type RateResult = { allowed: true } | { allowed: false; retryAfterSec: number };


type Bucket = number[];
const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const retryAfterSec = Math.ceil((hits[0] + windowMs - now) / 1000);
    return { allowed: false as const, retryAfterSec };
  }
  hits.push(now);
  buckets.set(key, hits);
  // hygiene
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.every((t) => now - t > windowMs * 3)) buckets.delete(k);
  }
  return { allowed: true as const };
}

/**
 * نسخة صالحة لأكثر من نسخة من التطبيق: Upstash REST عند تهيئته، وإلا الذاكرة.
 * تُستعمل في المسارات الحسّاسة (OTP، دخول الإدارة، فتح وردية برمز موظف).
 */
export async function checkRateLimitShared(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateResult> {
  const url = env.upstash.url;
  const token = env.upstash.token;
  if (!url || !token) return checkRateLimit(key, limit, windowMs);

  const bucket = `rl:${key}:${Math.floor(Date.now() / windowMs)}`;
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", bucket],
        ["PEXPIRE", bucket, String(windowMs), "NX"],
      ]),
      cache: "no-store",
    });
    if (!res.ok) return checkRateLimit(key, limit, windowMs);
    const data = (await res.json()) as { result?: number | string }[];
    const count = Number(data?.[0]?.result ?? 0);
    if (count > limit) return { allowed: false, retryAfterSec: Math.ceil(windowMs / 1000) };
    return { allowed: true };
  } catch {
    return checkRateLimit(key, limit, windowMs);
  }
}

export function clientKey(req: Request, scope: string) {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || req.headers.get("x-real-ip") || "local";
  return `${scope}:${ip}`;
}

export function rateLimited(retryAfterSec: number) {
  return Response.json(
    { error: `تجاوزت حد المحاولات — جرب بعد ${retryAfterSec} ثانية` },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}
