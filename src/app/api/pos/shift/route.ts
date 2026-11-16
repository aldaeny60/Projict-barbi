import { db } from "@/db";
import { branches, shifts } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const toDTO = (s: typeof shifts.$inferSelect) => ({
  id: s.id,
  branchId: s.branchId,
  staffName: s.staffName,
  role: s.role,
  status: s.status,
  openingCash: s.openingCash,
  closingCash: s.closingCash,
  openedAt: s.openedAt.toISOString(),
  closedAt: s.closedAt?.toISOString() ?? null,
});

/** GET ?branchId= → open shift + branches list */
export async function GET(req: NextRequest) {
  const branchId = Number(req.nextUrl.searchParams.get("branchId")) || 1;
  const [openShift] = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.branchId, branchId), eq(shifts.status, "open")))
    .orderBy(desc(shifts.openedAt))
    .limit(1);
  const allBranches = await db.select().from(branches);
  return Response.json({
    shift: openShift ? toDTO(openShift) : null,
    branches: allBranches.map((b) => ({
      id: b.id,
      name: b.name,
      city: b.city,
      phone: b.phone,
      address: b.address,
    })),
  });
}

/** POST { action: "open" | "close" } */
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.action === "open") {
    const branchId = Number(body.branchId) || 1;
    // أغلق أي وردية مفتوحة قديمة لنفس الفرع
    await db
      .update(shifts)
      .set({ status: "closed", closedAt: new Date() })
      .where(and(eq(shifts.branchId, branchId), eq(shifts.status, "open")));
    const [row] = await db
      .insert(shifts)
      .values({
        branchId,
        staffName: String(body.staffName ?? "كاشير"),
        role: ["cashier", "supervisor", "manager"].includes(body.role) ? body.role : "cashier",
        openingCash: Math.max(0, Math.round(Number(body.openingCash) || 0)),
      })
      .returning();
    return Response.json({ shift: toDTO(row) });
  }
  if (body.action === "close") {
    const shiftId = Number(body.shiftId);
    const [row] = await db
      .update(shifts)
      .set({ status: "closed", closedAt: new Date(), closingCash: Math.max(0, Math.round(Number(body.closingCash) || 0)) })
      .where(eq(shifts.id, shiftId))
      .returning();
    if (!row) return Response.json({ error: "الوردية غير موجودة" }, { status: 404 });
    return Response.json({ shift: toDTO(row) });
  }
  return Response.json({ error: "إجراء غير معروف" }, { status: 400 });
}
