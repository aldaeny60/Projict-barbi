import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * TOTP (RFC 6238) بلا مكتبات — للتحقق بخطوتين لحسابات الإدارة.
 * سرّ base32، نافذة ±30 ثانية، 6 أرقام، HMAC-SHA1 (متوافق مع Google Authenticator).
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(bytes = 20): string {
  const buf = randomBytes(bytes);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(secret: string): Buffer {
  const clean = secret.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

/** رمز اللحظة الحالية — للتشخيص/الاختبار فقط */
export function totpNow(secret: string, atMs = Date.now()): string {
  return hotp(secret, Math.floor(atMs / 1000 / 30));
}

/** تحقق مع نافذة ±1 خطوة (تعويض انحراف الساعة) */
export function verifyTotp(secret: string, code: string, atMs = Date.now()): boolean {
  const clean = String(code ?? "").replace(/\D/g, "");
  if (clean.length !== 6) return false;
  const step = Math.floor(atMs / 1000 / 30);
  for (const delta of [-1, 0, 1]) {
    const expected = hotp(secret, step + delta);
    const a = Buffer.from(expected);
    const b = Buffer.from(clean);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export function otpauthUri(secret: string, account: string, issuer = "Barbi"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, digits: "6", period: "30", algorithm: "SHA1" });
  return `otpauth://totp/${label}?${params.toString()}`;
}
