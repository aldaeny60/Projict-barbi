import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import type { NextRequest } from "next/server";

/**
 * سجل التدقيق — كل عملية حسّاسة (دخول، تغيير حالة طلب، تعديل منتج، بيع، مرتجع،
 * إدارة كوبون أو موظف) تُكتب هنا مع الفاعل ودوره وعنوانه.
 *
 * لا يفشل الطلب الأصلي إذا فشل السجل: نكتب الخطأ في الطرفية ونكمل.
 */

export type AuditActor = { actor: string; role: string; ip: string | null };

export function ipOf(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || null;
}

export const adminActor = (req: NextRequest): AuditActor => ({
  actor: "admin",
  role: "admin",
  ip: ipOf(req),
});

export async function logAudit(
  actor: AuditActor,
  action: string,
  target?: string | null,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actor: actor.actor.slice(0, 140),
      role: actor.role.slice(0, 24),
      action: action.slice(0, 64),
      target: target ? target.slice(0, 120) : null,
      meta: meta ?? {},
      ip: actor.ip,
    });
  } catch (err) {
    console.error("audit-log-failed", action, err);
  }
}
