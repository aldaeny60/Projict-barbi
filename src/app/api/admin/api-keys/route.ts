import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { adminForbidden, adminUnauthorized, isAdminAuthed, isAdminOwner } from "@/lib/admin-auth";
import { adminActor, logAudit } from "@/lib/audit";
import { generateApiKey } from "@/lib/api-key";
import { isSameOrigin } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * مفاتيح API الخارجية — للمالك فقط.
 * GET    → القائمة (بلا المفتاح نفسه، فقط بادئته)
 * POST   { name } → مفتاح جديد، يُعرض مرة واحدة في الرد
 * PATCH  { id, active } → إيقاف/تفعيل
 * DELETE ?id= → إبطال نهائي
 */

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  if (!isAdminOwner(req)) return adminForbidden();
  const rows = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  return Response.json({
    keys: rows.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      active: k.active,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  if (!isAdminOwner(req)) return adminForbidden();
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = String(body.name ?? "").trim();
  if (name.length < 2) return Response.json({ error: "اسم المفتاح مطلوب" }, { status: 400 });

  const { key, prefix, hash } = generateApiKey();
  const [row] = await db.insert(apiKeys).values({ name, prefix, keyHash: hash }).returning();
  await logAudit(adminActor(req), "api-key.create", `api-key:${row.id}`, { name, prefix });

  return Response.json({
    key: { id: row.id, name: row.name, prefix: row.prefix, active: row.active, createdAt: row.createdAt.toISOString() },
    // يُعرض مرة واحدة فقط — لا يمكن استرجاعه لاحقاً
    secret: key,
  });
}

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  if (!isAdminOwner(req)) return adminForbidden();
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { id?: number; active?: boolean };
  const id = Number(body.id);
  if (!id) return Response.json({ error: "معرّف مطلوب" }, { status: 400 });
  const [row] = await db
    .update(apiKeys)
    .set({ active: Boolean(body.active) })
    .where(eq(apiKeys.id, id))
    .returning();
  if (!row) return Response.json({ error: "المفتاح غير موجود" }, { status: 404 });
  await logAudit(adminActor(req), "api-key.update", `api-key:${id}`, { active: row.active });
  return Response.json({ key: { id: row.id, active: row.active } });
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  if (!isAdminOwner(req)) return adminForbidden();
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return Response.json({ error: "معرّف مطلوب" }, { status: 400 });
  const [row] = await db.delete(apiKeys).where(eq(apiKeys.id, id)).returning();
  if (!row) return Response.json({ error: "المفتاح غير موجود" }, { status: 404 });
  await logAudit(adminActor(req), "api-key.delete", `api-key:${id}`, { name: row.name });
  return Response.json({ deleted: true });
}
