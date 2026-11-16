"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, Shirt, Sparkles, Baby, SlidersHorizontal, Flame, X, PackageSearch } from "lucide-react";
import type { CategoryDTO, ProductDTO } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { SECTIONS } from "@/lib/data";

type Section = "all" | "boys" | "girls" | "newborn";

const SORTS = [
  { key: "newest", label: "الأحدث" },
  { key: "best", label: "الأكثر مبيعاً" },
  { key: "rating", label: "الأعلى تقييماً" },
  { key: "price_asc", label: "السعر: من الأقل" },
  { key: "price_desc", label: "السعر: من الأعلى" },
  { key: "deals", label: "أعلى خصم" },
];

const sectionIcons: Record<string, typeof Shirt> = {
  all: LayoutGrid,
  boys: Shirt,
  girls: Sparkles,
  newborn: Baby,
};

export function ShopClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const section = (sp.get("section") as Section) || "all";
  const category = sp.get("category") ?? "";
  const q = sp.get("q") ?? "";
  const sort = sp.get("sort") ?? "newest";
  const deals = sp.get("deals") === "1";
  const isNew = sp.get("new") === "1";

  const [cats, setCats] = useState<CategoryDTO[]>([]);
  const [items, setItems] = useState<ProductDTO[] | null>(null);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => setCats(d.categories ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    setItems(null);
    const params = new URLSearchParams();
    if (section !== "all") params.set("section", section);
    if (category) params.set("category", category);
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    if (deals) params.set("deals", "1");
    if (isNew) params.set("new", "1");
    params.set("limit", "60");
    fetch(`/api/products?${params}`)
      .then((r) => r.json())
      .then((d) => setItems(d.products ?? []))
      .catch(() => setItems([]));
  }, [section, category, q, sort, deals, isNew]);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "" || v === "all") params.delete(k);
        else params.set(k, v);
      }
      router.push(`/shop?${params.toString()}`);
    },
    [sp, router]
  );

  const sectionCats = useMemo(
    () => (section === "all" ? cats : cats.filter((c) => c.section === section)),
    [cats, section]
  );
  const activeCat = cats.find((c) => c.slug === category);

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 md:px-6">
      {/* heading */}
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-black md:text-3xl">
          {q ? (
            <>
              <PackageSearch className="text-blush-500" /> نتائج البحث عن “{q}”
            </>
          ) : isNew ? (
            <>
              <Sparkles className="text-minty-500" /> وصل حديثاً
            </>
          ) : deals ? (
            <>
              <Flame className="text-butter-500" /> عروض وخصومات اليوم
            </>
          ) : activeCat ? (
            <>
              {SECTIONS[activeCat.section as keyof typeof SECTIONS]?.label} — {activeCat.nameAr}
            </>
          ) : (
            <>تسوقي ملابس صغاركم</>
          )}
        </h1>
        <p className="mt-1 text-sm font-semibold text-ink-soft">
          {items ? `${items.length} منتج` : "جاري التحميل…"} • أسعار بالدينار العراقي تشمل التغليف
        </p>
      </div>

      {/* section segmented */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(["all", "boys", "girls", "newborn"] as Section[]).map((s) => {
          const Icon = sectionIcons[s];
          const active = section === s;
          return (
            <button
              key={s}
              onClick={() => setParams({ section: s === "all" ? null : s, category: null })}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-black transition-all ${
                active ? "bg-ink text-white shadow-pop" : "bg-white text-ink-soft shadow-soft hover:text-ink"
              }`}
            >
              <Icon size={15} />
              {s === "all" ? "الكل" : SECTIONS[s].label}
            </button>
          );
        })}
      </div>

      {/* category chips + sort */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <AnimatePresence>
            {sectionCats.map((c) => {
              const active = category === c.slug;
              return (
                <motion.button
                  key={c.id}
                  layout
                  onClick={() => setParams({ category: active ? null : c.slug })}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-xs font-bold transition-all ${
                    active
                      ? "bg-blush-500 text-white shadow-soft"
                      : "bg-white text-ink shadow-soft hover:bg-blush-50"
                  }`}
                >
                  {active && <X size={12} />}
                  {c.nameAr}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-ink-soft" />
          <select
            value={sort}
            onChange={(e) => setParams({ sort: e.target.value === "newest" ? null : e.target.value })}
            className="field w-auto cursor-pointer py-2 text-xs font-black"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* grid */}
      {items === null ? (
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4 md:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="shimmer aspect-[3/4.6] rounded-[1.75rem]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card-bubble mx-auto max-w-md p-10 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-lilac-100">
            <PackageSearch className="text-lilac-500" size={28} />
          </span>
          <h3 className="mt-4 text-lg font-black">ما لكينا شي يطابق طلبج</h3>
          <p className="mt-1 text-sm font-semibold text-ink-soft">جربي كلمة ثانية أو تصفحي الأقسام — توجد تشكيلات حلوة بانتظارج!</p>
          <button onClick={() => router.push("/shop")} className="mt-5 rounded-full bg-ink px-6 py-2.5 text-sm font-black text-white">
            عرض كل المنتجات
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4 md:gap-5">
          {items.map((p, i) => (
            <ProductCard key={p.id} p={p} index={i % 8} />
          ))}
        </div>
      )}
    </div>
  );
}
