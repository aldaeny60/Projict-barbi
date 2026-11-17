import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { env, sessionSecret } from "./env";

/**
 * بوابات الدفع — طبقة موحّدة فوق المزوّدين.
 *
 * مبدأ صارم: لا ندّعي دفعاً لم يحدث. المزوّد «غير مهيّأ» يُرجع خطأً واضحاً (503)
 * ولا يُنشأ سجل دفع ناجح إلا بعد تحقق توقيع الإشعار من المزوّد.
 *
 * المزوّدون:
 * - zaincash: JWT موقّع HS256 (تنفيذ يدوي بلا مكتبات) + init/pay + callback بتوكن.
 * - sandbox: مزوّد وهمي للاختبار فقط (PAYMENT_SANDBOX=1)، لا يحصّل مالاً.
 */

export type ProviderId = "zaincash" | "sandbox";

export type PaymentInitInput = {
  orderId: number;
  orderCode: string;
  amount: number;
  baseUrl: string;
};

export type PaymentInitResult = { redirectUrl: string; providerRef: string };

export type CallbackResult = {
  /** كود الطلب في نظامنا */
  orderCode: string;
  providerRef: string;
  status: "paid" | "failed";
  amount: number;
  raw: Record<string, unknown>;
};

/* ───────────── JWT HS256 يدوي (بلا مكتبات) ───────────── */

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

function hmac(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  return `${header}.${body}.${hmac(`${header}.${body}`, secret)}`;
}

export function verifyJwt(token: string | null | undefined, secret: string): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = hmac(`${header}.${body}`, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
    if (typeof parsed.exp === "number" && parsed.exp * 1000 < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/* ───────────── المزوّدون ───────────── */

export type ProviderInfo = { id: ProviderId; label: string; configured: boolean; sandbox: boolean };

export function listProviders(): ProviderInfo[] {
  return [
    { id: "zaincash", label: "زين كاش", configured: env.payments.zaincash.configured, sandbox: false },
    { id: "sandbox", label: "مزوّد اختبار (لا يحصّل مالاً)", configured: env.payments.sandbox, sandbox: true },
  ];
}

export function providerConfigured(id: string): boolean {
  if (id === "zaincash") return env.payments.zaincash.configured;
  if (id === "sandbox") return env.payments.sandbox;
  return false;
}

const SANDBOX_SECRET = () => `sandbox:${sessionSecret("admin")}`;

/** إنشاء جلسة دفع وإرجاع رابط التوجيه */
export async function initPayment(id: ProviderId, input: PaymentInitInput): Promise<PaymentInitResult> {
  if (id === "sandbox") {
    const ref = `SBX-${randomUUID()}`;
    const token = signJwt(
      { orderCode: input.orderCode, amount: input.amount, ref, exp: Math.floor(Date.now() / 1000) + 900 },
      SANDBOX_SECRET()
    );
    return {
      redirectUrl: `${input.baseUrl}/api/payments/callback/sandbox?token=${encodeURIComponent(token)}`,
      providerRef: ref,
    };
  }

  if (id === "zaincash") {
    const { msisdn, merchantId, secret, baseUrl } = env.payments.zaincash;
    const now = Math.floor(Date.now() / 1000);
    const token = signJwt(
      {
        amount: input.amount,
        serviceType: "barbi-store",
        msisdn,
        orderId: input.orderCode,
        redirectUrl: `${input.baseUrl}/api/payments/callback/zaincash`,
        iat: now,
        exp: now + 3600,
      },
      secret
    );

    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/transaction/init`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, merchantId }).toString(),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; err?: { msg?: string } };
    if (!res.ok || !data.id) {
      throw new Error(data?.err?.msg ?? `تعذر بدء الدفع (${res.status})`);
    }
    return {
      redirectUrl: `${baseUrl.replace(/\/+$/, "")}/transaction/pay?id=${encodeURIComponent(data.id)}`,
      providerRef: String(data.id),
    };
  }

  throw new Error("مزوّد دفع غير معروف");
}

/** التحقق من إشعار المزوّد — null يعني توقيعاً غير صالح أو بيانات ناقصة */
export async function verifyCallback(
  id: string,
  req: NextRequest
): Promise<CallbackResult | null> {
  const sp = req.nextUrl.searchParams;
  let token = sp.get("token");

  if (!token && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { token?: string };
    token = body.token ?? null;
  }
  if (!token) return null;

  if (id === "sandbox") {
    const payload = verifyJwt(token, SANDBOX_SECRET());
    if (!payload) return null;
    const orderCode = String(payload.orderCode ?? "");
    const amount = Number(payload.amount ?? 0);
    if (!orderCode || !amount) return null;
    return {
      orderCode,
      providerRef: String(payload.ref ?? ""),
      status: "paid",
      amount,
      raw: payload,
    };
  }

  if (id === "zaincash") {
    const payload = verifyJwt(token, env.payments.zaincash.secret);
    if (!payload) return null;
    const orderCode = String(payload.orderid ?? payload.orderId ?? "");
    const amount = Number(payload.amount ?? 0);
    const ok = String(payload.status ?? "").toLowerCase() === "success";
    if (!orderCode) return null;
    return {
      orderCode,
      providerRef: String(payload.id ?? ""),
      status: ok ? "paid" : "failed",
      amount,
      raw: payload,
    };
  }

  return null;
}
