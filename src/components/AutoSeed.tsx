"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

/** First-run experience: populate the database then refresh */
export function AutoSeed() {
  const router = useRouter();
  const [msg, setMsg] = useState("نجهز المتجر لأول مرة…");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/seed", { method: "POST" })
      .then((r) => r.json())
      .then(() => {
        if (!cancelled) {
          setMsg("جاهز! نعرض المنتجات…");
          router.refresh();
        }
      })
      .catch(() => setMsg("تعذر التهيئة — حدّث الصفحة"));
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="grid min-h-[70vh] place-items-center">
      <div className="card-bubble flex flex-col items-center gap-4 p-10 text-center">
        <span className="grid size-16 animate-floaty place-items-center rounded-3xl bg-gradient-to-br from-blush-200 to-lilac-200">
          <Sparkles className="text-blush-600" size={28} />
        </span>
        <Loader2 className="animate-spin text-lilac-500" size={22} />
        <p className="text-sm font-black text-ink">{msg}</p>
      </div>
    </div>
  );
}
