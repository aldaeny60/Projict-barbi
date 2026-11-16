"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Barcode, Search, X, Plus, Minus, Trash2, Printer, MessageCircle, Store,
  Wifi, WifiOff, CloudUpload, LogIn, LogOut, FileBarChart, Undo2, Lock,
  TicketPercent, BadgePercent, Banknote, CheckCircle2, ChevronLeft, Loader2,
  LayoutGrid, Shirt, Sparkles, Baby,
} from "lucide-react";
import type { BranchDTO, CategoryDTO, ProductDTO, ShiftDTO } from "@/lib/types";
import { PAYMENT_GATEWAYS } from "@/lib/payments";
import { COLOR_PALETTE, SIZES_ALL, SECTIONS } from "@/lib/data";
import { formatIQD, fmtTime, fmtDateTime, baghdadTodayKey } from "@/lib/format";
import { newRequestId } from "@/lib/request-id";

type PosLine = {
  productId: number;
  name: string;
  image: string;
  price: number;
  qty: number;
  size: string;
  color: string;
};
type Payment = { method: string; amount: number };
type SaleResult = {
  code: string; branch: string; staffName: string; items: PosLine[];
  subtotal: number; discountTotal: number; total: number;
  payments: Payment[]; changeDue: number; createdAt: string;
};
type Report = {
  date: string; invoicesCount: number; gross: number; discounts: number;
  returnsCount: number; returnsTotal: number; net: number;
  byPayment: { method: string; amount: number }[];
  topItems: { name: string; qty: number; revenue: number }[];
  recentSales: { id: number; code: string; total: number; status: string; staffName: string | null; createdAt: string; paymentMethod: string }[];
};

const CASH = { id: "cash", name: "نقدي", nameEn: "Cash", chip: "درج", online: false } as const;
const POS_METHODS = [
  { id: "cash", name: "نقدي", icon: Banknote, bg: "from-minty-300 to-minty-500" },
  ...PAYMENT_GATEWAYS.filter((g) => g.id !== "cod"),
];
const methodName = (id: string) =>
  id === "cash" ? "نقدي" : id === "split" ? "دفع مقسّم" : PAYMENT_GATEWAYS.find((g) => g.id === id)?.name ?? id;

const ROLES = [
  { key: "cashier", label: "كاشير" },
  { key: "supervisor", label: "مشرف" },
  { key: "manager", label: "مدير فرع" },
];

const QUEUE_KEY = "pos_queue_v1";

export default function PosPage() {
  /* catalog */
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [cats, setCats] = useState<CategoryDTO[]>([]);
  const [branches, setBranches] = useState<BranchDTO[]>([]);
  const [posStaff, setPosStaff] = useState<{ id: number; name: string; role: string }[]>([]);
  const [branchId, setBranchId] = useState(1);
  const [shift, setShift] = useState<ShiftDTO | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  /* filters */
  const [q, setQ] = useState("");
  const [section, setSection] = useState<"all" | "boys" | "girls" | "newborn">("all");
  const [catSlug, setCatSlug] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");

  /* invoice */
  const [lines, setLines] = useState<PosLine[]>([]);
  const [discount, setDiscount] = useState<{ mode: "percent" | "fixed"; value: number } | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponDisc, setCouponDisc] = useState(0);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customerPhone, setCustomerPhone] = useState("");

  /* modals */
  const [variantFor, setVariantFor] = useState<ProductDTO | null>(null);
  const [vSize, setVSize] = useState("");
  const [vColor, setVColor] = useState("");
  const [showShift, setShowShift] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showReturns, setShowReturns] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [sale, setSale] = useState<SaleResult | null>(null);

  /* misc */
  const [report, setReport] = useState<Report | null>(null);
  const [returnsList, setReturnsList] = useState<Report["recentSales"]>([]);
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<object[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [, forceTick] = useState(0);

  /* ── totals ── */
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const manual = discount
    ? discount.mode === "percent" ? Math.round((subtotal * discount.value) / 100) : discount.value
    : 0;
  const discountTotal = Math.min(manual + couponDisc, subtotal);
  const total = Math.max(0, subtotal - discountTotal);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, total - paid);

  /* ── bootstrap ── */
  const loadShift = useCallback(async (bId: number) => {
    try {
      const r = await fetch(`/api/pos/shift?branchId=${bId}`);
      const d = await r.json();
      setShift(d.shift);
      setBranches(d.branches ?? []);
      setPosStaff(d.staff ?? []);
    } catch { /* offline */ }
  }, []);

  useEffect(() => {
    fetch("/api/products?limit=100").then((r) => r.json()).then((d) => setProducts(d.products ?? [])).finally(() => setLoadingCatalog(false));
    fetch("/api/categories").then((r) => r.json()).then((d) => setCats(d.categories ?? [])).catch(() => {});
    loadShift(1);
    try { setQueue(JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]")); } catch { /* ignore */ }
  }, [loadShift]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  /* live clock */
  useEffect(() => {
    const t = setInterval(() => forceTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  /* ── filtering ── */
  const filtered = useMemo(() => {
    const s = q.trim();
    return products.filter((p) => {
      if (section !== "all" && p.section !== section) return false;
      if (catSlug && p.categorySlug !== catSlug) return false;
      if (sizeFilter && !p.sizes.includes(sizeFilter)) return false;
      if (colorFilter && !p.colors.some((c) => c.name === colorFilter)) return false;
      if (s && !(p.name.includes(s) || (p.barcode ?? "").includes(s))) return false;
      return true;
    });
  }, [products, q, section, catSlug, sizeFilter, colorFilter]);

  const sectionCats = cats.filter((c) => section === "all" || c.section === section);

  /* ── cart ops ── */
  const keyOf = (l: PosLine) => `${l.productId}|${l.size}|${l.color}`;
  const addLine = (p: ProductDTO, size: string, color: string) => {
    const line: PosLine = { productId: p.id, name: p.name, image: p.images[0] ?? "", price: p.price, qty: 1, size, color };
    setLines((prev) => {
      const k = keyOf(line);
      const ex = prev.find((l) => keyOf(l) === k);
      return ex ? prev.map((l) => keyOf(l) === k ? { ...l, qty: l.qty + 1 } : l) : [...prev, line];
    });
    setVariantFor(null);
  };
  const changeQty = (key: string, d: number) =>
    setLines((prev) => prev.map((l) => keyOf(l) === key ? { ...l, qty: l.qty + d } : l).filter((l) => l.qty > 0));

  const onSearchEnter = () => {
    if (!filtered.length) return;
    const first = filtered[0];
    if (first.sizes.length === 1 && first.colors.length === 1) addLine(first, first.sizes[0], first.colors[0].name);
    else { setVariantFor(first); setVSize(first.sizes[0]); setVColor(first.colors[0]?.name ?? ""); }
    setQ("");
  };

  /* coupon */
  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    const r = await fetch("/api/coupons/validate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponCode.trim(), subtotal: Math.max(0, subtotal - manual) }),
    });
    const d = await r.json();
    if (d.valid) setCouponDisc(d.discount);
  };

  /* complete sale */
  const requestKeyRef = useRef<string | null>(null);
  const completeSale = async () => {
    if (!lines.length) return;
    // مفتاح ثابت لكل محاولة: إعادة الإرسال أو فقدان الرد لا تُنشئ فاتورة ثانية
    const requestId = requestKeyRef.current ?? newRequestId();
    requestKeyRef.current = requestId;
    const payload = {
      branchId,
      shiftId: shift?.id ?? null,
      staffName: shift?.staffName ?? "كاشير",
      requestId,
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty, size: l.size, color: l.color })),
      discount: discount ?? undefined,
      couponCode: couponDisc > 0 ? couponCode : undefined,
      payments: payments.length ? payments : [{ method: "cash", amount: total }],
      phone: customerPhone || undefined,
    };
    if (!online) {
      const next = [...queue, { ...payload, offlineAt: new Date().toISOString(), total }];
      setQueue(next);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
      setSale({
        code: `OFFLINE-${Date.now().toString(36).toUpperCase()}`,
        branch: branches.find((b) => b.id === branchId)?.name ?? "الفرع",
        staffName: payload.staffName,
        items: lines, subtotal, discountTotal, total,
        payments: payload.payments as Payment[], changeDue: 0, createdAt: new Date().toISOString(),
      });
      resetInvoice();
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/pos/sale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "تعذر إتمام البيع");
      setSale(d.invoice);
      resetInvoice();
    } catch { /* network hiccup */ } finally { setBusy(false); }
  };
  const resetInvoice = () => {
    setLines([]); setDiscount(null); setCouponCode(""); setCouponDisc(0); setPayments([]); setCustomerPhone("");
    setShowPay(false);
    requestKeyRef.current = null;
  };

  /* sync queue */
  const syncQueue = async () => {
    if (!queue.length || syncing) return;
    setSyncing(true);
    const rest: object[] = [];
    for (const item of queue) {
      try {
        const r = await fetch("/api/pos/sale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
        if (!r.ok) rest.push(item);
      } catch { rest.push(item); }
    }
    setQueue(rest);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(rest));
    setSyncing(false);
  };

  /* report + returns */
  const loadReport = async () => {
    const r = await fetch(`/api/pos/report?date=${baghdadTodayKey()}&branchId=${branchId}`);
    setReport(await r.json());
  };
  const loadReturns = async () => {
    const r = await fetch(`/api/pos/sale?branchId=${branchId}&take=20`);
    const d = await r.json();
    setReturnsList(d.sales ?? []);
  };
  const doReturn = async (id: number) => {
    await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "returned" }) });
    await loadReturns();
  };

  /* print receipt */
  const printReceipt = () => window.print();

  const branch = branches.find((b) => b.id === branchId);

  const sectionIcons: Record<string, typeof LayoutGrid> = { all: LayoutGrid, boys: Shirt, girls: Sparkles, newborn: Baby };

  return (
    <div className="min-h-screen bg-paper">
      {/* ═══ top bar ═══ */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 md:gap-3 md:px-5">
          <Link href="/" className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-blush-300 via-lilac-300 to-aqua-300 shadow-soft">
            <Store size={18} className="text-white" />
          </Link>
          <select
            value={branchId}
            onChange={(e) => { const id = Number(e.target.value); setBranchId(id); loadShift(id); }}
            className="rounded-xl border-2 border-ink/8 bg-paper px-3 py-2 text-xs font-black outline-none"
          >
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.city}</option>)}
          </select>

          <span className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-black ${online ? "bg-minty-100 text-minty-700" : "bg-butter-200 text-butter-700"}`}>
            {online ? <Wifi size={13} /> : <WifiOff size={13} />}
            {online ? "متصل" : "وضع عدم الاتصال"}
          </span>
          {queue.length > 0 && (
            <button onClick={syncQueue} className="flex items-center gap-1.5 rounded-full bg-butter-400 px-3 py-2 text-[11px] font-black text-ink shadow-soft transition-transform hover:scale-105">
              {syncing ? <Loader2 size={13} className="animate-spin" /> : <CloudUpload size={13} />}
              مزامنة {queue.length} فاتورة
            </button>
          )}

          <div className="mr-auto flex items-center gap-2" style={{ marginInlineStart: "auto" }}>
            {shift ? (
              <span className="hidden items-center gap-2 rounded-full bg-lilac-100 px-3.5 py-2 text-[11px] font-black text-lilac-700 sm:flex">
                <span className="size-2 animate-pulse rounded-full bg-minty-400" />
                {shift.staffName} • {ROLES.find((r) => r.key === shift.role)?.label} • بدأت {fmtTime(shift.openedAt)}
              </span>
            ) : (
              <button onClick={() => setShowShift(true)} className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[11px] font-black text-white shadow-soft">
                <LogIn size={13} /> فتح وردية
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_400px]">
        {/* ═══ catalog ═══ */}
        <div className="p-3 md:p-5">
          {/* search */}
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Barcode size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-lilac-400" />
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearchEnter()}
                placeholder="امسح الباركود أو ابحث بالاسم…"
                className="field pr-12 py-3.5 text-sm"
                autoFocus
              />
            </div>
            <button onClick={() => { setQ(""); setCatSlug(""); setSizeFilter(""); setColorFilter(""); setSection("all"); }} className="rounded-2xl bg-white px-4 py-3.5 text-xs font-black shadow-soft hover:bg-blush-50">
              مسح
            </button>
          </div>

          {/* sections */}
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {(["all", "boys", "girls", "newborn"] as const).map((s) => {
              const Icon = sectionIcons[s];
              return (
                <button key={s} onClick={() => { setSection(s); setCatSlug(""); }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-black transition-all ${section === s ? "bg-ink text-white" : "bg-white shadow-soft text-ink-soft"}`}>
                  <Icon size={13} /> {s === "all" ? "الكل" : SECTIONS[s].label}
                </button>
              );
            })}
            <span className="mx-1 w-px bg-ink/10" />
            {sectionCats.map((c) => (
              <button key={c.id} onClick={() => setCatSlug(catSlug === c.slug ? "" : c.slug)}
                className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-bold transition-all ${catSlug === c.slug ? "bg-blush-500 text-white" : "bg-white shadow-soft text-ink"}`}>
                {c.nameAr}
              </button>
            ))}
          </div>

          {/* size + color filters */}
          <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)} className="shrink-0 rounded-full border-2 border-ink/8 bg-white px-3 py-1.5 text-[11px] font-black outline-none">
              <option value="">كل المقاسات</option>
              {SIZES_ALL.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {COLOR_PALETTE.map((c) => (
              <button key={c.name} title={c.name} onClick={() => setColorFilter(colorFilter === c.name ? "" : c.name)}
                className={`size-6 shrink-0 rounded-full ring-2 transition-transform ${colorFilter === c.name ? "ring-ink scale-110" : "ring-black/10 hover:scale-110"}`}
                style={{ background: c.hex }} />
            ))}
          </div>

          {/* grid */}
          {loadingCatalog ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="shimmer aspect-[3/4] rounded-3xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    if (p.stock <= 0) return;
                    if (p.sizes.length === 1 && p.colors.length === 1) addLine(p, p.sizes[0], p.colors[0].name);
                    else { setVariantFor(p); setVSize(p.sizes[0]); setVColor(p.colors[0]?.name ?? ""); }
                  }}
                  className={`group relative overflow-hidden rounded-3xl bg-white text-right shadow-soft ring-1 ring-black/5 transition-all hover:-translate-y-1 hover:shadow-pop active:scale-[0.98] ${p.stock <= 0 ? "opacity-50 grayscale" : ""}`}
                >
                  <div className="relative aspect-[4/3.4] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.images[0]} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    {p.discountPct && <span className="absolute right-2 top-2 rounded-full bg-butter-400 px-2 py-0.5 text-[10px] font-black text-ink">-{p.discountPct}%</span>}
                    {p.stock <= 8 && p.stock > 0 && <span className="absolute left-2 top-2 rounded-full bg-blush-500 px-2 py-0.5 text-[10px] font-black text-white">باقي {p.stock}</span>}
                  </div>
                  <div className="p-2.5">
                    <p className="line-clamp-1 text-[11px] font-black">{p.name}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs font-black text-blush-600">{formatIQD(p.price)}</span>
                      <span className="grid size-7 place-items-center rounded-full bg-ink text-white opacity-0 transition-opacity group-hover:opacity-100"><Plus size={14} /></span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ═══ invoice panel ═══ */}
        <aside className="sticky top-[61px] flex h-[calc(100vh-61px)] flex-col border-r-2 border-black/5 bg-white/60 backdrop-blur">
          <div className="flex items-center justify-between border-b border-dashed border-ink/10 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-black">
              <span className="grid size-8 place-items-center rounded-xl bg-butter-200 text-xs font-black text-butter-700">{lines.length}</span>
              الفاتورة الحالية
            </h2>
            <div className="flex gap-1.5">
              <button onClick={() => { setShowDrawer(true); }} title="فتح درج النقدية" className="grid size-9 place-items-center rounded-xl bg-minty-100 text-minty-700 transition-transform hover:scale-105"><Banknote size={15} /></button>
              <button onClick={() => { loadReport().then(() => setShowReport(true)); }} title="تقرير اليوم" className="grid size-9 place-items-center rounded-xl bg-aqua-100 text-aqua-700 transition-transform hover:scale-105"><FileBarChart size={15} /></button>
              <button onClick={() => { loadReturns().then(() => setShowReturns(true)); }} title="مرتجعات" className="grid size-9 place-items-center rounded-xl bg-blush-100 text-blush-600 transition-transform hover:scale-105"><Undo2 size={15} /></button>
              {shift && (
                <button onClick={() => setShowShift(true)} title="إغلاق الوردية" className="grid size-9 place-items-center rounded-xl bg-ink/5 text-ink transition-transform hover:scale-105"><LogOut size={15} /></button>
              )}
            </div>
          </div>

          {/* lines */}
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {lines.length === 0 && (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <Barcode className="mx-auto text-ink-faint" size={36} />
                  <p className="mt-2 text-xs font-black text-ink-faint">امسح باركود أو انقر منتجاً</p>
                </div>
              </div>
            )}
            <AnimatePresence initial={false}>
              {lines.map((l) => {
                const k = keyOf(l);
                return (
                  <motion.div key={k} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex items-center gap-2.5 rounded-2xl bg-white p-2 shadow-soft ring-1 ring-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.image} alt="" className="size-12 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-[11px] font-black">{l.name}</p>
                      <p className="text-[10px] font-bold text-ink-faint">{l.size} • {l.color}</p>
                      <p className="text-[11px] font-black text-blush-600">{formatIQD(l.price)} × {l.qty}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <button onClick={() => changeQty(k, 1)} className="grid size-7 place-items-center rounded-lg bg-minty-100 text-minty-700"><Plus size={12} /></button>
                        <button onClick={() => changeQty(k, -1)} className="grid size-7 place-items-center rounded-lg bg-ink/5 text-ink"><Minus size={12} /></button>
                      </div>
                      <button onClick={() => setLines((p) => p.filter((x) => keyOf(x) !== k))} className="grid size-7 place-items-center rounded-lg bg-blush-50 text-blush-600"><Trash2 size={12} /></button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* totals */}
          <div className="border-t-2 border-dashed border-ink/10 p-3.5">
            <div className="mb-2.5 flex gap-2">
              <button onClick={() => setShowDiscount(true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-lilac-100 py-2.5 text-[11px] font-black text-lilac-700 transition-transform hover:scale-[1.02]">
                <BadgePercent size={13} /> خصم يدوي
              </button>
              <div className="relative flex-1">
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  onBlur={applyCoupon}
                  placeholder="كود خصم"
                  className="w-full rounded-xl border-2 border-ink/8 bg-white py-2.5 pr-8 pl-2 text-[11px] font-black uppercase outline-none"
                  dir="ltr"
                />
                <TicketPercent size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-lilac-400" />
              </div>
            </div>

            <dl className="space-y-1 text-[12px] font-bold">
              <div className="flex justify-between"><dt className="text-ink-soft">المجموع</dt><dd>{formatIQD(subtotal)}</dd></div>
              {discountTotal > 0 && <div className="flex justify-between text-minty-600"><dt>الخصومات</dt><dd>−{formatIQD(discountTotal)}</dd></div>}
              <div className="flex justify-between text-lg font-black"><dt>الإجمالي</dt><dd className="text-blush-600">{formatIQD(total)}</dd></div>
            </dl>

            {/* payments summary */}
            {payments.length > 0 && (
              <div className="mt-2 space-y-1 rounded-xl bg-paper p-2.5">
                {payments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] font-bold">
                    <span className="flex items-center gap-1"><Banknote size={11} className="text-minty-500" /> {methodName(p.method)}</span>
                    <span className="flex items-center gap-1.5">
                      {formatIQD(p.amount)}
                      <button onClick={() => setPayments((ps) => ps.filter((_, x) => x !== i))} className="text-blush-500"><X size={11} /></button>
                    </span>
                  </div>
                ))}
                <div className={`flex justify-between border-t border-dashed border-ink/10 pt-1 text-[11px] font-black ${remaining > 0 ? "text-blush-600" : "text-minty-600"}`}>
                  <span>{remaining > 0 ? "المتبقي" : paid > total ? `الباقي للزبون` : "مدفوع بالكامل"}</span>
                  <span>{remaining > 0 ? formatIQD(remaining) : paid > total ? formatIQD(paid - total) : "0 د.ع"}</span>
                </div>
              </div>
            )}

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button onClick={() => setShowPay(true)} disabled={!lines.length}
                className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-ink py-3 text-xs font-black text-ink transition-all hover:bg-ink hover:text-white disabled:opacity-40">
                <Plus size={13} /> إضافة دفعة
              </button>
              <button onClick={completeSale} disabled={!lines.length || busy || (payments.length > 0 && remaining > 0)}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-l from-minty-400 to-aqua-500 py-3 text-xs font-black text-white shadow-pop transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                {payments.length === 0 ? "بيع نقدي سريع" : remaining > 0 ? "أكمل الدفع" : "إتمام البيع"}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ═══ variant modal ═══ */}
      <Modal open={!!variantFor} onClose={() => setVariantFor(null)}>
        {variantFor && (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={variantFor.images[0]} alt="" className="h-44 w-full rounded-2xl object-cover" />
            <h3 className="mt-3 text-base font-black">{variantFor.name}</h3>
            <p className="text-sm font-black text-blush-600">{formatIQD(variantFor.price)}</p>
            <p className="mb-1.5 mt-4 text-xs font-black text-ink-soft">المقاس</p>
            <div className="flex flex-wrap gap-1.5">
              {variantFor.sizes.map((s) => (
                <button key={s} onClick={() => setVSize(s)} className={`rounded-xl px-3 py-2 text-[11px] font-black ${vSize === s ? "bg-ink text-white" : "bg-paper ring-1 ring-ink/10"}`}>{s}</button>
              ))}
            </div>
            <p className="mb-1.5 mt-3 text-xs font-black text-ink-soft">اللون</p>
            <div className="flex flex-wrap gap-2">
              {variantFor.colors.map((c) => (
                <button key={c.name} title={c.name} onClick={() => setVColor(c.name)} className={`size-8 rounded-full ring-2 transition-transform ${vColor === c.name ? "ring-ink scale-110" : "ring-black/10"}`} style={{ background: c.hex }} />
              ))}
            </div>
            <button onClick={() => addLine(variantFor, vSize, vColor || variantFor.colors[0]?.name || "-")}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-sm font-black text-white transition-transform hover:scale-[1.02]">
              <Plus size={15} /> إضافة للفاتورة
            </button>
          </div>
        )}
      </Modal>

      {/* ═══ discount modal ═══ */}
      <Modal open={showDiscount} onClose={() => setShowDiscount(false)}>
        <DiscountForm
          current={discount}
          onApply={(d) => { setDiscount(d); setShowDiscount(false); setCouponDisc(0); if (couponCode) applyCoupon(); }}
          onClear={() => { setDiscount(null); setShowDiscount(false); }}
        />
      </Modal>

      {/* ═══ payment modal ═══ */}
      <Modal open={showPay} onClose={() => setShowPay(false)}>
        <PaymentForm
          remaining={remaining}
          onAdd={(p) => { setPayments((ps) => [...ps, p]); setShowPay(false); }}
          total={total}
        />
      </Modal>

      {/* ═══ shift modal ═══ */}
      <Modal open={showShift} onClose={() => setShowShift(false)}>
        <ShiftForm
          shift={shift}
          staff={posStaff}
          onOpen={async ({ member, name, role, pin, cash }) => {
            const r = await fetch("/api/pos/shift", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "open",
                branchId,
                staffId: member?.id,
                pin: pin || undefined,
                staffName: member?.name ?? name,
                role: member?.role ?? role,
                openingCash: cash,
              }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) return d.error ?? "تعذر فتح الوردية";
            setShift(d.shift);
            setShowShift(false);
            await loadShift(branchId);
            return null;
          }}
          onClose={async (closingCash) => {
            if (!shift) return;
            await fetch("/api/pos/shift", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "close", shiftId: shift.id, closingCash }) });
            setShift(null); setShowShift(false);
            await loadReport(); setShowReport(true);
          }}
        />
      </Modal>

      {/* ═══ drawer modal ═══ */}
      <Modal open={showDrawer} onClose={() => setShowDrawer(false)}>
        <div className="text-center">
          <span className="mx-auto grid size-16 animate-pop-in place-items-center rounded-3xl bg-minty-100"><Banknote size={30} className="text-minty-600" /></span>
          <h3 className="mt-3 text-lg font-black">تم فتح درج النقدية</h3>
          <p className="mt-1 text-xs font-bold text-ink-soft">إشعار فتح الدرج أُرسل إلى طابعة الفرع وسُجّل في سجل {branch?.name}</p>
          <button onClick={() => setShowDrawer(false)} className="mt-4 w-full rounded-2xl bg-ink py-3 text-sm font-black text-white">حسناً</button>
        </div>
      </Modal>

      {/* ═══ report modal ═══ */}
      <Modal open={showReport} onClose={() => setShowReport(false)} wide>
        {report ? (
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black"><FileBarChart className="text-aqua-500" /> تقرير الصندوق — اليوم</h3>
            <p className="mt-0.5 text-xs font-bold text-ink-faint">{branch?.name} • بتوقيت بغداد (GMT+3)</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { l: "عدد الفواتير", v: String(report.invoicesCount), tint: "bg-aqua-100 text-aqua-700" },
                { l: "إجمالي المبيعات", v: formatIQD(report.gross), tint: "bg-minty-100 text-minty-700" },
                { l: "المرتجعات", v: `${report.returnsTotal ? formatIQD(report.returnsTotal) : "0 د.ع"} (${report.returnsCount})`, tint: "bg-blush-100 text-blush-600" },
                { l: "صافي المبيعات", v: formatIQD(report.net), tint: "bg-butter-100 text-butter-700" },
              ].map((c) => (
                <div key={c.l} className={`rounded-2xl p-3 ${c.tint}`}>
                  <p className="text-[10px] font-black opacity-70">{c.l}</p>
                  <p className="mt-1 text-sm font-black">{c.v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-black text-ink-soft">تفصيل بوابات الدفع</p>
                <div className="space-y-1.5">
                  {report.byPayment.length === 0 && <p className="text-[11px] font-bold text-ink-faint">لا مبيعات بعد اليوم</p>}
                  {report.byPayment.map((p) => (
                    <div key={p.method} className="flex items-center justify-between rounded-xl bg-paper px-3 py-2 text-[12px] font-bold">
                      <span>{methodName(p.method)}</span><span className="font-black">{formatIQD(p.amount)}</span>
                    </div>
                  ))}
                </div>
                <p className="mb-2 mt-4 text-xs font-black text-ink-soft">أكثر المنتجات مبيعاً</p>
                {report.topItems.slice(0, 4).map((t) => (
                  <div key={t.name} className="mb-1 flex justify-between rounded-xl bg-white px-3 py-2 text-[11px] font-bold ring-1 ring-black/5">
                    <span className="line-clamp-1 flex-1">{t.name}</span>
                    <span className="shrink-0 font-black text-lilac-600">×{t.qty}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-2 text-xs font-black text-ink-soft">آخر الفواتير</p>
                <div className="max-h-64 space-y-1.5 overflow-y-auto pl-1">
                  {report.recentSales.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-[11px] font-bold ring-1 ring-black/5">
                      <span dir="ltr" className="font-black">{s.code}</span>
                      <span className={s.status === "returned" ? "text-blush-500" : "text-minty-600"}>{s.status === "returned" ? "مرتجع" : formatIQD(s.total)}</span>
                      <span className="text-ink-faint">{fmtTime(s.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={printReceipt} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3 text-sm font-black text-white"><Printer size={15} /> طباعة التقرير</button>
          </div>
        ) : <Loader2 className="mx-auto my-10 animate-spin text-lilac-400" />}
      </Modal>

      {/* ═══ returns modal ═══ */}
      <Modal open={showReturns} onClose={() => setShowReturns(false)} wide>
        <h3 className="flex items-center gap-2 text-lg font-black"><Undo2 className="text-blush-500" /> مرتجعات الفرع</h3>
        <p className="mt-0.5 text-xs font-bold text-ink-faint">اختاري فاتورة لاسترداد مبلغها وإعادة قطعها للرف</p>
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
          {returnsList.length === 0 && <p className="py-8 text-center text-xs font-bold text-ink-faint">لا توجد فواتير كاشير حديثة</p>}
          {returnsList.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-2xl bg-white p-3 ring-1 ring-black/5">
              <div>
                <p className="text-xs font-black" dir="ltr">{s.code}</p>
                <p className="text-[10px] font-bold text-ink-faint">{fmtDateTime(s.createdAt)} • {s.staffName ?? "كاشير"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black ${s.status === "returned" ? "text-blush-500 line-through" : "text-ink"}`}>{formatIQD(s.total)}</span>
                {s.status === "returned" ? (
                  <span className="rounded-full bg-blush-100 px-3 py-1.5 text-[10px] font-black text-blush-600">مستردة</span>
                ) : (
                  <button onClick={() => doReturn(s.id)} className="rounded-full bg-blush-500 px-3.5 py-1.5 text-[10px] font-black text-white transition-transform hover:scale-105">
                    استرداد
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* ═══ sale success + receipt ═══ */}
      <Modal open={!!sale} onClose={() => setSale(null)}>
        {sale && (
          <div className="text-center">
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} className="mx-auto grid size-16 place-items-center rounded-full bg-minty-100">
              <CheckCircle2 size={30} className="text-minty-600" />
            </motion.span>
            <h3 className="mt-3 text-lg font-black">تم البيع — الفاتورة جاهزة</h3>
            <p className="mt-1 text-xs font-bold text-ink-faint" dir="ltr">{sale.code}</p>
            <p className="mt-2 text-2xl font-black text-blush-600">{formatIQD(sale.total)}</p>
            {sale.changeDue > 0 && <p className="text-xs font-black text-butter-700">الباقي للزبون: {formatIQD(sale.changeDue)}</p>}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button onClick={printReceipt} className="flex items-center justify-center gap-1 rounded-2xl bg-ink py-3 text-[11px] font-black text-white"><Printer size={13} /> طباعة</button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`فاتورة باربي ${sale.code}\n${sale.items.map((i) => `• ${i.name} ×${i.qty}`).join("\n")}\nالإجمالي: ${sale.total.toLocaleString("en-US")} د.ع`)}`}
                target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-1 rounded-2xl bg-minty-500 py-3 text-[11px] font-black text-white"
              >
                <MessageCircle size={13} /> واتساب
              </a>
              <button onClick={() => setSale(null)} className="rounded-2xl bg-paper py-3 text-[11px] font-black ring-1 ring-ink/10">بيع جديد</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══ thermal receipt (print only) ═══ */}
      {sale && (
        <div id="thermal-receipt" dir="rtl">
          <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: 8, marginBottom: 8 }}>
            <p style={{ fontSize: 16, fontWeight: 900 }}>باربي — BARBI KIDS</p>
            <p style={{ fontSize: 10 }}>{branch?.name} — {branch?.city} • {branch?.phone}</p>
            <p style={{ fontSize: 10 }}>ملابس أطفال عراقية — من الولادة حتى 16 سنة</p>
          </div>
          <p style={{ fontSize: 10 }}>فاتورة: {sale.code}</p>
          <p style={{ fontSize: 10 }}>التاريخ: {fmtDateTime(sale.createdAt)} (بتوقيت بغداد)</p>
          <p style={{ fontSize: 10 }}>الكاشير: {sale.staffName}</p>
          <table style={{ width: "100%", fontSize: 10, marginTop: 6, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px dashed #000" }}>
                <th style={{ textAlign: "right", padding: "2px 0" }}>الصنف</th>
                <th style={{ padding: "2px 0" }}>كمية</th>
                <th style={{ textAlign: "left", padding: "2px 0" }}>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((i, x) => (
                <tr key={x} style={{ borderBottom: "1px dotted #999" }}>
                  <td style={{ padding: "3px 0" }}>{i.name}<br /><span style={{ color: "#555" }}>{i.size} / {i.color}</span></td>
                  <td style={{ textAlign: "center" }}>{i.qty}</td>
                  <td style={{ textAlign: "left" }}>{(i.price * i.qty).toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 6, fontSize: 10 }}>
            <p style={{ display: "flex", justifyContent: "space-between" }}><span>المجموع</span><span>{sale.subtotal.toLocaleString("en-US")} د.ع</span></p>
            {sale.discountTotal > 0 && <p style={{ display: "flex", justifyContent: "space-between" }}><span>الخصم</span><span>-{sale.discountTotal.toLocaleString("en-US")} د.ع</span></p>}
            {sale.payments.map((p, i) => (
              <p key={i} style={{ display: "flex", justifyContent: "space-between" }}><span>{methodName(p.method)}</span><span>{p.amount.toLocaleString("en-US")} د.ع</span></p>
            ))}
            <p style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 900, borderTop: "1px dashed #000", marginTop: 4, paddingTop: 4 }}>
              <span>الإجمالي</span><span>{sale.total.toLocaleString("en-US")} د.ع</span>
            </p>
            {sale.changeDue > 0 && <p style={{ display: "flex", justifyContent: "space-between" }}><span>الباقي</span><span>{sale.changeDue.toLocaleString("en-US")} د.ع</span></p>}
          </div>
          <p style={{ textAlign: "center", fontSize: 10, marginTop: 8 }}>شكراً لتسوقكم من باربي — الإرجاع خلال 7 أيام بالفاتورة</p>
          <p style={{ textAlign: "center", fontSize: 9, color: "#555" }}>واتساب خدمة العملاء: 07700001122</p>
        </div>
      )}
    </div>
  );
}

/* ─────── reusable modal ─────── */
function Modal({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
          <motion.div
            initial={{ scale: 0.92, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative max-h-[88vh] w-full overflow-y-auto rounded-[1.75rem] bg-white p-5 shadow-pop ${wide ? "max-w-2xl" : "max-w-sm"}`}
          >
            <button onClick={onClose} className="absolute left-4 top-4 grid size-8 place-items-center rounded-full bg-ink/5 text-ink transition-transform hover:scale-110" aria-label="إغلاق">
              <X size={14} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────── discount form ─────── */
function DiscountForm({ current, onApply, onClear }: { current: { mode: "percent" | "fixed"; value: number } | null; onApply: (d: { mode: "percent" | "fixed"; value: number }) => void; onClear: () => void }) {
  const [mode, setMode] = useState<"percent" | "fixed">(current?.mode ?? "percent");
  const [value, setValue] = useState(current?.value ? String(current.value) : "");
  return (
    <div>
      <h3 className="flex items-center gap-2 text-base font-black"><BadgePercent className="text-lilac-500" /> خصم يدوي على الفاتورة</h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {([["percent", "نسبة %"], ["fixed", "مبلغ د.ع"]] as const).map(([m, l]) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded-2xl py-2.5 text-xs font-black ${mode === m ? "bg-ink text-white" : "bg-paper ring-1 ring-ink/10"}`}>{l}</button>
        ))}
      </div>
      <input value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))} placeholder={mode === "percent" ? "مثال: 10" : "مثال: 5000"} inputMode="numeric" className="field mt-3 text-center text-lg font-black" dir="ltr" />
      <div className="mt-3 flex gap-2">
        <button onClick={() => value && onApply({ mode, value: Number(value) })} className="flex-1 rounded-2xl bg-gradient-to-l from-lilac-400 to-blush-400 py-3 text-sm font-black text-white">تطبيق</button>
        {current && <button onClick={onClear} className="rounded-2xl bg-blush-50 px-4 text-sm font-black text-blush-600">إزالة</button>}
      </div>
    </div>
  );
}

/* ─────── payment form (split supported) ─────── */
function PaymentForm({ remaining, total, onAdd }: { remaining: number; total: number; onAdd: (p: Payment) => void }) {
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState("");
  const due = remaining > 0 ? remaining : total;
  return (
    <div>
      <h3 className="flex items-center gap-2 text-base font-black"><Banknote className="text-minty-500" /> إضافة دفعة — ادعم التقسيط بين بوابات</h3>
      <p className="mt-1 text-xs font-bold text-ink-faint">المطلوب: <span className="font-black text-blush-600">{formatIQD(due)}</span></p>
      <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {POS_METHODS.map((m) => (
          <button key={m.id} onClick={() => setMethod(m.id)} className={`flex flex-col items-center gap-1 rounded-2xl p-2.5 text-[10px] font-black transition-all ${method === m.id ? "bg-ink text-white shadow-soft" : "bg-paper ring-1 ring-ink/10 hover:ring-ink/25"}`}>
            <m.icon size={16} />
            {m.name}
          </button>
        ))}
      </div>
      <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} placeholder={due.toLocaleString("en-US")} inputMode="numeric" className="field mt-3 text-center text-lg font-black" dir="ltr" />
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {[1000, 5000, due].map((v) => (
          <button key={v} onClick={() => setAmount(String(v))} className="rounded-xl bg-paper py-2 text-[11px] font-black ring-1 ring-ink/10 hover:bg-aqua-50">{v === due ? "كامل الباقي" : formatIQD(v)}</button>
        ))}
      </div>
      <button onClick={() => Number(amount) > 0 && onAdd({ method, amount: Number(amount) })}
        className="mt-4 w-full rounded-2xl bg-ink py-3.5 text-sm font-black text-white transition-transform hover:scale-[1.02]">
        إضافة {amount ? formatIQD(Number(amount)) : ""} — {methodName(method)}
      </button>
    </div>
  );
}

/* ─────── shift form ─────── */

type ShiftMember = { id: number; name: string; role: string };
type ShiftOpenInput = {
  member: ShiftMember | null;
  name: string;
  role: string;
  pin: string;
  cash: number;
};

function ShiftForm({ shift, staff, onOpen, onClose }: {
  shift: ShiftDTO | null;
  staff: ShiftMember[];
  onOpen: (input: ShiftOpenInput) => Promise<string | null>;
  onClose: (cash: number) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("cashier");
  const [memberId, setMemberId] = useState<number | "">(staff[0]?.id ?? "");
  const [pin, setPin] = useState("");
  const [cash, setCash] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const hasAccounts = staff.length > 0;
  const member = hasAccounts ? (staff.find((s) => s.id === Number(memberId)) ?? staff[0]) : null;
  const effectiveRole = member?.role ?? role;

  if (!shift) {
    return (
      <div>
        <h3 className="flex items-center gap-2 text-base font-black"><LogIn className="text-minty-500" /> فتح وردية جديدة</h3>
        {hasAccounts ? (
          <>
            <label className="mt-3 block text-[11px] font-black text-ink-soft">اختَر حسابك</label>
            <select
              value={memberId}
              onChange={(e) => { setMemberId(Number(e.target.value)); setErr(""); }}
              className="field mt-1.5 cursor-pointer text-sm font-black"
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {ROLES.find((r) => r.key === s.role)?.label ?? s.role}</option>
              ))}
            </select>
            <input
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/[^\d]/g, "")); setErr(""); }}
              placeholder="رمز الموظف (4–8 أرقام)"
              type="password"
              inputMode="numeric"
              maxLength={8}
              dir="ltr"
              className="field mt-2.5 text-center font-black tracking-[0.3em]"
            />
          </>
        ) : (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الموظف" className="field mt-3" />
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              {ROLES.map((r) => (
                <button key={r.key} onClick={() => setRole(r.key)} className={`rounded-2xl py-2.5 text-xs font-black ${role === r.key ? "bg-ink text-white" : "bg-paper ring-1 ring-ink/10"}`}>{r.label}</button>
              ))}
            </div>
          </>
        )}
        <p className="mt-3 flex items-center gap-1 text-[10px] font-bold text-ink-faint">
          <Lock size={11} /> {effectiveRole === "cashier" ? "بيع وطباعة فقط" : effectiveRole === "supervisor" ? "بيع + مرتجعات + خصم يدوي" : "كل الصلاحيات + إغلاق الصندوق"}
        </p>
        <input value={cash} onChange={(e) => setCash(e.target.value.replace(/[^\d]/g, ""))} placeholder="النقد الافتتاحي بالدرج (د.ع)" inputMode="numeric" className="field mt-3 text-center font-black" dir="ltr" />
        {err && <p className="mt-2 text-center text-[11px] font-black text-blush-600">{err}</p>}
        <button
          disabled={busy}
          onClick={async () => {
            if (hasAccounts && !member) return setErr("اختَر حسابك");
            if (hasAccounts && pin.length < 4) return setErr("أدخل رمز الموظف");
            if (!hasAccounts && !name.trim()) return setErr("اكتب اسم الموظف");
            setBusy(true);
            setErr("");
            const error = await onOpen({
              member,
              name: name.trim(),
              role,
              pin,
              cash: Number(cash) || 0,
            });
            setBusy(false);
            if (error) { setErr(error); setPin(""); }
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-minty-400 to-aqua-500 py-3.5 text-sm font-black text-white disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          فتح الوردية
        </button>
      </div>
    );
  }
  return (
    <div>
      <h3 className="flex items-center gap-2 text-base font-black"><LogOut className="text-blush-500" /> إغلاق الوردية — {shift.staffName}</h3>
      <p className="mt-1 text-xs font-bold text-ink-faint">الافتتاحي: {formatIQD(shift.openingCash)} • بدأت {fmtTime(shift.openedAt)}</p>
      <input value={cash} onChange={(e) => setCash(e.target.value.replace(/[^\d]/g, ""))} placeholder="عدّ النقدية بالدرج وأدخل المجموع" inputMode="numeric" className="field mt-3 text-center font-black" dir="ltr" />
      <button onClick={() => onClose(Number(cash) || 0)} className="mt-4 w-full rounded-2xl bg-blush-500 py-3.5 text-sm font-black text-white">إغلاق الصندوق وعرض التقرير</button>
      <button onClick={() => {}} className="mt-2 w-full py-2 text-xs font-black text-ink-soft"> </button>
    </div>
  );
}


