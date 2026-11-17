import { createHash, randomBytes } from "crypto";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

/**
 * مفاتيح API للقراءة فقط — للواجهات الخارجية.
 * - المفتاح يُعرض مرة واحدة عند الإنشاء، ويُخزَّن هاشه فقط (SHA-256).
 * - يُقبل في `Authorization: Bearer <key>` أو `x-api-key`.
 * - يُحدَّث «آخر استخدام» مرة كل دقيقة على الأكثر (لا كتابة في كل طلب).
 */

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `barbi_${randomBytes(24).toString("base64url")}`;
  return { key, prefix: key.slice(0, 12), hash: hashApiKey(key) };
}

export type ApiKeyAuth = { id: number; name: string };

export async function authenticateApiKey(req: NextRequest): Promise<ApiKeyAuth | null> {
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const key = bearer || req.headers.get("x-api-key")?.trim() || "";
  if (!key || key.length < 20) return null;

  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hashApiKey(key)), eq(apiKeys.active, true)))
    .limit(1);
  if (!row) return null;

  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  }
  return { id: row.id, name: row.name };
}

export function apiUnauthorized() {
  return Response.json(
    { error: "مفتاح API غير صالح — أرسل Authorization: Bearer <key> أو x-api-key" },
    { status: 401 }
  );
}
