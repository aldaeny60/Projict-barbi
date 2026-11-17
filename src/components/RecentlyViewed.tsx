"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { formatIQD } from "@/lib/format";

type Viewed = { id: number; slug: string; name: string; price: number; image: string };

const KEY = "barbi_viewed_v1";
const MAX = 8;

/**
 * «شوهدت مؤخراً» — محلي في المتصفح فقط (لا حساب ولا قاعدة بيانات).
 * يُسجَّل المنتج الحالي عند فتح صفحته، ويُعرض ما سبقه.
 */
export function RecentlyViewed({ current }: { current: Viewed }) {
  const [items, setItems] = useState<Viewed[]>([]);

  useEffect(() => {
    let prev: Viewed[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      if (Array.isArray(raw)) {
        prev = raw.filter(
          (x): x is Viewed =>
            Boolean(x) &&
            typeof x.id === "number" &&
            typeof x.slug === "string" &&
            typeof x.name === "string" &&
            typeof x.price === "number"
        );
      }
    } catch {
      /* تخزين تالف أو محظور — نتجاهل */
    }
    setItems(prev.filter((x) => x.id !== current.id).slice(0, MAX));
    const next = [current, ...prev.filter((x) => x.id !== current.id)].slice(0, MAX);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, [current]);

  if (!items.length) return null;

  return (
    <div className="mt-10">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-black">
        <Clock size={18} className="text-lilac-500" /> شوهدت مؤخراً
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {items.map((p) => (
          <Link key={p.id} href={`/product/${p.slug || p.id}`} className="w-32 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image} alt={p.name} loading="lazy" className="aspect-[3/4] w-full rounded-2xl object-cover shadow-soft" />
            <p className="mt-1.5 line-clamp-1 text-[11px] font-black">{p.name}</p>
            <p className="text-[10px] font-bold text-blush-600">{formatIQD(p.price)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
