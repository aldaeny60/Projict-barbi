import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * رموز PIN للموظفين — تُخزَّن مُجزّأة (scrypt + ملح عشوائي) ولا تظهر في أي استجابة.
 * لا نستخدم bcrypt/argon2 لتفادي تبعية إضافية؛ scrypt داخل Node قياسي وقوي بما يكفي لـ PIN.
 */

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const parts = (stored ?? "").split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expected] = parts;
  if (!salt || !expected) return false;
  let actual: Buffer;
  try {
    actual = scryptSync(pin, salt, 32);
  } catch {
    return false;
  }
  const b = Buffer.from(expected, "hex");
  if (actual.length !== b.length) return false;
  return timingSafeEqual(actual, b);
}
