import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { desc, eq, ilike, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { adminUnauthorized, isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * سجل التدقيق — للقراءة فقط وبجلسة إدارة.
 * GET ?limit=100&q=... → آخر العمليات (الأحدث أولاً) مع إمكانية بحث بسيط.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 100, 1), 300);
  const q = sp.get("q")?.trim();

  const rows = await db
    .select()
    .from(auditLogs)
    .where(q ? or(ilike(auditLogs.action, `%${q}%`), ilike(auditLogs.actor, `%${q}%`), eq(auditLogs.target, q)) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return Response.json({
    entries: rows.map((r) => ({
      id: r.id,
      actor: r.actor,
      role: r.role,
      action: r.action,
      target: r.target,
      meta: r.meta,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
