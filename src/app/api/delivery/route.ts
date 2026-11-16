import { db } from "@/db";
import { deliveryFees } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { adminUnauthorized, isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(deliveryFees).orderBy(asc(deliveryFees.id));
  return Response.json({ fees: rows });
}

/** Admin: update a governorate's fee */
export async function PATCH(req: NextRequest) {
  if (!isAdminAuthed(req)) return adminUnauthorized();
  const body = (await req.json()) as { governorate?: string; fee?: number; eta?: string };
  if (!body.governorate) return Response.json({ error: "المحافظة مطلوبة" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (body.fee !== undefined) patch.fee = Math.max(0, Math.round(Number(body.fee)));
  if (body.eta !== undefined) patch.eta = body.eta;
  const [row] = await db
    .update(deliveryFees)
    .set(patch)
    .where(eq(deliveryFees.governorate, body.governorate))
    .returning();
  return Response.json({ fee: row });
}
