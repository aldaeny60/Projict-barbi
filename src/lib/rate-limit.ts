/** In-memory sliding-window rate limiter (per-key). Swap for Redis in multi-instance prod. */

type Bucket = number[];
const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number) {
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
