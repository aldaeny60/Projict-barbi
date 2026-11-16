"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Heart, ShoppingBag, User, Star, Truck, Sparkles, Baby, Shirt, Loader2 } from "lucide-react";
import { Logo } from "./Logo";
import { useCart, useFavorites, useCustomer } from "./providers";
import { formatIQD } from "@/lib/format";
import type { CategoryDTO } from "@/lib/types";

type Suggestion = { id: number; slug: string; name: string; price: number; image: string | null };

const MARQUEE_ITEMS = [
  "توصيل لكل محافظات العراق خلال 24 - 72 ساعة",
  "خصم 25% على تشكيلة العيد — كود EID25",
  "الدفع عند الاستلام متاح في كل المحافظات",
  "إرجاع واستبدال مجاني خلال 7 أيام",
  "أول طلب لك؟ استخدم WELCOME10 واحصل على خصم 10%",
];

export function Header() {
  const router = useRouter();
  const { count } = useCart();
  const { favorites } = useFavorites();
  const { customer } = useCustomer();
  const [cats, setCats] = useState<CategoryDTO[]>([]);
  const [query, setQuery] = useState("");
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [openSugs, setOpenSugs] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCats(d.categories ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpenSugs(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const onType = (v: string) => {
    setQuery(v);
    if (debRef.current) clearTimeout(debRef.current);
    if (v.trim().length < 2) {
      setSugs([]);
      setOpenSugs(false);
      return;
    }
    debRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(v.trim())}`);
        const d = await r.json();
        setSugs(d.suggestions ?? []);
        setOpenSugs(true);
      } catch {
        /* offline */
      } finally {
        setSearching(false);
      }
    }, 260);
  };

  const goSearch = () => {
    if (!query.trim()) return;
    setOpenSugs(false);
    router.push(`/shop?q=${encodeURIComponent(query.trim())}`);
  };

  const sections = [
    {
      key: "boys",
      label: "أولاد",
      icon: Shirt,
      chip: "bg-aqua-100 text-aqua-700",
      panel: "bg-aqua-50",
      glow: "group-hover/link:text-aqua-600",
    },
    {
      key: "girls",
      label: "بنات",
      icon: Sparkles,
      chip: "bg-blush-100 text-blush-700",
      panel: "bg-blush-50",
      glow: "group-hover/link:text-blush-600",
    },
    {
      key: "newborn",
      label: "مواليد",
      icon: Baby,
      chip: "bg-minty-100 text-minty-700",
      panel: "bg-minty-50",
      glow: "group-hover/link:text-minty-600",
    },
  ] as const;

  return (
    <header className="sticky top-0 z-50">
      {/* offers marquee */}
      <div className="overflow-hidden bg-ink py-1.5 text-white" dir="ltr">
        <div className="animate-marquee flex w-max gap-10 [--tw:0]" style={{ direction: "ltr" }}>
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((t, i) => (
            <span key={i} className="flex items-center gap-2 text-[11px] font-bold" dir="rtl">
              <Star size={11} className="fill-butter-300 text-butter-300" />
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="border-b border-white/60 bg-paper/85 shadow-[0_4px_24px_-12px_rgb(58_53_80/0.15)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-3 md:gap-5 md:px-6">
          <Logo />

          {/* search - desktop */}
          <div ref={boxRef} className="relative hidden flex-1 md:block">
            <div className="flex items-center gap-2 rounded-full border-2 border-blush-100 bg-white py-2.5 pr-4 pl-2 transition-shadow focus-within:shadow-soft focus-within:border-blush-300">
              {searching ? <Loader2 size={18} className="animate-spin text-blush-400" /> : <Search size={18} className="text-blush-400" />}
              <input
                value={query}
                onChange={(e) => onType(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && goSearch()}
                onFocus={() => sugs.length && setOpenSugs(true)}
                placeholder="دوري على فستان، طقم، حذاء… ابحثي هنا"
                className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-ink-faint"
              />
              <button
                onClick={goSearch}
                className="shrink-0 rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-white transition-transform hover:scale-105"
              >
                بحث
              </button>
            </div>

            <AnimatePresence>
              {openSugs && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-3xl border border-blush-100 bg-white shadow-pop"
                >
                  {sugs.length === 0 ? (
                    <p className="px-5 py-4 text-sm font-semibold text-ink-soft">ما لكينا نتائج مطابقة لـ “{query}”</p>
                  ) : (
                    sugs.map((s) => (
                      <Link
                        key={s.id}
                        href={`/product/${s.id}`}
                        onClick={() => setOpenSugs(false)}
                        className="flex items-center gap-3 border-b border-paper px-4 py-2.5 transition-colors last:border-0 hover:bg-blush-50"
                      >
                        {s.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.image} alt="" className="size-11 rounded-xl object-cover" />
                        )}
                        <span className="flex-1 text-sm font-bold leading-snug">{s.name}</span>
                        <span className="text-xs font-black text-blush-600">{formatIQD(s.price)}</span>
                      </Link>
                    ))
                  )}
                  <button
                    onClick={goSearch}
                    className="w-full bg-blush-50 py-2.5 text-center text-xs font-black text-blush-700 hover:bg-blush-100"
                  >
                    عرض كل النتائج لـ “{query}”
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mr-auto flex items-center gap-1.5 md:mr-0 md:gap-2.5" style={{ marginInlineStart: "auto" }}>
            <Link
              href="/account"
              className="relative grid size-10 place-items-center rounded-full bg-white text-ink shadow-soft ring-1 ring-black/5 transition-transform hover:scale-110"
              title="حسابي"
            >
              <User size={18} />
              {customer && <span className="absolute -top-0.5 -left-0.5 size-2.5 rounded-full bg-minty-400 ring-2 ring-paper" />}
            </Link>
            <Link
              href="/account?tab=favorites"
              className="relative grid size-10 place-items-center rounded-full bg-white text-ink shadow-soft ring-1 ring-black/5 transition-transform hover:scale-110"
              title="المفضلة"
            >
              <Heart size={18} />
              {favorites.length > 0 && (
                <span className="absolute -top-1 -left-1 grid size-5 place-items-center rounded-full bg-blush-500 text-[10px] font-black text-white">
                  {favorites.length}
                </span>
              )}
            </Link>
            <Link
              href="/cart"
              className="relative flex items-center gap-2 rounded-full bg-ink px-3.5 py-2.5 text-sm font-black text-white shadow-soft transition-transform hover:scale-105 md:px-4"
            >
              <ShoppingBag size={17} />
              <span className="hidden md:inline">السلة</span>
              {count > 0 && (
                <span className="absolute -top-1.5 -left-1.5 grid size-5 place-items-center rounded-full bg-butter-400 text-[10px] font-black text-ink">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* nav - desktop */}
        <nav className="mx-auto hidden max-w-7xl items-center gap-1 px-6 pb-1 md:flex">
          <Link href="/" className="rounded-full px-4 py-2 text-sm font-black text-ink transition-colors hover:bg-blush-100">
            الرئيسية
          </Link>
          {sections.map((s) => (
            <div key={s.key} className="group/link relative">
              <Link
                href={`/shop?section=${s.key}`}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-black text-ink transition-colors ${s.glow}`}
              >
                <s.icon size={15} />
                {s.label}
              </Link>
              <div className={`invisible absolute right-0 top-full z-50 w-72 translate-y-2 rounded-3xl border border-black/5 ${s.panel} p-3 opacity-0 shadow-pop transition-all duration-200 group-hover/link:visible group-hover/link:translate-y-0 group-hover/link:opacity-100`}>
                <div className="grid grid-cols-2 gap-1.5">
                  {cats
                    .filter((c) => c.section === s.key)
                    .map((c) => (
                      <Link
                        key={c.id}
                        href={`/shop?section=${s.key}&category=${c.slug}`}
                        className="rounded-xl bg-white px-3 py-2 text-center text-[13px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:shadow-soft"
                      >
                        {c.nameAr}
                      </Link>
                    ))}
                </div>
              </div>
            </div>
          ))}
          <Link href="/track" className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-black text-ink transition-colors hover:bg-aqua-100">
            <Truck size={15} /> تتبع طلبك
          </Link>
          <Link href="/shop?deals=1&sort=deals" className="flex items-center gap-1.5 rounded-full bg-butter-100 px-4 py-2 text-sm font-black text-butter-700 transition-transform hover:scale-105">
            <Sparkles size={15} /> عروض اليوم
          </Link>
        </nav>

        {/* search - mobile */}
        <div className="px-3 pb-3 md:hidden">
          <div className="flex items-center gap-2 rounded-full border-2 border-blush-100 bg-white py-2 pr-4 pl-2">
            {searching ? <Loader2 size={16} className="animate-spin text-blush-400" /> : <Search size={16} className="text-blush-400" />}
            <input
              value={query}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && goSearch()}
              placeholder="دوري على ملابس طفلك…"
              className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-ink-faint"
            />
          </div>
          <AnimatePresence>
            {openSugs && sugs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute inset-x-3 z-50 mt-2 overflow-hidden rounded-3xl border border-blush-100 bg-white shadow-pop"
              >
                {sugs.map((s) => (
                  <Link
                    key={s.id}
                    href={`/product/${s.id}`}
                    onClick={() => setOpenSugs(false)}
                    className="flex items-center gap-3 border-b border-paper px-4 py-2.5 last:border-0"
                  >
                    {s.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image} alt="" className="size-10 rounded-xl object-cover" />
                    )}
                    <span className="flex-1 text-[13px] font-bold leading-snug">{s.name}</span>
                    <span className="text-xs font-black text-blush-600">{formatIQD(s.price)}</span>
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
