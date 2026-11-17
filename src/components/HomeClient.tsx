"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Shirt,
  Sparkles,
  Baby,
  Star,
  Moon,
  Heart,
  Backpack,
  Gift,
  Cake,
  Flame,
  Truck,
  Store,
  Smartphone,
} from "lucide-react";
import type { CategoryDTO, ProductDTO } from "@/lib/types";
import { ProductCard, SectionTitle } from "./ProductCard";
import { Countdown } from "./Countdown";
import { OCCASIONS, SECTIONS } from "@/lib/data";

const occIcon: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  moon: Moon,
  star: Star,
  heart: Heart,
  backpack: Backpack,
  gift: Gift,
  cake: Cake,
};

const HERO_SLIDES = [
  {
    img: "/images/hero-kids.png",
    tint: "from-blush-200 via-lilac-100 to-aqua-100",
    badge: "تشكيلة جديدة",
    title: "ألبسوهم الفرحة… بألوان الباستيل",
    sub: "أطقم وفساتين وبيجامات قطنية لطيفة على بشرة صغاركم — من الولادة حتى 16 سنة",
    cta: { label: "تسوقي الجديد", href: "/shop?new=1" },
    cta2: { label: "قسم المواليد", href: "/shop?section=newborn" },
  },
  {
    img: "/images/promo-eid.png",
    tint: "from-butter-100 via-blush-100 to-lilac-100",
    badge: "عروض العيد",
    title: "رونق العيد يبدأ من خزانة صغارك",
    sub: "خصومات تصل إلى 25% على فساتين المناسبات والأطقم الفاخرة — لفترة محدودة",
    cta: { label: "اكتشفي العروض", href: "/shop?deals=1&sort=deals" },
    cta2: { label: "فساتين المناسبات", href: "/shop?section=girls&category=girls-occasion-dresses" },
  },
];

export function HomeClient({
  deals,
  newArrivals,
  best,
  categories,
}: {
  deals: ProductDTO[];
  newArrivals: ProductDTO[];
  best: ProductDTO[];
  categories: CategoryDTO[];
}) {
  const [slide, setSlide] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>>(null);

  const go = (dir: number) => setSlide((s) => (s + dir + HERO_SLIDES.length + 1) % (HERO_SLIDES.length + 1));

  useEffect(() => {
    timer.current = setInterval(() => setSlide((s) => (s + 1) % (HERO_SLIDES.length + 1)), 6000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const slides = [
    ...HERO_SLIDES,
    {
      img: null,
      tint: "from-minty-100 via-aqua-100 to-butter-100",
      badge: "كل العراق",
      title: "نوصل فرحة صغاركم لكل محافظة",
      sub: "بغداد خلال 24 ساعة — والمحافظات من يوم إلى أربعة أيام عبر زاجل وأرامكس وناشيونال",
      cta: { label: "ابدئي التسوق", href: "/shop" },
      cta2: { label: "أجور التوصيل", href: "/cart" },
    },
  ];
  const cur = slides[slide];
  const sectionTints: Record<string, string> = {
    boys: "from-aqua-200 to-aqua-400",
    girls: "from-blush-200 to-blush-400",
    newborn: "from-minty-200 to-minty-400",
  };
  const sectionIcons: Record<string, typeof Shirt> = { boys: Shirt, girls: Sparkles, newborn: Baby };

  return (
    <div className="space-y-14 pb-6">
      {/* ─────────── HERO ─────────── */}
      <section className="mx-auto max-w-7xl px-3 pt-4 md:px-6">
        <div className={`relative overflow-hidden rounded-[2.5rem] bg-gradient-to-bl ${cur.tint} shadow-pop transition-colors duration-700`}>
          {/* decorations */}
          <Star className="animate-floaty absolute right-[42%] top-10 size-6 fill-butter-300 text-butter-300" />
          <Heart className="animate-floaty-slow absolute bottom-12 left-[8%] size-7 fill-blush-300 text-blush-300" />
          <Sparkles className="animate-floaty absolute left-[38%] top-16 size-5 text-lilac-400" />
          <div className="bg-dots absolute inset-0 opacity-40" />

          <div className="relative grid items-center gap-6 p-6 md:grid-cols-2 md:p-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={slide}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-1.5 text-xs font-black text-ink shadow-soft backdrop-blur">
                  <Flame size={13} className="text-blush-500" /> {cur.badge}
                </span>
                <h1 className="mt-4 text-3xl font-black leading-[1.25] md:text-[2.9rem] md:leading-[1.25]">
                  {cur.title}
                </h1>
                <p className="mt-3 max-w-md text-sm font-semibold leading-7 text-ink-soft md:text-base md:leading-8">
                  {cur.sub}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href={cur.cta.href}
                    className="rounded-full bg-ink px-7 py-3.5 text-sm font-black text-white shadow-pop transition-transform hover:scale-105 active:scale-95"
                  >
                    {cur.cta.label}
                  </Link>
                  <Link
                    href={cur.cta2.href}
                    className="rounded-full bg-white/85 px-7 py-3.5 text-sm font-black text-ink shadow-soft backdrop-blur transition-transform hover:scale-105 active:scale-95"
                  >
                    {cur.cta2.label}
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="relative mx-auto w-full max-w-md">
              <AnimatePresence mode="wait">
                {cur.img ? (
                  <motion.img
                    key={`img-${slide}`}
                    src={cur.img}
                    alt={cur.title ?? "من تشكيلة باربي"}
                    initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.94, rotate: 3 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="animate-floaty mx-auto w-full max-w-sm rounded-[2rem] shadow-pop"
                  />
                ) : (
                  <motion.div
                    key={`css-${slide}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="mx-auto grid aspect-square w-full max-w-sm place-items-center rounded-[2rem] bg-white/70 shadow-pop backdrop-blur"
                  >
                    <div className="text-center">
                      <Truck className="animate-floaty mx-auto text-aqua-500" size={84} strokeWidth={1.4} />
                      <p className="mt-4 text-lg font-black text-ink">18 محافظة عراقية</p>
                      <p className="text-xs font-bold text-ink-soft">ومندوب توصيل داخلي لبغداد</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* controls */}
          <div className="relative flex items-center justify-between px-6 pb-6 md:px-12">
            <div className="flex items-center gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  aria-label={`شريحة ${i + 1}`}
                  className={`h-2.5 rounded-full transition-all ${i === slide ? "w-8 bg-ink" : "w-2.5 bg-ink/20 hover:bg-ink/40"}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => go(-1)} aria-label="السابق" className="grid size-10 place-items-center rounded-full bg-white/80 shadow-soft transition-transform hover:scale-110">
                <ChevronRight size={18} />
              </button>
              <button onClick={() => go(1)} aria-label="التالي" className="grid size-10 place-items-center rounded-full bg-ink text-white shadow-soft transition-transform hover:scale-110">
                <ChevronLeft size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── SECTIONS ─────────── */}
      <section className="mx-auto max-w-7xl px-3 md:px-6">
        <SectionTitle title="تسوقي حسب القسم" sub="اختاري المناسب لطفلك — أولاد، بنات، أو مواليد" tone="lilac" />
        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(SECTIONS) as (keyof typeof SECTIONS)[]).map((key, i) => {
            const Icon = sectionIcons[key];
            const subs = categories.filter((c) => c.section === key);
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`group relative overflow-hidden rounded-[2rem] bg-gradient-to-bl ${sectionTints[key]} p-6 shadow-soft transition-transform hover:-translate-y-1`}
              >
                <Heart className="absolute -left-5 -top-5 size-28 fill-white/30 text-transparent transition-transform duration-500 group-hover:rotate-12" />
                <div className="flex items-center justify-between">
                  <span className="grid size-14 place-items-center rounded-3xl bg-white shadow-soft">
                    <Icon className="text-ink" size={26} />
                  </span>
                  <Link href={`/shop?section=${key}`} className="rounded-full bg-ink/90 px-4 py-2 text-xs font-black text-white transition-transform hover:scale-105">
                    تسوقي القسم
                  </Link>
                </div>
                <h3 className="mt-4 text-xl font-black">{SECTIONS[key].label}</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {subs.slice(0, 5).map((c) => (
                    <Link
                      key={c.id}
                      href={`/shop?section=${key}&category=${c.slug}`}
                      className="rounded-full bg-white/75 px-3 py-1.5 text-[11px] font-bold text-ink backdrop-blur transition-all hover:bg-white hover:shadow-soft"
                    >
                      {c.nameAr}
                    </Link>
                  ))}
                  {subs.length > 5 && (
                    <Link href={`/shop?section=${key}`} className="rounded-full bg-ink/80 px-3 py-1.5 text-[11px] font-bold text-white">
                      +{subs.length - 5}
                    </Link>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ─────────── DEALS ─────────── */}
      <section className="bg-gradient-to-l from-butter-100 via-blush-50 to-lilac-100 py-10">
        <div className="mx-auto max-w-7xl px-3 md:px-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-2 h-2 w-12 rounded-full bg-gradient-to-l from-butter-300 to-blush-400" />
              <h2 className="flex items-center gap-2 text-2xl font-black md:text-3xl">
                عروض اليوم <Flame className="text-blush-500" size={26} />
              </h2>
              <p className="mt-1 text-sm font-semibold text-ink-soft">أسعار تذوب… قبل نهاية اليوم!</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-ink-soft">ينتهي العرض خلال</span>
              <Countdown />
            </div>
          </div>
          <div className="no-scrollbar -mx-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-3 pb-2 md:mx-0 md:px-0">
            {deals.map((p, i) => (
              <div key={p.id} className="w-[240px] shrink-0 snap-start md:w-[270px]">
                <ProductCard p={p} index={i} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── NEW ARRIVALS ─────────── */}
      <section className="mx-auto max-w-7xl px-3 md:px-6">
        <SectionTitle title="وصل حديثاً" sub="أحدث القطع على الرفوف — قبل ما تخلص" href="/shop?new=1" tone="minty" />
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4 md:gap-5">
          {newArrivals.slice(0, 8).map((p, i) => (
            <ProductCard key={p.id} p={p} index={i} />
          ))}
        </div>
      </section>

      {/* ─────────── OCCASIONS ─────────── */}
      <section className="mx-auto max-w-7xl px-3 md:px-6">
        <SectionTitle title="جهزيهم للمناسبات" sub="أُطُق جاهزة لكل موسم عراقي" tone="butter" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {OCCASIONS.map((o, i) => {
            const Icon = occIcon[o.emojiIcon] ?? Star;
            const tones = ["bg-blush-100 text-blush-700", "bg-aqua-100 text-aqua-700", "bg-minty-100 text-minty-700", "bg-lilac-100 text-lilac-700", "bg-butter-100 text-butter-700", "bg-cream text-butter-700"];
            return (
              <motion.div
                key={o.key}
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href="/shop?deals=1&sort=deals"
                  className={`group flex flex-col items-center gap-2 rounded-3xl ${tones[i % tones.length]} p-5 text-center transition-transform hover:-translate-y-1.5 hover:shadow-pop`}
                >
                  <span className="grid size-12 place-items-center rounded-2xl bg-white shadow-soft transition-transform group-hover:rotate-12">
                    <Icon size={22} />
                  </span>
                  <span className="text-sm font-black">{o.key}</span>
                  <span className="text-[10px] font-bold opacity-70">{o.tagline}</span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ─────────── BEST SELLERS ─────────── */}
      <section className="mx-auto max-w-7xl px-3 md:px-6">
        <SectionTitle
          title="الأكثر مبيعاً"
          sub="اختيارات الأمهات العراقيات — جربتيهن وبتحبيهن"
          href="/shop?sort=best"
          tone="blush"
        />
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4 md:gap-5">
          {best.slice(0, 8).map((p, i) => (
            <ProductCard key={p.id} p={p} index={i} />
          ))}
        </div>
      </section>

      {/* ─────────── APP CTA ─────────── */}
      <section className="mx-auto max-w-7xl px-3 md:px-6">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-ink p-8 text-white shadow-pop md:p-12">
          <Star className="animate-floaty absolute left-10 top-10 size-8 fill-butter-300 text-butter-300" />
          <Heart className="animate-floaty-slow absolute bottom-8 right-[30%] size-6 fill-blush-300 text-blush-300" />
          <div className="relative grid items-center gap-8 md:grid-cols-2">
            <div>
              <span className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-black">تطبيقات باربي</span>
              <h2 className="mt-4 text-2xl font-black leading-snug md:text-3xl">
                تسوقي براحة من تلفونج —
                <br className="hidden md:block" /> المتجر بين إيديك جاي!
              </h2>
              <p className="mt-3 max-w-md text-sm font-semibold leading-7 text-white/70">
                تطبيق آيفون وأندرويد قيد الإطلاق على App Store وGoogle Play. إلى حينها: ثبّتي الموقع كتطبيق (PWA) من قائمة المتصفح — نفس التجربة وبدون تحميل.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {[
                  { icon: Smartphone, label: "App Store", sub: "قريباً" },
                  { icon: Smartphone, label: "Google Play", sub: "قريباً" },
                ].map((s) => (
                  <span key={s.label} className="flex items-center gap-3 rounded-2xl bg-white/10 px-5 py-3 backdrop-blur">
                    <s.icon size={22} className="text-butter-300" />
                    <span className="text-right">
                      <span className="block text-sm font-black">{s.label}</span>
                      <span className="block text-[10px] font-bold text-white/60">متوفر {s.sub} — PWA متاح الآن</span>
                    </span>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-center md:justify-end">
              <div className="animate-floaty relative">
                <div className="grid size-52 place-items-center rounded-[3rem] bg-gradient-to-br from-blush-300 via-lilac-300 to-aqua-300 shadow-pop md:size-64">
                  <div className="text-center">
                    <Store size={72} className="mx-auto text-white drop-shadow-lg" strokeWidth={1.3} />
                    <p className="mt-3 text-lg font-black text-white">باربي PWA</p>
                    <p className="px-6 text-[11px] font-bold text-white/80">"إضافة إلى الشاشة الرئيسية" من متصفحك</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
