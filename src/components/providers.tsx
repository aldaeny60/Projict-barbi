"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import type { CartLine, ProductDTO } from "@/lib/types";

export type Customer = { id: number; name: string; phone: string };

/* ───────────── toast ───────────── */
type Toast = { id: number; message: string; tone: "ok" | "err" | "info" };
const ToastCtx = createContext<{ toast: (message: string, tone?: Toast["tone"]) => void }>({
  toast: () => {},
});
export const useToast = () => useContext(ToastCtx);

/* ───────────── cart ───────────── */
type CartCtx = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};
export const lineKey = (l: Pick<CartLine, "productId" | "size" | "color">) =>
  `${l.productId}|${l.size}|${l.color}`;

const CartContext = createContext<CartCtx>({
  lines: [],
  count: 0,
  subtotal: 0,
  add: () => {},
  setQty: () => {},
  remove: () => {},
  clear: () => {},
});
export const useCart = () => useContext(CartContext);

const CART_KEY = "sighar_cart_v1";
const FAV_KEY = "sighar_fav_v1";
const CUSTOMER_KEY = "sighar_customer_v1";

/* ───────────── favorites ───────────── */
type FavCtx = {
  favorites: CartLine[];
  toggleFav: (line: Omit<CartLine, "qty" | "size" | "color" | "stock"> & { size?: string; color?: string }) => void;
  hasFav: (productId: number) => boolean;
};
const FavContext = createContext<FavCtx>({ favorites: [], toggleFav: () => {}, hasFav: () => false });
export const useFavorites = () => useContext(FavContext);

/* ───────────── customer ───────────── */
type CustomerCtx = {
  customer: Customer | null;
  login: (c: Customer) => void;
  logout: () => void;
};
const CustomerContext = createContext<CustomerCtx>({ customer: null, login: () => {}, logout: () => {} });
export const useCustomer = () => useContext(CustomerContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [favorites, setFavorites] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const hydrated = useRef(false);
  const customerRef = useRef<Customer | null>(null);
  const favoritesRef = useRef<CartLine[]>([]);
  const syncedFor = useRef<string | null>(null);
  customerRef.current = customer;
  favoritesRef.current = favorites;

  /* hydrate from localStorage */
  useEffect(() => {
    try {
      const c = localStorage.getItem(CART_KEY);
      if (c) setLines(JSON.parse(c));
      const f = localStorage.getItem(FAV_KEY);
      if (f) setFavorites(JSON.parse(f));
      const cu = localStorage.getItem(CUSTOMER_KEY);
      if (cu) setCustomer(JSON.parse(cu));
    } catch { /* ignore */ }
    hydrated.current = true;
  }, []);

  /* جلسة الزبون الحقيقية من الخادم (كوكي OTP موقّعة) — لا نثق بـ localStorage وحده */
  useEffect(() => {
    let alive = true;
    fetch("/api/customer/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { customer: Customer | null } | null) => {
        if (!alive || !d) return; // فشل الشبكة: نُبقي النسخة المحلية للعمل بلا اتصال
        setCustomer(d.customer);
        try {
          if (d.customer) localStorage.setItem(CUSTOMER_KEY, JSON.stringify(d.customer));
          else localStorage.removeItem(CUSTOMER_KEY);
        } catch { /* ignore */ }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  /* دمج المفضلة المحلية مع الخادم مرة واحدة بعد الدخول، ثم جلب مفضلة الحساب */
  useEffect(() => {
    if (!customer) return;
    if (syncedFor.current === customer.phone) return;
    syncedFor.current = customer.phone;
    const local = favorites;
    (async () => {
      for (const f of local) {
        await fetch("/api/customer/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: f.productId }),
        }).catch(() => {});
      }
      const r = await fetch("/api/customer/favorites").catch(() => null);
      if (!r?.ok) return;
      const d = (await r.json().catch(() => null)) as { favorites?: ProductDTO[] } | null;
      const server = d?.favorites ?? [];
      if (!server.length) return;
      setFavorites((prev) => {
        const byId = new Map(prev.map((l) => [l.productId, l] as const));
        for (const p of server) {
          if (byId.has(p.id)) continue;
          byId.set(p.id, {
            productId: p.id,
            slug: p.slug,
            name: p.name,
            price: p.price,
            compareAtPrice: p.compareAtPrice,
            image: p.images[0] ?? "",
            size: p.sizes[0] ?? "",
            color: p.colors[0]?.name ?? "",
            qty: 1,
            stock: p.stock,
          });
        }
        return [...byId.values()];
      });
    })();
  }, [customer, favorites]);

  useEffect(() => {
    if (hydrated.current) localStorage.setItem(CART_KEY, JSON.stringify(lines));
  }, [lines]);
  useEffect(() => {
    if (hydrated.current) localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const toast = useCallback((message: string, tone: Toast["tone"] = "ok") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  const add = useCallback((line: Omit<CartLine, "qty">, qty = 1) => {
    setLines((prev) => {
      const key = lineKey(line);
      const existing = prev.find((l) => lineKey(l) === key);
      if (existing) {
        return prev.map((l) =>
          lineKey(l) === key ? { ...l, qty: Math.min(l.qty + qty, 10) } : l
        );
      }
      return [...prev, { ...line, qty }];
    });
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => lineKey(l) !== key)
        : prev.map((l) => (lineKey(l) === key ? { ...l, qty: Math.min(qty, 10) } : l))
    );
  }, []);

  const remove = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => lineKey(l) !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const cart = useMemo<CartCtx>(
    () => ({
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: lines.reduce((s, l) => s + l.qty * l.price, 0),
      add,
      setQty,
      remove,
      clear,
    }),
    [lines, add, setQty, remove, clear]
  );

  const toggleFav = useCallback<FavCtx["toggleFav"]>((line) => {
    const exists = favoritesRef.current.some((f) => f.productId === line.productId);
    // المفضلة تُحفظ على الخادم أيضاً حتى تبقى بين الأجهزة (تتجاهل بهدوء بلا اتصال)
    if (customerRef.current) {
      fetch("/api/customer/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: line.productId, action: exists ? "remove" : "add" }),
      }).catch(() => {});
    }
    setFavorites((prev) =>
      exists
        ? prev.filter((f) => f.productId !== line.productId)
        : [
            ...prev,
            {
              productId: line.productId,
              slug: line.slug,
              name: line.name,
              price: line.price,
              compareAtPrice: line.compareAtPrice,
              image: line.image,
              size: line.size ?? "",
              color: line.color ?? "",
              qty: 1,
              stock: 99,
            },
          ]
    );
  }, []);

  const fav = useMemo<FavCtx>(
    () => ({ favorites, toggleFav, hasFav: (id) => favorites.some((f) => f.productId === id) }),
    [favorites, toggleFav]
  );

  const cust = useMemo<CustomerCtx>(
    () => ({
      customer,
      login: (c) => {
        setCustomer(c);
        localStorage.setItem(CUSTOMER_KEY, JSON.stringify(c));
      },
      logout: () => {
        setCustomer(null);
        syncedFor.current = null;
        localStorage.removeItem(CUSTOMER_KEY);
        // إنهاء جلسة الخادم الموقّعة أيضاً (كوكي الزبون)
        fetch("/api/customer/me", { method: "DELETE" }).catch(() => {});
      },
    }),
    [customer]
  );

  return (
    <ToastCtx.Provider value={{ toast }}>
      <CartContext.Provider value={cart}>
        <FavContext.Provider value={fav}>
          <CustomerContext.Provider value={cust}>
            {children}
            {/* toasts */}
            <div className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex flex-col items-center gap-2 px-4">
              <AnimatePresence>
                {toasts.map((t) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: -16, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className={`pointer-events-auto flex max-w-sm items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-pop ${
                      t.tone === "ok"
                        ? "bg-minty-500"
                        : t.tone === "err"
                          ? "bg-blush-600"
                          : "bg-lilac-500"
                    }`}
                  >
                    {t.tone === "ok" ? (
                      <CheckCircle2 size={18} />
                    ) : t.tone === "err" ? (
                      <AlertTriangle size={18} />
                    ) : (
                      <Sparkles size={18} />
                    )}
                    {t.message}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </CustomerContext.Provider>
        </FavContext.Provider>
      </CartContext.Provider>
    </ToastCtx.Provider>
  );
}
