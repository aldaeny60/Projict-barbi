import { db } from "@/db";
import { uploads } from "@/db/schema";
import type { NextRequest } from "next/server";
import { adminUnauthorized, isAdminAuthed } from "@/lib/admin-auth";
import { adminActor, logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/session";

export const dynamic = "force-dynamic";

const MAX_BYTES = 6 * 1024 * 1024; // 6MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

/**
 * POST — رفع صورة منتج من لوحة التحكم إلى القاعدة (base64) وإرجاع رابط دائم.
 * بهذا يستغني المتجر عن CDN خارجي لصوره الحقيقية، ويمكن ترقية التخزين لاحقاً
 * إلى S3/R2 بتغيير هذا المسار وحده.
 */
export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  if (!isSameOrigin(req)) return Response.json({ error: "طلب غير موثوق" }, { status: 403 });

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json({ error: "أرسل الصورة بصيغة multipart/form-data" }, { status: 400 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "لم تصل أي صورة" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return Response.json({ error: "الصيغة غير مدعومة — استخدم JPG أو PNG أو WebP" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "حجم الصورة أكبر من 6 ميغابايت" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const [row] = await db
    .insert(uploads)
    .values({ mime: file.type, size: buffer.byteLength, data: buffer.toString("base64") })
    .returning({ id: uploads.id });

  await logAudit(adminActor(req), "upload.create", `upload:${row.id}`, {
    mime: file.type,
    size: buffer.byteLength,
  });

  return Response.json({ ok: true, url: `/api/uploads/${row.id}`, id: row.id });
}
