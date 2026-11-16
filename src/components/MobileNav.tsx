"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ShoppingBag, Heart, User } from "lucide-react";
import { useCart, useFavorites } from "./providers";

const TABS = [
  { href: "/", label: "الرئيسية", icon: Home },
  { href: "/shop", label: "التسوق", icon: LayoutGrid },
  { href: "/cart", label: "السلة", icon: ShoppingBag },
  { href: "/account?tab=favorites", label: "المفضلة", icon: Heart },
  { href: "/account", label: "حسابي", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();
  const { count } = useCart();
  const { favorites } = useFavorites();

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 rounded-3xl border border-white/50 bg-white/90 py-2 shadow-pop backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((t) => {
          const active =
            t.href === "/" ? pathname === "/" : pathname.startsWith(t.href.split("?")[0]);
          return (
            <Link key={t.label} href={t.href} className="relative flex flex-col items-center gap-0.5 px-3 py-1">
              <span className={`relative grid size-9 place-items-center rounded-2xl transition-all ${active ? "bg-gradient-to-br from-blush-300 to-lilac-300 text-white shadow-soft" : "text-ink-soft"}`}>
                <t.icon size={19} />
                {t.label === "السلة" && count > 0 && (
                  <span className="absolute -top-1 -left-1 grid size-4 place-items-center rounded-full bg-butter-400 text-[9px] font-black text-ink">{count}</span>
                )}
                {t.label === "المفضلة" && favorites.length > 0 && (
                  <span className="absolute -top-1 -left-1 grid size-4 place-items-center rounded-full bg-blush-500 text-[9px] font-black text-white">{favorites.length}</span>
                )}
              </span>
              <span className={`text-[10px] font-black ${active ? "text-blush-600" : "text-ink-soft"}`}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
