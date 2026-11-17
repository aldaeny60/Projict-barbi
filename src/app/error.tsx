"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * شاشة خطأ عامة — تظهر بدل صفحة بيضاء إذا فشل الاتصال بقاعدة البيانات
 * أو أي خطأ خادم آخر، مع رسالة عربية واضحة وزر إعادة محاولة.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4 py-10">
      <div className="card-bubble w-full p-8 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-blush-100">
          <AlertTriangle className="text-blush-600" size={26} />
        </span>
        <h1 className="mt-4 text-xl font-black">صار خطأ غير متوقع</h1>
        <p className="mt-2 text-sm font-semibold leading-7 text-ink-soft">
          تعذّر تحميل الصفحة. إذا كنت تشاهد نسخة العرض فقد تكون قاعدة البيانات المؤقتة ما زالت تُقلع —
          أعد المحاولة بعد ثوانٍ.
        </p>
        <button
          onClick={reset}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-ink px-6 py-3 text-sm font-black text-white"
        >
          <RotateCcw size={15} /> إعادة المحاولة
        </button>
        <a href="/" className="mt-3 block text-xs font-black text-ink-soft hover:text-ink">
          العودة للرئيسية
        </a>
      </div>
    </div>
  );
}
