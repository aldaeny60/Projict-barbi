"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, Package, ShoppingBag, TicketPercent, Truck, Boxes, Store,
  Lock, Loader2, Plus, Pencil, Trash2, X, Check, Search, AlertTriangle,
  TrendingUp, Banknote, ReceiptText, RefreshCcw, ChevronLeft, Star, Globe,
  Users, ScrollText, Upload, RotateCcw,
} from "lucide-react";
import { MarketSearchTab } from "@/components/AdminMarketSearch";
import type { CategoryDTO, CouponDTO, DeliveryFeeDTO, OrderDTO, ProductDTO } from "@/lib/types";
import { ColorPalette, orderStatusLabel } from "@/lib/admin-helpers";
import { formatIQD, formatNum, fmtDateTime } from "@/lib/format";
import { SIZES_ALL, nextStatuses } from "@/lib/data";
import { ORDER_STATUSES } from "@/db/schema";
import { gatewayById } from "@/lib/payments";

const Charts = dynamic(() => import("@/components/AdminCharts"), { ssr: false });

type Stats = {
  cards: {
    todayRevenue: number; todayOrders: number; monthRevenue: number; monthOrders: number;
    avgOrder: number; pendingOrders: number; returns: number; webTotal: number; posTotal: number;
  };
  series: { day: string; label: string; total: number; count: number }[];
  payments: { id: string; name: string; value: number }[];
  governorates: { name: string; total: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  statusBreakdown: { status: string; count: number }[];
  lowStock: ProductDTO[];
  recentOrders: { id: number; code: string; source: string; customerName: string; governorate: string | null; total: number; status: string; paymentMethod: string; createdAt: string }[];
};

type Tab = "overview" | "products" | "orders" | "customers" | "coupons" | "delivery" | "inventory" | "branches" | "team" | "audit" | "market";

const TABS: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "نظرة عامة", icon: LayoutDashboard },
  { key: "products", label: "المنتجات", icon: Package },
  { key: "orders", label: "الطلبات", icon: ShoppingBag },
  { key: "customers", label: "الزبائن", icon: Users },
  { key: "coupons", label: "الكوبونات", icon: TicketPercent },
  { key: "delivery", label: "التوصيل", icon: Truck },
  { key: "inventory", label: "المخزون", icon: Boxes },
  { key: "branches", label: "الفروع", icon: Store },
  { key: "team", label: "الفريق والصلاحيات", icon: Users },
  { key: "audit", label: "سجل التدقيق", icon: ScrollText },
  { key: "market", label: "رصد السوق", icon: Globe },
];

const STATUS_TONE: Record<string, string> = {
  pending: "bg-butter-100 text-butter-700",
  processing: "bg-aqua-100 text-aqua-700",
  shipped: "bg-lilac-100 text-lilac-700",
  out_for_delivery: "bg-lilac-200 text-lilac-700",
  delivered: "bg-minty-100 text-minty-700",
  cancelled: "bg-gray-100 text-gray-500",
  return_requested: "bg-butter-200 text-butter-700",
  returned: "bg-blush-100 text-blush-700",
};

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);

  const [pinError, setPinError] = useState("");

  // تحقق من الجلسة الحقيقية — الوصول للـ API يتطلب كوكي إدارة صالحة (LAW 004/006)
  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => {
        if (r.ok) return r.json().then(setStats).then(() => setAuthed(true));
        setAuthed(false);
      })
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (authed) fetch("/api/admin/stats").then((r) => (r.ok ? r.json() : null)).then((d) => d && setStats(d)).catch(() => {});
  }, [authed]);

  const doLogin = async () => {
    setPinError("");
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: code }),
    });
    if (r.ok) setAuthed(true);
    else {
      const d = await r.json().catch(() => null);
      setPinError(d?.error ?? "تعذر الدخول");
    }
  };
  const doLogout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
    setCode("");
  };

  if (authed === null) return null;

  if (!authed) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-bubble w-full max-w-sm p-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-lilac-200 to-blush-200">
            <Lock className="text-lilac-600" size={26} />
          </span>
          <h1 className="mt-4 text-xl font-black">لوحة تحكم باربي</h1>
          <p className="mt-1 text-xs font-bold text-ink-soft">منطقة الإدارة — يُضبط رمز الدخول من متغير البيئة ADMIN_PIN</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter" && code) doLogin(); }}
            placeholder="••••"
            dir="ltr"
            inputMode="numeric"
            maxLength={8}
            className="field mt-5 text-center text-2xl font-black tracking-[0.5em]"
          />
          {pinError && <p className="mt-2 text-center text-[11px] font-black text-blush-600">{pinError}</p>}
          <button
            onClick={doLogin}
            disabled={!code}
            className="mt-4 w-full rounded-2xl bg-ink py-3.5 text-sm font-black text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            دخول آمِن
          </button>
          <Link href="/" className="mt-3 inline-block text-xs font-black text-ink-soft hover:text-ink">← رجوع للمتجر</Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="grid lg:grid-cols-[230px_1fr]">
        {/* sidebar */}
        <aside className="sticky top-0 z-40 hidden h-screen flex-col border-l border-black/5 bg-white/70 p-4 backdrop-blur lg:flex">
          <Link href="/" className="mb-6 flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-blush-300 via-lilac-300 to-aqua-300 shadow-soft">
              <Star size={18} className="fill-white text-white" />
            </span>
            <span>
              <span className="block text-lg font-black leading-none">باربي</span>
              <span className="text-[10px] font-bold text-ink-soft">لوحة التحكم المركزية</span>
            </span>
          </Link>
          <nav className="flex-1 space-y-1">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-3 text-sm font-black transition-all ${tab === t.key ? "bg-ink text-white shadow-pop" : "text-ink-soft hover:bg-blush-50 hover:text-ink"}`}>
                <t.icon size={16} /> {t.label}
              </button>
            ))}
          </nav>
          <div className="rounded-2xl bg-paper p-3 text-center ring-1 ring-ink/8">
            <p className="text-[10px] font-black text-ink-soft">تزامن لحظي مع</p>
            <p className="mt-1 text-[11px] font-black text-ink">الويب • الكاشير • التطبيقات</p>
            <span className="mx-auto mt-2 flex size-2 items-center justify-center"><span className="absolute size-2 animate-ping rounded-full bg-minty-400/60" /><span className="size-2 rounded-full bg-minty-400" /></span>
          </div>
          <button onClick={doLogout} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-blush-50 py-2.5 text-[11px] font-black text-blush-600 transition-colors hover:bg-blush-100">
            <Lock size={12} /> تسجيل خروج الإدارة
          </button>
        </aside>

        <div className="min-w-0">
          {/* mobile tabs */}
          <div className="sticky top-0 z-30 flex gap-1.5 overflow-x-auto border-b border-black/5 bg-white/90 px-3 py-2.5 backdrop-blur lg:hidden no-scrollbar">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-black ${tab === t.key ? "bg-ink text-white" : "bg-paper text-ink-soft"}`}>
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          <div className="p-4 md:p-7">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black">{TABS.find((t) => t.key === tab)?.label}</h1>
                <p className="text-xs font-bold text-ink-faint">توقيت بغداد (GMT+3) • الأسعار بالدينار العراقي</p>
              </div>
              <button onClick={() => setStats(null as never) ?? undefined} className="hidden" />
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {tab === "overview" && <Overview stats={stats} />}
                {tab === "products" && <ProductsTab />}
                {tab === "orders" && <OrdersTab />}
                {tab === "customers" && <CustomersTab />}
                {tab === "coupons" && <CouponsTab />}
                {tab === "delivery" && <DeliveryTab />}
                {tab === "inventory" && <InventoryTab stats={stats} onRefresh={() => fetch("/api/admin/stats").then((r) => r.json()).then(setStats)} />}
                {tab === "branches" && <BranchesTab />}
                {tab === "team" && <TeamTab />}
                {tab === "audit" && <AuditTab />}
                {tab === "market" && <MarketSearchTab />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ overview ═══ */
function Overview({ stats }: { stats: Stats | null }) {
  if (!stats) return <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="shimmer h-28 rounded-3xl" />)}</div>;
  const c = stats.cards;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "مبيعات اليوم", value: formatIQD(c.todayRevenue), sub: `${c.todayOrders} فاتورة`, icon: TrendingUp, tint: "from-minty-200 to-aqua-200" },
          { label: "مبيعات الشهر", value: formatIQD(c.monthRevenue), sub: `${c.monthOrders} طلب`, icon: Banknote, tint: "from-blush-200 to-lilac-200" },
          { label: "متوسط السلة", value: formatIQD(c.avgOrder), sub: "آخر 30 يوم", icon: ReceiptText, tint: "from-butter-200 to-blush-200" },
          { label: "بانتظار التأكيد", value: formatNum(c.pendingOrders), sub: `${c.returns} مرتجع`, icon: RefreshCcw, tint: "from-lilac-200 to-aqua-200" },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className={`rounded-3xl bg-gradient-to-bl ${k.tint} p-4 shadow-soft`}>
            <span className="grid size-10 place-items-center rounded-2xl bg-white shadow-soft"><k.icon size={17} className="text-ink" /></span>
            <p className="mt-3 text-[11px] font-black text-ink/60">{k.label}</p>
            <p className="mt-0.5 text-lg font-black">{k.value}</p>
            <p className="text-[10px] font-bold text-ink/50">{k.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* channels */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card-bubble flex items-center justify-between p-4">
          <div><p className="text-[11px] font-black text-ink-soft">قناة الويب/التطبيق</p><p className="text-base font-black text-lilac-600">{formatIQD(c.webTotal)}</p></div>
          <span className="grid size-10 place-items-center rounded-2xl bg-lilac-100 text-lilac-600"><ShoppingBag size={17} /></span>
        </div>
        <div className="card-bubble flex items-center justify-between p-4">
          <div><p className="text-[11px] font-black text-ink-soft">قناة الكاشير (الفروع)</p><p className="text-base font-black text-minty-600">{formatIQD(c.posTotal)}</p></div>
          <span className="grid size-10 place-items-center rounded-2xl bg-minty-100 text-minty-600"><Store size={17} /></span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="card-bubble p-5">
          <h3 className="mb-1 text-sm font-black">المبيعات — آخر 14 يوم</h3>
          <Charts sales={stats.series} view="area" />
        </div>
        <div className="card-bubble p-5">
          <h3 className="mb-1 text-sm font-black">بوابات الدفع (30 يوم)</h3>
          <Charts payments={stats.payments} view="pie" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <div className="card-bubble p-5">
          <h3 className="mb-1 text-sm font-black">المبيعات حسب المحافظة</h3>
          <Charts governorates={stats.governorates} view="bar" />
        </div>
        <div className="card-bubble p-5">
          <h3 className="mb-3 text-sm font-black">أحدث الطلبات</h3>
          <div className="space-y-2">
            {stats.recentOrders.slice(0, 7).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 rounded-2xl bg-paper px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className={`grid size-8 place-items-center rounded-xl text-[9px] font-black ${o.source === "pos" ? "bg-minty-100 text-minty-700" : "bg-lilac-100 text-lilac-700"}`}>
                    {o.source === "pos" ? "فرع" : "ويب"}
                  </span>
                  <div>
                    <p className="text-xs font-black" dir="ltr">{o.code}</p>
                    <p className="text-[10px] font-bold text-ink-faint">{o.customerName} {o.governorate ? `• ${o.governorate}` : ""}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-xs font-black">{formatIQD(o.total)}</p>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-black ${STATUS_TONE[o.status]}`}>{orderStatusLabel(o.status)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* top products */}
      <div className="card-bubble p-5">
        <h3 className="mb-3 text-sm font-black">الأكثر مبيعاً هذا الشهر</h3>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {stats.topProducts.map((t, i) => (
            <div key={t.name} className="flex items-center gap-3 rounded-2xl bg-paper p-3">
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-xs font-black ${["bg-butter-200 text-butter-700", "bg-blush-100 text-blush-600", "bg-aqua-100 text-aqua-700"][i % 3]}`}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-xs font-black">{t.name}</p>
                <p className="text-[10px] font-bold text-ink-faint">{formatNum(t.qty)} قطعة • {formatIQD(t.revenue)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══ products ═══ */
type ProductForm = {
  id?: number; name: string; description: string; price: string; compareAtPrice: string;
  stock: string; categoryId: number; images: string; sizes: string[]; colors: { name: string; hex: string }[]; isNew: boolean;
  /** مخزون كل مقاس — يُرسل للخادم ويحسب الإجمالي */
  sizeStock: Record<string, string>;
};

/** توزيع الإجمالي على المقاسات بالتساوي (والباقي على الأول) */
function distributeStock(total: number, sizes: string[]): Record<string, string> {
  if (!sizes.length) return {};
  const per = Math.floor(total / sizes.length);
  const rem = total % sizes.length;
  return Object.fromEntries(sizes.map((s, i) => [s, String(per + (i < rem ? 1 : 0))]));
}

function ProductsTab() {
  const [items, setItems] = useState<ProductDTO[] | null>(null);
  const [cats, setCats] = useState<CategoryDTO[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<ProductForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    fetch("/api/products?limit=100").then((r) => r.json()).then((d) => setItems(d.products ?? [])).catch(() => setItems([]));
  }, []);
  useEffect(() => {
    load();
    fetch("/api/categories").then((r) => r.json()).then((d) => setCats(d.categories ?? [])).catch(() => {});
  }, [load]);

  const filtered = (items ?? []).filter((p) => !q || p.name.includes(q));

  const openNew = () => {
    const sizes = [...SIZES_ALL.slice(2, 8)];
    setEditing({
      name: "", description: "", price: "", compareAtPrice: "", stock: "20",
      categoryId: cats[0]?.id ?? 1, images: "", sizes, colors: [ColorPalette[0]], isNew: true,
      sizeStock: distributeStock(20, sizes),
    });
  };
  const openEdit = (p: ProductDTO) => {
    const rows = new Map((p.sizeStock ?? []).map((r) => [r.size, r.stock]));
    setEditing({
      id: p.id, name: p.name, description: p.description, price: String(p.price),
      compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : "", stock: String(p.stock),
      categoryId: p.categoryId, images: p.images.join("\n"), sizes: p.sizes, colors: p.colors, isNew: p.isNew,
      sizeStock: Object.fromEntries(p.sizes.map((s) => [s, String(rows.get(s) ?? 0)])),
    });
  };

  /** رفع صور حقيقية من الجهاز إلى الخادم وإضافتها لقائمة روابط المنتج */
  const uploadImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files).slice(0, 6)) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const r = await fetch("/api/uploads", { method: "POST", body: fd });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.url) urls.push(String(d.url));
      } catch { /* تجاهل الملف الفاشل وانتقل للتالي */ }
    }
    setUploading(false);
    if (!urls.length) return;
    setEditing((prev) =>
      prev ? { ...prev, images: [prev.images, ...urls].filter(Boolean).join("\n") } : prev
    );
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const sizeRows = editing.sizes.map((s) => ({
      size: s,
      stock: Math.max(0, Math.round(Number(editing.sizeStock[s] ?? 0) || 0)),
    }));
    const payload = {
      name: editing.name, description: editing.description,
      price: Number(editing.price), compareAtPrice: editing.compareAtPrice ? Number(editing.compareAtPrice) : null,
      stock: sizeRows.length ? sizeRows.reduce((a, b) => a + b.stock, 0) : Number(editing.stock),
      categoryId: editing.categoryId,
      images: editing.images.split(/\n+/).map((s) => s.trim()).filter(Boolean),
      sizes: editing.sizes, colors: editing.colors, isNew: editing.isNew,
      ...(sizeRows.length ? { sizeStock: sizeRows } : {}),
    };
    const url = editing.id ? `/api/products/${editing.id}` : "/api/products";
    await fetch(url, { method: editing.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    setEditing(null);
    load();
  };

  const del = async (id: number) => {
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    load();
  };

  const toggleSize = (s: string) => {
    if (!editing) return;
    const on = editing.sizes.includes(s);
    setEditing({
      ...editing,
      sizes: on ? editing.sizes.filter((x) => x !== s) : [...editing.sizes, s],
      sizeStock: on
        ? Object.fromEntries(Object.entries(editing.sizeStock).filter(([k]) => k !== s))
        : { ...editing.sizeStock, [s]: editing.sizeStock[s] ?? "0" },
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم..." className="field pr-10 py-2.5 text-sm" />
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 rounded-2xl bg-ink px-4 py-2.5 text-xs font-black text-white transition-transform hover:scale-105">
          <Plus size={14} /> منتج جديد
        </button>
      </div>

      <div className="card-bubble overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-right text-xs">
            <thead>
              <tr className="bg-paper text-[10px] font-black text-ink-soft">
                <th className="p-3">المنتج</th><th className="p-3">التصنيف</th><th className="p-3">السعر</th>
                <th className="p-3">الخصم</th><th className="p-3">المخزون</th><th className="p-3">مبيعات</th><th className="p-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-black/5 font-bold hover:bg-blush-50/40">
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.images[0]} alt="" className="size-10 rounded-xl object-cover" />
                      <span className="max-w-44"><span className="line-clamp-2">{p.name}</span>{p.isNew && <span className="mr-1 rounded bg-minty-100 px-1 py-0.5 text-[8px] font-black text-minty-700">جديد</span>}</span>
                    </div>
                  </td>
                  <td className="p-3 text-ink-soft">{p.categoryName}</td>
                  <td className="p-3 font-black">{formatIQD(p.price)}</td>
                  <td className="p-3">{p.discountPct ? <span className="rounded-full bg-butter-100 px-2 py-0.5 text-butter-700 font-black">-{p.discountPct}%</span> : "—"}</td>
                  <td className="p-3">
                    <span className={`font-black ${p.stock <= 8 ? "text-blush-600" : "text-minty-600"}`}>{p.stock}</span>
                    {p.stock <= 8 && <AlertTriangle size={11} className="mr-1 inline text-blush-500" />}
                  </td>
                  <td className="p-3 text-ink-soft">{formatNum(p.soldCount)}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)} className="grid size-8 place-items-center rounded-lg bg-aqua-100 text-aqua-700 transition-transform hover:scale-110"><Pencil size={13} /></button>
                      <button onClick={() => del(p.id)} className="grid size-8 place-items-center rounded-lg bg-blush-100 text-blush-600 transition-transform hover:scale-110"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {items === null && <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="mx-auto animate-spin text-lilac-400" /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* edit modal */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
            <motion.div initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()}
              className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] bg-white p-6 shadow-pop">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-black">{editing.id ? "تعديل المنتج" : "منتج جديد"}</h3>
                <button onClick={() => setEditing(null)} className="grid size-8 place-items-center rounded-full bg-ink/5"><X size={14} /></button>
              </div>
              <div className="space-y-3">
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="اسم المنتج بالعربي" className="field text-sm" />
                <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="الوصف التفصيلي" rows={3} className="field text-sm" />
                <div className="grid grid-cols-3 gap-2">
                  <input value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value.replace(/[^\d]/g, "") })} placeholder="السعر د.ع" className="field text-sm" dir="ltr" inputMode="numeric" />
                  <input value={editing.compareAtPrice} onChange={(e) => setEditing({ ...editing, compareAtPrice: e.target.value.replace(/[^\d]/g, "") })} placeholder="قبل الخصم" className="field text-sm" dir="ltr" inputMode="numeric" />
                  <input value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: e.target.value.replace(/[^\d]/g, "") })} placeholder="المخزون" className="field text-sm" dir="ltr" inputMode="numeric" />
                </div>
                <select value={editing.categoryId} onChange={(e) => setEditing({ ...editing, categoryId: Number(e.target.value) })} className="field cursor-pointer text-sm font-black">
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.nameAr} — {c.section}</option>)}
                </select>
                <textarea value={editing.images} onChange={(e) => setEditing({ ...editing, images: e.target.value })} placeholder={"روابط الصور — رابط في كل سطر (4 صور على الأقل)"} rows={3} className="field text-xs" dir="ltr" />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-lilac-100 px-3 py-2 text-[11px] font-black text-lilac-700 transition-transform hover:scale-105">
                    {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {uploading ? "جاري الرفع..." : "رفع صور من الجهاز"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                      multiple
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => { uploadImages(e.target.files); e.currentTarget.value = ""; }}
                    />
                  </label>
                  <span className="text-[10px] font-bold text-ink-faint">JPG/PNG/WebP حتى 6 ميغا — تُخزَّن على الخادم</span>
                </div>
                {editing.images.trim() && (
                  <div className="flex flex-wrap gap-1.5">
                    {editing.images.split(/\n+/).map((s) => s.trim()).filter(Boolean).slice(0, 8).map((src) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={src} src={src} alt="" className="size-14 rounded-xl object-cover ring-2 ring-paper" />
                    ))}
                  </div>
                )}
                <div>
                  <p className="mb-1.5 text-xs font-black text-ink-soft">المقاسات المتوفرة</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SIZES_ALL.map((s) => (
                      <button key={s} type="button" onClick={() => toggleSize(s)}
                        className={`rounded-xl px-2.5 py-1.5 text-[10px] font-black ${editing.sizes.includes(s) ? "bg-ink text-white" : "bg-paper ring-1 ring-ink/10"}`}>{s}</button>
                    ))}
                  </div>
                  {editing.sizes.length > 0 && (
                    <div className="mt-2 space-y-1.5 rounded-2xl bg-paper p-2.5">
                      <p className="text-[10px] font-black text-ink-soft">
                        مخزون كل مقاس — الإجمالي {editing.sizes.reduce((a, s) => a + (Number(editing.sizeStock[s]) || 0), 0)}
                      </p>
                      {editing.sizes.map((s) => (
                        <label key={s} className="flex items-center gap-2">
                          <span className="flex-1 text-[11px] font-bold">{s}</span>
                          <input
                            value={editing.sizeStock[s] ?? ""}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^\d]/g, "");
                              setEditing({ ...editing, sizeStock: { ...editing.sizeStock, [s]: v } });
                            }}
                            placeholder="0"
                            inputMode="numeric"
                            dir="ltr"
                            className="w-16 rounded-lg border border-ink/10 bg-white py-1 text-center text-[11px] font-black"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-black text-ink-soft">الألوان المتوفرة</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ColorPalette.map((c) => {
                      const on = editing.colors.some((x) => x.hex === c.hex);
                      return (
                        <button key={c.hex} type="button" title={c.name}
                          onClick={() => setEditing({ ...editing, colors: on ? editing.colors.filter((x) => x.hex !== c.hex) : [...editing.colors, c] })}
                          className={`flex items-center gap-1 rounded-xl py-1.5 pr-1.5 pl-2.5 text-[10px] font-black ${on ? "bg-ink text-white" : "bg-paper ring-1 ring-ink/10"}`}>
                          <span className="size-4 rounded-full ring-1 ring-black/20" style={{ background: c.hex }} /> {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button type="button" onClick={() => setEditing({ ...editing, isNew: !editing.isNew })}
                  className={`flex w-full items-center justify-between rounded-2xl p-3 text-xs font-black ${editing.isNew ? "bg-minty-100 text-minty-700" : "bg-paper text-ink-soft ring-1 ring-ink/10"}`}>
                  وسم "وصل حديثاً" {editing.isNew ? <Check size={15} /> : <span />}
                </button>
              </div>
              <button onClick={save} disabled={saving || !editing.name || !editing.price}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-sm font-black text-white transition-transform hover:scale-[1.02] disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} حفظ المنتج
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══ orders ═══ */
function OrdersTab() {
  const [orders, setOrders] = useState<OrderDTO[] | null>(null);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [statusError, setStatusError] = useState<{ id: number; text: string } | null>(null);
  const [returnFor, setReturnFor] = useState<number | null>(null);
  const [returnQty, setReturnQty] = useState<Record<number, string>>({});
  const [returnBusy, setReturnBusy] = useState(false);

  const load = useCallback((status: string) => {
    setOrders(null);
    fetch("/api/admin/stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
      .then((r) => r.json()).then((d) => setOrders(d.orders ?? [])).catch(() => setOrders([]));
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  const setStatus = async (id: number, status: string) => {
    setStatusError(null);
    const r = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setStatusError({ id, text: d.error ?? "تعذر تغيير الحالة" });
      return;
    }
    load(filter);
  };

  const remainingOf = (it: OrderDTO["items"][number]) => it.qty - (it.returnedQty ?? 0);
  const canReturn = (o: OrderDTO) =>
    ["delivered", "return_requested"].includes(o.status) && o.items.some((it) => remainingOf(it) > 0);

  const submitReturn = async (orderId: number) => {
    const items = Object.entries(returnQty)
      .map(([id, qty]) => ({ orderItemId: Number(id), qty: Number(qty) || 0 }))
      .filter((i) => i.qty > 0);
    if (!items.length) {
      setStatusError({ id: orderId, text: "حدّد كمية لقطعة واحدة على الأقل" });
      return;
    }
    setReturnBusy(true);
    const r = await fetch(`/api/orders/${orderId}/returns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const d = await r.json().catch(() => ({}));
    setReturnBusy(false);
    if (!r.ok) {
      setStatusError({ id: orderId, text: d.error ?? "تعذر تسجيل الإرجاع" });
      return;
    }
    setReturnFor(null);
    setReturnQty({});
    load(filter);
  };

  return (
    <div>
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {[{ k: "all", l: "الكل" }, ...ORDER_STATUSES.map((s) => ({ k: s, l: orderStatusLabel(s) }))].map((s) => (
          <button key={s.k} onClick={() => setFilter(s.k)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-black ${filter === s.k ? "bg-ink text-white" : "bg-white text-ink-soft shadow-soft"}`}>{s.l}</button>
        ))}
      </div>
      <div className="space-y-2.5">
        {orders === null && <div className="shimmer h-40 rounded-3xl" />}
        {orders?.length === 0 && <div className="card-bubble p-8 text-center text-sm font-bold text-ink-faint">لا توجد طلبات بهذه الحالة</div>}
        {orders?.map((o) => (
          <div key={o.id} className="card-bubble overflow-hidden">
            <button onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-right">
              <div className="flex items-center gap-3">
                <ChevronLeft size={15} className={`text-ink-soft transition-transform ${expanded === o.id ? "-rotate-90" : ""}`} />
                <div>
                  <p className="text-xs font-black" dir="ltr">{o.code}</p>
                  <p className="text-[10px] font-bold text-ink-faint">{o.customerName} • {o.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-ink-faint">{fmtDateTime(o.createdAt)}</span>
                <span className="text-xs font-black">{formatIQD(o.total)}</span>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black ${STATUS_TONE[o.status]}`}>{orderStatusLabel(o.status)}</span>
              </div>
            </button>
            {expanded === o.id && (
              <div className="border-t-2 border-dashed border-ink/8 bg-paper/60 p-4">
                <div className="space-y-1.5">
                  {o.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-2.5 text-xs font-bold">
                      {it.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.image} alt="" className="size-9 rounded-lg object-cover" />
                      )}
                      <span className="flex-1">{it.name} <span className="text-ink-faint">({it.size}/{it.color})</span></span>
                      <span>×{it.qty}</span>
                      <span className="font-black">{formatIQD(it.price * it.qty)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-ink/10 pt-3">
                  <div className="text-[11px] font-bold text-ink-soft">
                    {o.governorate && <span>{o.governorate}{o.district ? ` — ${o.district}` : ""} • </span>}
                    الدفع: {gatewayById(o.paymentMethod).name} {o.couponCode && `• كوبون ${o.couponCode}`}
                    {o.refundTotal ? <span className="text-blush-600"> • مسترد {formatIQD(o.refundTotal)}</span> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value=""
                      disabled={!nextStatuses(o.status).length}
                      onChange={(e) => { if (e.target.value) setStatus(o.id, e.target.value); }}
                      className="field w-auto cursor-pointer py-2 text-[11px] font-black disabled:opacity-50"
                    >
                      <option value="">تغيير الحالة…</option>
                      {nextStatuses(o.status).map((s) => <option key={s} value={s}>{orderStatusLabel(s)}</option>)}
                    </select>
                  </div>
                </div>
                {statusError?.id === o.id && (
                  <p className="mt-2 text-[11px] font-black text-blush-600">{statusError.text}</p>
                )}

                {canReturn(o) && (
                  <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-ink/8">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-black"><RotateCcw size={12} /> إرجاع جزئي</p>
                      <button
                        onClick={() => { setReturnFor(returnFor === o.id ? null : o.id); setReturnQty({}); }}
                        className="rounded-full bg-blush-50 px-3 py-1.5 text-[10px] font-black text-blush-600 hover:bg-blush-100"
                      >
                        {returnFor === o.id ? "إلغاء" : "تحديد القطع"}
                      </button>
                    </div>
                    {returnFor === o.id && (
                      <div className="mt-2 space-y-2">
                        {o.items.map((it) => {
                          const remaining = remainingOf(it);
                          if (remaining <= 0) return null;
                          return (
                            <div key={it.id} className="flex items-center gap-2">
                              <span className="flex-1 text-[11px] font-bold">
                                {it.name} <span className="text-ink-faint">— متبقٍ {remaining}</span>
                              </span>
                              <input
                                value={returnQty[it.id] ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/[^\d]/g, "");
                                  setReturnQty((prev) => ({ ...prev, [it.id]: v }));
                                }}
                                placeholder="0"
                                inputMode="numeric"
                                className="field w-16 py-1.5 text-center text-[11px] font-black"
                                dir="ltr"
                              />
                            </div>
                          );
                        })}
                        <button
                          onClick={() => submitReturn(o.id)}
                          disabled={returnBusy}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blush-500 py-2.5 text-[11px] font-black text-white disabled:opacity-60"
                        >
                          {returnBusy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                          تسجيل الإرجاع واستعادة المخزون
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {o.events?.length ? (
                  <div className="mt-3 space-y-1.5 border-t border-dashed border-ink/10 pt-3">
                    <p className="text-[10px] font-black text-ink-soft">سجل الحالات</p>
                    {o.events.map((e) => (
                      <div key={e.id} className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-ink-soft">
                        <span className="size-1.5 rounded-full bg-lilac-400" />
                        {e.fromStatus ? `${orderStatusLabel(e.fromStatus)} ← ` : ""}
                        <span className="text-ink">{orderStatusLabel(e.toStatus)}</span>
                        <span>• {fmtDateTime(e.createdAt)}</span>
                        <span>• {e.actor}</span>
                        {e.note ? <span className="text-ink-faint">• {e.note}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ coupons ═══ */
function CouponsTab() {
  const [coupons, setCoupons] = useState<CouponDTO[] | null>(null);
  const [form, setForm] = useState({ code: "", type: "percent", value: "", minSubtotal: "", description: "", maxUses: "" });
  const load = useCallback(() => fetch("/api/coupons").then((r) => r.json()).then((d) => setCoupons(d.coupons ?? [])).catch(() => setCoupons([])), []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-2.5">
        {coupons?.map((c) => (
          <div key={c.id} className="card-bubble flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-lilac-100 text-lilac-600"><TicketPercent size={17} /></span>
              <div>
                <p className="text-sm font-black" dir="ltr">{c.code}</p>
                <p className="text-[11px] font-bold text-ink-soft">
                  {c.type === "percent" ? `${c.value}%` : formatIQD(c.value)} — حد أدنى {formatIQD(c.minSubtotal)}
                </p>
                <p className="text-[10px] font-bold text-ink-faint">
                  الاستخدام: {formatNum(c.usedCount ?? 0)} / {c.maxUses ?? "∞"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                defaultValue={c.maxUses ?? ""}
                id={`max-${c.id}`}
                placeholder="حد"
                dir="ltr"
                inputMode="numeric"
                className="field w-16 py-1.5 text-center text-[11px] font-black"
                title="حد الاستخدام — فارغ = بلا حد"
              />
              <button onClick={async () => {
                const el = document.getElementById(`max-${c.id}`) as HTMLInputElement | null;
                const raw = (el?.value ?? "").replace(/[^\d]/g, "");
                await fetch("/api/coupons", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: c.id, maxUses: raw ? Number(raw) : null }),
                });
                load();
              }} className="rounded-full bg-ink/5 px-3 py-1.5 text-[10px] font-black text-ink">حفظ الحد</button>
              <button onClick={async () => { await fetch("/api/coupons", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, active: !c.active }) }); load(); }}
                className={`rounded-full px-3.5 py-1.5 text-[11px] font-black ${c.active ? "bg-minty-100 text-minty-700" : "bg-ink/5 text-ink-faint"}`}>
                {c.active ? "مفعّل" : "موقوف"}
              </button>
              <button onClick={async () => { await fetch(`/api/coupons?id=${c.id}`, { method: "DELETE" }); load(); }}
                className="grid size-9 place-items-center rounded-xl bg-blush-100 text-blush-600 transition-transform hover:scale-110"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="card-bubble p-5">
        <h3 className="mb-3 text-sm font-black">إنشاء كوبون</h3>
        <div className="space-y-2.5">
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="الكود — مثل EID30" className="field text-sm uppercase" dir="ltr" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="field cursor-pointer text-sm">
              <option value="percent">نسبة %</option><option value="fixed">مبلغ ثابت</option>
            </select>
            <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value.replace(/[^\d]/g, "") })} placeholder="القيمة" className="field text-sm" dir="ltr" inputMode="numeric" />
          </div>
          <input value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value.replace(/[^\d]/g, "") })} placeholder="الحد الأدنى للطلب (د.ع)" className="field text-sm" dir="ltr" inputMode="numeric" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="وصف قصير" className="field text-sm" />
          <input value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value.replace(/[^\d]/g, "") })} placeholder="حد الاستخدام — فارغ = بلا حد" className="field text-sm" dir="ltr" inputMode="numeric" />
          <button onClick={async () => {
            if (!form.code || !form.value) return;
            await fetch("/api/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, value: Number(form.value), minSubtotal: Number(form.minSubtotal) || 0 }) });
            setForm({ code: "", type: "percent", value: "", minSubtotal: "", description: "", maxUses: "" });
            load();
          }} className="w-full rounded-2xl bg-ink py-3 text-sm font-black text-white transition-transform hover:scale-[1.02]">إنشاء</button>
        </div>
      </div>
    </div>
  );
}

/* ═══ delivery ═══ */
function DeliveryTab() {
  const [fees, setFees] = useState<DeliveryFeeDTO[] | null>(null);
  const load = useCallback(() => fetch("/api/delivery").then((r) => r.json()).then((d) => setFees(d.fees ?? [])).catch(() => setFees([])), []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {fees?.map((f) => (
        <div key={f.id} className="card-bubble p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black">{f.governorate}</p>
            <span className="rounded-full bg-aqua-100 px-2 py-0.5 text-[9px] font-black text-aqua-700">{f.carrier}</span>
          </div>
          <p className="mt-1 text-[10px] font-bold text-ink-faint">الوصول المتوقع: {f.eta}</p>
          <div className="mt-3 flex items-center gap-2">
            <input defaultValue={f.fee} inputMode="numeric" dir="ltr" id={`fee-${f.id}`}
              className="field py-2 text-center text-sm font-black" />
            <button onClick={async () => {
              const el = document.getElementById(`fee-${f.id}`) as HTMLInputElement;
              await fetch("/api/delivery", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ governorate: f.governorate, fee: Number(el.value) || f.fee }) });
              load();
            }} className="shrink-0 rounded-xl bg-ink px-3.5 py-2.5 text-[11px] font-black text-white">حفظ</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══ inventory ═══ */
function InventoryTab({ stats, onRefresh }: { stats: Stats | null; onRefresh: () => void }) {
  const restock = async (productId: number, add: number) => {
    await fetch("/api/admin/stats", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, add }) });
    onRefresh();
  };
  if (!stats) return <div className="shimmer h-60 rounded-3xl" />;
  return (
    <div>
      <div className="card-bubble mb-4 flex items-center gap-3 bg-gradient-to-l from-blush-100 to-butter-100 p-4">
        <AlertTriangle className="text-blush-600" size={22} />
        <p className="text-xs font-black text-ink">تنبيهات النفاذ — {stats.lowStock.length} منتجات مخزونها 8 قطع أو أقل. زوّدي المخزون قبل نفاذها بعروض العيد!</p>
      </div>
      <div className="space-y-2.5">
        {stats.lowStock.map((p) => (
          <div key={p.id} className="card-bubble flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.images[0]} alt="" className="size-12 rounded-xl object-cover" />
              <div>
                <p className="max-w-64 line-clamp-1 text-xs font-black">{p.name}</p>
                <p className="text-[10px] font-bold text-blush-600">المتبقي: {p.stock} قطعة فقط</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              {[10, 25, 50].map((n) => (
                <button key={n} onClick={() => restock(p.id, n)} className="rounded-xl bg-minty-100 px-3 py-2 text-[11px] font-black text-minty-700 transition-transform hover:scale-105">+{n}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ branches ═══ */
function BranchesTab() {
  const [branches, setBranches] = useState<{ id: number; name: string; city: string; phone: string | null; address: string | null }[]>([]);
  useEffect(() => {
    fetch("/api/pos/shift?branchId=1").then((r) => r.json()).then((d) => setBranches(d.branches ?? [])).catch(() => {});
  }, []);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {branches.map((b, i) => (
          <div key={b.id} className="card-bubble p-5">
            <span className={`grid size-11 place-items-center rounded-2xl ${["bg-blush-100 text-blush-600", "bg-aqua-100 text-aqua-600", "bg-minty-100 text-minty-600"][i % 3]}`}><Store size={20} /></span>
            <p className="mt-3 text-sm font-black">{b.name}</p>
            <p className="text-[11px] font-bold text-ink-soft">{b.address}</p>
            <p className="mt-1 text-[11px] font-black text-ink" dir="ltr">{b.phone}</p>
            <Link href="/pos" className="mt-3 inline-block rounded-full bg-ink px-4 py-2 text-[11px] font-black text-white">فتح الكاشير</Link>
          </div>
        ))}
      </div>
      <div className="card-bubble p-6">
        <h3 className="text-sm font-black">صلاحيات الورديات</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            { role: "كاشير", perms: ["إنشاء فواتير", "طباعة حرارية 80mm", "فتح درج النقدية", "وضع عدم الاتصال"], tint: "bg-aqua-100 text-aqua-700" },
            { role: "مشرف", perms: ["كل صلاحيات الكاشير", "المرتجعات والاسترداد", "الخصومات اليدوية", "عرض تقرير اليوم"], tint: "bg-lilac-100 text-lilac-700" },
            { role: "مدير فرع", perms: ["كل الصلاحيات", "إغلاق الصندوق", "إدارة المخزون", "تقرير الفروع الموحد"], tint: "bg-blush-100 text-blush-600" },
          ].map((r) => (
            <div key={r.role} className="rounded-2xl bg-paper p-4 ring-1 ring-ink/5">
              <span className={`rounded-full px-3 py-1 text-[11px] font-black ${r.tint}`}>{r.role}</span>
              <ul className="mt-3 space-y-1.5 text-[11px] font-bold text-ink-soft">
                {r.perms.map((p) => <li key={p} className="flex items-center gap-1.5"><Check size={12} className="text-minty-500" /> {p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ═══ الفريق والصلاحيات (RBAC) ═══ */

type StaffRow = {
  id: number;
  name: string;
  role: string;
  branchId: number | null;
  branchName: string | null;
  active: boolean;
  createdAt: string;
};

type BranchRow = { id: number; name: string; city: string; phone: string | null; address: string | null };

const STAFF_ROLE_LABELS: Record<string, string> = {
  cashier: "كاشير",
  supervisor: "مشرف",
  manager: "مدير فرع",
};

function TeamTab() {
  const [list, setList] = useState<StaffRow[] | null>(null);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [form, setForm] = useState({ name: "", role: "cashier", branchId: "1", pin: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pinFor, setPinFor] = useState<{ id: number; value: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/staff")
      .then((r) => r.json())
      .then((d) => setList(d.staff ?? []))
      .catch(() => setList([]));
  }, []);

  useEffect(() => {
    load();
    fetch("/api/pos/shift?branchId=1")
      .then((r) => r.json())
      .then((d) => setBranches(d.branches ?? []))
      .catch(() => {});
  }, [load]);

  const create = async () => {
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          role: form.role,
          branchId: Number(form.branchId) || null,
          pin: form.pin,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "تعذر إنشاء الحساب");
      setForm({ name: "", role: "cashier", branchId: form.branchId, pin: "" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إنشاء الحساب");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: number, body: Record<string, unknown>) => {
    setError("");
    const r = await fetch("/api/admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(d.error ?? "تعذر التحديث");
    }
    load();
  };

  const remove = async (id: number) => {
    await fetch(`/api/admin/staff?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-2.5">
        {list === null && <div className="shimmer h-40 rounded-3xl" />}
        {list?.length === 0 && (
          <div className="card-bubble p-8 text-center text-sm font-bold text-ink-soft">
            ما عندك حسابات موظفين بعد — أضف حساباً لكل كاشير حتى يُنسب كل بيع ومرتجع لشخصه
          </div>
        )}
        {list?.map((s) => (
          <div key={s.id} className="card-bubble p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`grid size-10 place-items-center rounded-2xl ${s.active ? "bg-aqua-100 text-aqua-700" : "bg-ink/5 text-ink-faint"}`}>
                  <Users size={17} />
                </span>
                <div>
                  <p className="text-sm font-black">{s.name}</p>
                  <p className="text-[11px] font-bold text-ink-soft">
                    {STAFF_ROLE_LABELS[s.role] ?? s.role} • {s.branchName ?? "كل الفروع"} • {s.active ? "مفعّل" : "موقوف"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={s.role}
                  onChange={(e) => patch(s.id, { role: e.target.value })}
                  className="field w-auto cursor-pointer py-1.5 text-[11px] font-black"
                >
                  {Object.entries(STAFF_ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <button
                  onClick={() => setPinFor(pinFor?.id === s.id ? null : { id: s.id, value: "" })}
                  className="rounded-full bg-ink/5 px-3 py-1.5 text-[10px] font-black text-ink"
                >
                  رمز جديد
                </button>
                <button
                  onClick={() => patch(s.id, { active: !s.active })}
                  className={`rounded-full px-3.5 py-1.5 text-[11px] font-black ${s.active ? "bg-minty-100 text-minty-700" : "bg-ink/5 text-ink-faint"}`}
                >
                  {s.active ? "مفعّل" : "موقوف"}
                </button>
                <button onClick={() => remove(s.id)} className="grid size-9 place-items-center rounded-xl bg-blush-100 text-blush-600 transition-transform hover:scale-110">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {pinFor?.id === s.id && (
              <div className="mt-3 flex items-center gap-2 border-t border-dashed border-ink/10 pt-3">
                <input
                  value={pinFor.value}
                  onChange={(e) => setPinFor({ id: s.id, value: e.target.value.replace(/[^\d]/g, "") })}
                  placeholder="رمز من 4 إلى 8 أرقام"
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={8}
                  className="field w-44 py-2 text-center text-sm font-black"
                />
                <button
                  onClick={async () => { await patch(s.id, { pin: pinFor.value }); setPinFor(null); }}
                  disabled={pinFor.value.length < 4}
                  className="rounded-xl bg-ink px-4 py-2.5 text-[11px] font-black text-white disabled:opacity-40"
                >
                  حفظ الرمز
                </button>
                <button onClick={() => setPinFor(null)} className="text-[11px] font-black text-ink-soft">إلغاء</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card-bubble h-fit p-5">
        <h3 className="mb-3 text-sm font-black">حساب موظف جديد</h3>
        <div className="space-y-2.5">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الموظف" className="field text-sm" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="field cursor-pointer text-sm">
            {Object.entries(STAFF_ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} className="field cursor-pointer text-sm">
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.city}</option>)}
          </select>
          <input
            value={form.pin}
            onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/[^\d]/g, "") })}
            placeholder="رمز الدخول (4–8 أرقام)"
            dir="ltr"
            inputMode="numeric"
            maxLength={8}
            className="field text-center text-sm font-black"
          />
          {error && <p className="text-[11px] font-black text-blush-600">{error}</p>}
          <button
            onClick={create}
            disabled={busy || form.name.trim().length < 2 || form.pin.length < 4}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3 text-sm font-black text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} إنشاء الحساب
          </button>
          <p className="text-[10px] font-bold leading-5 text-ink-faint">
            بعد إضافة أول حساب لفرع، لا يفتح الكاشير ورديةً إلا باختيار حسابه وإدخال رمزه. الرمز يُخزَّن مُجزّأً ولا يظهر لأحد.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══ سجل التدقيق ═══ */

type AuditEntry = {
  id: number;
  actor: string;
  role: string;
  action: string;
  target: string | null;
  meta: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
};

const AUDIT_LABELS: Record<string, string> = {
  "admin.login": "دخول إدارة",
  "admin.logout": "خروج إدارة",
  "admin.login.failed": "محاولة دخول فاشلة",
  "admin.login.blocked": "محاولة محجوبة (حد المعدل)",
  "order.status": "تغيير حالة طلب",
  "product.create": "إضافة منتج",
  "product.update": "تعديل منتج",
  "product.delete": "حذف منتج",
  "coupon.create": "إنشاء كوبون",
  "coupon.update": "تعديل كوبون",
  "coupon.delete": "حذف كوبون",
  "upload.create": "رفع صورة",
  "stock.restock": "إعادة تخزين",
  "pos.sale": "بيع كاشير",
  "pos.shift.open": "فتح وردية",
  "pos.shift.close": "إغلاق وردية",
  "pos.shift.denied": "رمز موظف خاطئ",
  "staff.create": "إنشاء حساب موظف",
  "staff.update": "تعديل حساب موظف",
  "staff.delete": "حذف حساب موظف",
  "seed.run": "بذر بيانات",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "إدارة",
  cashier: "كاشير",
  supervisor: "مشرف",
  manager: "مدير",
  customer: "زبون",
  system: "نظام",
};

function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback((query: string) => {
    setEntries(null);
    fetch(`/api/admin/audit?limit=150${query ? `&q=${encodeURIComponent(query)}` : ""}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => { load(""); }, [load]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في السجل..." className="field pr-10 py-2.5 text-sm" />
        </div>
        <button onClick={() => load(q.trim())} className="rounded-2xl bg-ink px-4 py-2.5 text-xs font-black text-white transition-transform hover:scale-105">بحث</button>
      </div>

      <div className="card-bubble overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-right text-xs">
            <thead>
              <tr className="bg-paper text-[10px] font-black text-ink-soft">
                <th className="p-3">الوقت</th><th className="p-3">الفاعل</th><th className="p-3">العملية</th>
                <th className="p-3">الهدف</th><th className="p-3">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {entries?.map((e) => (
                <tr key={e.id} className="border-t border-black/5 font-bold hover:bg-blush-50/40">
                  <td className="whitespace-nowrap p-3 text-[10px] text-ink-faint">{fmtDateTime(e.createdAt)}</td>
                  <td className="p-3">
                    <span className="block">{e.actor}</span>
                    <span className="text-[10px] text-ink-faint">{ROLE_LABELS[e.role] ?? e.role}</span>
                  </td>
                  <td className="p-3">{AUDIT_LABELS[e.action] ?? e.action}</td>
                  <td className="p-3 text-[10px] text-ink-soft" dir="ltr">{e.target ?? "—"}</td>
                  <td className="p-3 text-[10px] text-ink-soft" dir="ltr">
                    {Object.keys(e.meta ?? {}).length ? JSON.stringify(e.meta) : "—"}
                  </td>
                </tr>
              ))}
              {entries === null && <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="mx-auto animate-spin text-lilac-400" /></td></tr>}
              {entries?.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-sm font-bold text-ink-faint">لا توجد عمليات مطابقة</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-[10px] font-bold text-ink-faint">السجل للقراءة فقط — يُكتب من الخادم ولا يمكن تعديله أو حذفه من الواجهة.</p>
    </div>
  );
}


/* ═══ الزبائن ═══ */

type CustomerRow = {
  id: number;
  name: string;
  phone: string;
  createdAt: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
};

function CustomersTab() {
  const [rows, setRows] = useState<CustomerRow[] | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback((query: string) => {
    setRows(null);
    fetch(`/api/admin/customers${query ? `?q=${encodeURIComponent(query)}` : ""}`)
      .then((r) => r.json())
      .then((d) => setRows(d.customers ?? []))
      .catch(() => setRows([]));
  }, []);

  useEffect(() => { load(""); }, [load]);

  const totalSpent = (rows ?? []).reduce((s, c) => s + c.totalSpent, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الهاتف..." className="field pr-10 py-2.5 text-sm" />
        </div>
        <button onClick={() => load(q.trim())} className="rounded-2xl bg-ink px-4 py-2.5 text-xs font-black text-white transition-transform hover:scale-105">بحث</button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card-bubble p-4">
          <p className="text-[11px] font-black text-ink-soft">الزبائن المعروضون</p>
          <p className="mt-1 text-lg font-black">{formatNum(rows?.length ?? 0)}</p>
        </div>
        <div className="card-bubble p-4">
          <p className="text-[11px] font-black text-ink-soft">إنفاقهم الصافي</p>
          <p className="mt-1 text-lg font-black text-blush-600">{formatIQD(totalSpent)}</p>
        </div>
        <div className="card-bubble p-4">
          <p className="text-[11px] font-black text-ink-soft">بلا طلبات</p>
          <p className="mt-1 text-lg font-black">{formatNum((rows ?? []).filter((c) => !c.ordersCount).length)}</p>
        </div>
      </div>

      <div className="card-bubble overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-right text-xs">
            <thead>
              <tr className="bg-paper text-[10px] font-black text-ink-soft">
                <th className="p-3">الزبون</th><th className="p-3">الهاتف</th><th className="p-3">الطلبات</th>
                <th className="p-3">الإنفاق</th><th className="p-3">آخر طلب</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((c) => (
                <tr key={c.id} className="border-t border-black/5 font-bold hover:bg-blush-50/40">
                  <td className="p-3 font-black">{c.name}</td>
                  <td className="p-3 text-ink-soft" dir="ltr">{c.phone}</td>
                  <td className="p-3">{formatNum(c.ordersCount)}</td>
                  <td className={`p-3 font-black ${c.totalSpent ? "text-minty-600" : "text-ink-faint"}`}>{formatIQD(c.totalSpent)}</td>
                  <td className="p-3 text-[10px] text-ink-faint">{c.lastOrderAt ? fmtDateTime(c.lastOrderAt) : "—"}</td>
                </tr>
              ))}
              {rows === null && <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="mx-auto animate-spin text-lilac-400" /></td></tr>}
              {rows?.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-sm font-bold text-ink-faint">لا يوجد زبائن مطابقون</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
