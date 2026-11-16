"use client";

import { useEffect, useState } from "react";

function msUntilBaghdadMidnight() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Baghdad", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const s = get("hour") * 3600 + get("minute") * 60 + get("second");
  return (86400 - s) * 1000;
}

export function Countdown({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    setMs(msUntilBaghdadMidnight());
    const t = setInterval(() => {
      setMs((m) => {
        const next = (m ?? msUntilBaghdadMidnight()) - 1000;
        return next <= 0 ? msUntilBaghdadMidnight() : next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const totalSec = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const cells = [
    { v: h, l: "ساعة" },
    { v: m, l: "دقيقة" },
    { v: s, l: "ثانية" },
  ];
  const boxCls =
    tone === "dark"
      ? "bg-ink text-white"
      : "bg-white text-ink shadow-soft";
  return (
    <div className="flex items-center gap-1.5" dir="ltr">
      {ms === null
        ? [0, 0, 0].map((_, i) => <span key={i} className={`grid h-10 w-11 animate-pulse place-items-center rounded-xl ${boxCls}`} />)
        : cells.map((c, i) => (
            <span key={c.l} className="flex items-center gap-1.5">
              <span className={`grid h-11 w-12 place-items-center rounded-xl text-base font-black tabular-nums ${boxCls}`}>
                {String(c.v).padStart(2, "0")}
                <span className="sr-only">{c.l}</span>
              </span>
              {i < 2 && <span className={`animate-pulse text-lg font-black ${tone === "dark" ? "text-white/60" : "text-ink/30"}`}>:</span>}
            </span>
          ))}
    </div>
  );
}
