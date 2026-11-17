"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

/**
 * إعادة محاولة الدفع لطلب قائم — ينشئ محاولة جديدة ويوجّه للبوابة.
 * يُخفى إذا رفض الخادم (مزوّد غير مفعّل) برسالة صريحة.
 */
export function PaymentRetry({ code, provider }: { code: string; provider: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const retry = async () => {
    setBusy(true);
    setError("");
    try {
      // نجد الطلب بالكود عبر نقطة التتبع الموثّقة ثم نبدأ الدفع
      const res = await fetch(`/api/orders/by-code/${encodeURIComponent(code)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.order?.id) throw new Error(data.error ?? "تعذر العثور على الطلب");
      const init = await fetch("/api/payments/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: data.order.id, provider }),
      });
      const pd = await init.json().catch(() => ({}));
      if (!init.ok || !pd.redirectUrl) throw new Error(pd.error ?? "تعذر بدء الدفع");
      window.location.href = pd.redirectUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر بدء الدفع");
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={retry}
        disabled={busy}
        className="flex items-center justify-center gap-2 rounded-2xl bg-minty-500 py-3 text-sm font-black text-white disabled:opacity-60"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
        إعادة محاولة الدفع
      </button>
      {error && <p className="text-center text-[11px] font-black text-blush-600">{error}</p>}
    </>
  );
}
