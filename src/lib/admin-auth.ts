import { createHash } from "crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "barbi_admin";
/** dev fallback only — override via ADMIN_PIN in .env for any real deployment */
const DEV_PIN = "2024";

export function adminPin(): string {
  return process.env.ADMIN_PIN || DEV_PIN;
}

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || "barbi-dev-secret-change-me";
}

export function adminTokenFor(pin: string): string {
  return createHash("sha256").update(`${pin}|${sessionSecret()}`).digest("hex");
}

export function isAdminAuthed(req: NextRequest): boolean {
  return req.cookies.get(ADMIN_COOKIE)?.value === adminTokenFor(adminPin());
}

export function adminUnauthorized() {
  return Response.json(
    { error: "وصول غير مصرّح — هذه النقطة مخصصة للإدارة فقط" },
    { status: 401 }
  );
}
