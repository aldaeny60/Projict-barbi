/**
 * إشعارات الطلب — تُرسل فعلاً عبر مزود SMS عند تهيئته، وتُرجع حالة صريحة.
 * لا ندّعي إرسالاً لم يحدث: بلا مزود نرجع "skipped" مع سبب مفهوم.
 */

export type NotifyResult = {
  sms: "sent" | "skipped" | "failed";
  whatsapp: "link";
  message: string;
  reason?: string;
};

const WHATSAPP_TEXT = (name: string, code: string, total: number) =>
  `باربي: أهلاً ${name}، تم استلام طلبك ${code} بقيمة ${total.toLocaleString("en-US")} د.ع. سنتصل بك للتأكيد.`;

export async function sendSms(to: string, text: string): Promise<"sent" | "skipped" | "failed"> {
  const url = process.env.SMS_PROVIDER_URL;
  const key = process.env.SMS_PROVIDER_API_KEY;
  if (!url || !key) return "skipped";
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ sender: process.env.SMS_SENDER_ID || "BARBI", to, text }),
    });
    return r.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

export async function sendOrderNotifications(input: {
  phone: string;
  customerName: string;
  code: string;
  total: number;
}): Promise<NotifyResult> {
  const text = WHATSAPP_TEXT(input.customerName, input.code, input.total);
  const sms = await sendSms(input.phone, text);
  return {
    sms,
    whatsapp: "link",
    message: text,
    reason:
      sms === "skipped"
        ? "مزود SMS غير مهيّأ على الخادم — الفاتورة متاحة للنسخ/المشاركة عبر واتساب"
        : sms === "failed"
          ? "تعذر إرسال SMS — الفاتورة متاحة للمشاركة عبر واتساب"
          : undefined,
  };
}
