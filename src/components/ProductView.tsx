"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Heart,
  ShoppingBag,
  Zap,
  Truck,
  RefreshCcw,
  ShieldCheck,
  Ruler,
  MessageSquareHeart,
  ChevronLeft,
  Check,
  Star,
} from "lucide-react";
import type { ProductDTO, ReviewDTO } from "@/lib/types";
import { formatIQD, fmtDate, formatNum } from "@/lib/format";
import { SIZE_CHART, SECTIONS } from "@/lib/data";
import { ProductCard, Stars, SectionTitle } from "./ProductCard";
import { RecentlyViewed } from "./RecentlyViewed";
import { useCart, useCustomer, useFavorites, useToast } from "./providers";

export function ProductView({
  product: p,
  similar,
  reviews: initialReviews,
}: {
  product: ProductDTO;
  similar: ProductDTO[];
  reviews: ReviewDTO[];
}) {
  const router = useRouter();
  const { add } = useCart();
  const { toggleFav, hasFav } = useFavorites();
  const { toast } = useToast();
  const { customer } = useCustomer();

  const [imgIdx, setImgIdx] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"desc" | "chart" | "reviews">("desc");
  const [reviews, setReviews] = useState(initialReviews);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const fav = hasFav(p.id);
  const soldOut = p.stock <= 0;
  const saveAmount = p.compareAtPrice ? p.compareAtPrice - p.price : 0;
  /** مخزون المقاس المحدد — null يعني لا توزيع مقاسات لهذا المنتج */
  const stockOfSize = (s: string | null) =>
    s ? (p.sizeStock?.find((x) => x.size === s)?.stock ?? null) : null;
  const selectedStock = stockOfSize(size);
  const maxQty = selectedStock ?? p.stock;

  const ready = Boolean(size && color);
  const tryAdd = (silent = false): boolean => {
    if (!size) {
      toast("اختاري المقاس أولاً", "err");
      return false;
    }
    if (!color) {
      toast("اختاري اللون أولاً", "err");
      return false;
    }
    if (qty > maxQty) {
      toast("الكمية المطلوبة غير متوفرة بهذا المقاس", "err");
      return false;
    }
    add({
      productId: p.id,
      slug: p.slug,
      name: p.name,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      image: p.images[0] ?? "",
      size,
      color,
      stock: maxQty,
    }, qty);
    if (!silent) toast("انضاف للسلة — خيار موفق!");
    return true;
  };

  const buyNow = () => {
    if (tryAdd(true)) router.push("/checkout");
  };

  const chartRows = useMemo(
    () => SIZE_CHART.filter((r) => p.sizes.includes(r.size)),
    [p.sizes]
  );

  const submitReview = async () => {
    if (!customer) return toast("سجّلي برقمك أولاً من صفحة حسابي", "err");
    if (comment.trim().length < 3) return toast("اكتبي ملاحظتج عن المنتج", "err");
    setSending(true);
    try {
      const r = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: p.id, rating, comment: comment.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "تعذر إرسال التقييم");
      setReviews((prev) => [
        { id: Date.now(), author: d.author ?? customer.name, rating, comment: comment.trim(), createdAt: new Date().toISOString() },
        ...prev.filter((x) => x.author !== (d.author ?? customer.name)),
      ]);
      setComment("");
      toast("شكراً! تم نشر تقييمج");
    } catch (e) {
      toast(e instanceof Error ? e.message : "تعذر إرسال التقييم", "err");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 md:px-6">
      {/* breadcrumb */}
      <nav className="mb-5 flex items-center gap-1.5 text-xs font-bold text-ink-soft">
        <Link href="/" className="hover:text-blush-600">الرئيسية</Link>
        <ChevronLeft size={12} />
        <Link href={`/shop?section=${p.section}`} className="hover:text-blush-600">
          {SECTIONS[p.section]?.label}
        </Link>
        <ChevronLeft size={12} />
        <Link href={`/shop?section=${p.section}&category=${p.categorySlug}`} className="hover:text-blush-600">
          {p.categoryName}
        </Link>
        <ChevronLeft size={12} />
        <span className="line-clamp-1 max-w-48 text-ink">{p.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ─── gallery ─── */}
        <div>
          <div className="card-bubble relative overflow-hidden">
            <div className="relative aspect-[4/5] bg-aqua-50">
              <AnimatePresence mode="wait">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <motion.img
                  key={imgIdx}
                  src={p.images[imgIdx]}
                  alt={p.name}
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="absolute inset-0 size-full object-cover"
                />
              </AnimatePresence>
              {p.discountPct && (
                <span className="absolute right-4 top-4 rounded-full bg-butter-400 px-3.5 py-1.5 text-sm font-black text-ink shadow-soft">
                  خصم {p.discountPct}%
                </span>
              )}
              <button
                onClick={() =>
                  toggleFav({ productId: p.id, slug: p.slug, name: p.name, price: p.price, compareAtPrice: p.compareAtPrice, image: p.images[0] })
                }
                className={`absolute left-4 top-4 grid size-11 place-items-center rounded-full shadow-soft transition-all active:scale-75 ${fav ? "bg-blush-500 text-white" : "bg-white/90 text-ink"}`}
                aria-label="مفضلة"
              >
                <Heart size={18} className={fav ? "fill-current" : ""} />
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2.5">
            {p.images.slice(0, 4).map((src, i) => (
              <button
                key={i}
                onClick={() => setImgIdx(i)}
                className={`relative aspect-square overflow-hidden rounded-2xl ring-offset-2 transition-all ${
                  i === imgIdx ? "ring-[3px] ring-blush-400" : "opacity-70 hover:opacity-100"
                }`}
                aria-label={`صورة ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${p.name} — صورة ${i + 1}`} className="absolute inset-0 size-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* ─── info ─── */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <h1 className="text-2xl font-black leading-snug md:text-[1.9rem]">{p.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Stars value={p.rating} size={16} />
            <span className="text-xs font-black text-ink">{p.rating}</span>
            <button onClick={() => setTab("reviews")} className="text-xs font-bold text-ink-soft underline underline-offset-4 hover:text-blush-600">
              {formatNum(p.reviewsCount)} تقييم
            </button>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${soldOut ? "bg-blush-100 text-blush-600" : p.stock <= 8 ? "bg-butter-100 text-butter-700" : "bg-minty-100 text-minty-700"}`}>
              {soldOut ? "نفذت الكمية" : p.stock <= 8 ? `باقي ${p.stock} فقط!` : "متوفر"}
            </span>
          </div>

          <div className="mt-4 flex items-end gap-3">
            <span className="text-3xl font-black text-blush-600 md:text-4xl">{formatIQD(p.price)}</span>
            {p.compareAtPrice && (
              <>
                <span className="pb-1 text-lg font-bold text-ink-faint line-through">{formatIQD(p.compareAtPrice)}</span>
                <span className="pb-1.5 text-xs font-black text-minty-600">وفّرتي {formatIQD(saveAmount)}</span>
              </>
            )}
          </div>

          <p className="mt-4 text-sm font-semibold leading-8 text-ink-soft">{p.description}</p>

          {/* colors */}
          <div className="mt-6">
            <p className="mb-2 text-sm font-black">
              اللون:{" "}
              <span className={`font-bold ${color ? "text-blush-600" : "text-ink-faint"}`}>{color ?? "اختاري لوناً"}</span>
            </p>
            <div className="flex flex-wrap gap-2.5">
              {p.colors.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setColor(c.name)}
                  title={c.name}
                  className={`relative size-10 rounded-full shadow-soft ring-2 transition-all active:scale-90 ${
                    color === c.name ? "ring-ink scale-110" : "ring-black/10 hover:scale-110"
                  }`}
                  style={{ background: c.hex }}
                >
                  {color === c.name && (
                    <Check size={16} className="absolute inset-0 m-auto text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* sizes */}
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-black">
                المقاس العمري:{" "}
                <span className={`font-bold ${size ? "text-blush-600" : "text-ink-faint"}`}>
                  {size ?? "اختاري العمر"}
                  {selectedStock !== null ? ` — متبقٍ ${selectedStock}` : ""}
                </span>
              </p>
              <button onClick={() => setTab("chart")} className="flex items-center gap-1 text-xs font-black text-lilac-600 hover:underline">
                <Ruler size={13} /> جدول المقاسات
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {p.sizes.map((s) => {
                const left = stockOfSize(s);
                const gone = left !== null && left <= 0;
                return (
                <button
                  key={s}
                  disabled={gone}
                  onClick={() => { setSize(s); setQty(1); }}
                  className={`rounded-2xl border-2 py-2.5 text-center text-xs font-black transition-all active:scale-95 ${
                    gone
                      ? "cursor-not-allowed border-ink/5 bg-paper text-ink-faint line-through"
                      : size === s
                        ? "border-blush-500 bg-blush-50 text-blush-600 shadow-soft"
                        : "border-ink/10 bg-white text-ink hover:border-blush-300"
                  }`}
                >
                  {s}
                  {gone ? <span className="block text-[9px] font-bold">نفذ</span> : null}
                </button>
                );
              })}
            </div>
          </div>

          {/* qty + actions */}
          <div className="mt-6 flex items-stretch gap-3">
            <div className="flex items-center rounded-2xl border-2 border-ink/10 bg-white">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-4 py-3 text-xl font-black text-ink-soft hover:text-blush-600">−</button>
              <span className="w-8 text-center text-lg font-black tabular-nums">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(10, q + 1))} className="px-4 py-3 text-xl font-black text-ink-soft hover:text-blush-600">+</button>
            </div>
            <button
              onClick={() => !soldOut && tryAdd()}
              disabled={soldOut}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-black transition-all active:scale-95 ${
                soldOut ? "cursor-not-allowed bg-ink/10 text-ink-faint" : ready ? "bg-gradient-to-l from-blush-500 to-lilac-500 text-white shadow-pop hover:scale-[1.02]" : "bg-ink text-white shadow-pop hover:scale-[1.02]"
              }`}
            >
              <ShoppingBag size={17} /> {soldOut ? "نفذت الكمية" : "أضيفي إلى السلة"}
            </button>
          </div>
          {!soldOut && (
            <button
              onClick={buyNow}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-white py-3.5 text-sm font-black text-ink transition-all hover:bg-ink hover:text-white active:scale-95"
            >
              <Zap size={16} className="fill-butter-300 text-butter-400" /> اشتري الآن — توصيل سريع
            </button>
          )}

          {/* trust */}
          <div className="mt-6 grid grid-cols-3 gap-2">
            {[
              { icon: Truck, t: "توصيل 18 محافظة" },
              { icon: RefreshCcw, t: "إرجاع مجاني 7 أيام" },
              { icon: ShieldCheck, t: "دفع آمن ومشفر" },
            ].map((b) => (
              <div key={b.t} className="flex flex-col items-center gap-1.5 rounded-2xl bg-paper p-3 text-center ring-1 ring-black/5">
                <b.icon size={18} className="text-minty-500" />
                <span className="text-[10px] font-black text-ink-soft">{b.t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── tabs ─── */}
      <div className="mt-12">
        <div className="flex gap-2 border-b-2 border-ink/5">
          {(
            [
              { key: "desc", label: "الوصف التفصيلي" },
              { key: "chart", label: "جدول المقاسات (سم)" },
              { key: "reviews", label: `التقييمات (${reviews.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-3 text-sm font-black transition-colors ${tab === t.key ? "text-blush-600" : "text-ink-soft hover:text-ink"}`}
            >
              {t.label}
              {tab === t.key && (
                <motion.span layoutId="tab-underline" className="absolute inset-x-2 -bottom-[2px] h-1 rounded-full bg-blush-500" />
              )}
            </button>
          ))}
        </div>

        <div className="py-6">
          {tab === "desc" && (
            <div className="card-bubble max-w-3xl p-6">
              <p className="text-sm font-semibold leading-8 text-ink">{p.description}</p>
              <ul className="mt-4 space-y-2 text-sm font-semibold text-ink-soft">
                <li className="flex items-center gap-2"><Check size={15} className="text-minty-500" /> خامات آمنة على بشرة الأطفال — بدون أصباغ ضارة</li>
                <li className="flex items-center gap-2"><Check size={15} className="text-minty-500" /> تصميم عراقي يراعي الأجواء والعادات المحلية</li>
                <li className="flex items-center gap-2"><Check size={15} className="text-minty-500" /> غسيل عادي — تنشف بسرعة وما يبهت لونها</li>
                <li className="flex items-center gap-2"><Check size={15} className="text-minty-500" /> التصنيف: {SECTIONS[p.section]?.label} / {p.categoryName}</li>
              </ul>
            </div>
          )}

          {tab === "chart" && (
            <div className="card-bubble max-w-3xl overflow-hidden">
              <table className="w-full text-center text-sm">
                <thead>
                  <tr className="bg-lilac-100 text-xs font-black text-lilac-700">
                    <th className="px-3 py-3">الفئة العمرية</th>
                    <th className="px-3 py-3">الطول (سم)</th>
                    <th className="px-3 py-3">الصدر (سم)</th>
                    <th className="px-3 py-3">الخصر (سم)</th>
                    <th className="px-3 py-3">الوزن (كغ)</th>
                  </tr>
                </thead>
                <tbody>
                  {chartRows.map((r, i) => (
                    <tr key={r.size} className={`font-bold ${i % 2 ? "bg-paper" : "bg-white"}`}>
                      <td className="px-3 py-3 text-blush-600">{r.size}</td>
                      <td className="px-3 py-3">{r.height}</td>
                      <td className="px-3 py-3">{r.chest}</td>
                      <td className="px-3 py-3">{r.waist}</td>
                      <td className="px-3 py-3">{r.weight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="bg-butter-50 px-4 py-3 text-[11px] font-bold text-butter-700">
                نصيحة من باربي: إذا كان طفلج بين مقاسين، اختاري الأكبر — بتكبرينه بسرعة!
              </p>
            </div>
          )}

          {tab === "reviews" && (
            <div className="grid max-w-4xl gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-3">
                {reviews.length === 0 && (
                  <div className="card-bubble p-8 text-center text-sm font-bold text-ink-soft">
                    <MessageSquareHeart className="mx-auto mb-2 text-blush-400" size={28} />
                    كوني أول من يقيّم هذا المنتج!
                  </div>
                )}
                {reviews.map((r) => (
                  <div key={r.id} className="card-bubble p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-blush-200 to-lilac-200 text-sm font-black text-ink">
                          {r.author[0]}
                        </span>
                        <span className="text-sm font-black">{r.author}</span>
                      </div>
                      <Stars value={r.rating} />
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-7 text-ink-soft">{r.comment}</p>
                    <p className="mt-2 text-[11px] font-bold text-ink-faint">{fmtDate(r.createdAt)}</p>
                  </div>
                ))}
              </div>

              <div className="card-bubble h-fit p-5">
                <h4 className="text-sm font-black">شاركينا رأيج بالمنتج</h4>
                {customer ? (
                  <p className="mt-1 text-[11px] font-bold text-ink-faint">
                    سيظهر التقييم باسم <span className="font-black text-ink">{customer.name}</span> — والمنتج لازم يكون بطلباتك المُسلَّمة
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] font-bold text-blush-600">
                    <Link href="/account" className="underline">سجّلي برقمك</Link> أولاً — التقييم للزبائن الذين استلموا الطلب
                  </p>
                )}
                <div className="mt-3 flex items-center gap-1.5" dir="ltr">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button key={i} onClick={() => setRating(i)} className="transition-transform active:scale-75">
                      <Star size={26} className={i <= rating ? "fill-butter-400 text-butter-400" : "fill-ink/10 text-ink/10"} />
                    </button>
                  ))}
                </div>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="شلون كانت الخامة والمقاس؟" rows={3} className="field mt-2 text-sm" />
                <button onClick={submitReview} disabled={sending} className="mt-3 w-full rounded-2xl bg-ink py-3 text-sm font-black text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                  {sending ? "جاري النشر…" : "انشري التقييم"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── similar ─── */}
      <div className="mt-10">
        <SectionTitle title="منتجات مشابهة تعجبج" tone="aqua" />
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4 md:gap-5">
          {similar.map((s, i) => (
            <ProductCard key={s.id} p={s} index={i} />
          ))}
        </div>
      </div>

      <RecentlyViewed current={{ id: p.id, slug: p.slug, name: p.name, price: p.price, image: p.images[0] ?? "" }} />
    </div>
  );
}
