"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Lock } from "lucide-react";

/**
 * شاشة أول تشغيل عندما تكون القاعدة فارغة.
 * - وضع العرض: تبذر تلقائياً ثم تُحدّث الصفحة.
 * - الإنتاج: لا تحاول الكتابة (البذر للإدارة فقط) وتعرض خطوة واضحة بدل خطأ صامت.
 */
export function AutoSeed({ demo = false }: { demo?: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState(demo ? "نجهز المتجر لأول مرة…" : "");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!demo) return;
    let cancelled = false;
    fetch("/api/seed", { method: "POST" })
      .then((r) => r.json())
      .then(() => {
        if (cancelled) return;
        setMsg("جاهز! نعرض المنتجات…");
        router.refresh();
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setMsg("تعذر التهيئة — حدّث الصفحة");
      });
    return () => {
      cancelled = true;
    };
  }, [demo, router]);

  if (!demo) {
    return (
      <div className="grid min-h-[70vh] place-items-center px-4">
        <div className="card-bubble flex max-w-md flex-col items-center gap-3 p-10 text-center">
          <span className="grid size-16 place-items-center rounded-3xl bg-lilac-100">
            <Lock className="text-lilac-600" size={26} />
          </span>
          <p className="text-base font-black">المتجر بلا منتجات بعد</p>
          <p className="text-sm font-semibold leading-7 text-ink-soft">
            قاعدة البيانات فارغة. البذر مخصص للإدارة: ادخل لوحة التحكم ثم شغّل التهيئة،
            أو نفّذ <code className="rounded bg-paper px-1.5 py-0.5 text-[11px]" dir="ltr">POST /api/seed</code> بجلسة إدارة.
          </p>
          <Link href="/admin" className="mt-2 rounded-2xl bg-ink px-6 py-3 text-sm font-black text-white">
            دخول لوحة التحكم
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[70vh] place-items-center">
      <div className="card-bubble flex flex-col items-center gap-4 p-10 text-center">
        <span className="grid size-16 animate-floaty place-items-center rounded-3xl bg-gradient-to-br from-blush-200 to-lilac-200">
          <Sparkles className="text-blush-600" size={28} />
        </span>
        {failed ? null : <Loader2 className="animate-spin text-lilac-500" size={22} />}
        <p className="text-sm font-black text-ink">{msg}</p>
      </div>
    </div>
  );
}
