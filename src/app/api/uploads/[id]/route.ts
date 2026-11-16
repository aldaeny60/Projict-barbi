import { db } from "@/db";
import { uploads } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET — تقديم الصورة المرفوعة بمخزن مؤقت طويل (المحتوى ثابت لا يتغير) */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) return new Response("not found", { status: 404 });

  const [row] = await db.select().from(uploads).where(eq(uploads.id, numId)).limit(1);
  if (!row) return new Response("not found", { status: 404 });

  const bytes = Buffer.from(row.data, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
