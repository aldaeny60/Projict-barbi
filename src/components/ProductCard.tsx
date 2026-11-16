"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, ShoppingBag, Star, Sparkle } from "lucide-react";
import type { ProductDTO } from "@/lib/types";
import { formatIQD } from "@/lib/format";
import { useCart, useFavorites, useToast } from "./providers";

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={
            i <= Math.round(value) ? "fill-butter-400 text-butter-400" : "fill-ink/10 text-ink/10"
          }
        />
      ))}
    </span>
  );
}

export function ProductCard({ p, index = 0 }: { p: ProductDTO; index?: number }) {
  const { add } = useCart();
  const { toggleFav, hasFav } = useFavorites();
  const { toast } = useToast();
  const [hovered, setHovered] = useState(false);
  const soldOut = p.stock <= 0;
  const fav = hasFav(p.id);

  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (soldOut) return;
    add({
      productId: p.id,
      slug: p.slug,
      name: p.name,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      image: p.images[0] ?? "",
      size: p.sizes[0] ?? "قياس واحد",
      color: p.colors[0]?.name ?? "أساسي",
      stock: p.stock,
    });
    toast("انضاف للسلة — نفس الذوق الحلو!");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.3), ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={`/product/${p.id}`}
        className="group block"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="card-bubble overflow-hidden transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-pop">
          {/* image */}
          <div className="relative aspect-[4/5] overflow-hidden bg-aqua-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.images[0]}
              alt={p.name}
              loading="lazy"
              className={`absolute inset-0 size-full object-cover transition-all duration-700 ${hovered && p.images[1] ? "scale-110 opacity-0" : "scale-100 opacity-100"}`}
            />
            {p.images[1] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.images[1]}
                alt=""
                loading="lazy"
                className={`absolute inset-0 size-full object-cover transition-all duration-700 ${hovered ? "scale-105 opacity-100" : "scale-125 opacity-0"}`}
              />
            )}

            {/* badges */}
            <div className="absolute right-3 top-3 flex flex-col gap-1.5">
              {p.discountPct && (
                <span className="rounded-full bg-butter-400 px-2.5 py-1 text-[11px] font-black text-ink shadow-soft">
                  خصم {p.discountPct}%
                </span>
              )}
              {p.isNew && (
                <span className="flex items-center gap-1 rounded-full bg-minty-400 px-2.5 py-1 text-[11px] font-black text-white shadow-soft">
                  <Sparkle size={10} /> جديد
                </span>
              )}
            </div>

            {/* fav */}
            <button
              onClick={(e) => {
                e.preventDefault();
                toggleFav({
                  productId: p.id,
                  slug: p.slug,
                  name: p.name,
                  price: p.price,
                  compareAtPrice: p.compareAtPrice,
                  image: p.images[0] ?? "",
                });
              }}
              aria-label="مفضلة"
              className={`absolute left-3 top-3 grid size-9 place-items-center rounded-full shadow-soft backdrop-blur transition-all active:scale-75 ${
                fav ? "bg-blush-500 text-white" : "bg-white/85 text-ink hover:text-blush-500"
              }`}
            >
              <Heart size={16} className={fav ? "fill-current" : ""} />
            </button>

            {/* quick add */}
            {!soldOut && (
              <button
                onClick={quickAdd}
                className="absolute inset-x-3 bottom-3 flex translate-y-14 items-center justify-center gap-2 rounded-2xl bg-ink/90 py-2.5 text-xs font-black text-white opacity-0 backdrop-blur transition-all duration-300 hover:bg-ink group-hover:translate-y-0 group-hover:opacity-100"
              >
                <ShoppingBag size={14} /> إضافة سريعة للسلة
              </button>
            )}

            {soldOut && (
              <div className="absolute inset-0 grid place-items-center bg-white/60 backdrop-blur-[2px]">
                <span className="rounded-full bg-ink px-4 py-1.5 text-xs font-black text-white">نفذت الكمية</span>
              </div>
            )}
          </div>

          {/* info */}
          <div className="p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-bold text-ink-soft">
                {p.categoryName}
              </span>
              <span className="flex items-center gap-1">
                <Stars value={p.rating} size={11} />
                <span className="text-[10px] font-bold text-ink-faint">({p.reviewsCount})</span>
              </span>
            </div>
            <h3 className="mt-2 line-clamp-2 min-h-[2.6rem] text-[13px] font-black leading-relaxed">{p.name}</h3>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-base font-black text-blush-600">{formatIQD(p.price)}</span>
              {p.compareAtPrice && (
                <span className="text-[11px] font-bold text-ink-faint line-through">{formatIQD(p.compareAtPrice)}</span>
              )}
            </div>
            {/* color dots */}
            <div className="mt-2 flex items-center gap-1">
              {p.colors.slice(0, 5).map((c) => (
                <span key={c.name} title={c.name} className="size-3.5 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} />
              ))}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function SectionTitle({
  title,
  sub,
  href,
  tone = "blush",
}: {
  title: string;
  sub?: string;
  href?: string;
  tone?: "blush" | "aqua" | "minty" | "lilac" | "butter";
}) {
  const tones: Record<string, string> = {
    blush: "from-blush-300 to-blush-500",
    aqua: "from-aqua-300 to-aqua-500",
    minty: "from-minty-300 to-minty-500",
    lilac: "from-lilac-300 to-lilac-500",
    butter: "from-butter-300 to-butter-500",
  };
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <div className={`mb-2 h-2 w-12 rounded-full bg-gradient-to-l ${tones[tone]}`} />
        <h2 className="text-2xl font-black md:text-3xl">{title}</h2>
        {sub && <p className="mt-1 text-sm font-semibold text-ink-soft">{sub}</p>}
      </div>
      {href && (
        <Link href={href} className="shrink-0 rounded-full border-2 border-ink/10 bg-white px-4 py-2 text-xs font-black transition-all hover:-translate-y-0.5 hover:border-blush-300 hover:text-blush-600">
          عرض الكل ←
        </Link>
      )}
    </div>
  );
}
