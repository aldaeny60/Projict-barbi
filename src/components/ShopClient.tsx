"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, Shirt, Sparkles, Baby, SlidersHorizontal, Flame, X, PackageSearch } from "lucide-react";
import type { CategoryDTO, ProductDTO } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { COLOR_PALETTE, SECTIONS, SIZES_ALL } from "@/lib/data";

type Section = "all" | "boys" | "girls" | "newborn";

const PRICE_RANGES = [
  { key: "", label: "كل الأسعار" },
  { key: "0-15000", label: "أقل من 15 ألف" },
  { key: "15000-30000", label: "15 – 30 ألف" },
  { key: "30000-50000", label: "30 – 50 ألف" },
  { key: "50000-0", label: "أكثر من 50 ألف" },
];

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
  const minPrice = sp.get("minPrice") ?? "";
  const maxPrice = sp.get("maxPrice") ?? "";
  const size = sp.get("size") ?? "";
  const color = sp.get("color") ?? "";
  const [showFilters, setShowFilters] = useState(false);

  const priceKey = minPrice || maxPrice ? `${minPrice}-${maxPrice}` : "";
  const filtersCount = [priceKey, size, color].filter(Boolean).length;

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
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (size) params.set("size", size);
    if (color) params.set("color", color);
    params.set("limit", "60");
    fetch(`/api/products?${params}`)
      .then((r) => r.json())
      .then((d) => setItems(d.products ?? []))
      .catch(() => setItems([]));
  }, [section, category, q, sort, deals, isNew, minPrice, maxPrice, size, color]);

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

      {/* filters */}
      <div className="mb-6">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-black transition-colors ${filtersCount ? "bg-ink text-white" : "bg-white text-ink-soft shadow-soft hover:text-ink"}`}
        >
          <SlidersHorizontal size={14} />
          فلاتر {filtersCount ? `(${filtersCount})` : ""}
          {filtersCount ? (
            <span
              onClick={(e) => { e.stopPropagation(); setParams({ minPrice: null, maxPrice: null, size: null, color: null }); }}
              className="mr-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px]"
            >
              مسح
            </span>
          ) : null}
        </button>

        {showFilters && (
          <div className="mt-2 grid gap-4 rounded-3xl bg-white p-4 shadow-soft md:grid-cols-3">
            <div>
              <p className="mb-2 text-xs font-black text-ink-soft">السعر</p>
              <select
                value={priceKey}
                onChange={(e) => {
                  const [min, max] = e.target.value.split("-");
                  setParams({ minPrice: min && min !== "0" ? min : null, maxPrice: max && max !== "0" ? max : null });
                }}
                className="field cursor-pointer py-2 text-xs font-black"
              >
                {PRICE_RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-2 text-xs font-black text-ink-soft">المقاس</p>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {SIZES_ALL.map((s) => (
                  <button
                    key={s}
                    onClick={() => setParams({ size: size === s ? null : s })}
                    className={`rounded-xl px-2.5 py-1.5 text-[10px] font-black ${size === s ? "bg-ink text-white" : "bg-paper ring-1 ring-ink/10"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-black text-ink-soft">اللون</p>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => setParams({ color: color === c.name ? null : c.name })}
                    className={`flex items-center gap-1 rounded-xl py-1.5 pl-2.5 pr-1.5 text-[10px] font-black ${color === c.name ? "bg-ink text-white" : "bg-paper ring-1 ring-ink/10"}`}
                  >
                    <span className="size-3.5 rounded-full ring-1 ring-black/20" style={{ background: c.hex }} />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
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
