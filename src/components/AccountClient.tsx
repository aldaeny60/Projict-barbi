"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  User, Package, Heart, TicketPercent, MapPin, LogOut, Phone, ShieldCheck,
  Loader2, Copy, Check, Truck, Star,
} from "lucide-react";
import { useCustomer, useFavorites, useToast } from "./providers";
import { formatIQD, fmtDateTime, isValidIraqiPhone, maskPhone } from "@/lib/format";
import { GOVERNORATES, ORDER_STATUS_META, ORDER_STATUS_TONE } from "@/lib/data";
import { ProductCard } from "./ProductCard";
import type { CouponDTO, OrderDTO, ProductDTO } from "@/lib/types";

type Tab = "orders" | "favorites" | "coupons" | "addresses" | "profile";

export function AccountClient() {
  const sp = useSearchParams();
  const { customer, login, logout } = useCustomer();
  const { toast } = useToast();
  const { favorites } = useFavorites();

  const [tab, setTab] = useState<Tab>((sp.get("tab") as Tab) || "orders");

  /* OTP state */
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  /* data */
  const [orders, setOrders] = useState<OrderDTO[] | null>(null);
  const [coupons, setCoupons] = useState<CouponDTO[]>([]);
  const [favProducts, setFavProducts] = useState<Map<number, ProductDTO>>(new Map());

  const loadOrders = useCallback(() => {
    setOrders(null);
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []))
      .catch(() => setOrders([]));
  }, []);

  useEffect(() => {
    if (customer) loadOrders();
    fetch("/api/coupons").then((r) => r.json()).then((d) => setCoupons((d.coupons ?? []).filter((c: CouponDTO) => c.active))).catch(() => {});
  }, [customer, loadOrders]);

  /* hydrate favorite products details */
  useEffect(() => {
    let alive = true;
    (async () => {
      const map = new Map<number, ProductDTO>();
      for (const f of favorites.slice(0, 24)) {
        try {
          const r = await fetch(`/api/products/${f.productId}`);
          if (r.ok) map.set(f.productId, (await r.json()).product);
        } catch { /* offline */ }
      }
      if (alive) setFavProducts(map);
    })();
    return () => { alive = false; };
  }, [favorites]);

  const sendOtp = async () => {
    if (!isValidIraqiPhone(phone)) return toast("رقم عراقي غير صالح — مثال: 07701234567", "err");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", phone }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setStep("code");
      if (d.devCode) toast(`رمز التحقق (وضع التطوير): ${d.devCode}`, "info");
      else toast("أرسلنا رمز التحقق برسالة SMS", "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : "تعذر الإرسال", "err");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", phone, code, name: name.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      login(d.customer);
      toast(`أهلاً بِج بباربي، ${d.customer.name}!`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "تعذر التحقق", "err");
    } finally {
      setBusy(false);
    }
  };

  /* ─── login screen ─── */
  if (!customer) {
    return (
      <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-bubble w-full overflow-hidden">
          <div className="bg-gradient-to-l from-blush-100 via-lilac-100 to-aqua-100 p-6 text-center">
            <span className="mx-auto grid size-16 animate-floaty place-items-center rounded-3xl bg-white shadow-soft">
              <User className="text-lilac-500" size={28} />
            </span>
            <h1 className="mt-3 text-xl font-black">حسابج بباربي</h1>
            <p className="mt-1 text-xs font-bold text-ink-soft">سجلي برقم تلفونج — بدون كلمات سر، برمز SMS واحد</p>
          </div>
          <div className="p-6">
            {step === "phone" ? (
              <>
                <div className="relative">
                  <Phone size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blush-400" />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="07XX XXX XXXX"
                    dir="ltr"
                    inputMode="tel"
                    maxLength={11}
                    className="field pr-11 text-center text-lg tracking-widest"
                  />
                </div>
                <p className="mt-2 pr-1 text-[10px] font-bold text-ink-faint">يفتّح بـ 075X / 077X / 078X / 079X وعدد 11 رقم</p>
                <button onClick={sendOtp} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-sm font-black text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  أرسلي رمز التحقق
                </button>
              </>
            ) : (
              <>
                <label className="mb-2 block text-center text-xs font-black text-ink-soft">
                  رمز التحقق المرسل إلى <span dir="ltr">{maskPhone(phone)}</span>
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="••••"
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={4}
                  className="field text-center text-2xl font-black tracking-[0.6em]"
                />
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمج الكريم (لأول مرة)" className="field mt-3 text-center" />
                <button onClick={verifyOtp} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-blush-500 to-lilac-500 py-3.5 text-sm font-black text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  تأكيد الدخول
                </button>
                <button onClick={() => setStep("phone")} className="mt-2 w-full py-2 text-xs font-black text-ink-soft hover:text-ink">
                  تغيير الرقم
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  const TABS: { key: Tab; label: string; icon: typeof User }[] = [
    { key: "orders", label: "طلباتي", icon: Package },
    { key: "favorites", label: "المفضلة", icon: Heart },
    { key: "coupons", label: "كوبوناتي", icon: TicketPercent },
    { key: "addresses", label: "عناويني", icon: MapPin },
    { key: "profile", label: "بياناتي", icon: User },
  ];

  return (
    <div className="mx-auto max-w-6xl px-3 py-8 md:px-6">
      {/* hero chip */}
      <div className="card-bubble mb-6 flex flex-wrap items-center justify-between gap-4 overflow-hidden bg-gradient-to-l from-lilac-100 via-blush-50 to-aqua-100 p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-14 place-items-center rounded-3xl bg-white text-xl font-black text-lilac-600 shadow-soft">
            {customer.name[0]}
          </span>
          <div>
            <h1 className="text-xl font-black">يا هلا {customer.name}!</h1>
            <p className="text-xs font-bold text-ink-soft" dir="ltr">{customer.phone}</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-black text-blush-600 shadow-soft transition-transform hover:scale-105">
          <LogOut size={13} /> تسجيل خروج
        </button>
      </div>

      {/* tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-black transition-all ${
              tab === t.key ? "bg-ink text-white shadow-pop" : "bg-white text-ink-soft shadow-soft hover:text-ink"
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {tab === "orders" && <OrdersTab orders={orders} reload={loadOrders} />}
          {tab === "favorites" && <FavoritesTab favProducts={favProducts} />}
          {tab === "coupons" && <CouponsTab coupons={coupons} />}
          {tab === "addresses" && <AddressesTab />}
          {tab === "profile" && <ProfileTab customer={customer} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ─────── tabs ─────── */

function OrdersTab({ orders, reload }: { orders: OrderDTO[] | null; reload: () => void }) {
  const { toast } = useToast();
  const [cancelId, setCancelId] = useState<number | null>(null);

  const requestReturn = async (id: number) => {
    const r = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "return_requested" }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      toast("سجّلنا طلب الإرجاع — فريق باربي يتواصل معك");
      reload();
    } else {
      toast(d.error ?? "تعذر طلب الإرجاع", "err");
    }
  };

  const cancel = async (id: number) => {
    const r = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (r.ok) {
      toast("تم إلغاء الطلب");
      setCancelId(null);
      reload();
    } else toast("تعذر الإلغاء", "err");
  };

  if (orders === null)
    return <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="shimmer h-44 rounded-3xl" />)}</div>;

  if (orders.length === 0)
    return (
      <div className="card-bubble p-10 text-center">
        <Package className="mx-auto text-lilac-400" size={36} />
        <p className="mt-3 font-black">لحد الآن ما عندج طلبات</p>
        <p className="mt-1 text-sm font-semibold text-ink-soft">أول طلب يجيبلج خصم WELCOME10 — يلا ندلل الصغار!</p>
        <Link href="/shop" className="mt-4 inline-block rounded-full bg-ink px-6 py-3 text-sm font-black text-white">تسوقي هسة</Link>
      </div>
    );

  return (
    <div className="space-y-4">
      {orders.map((o) => {
        const meta = ORDER_STATUS_META[o.status] ?? ORDER_STATUS_META.pending;
        const activeStep = meta.step;
        return (
          <div key={o.id} className="card-bubble p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black" dir="ltr">{o.code}</p>
                <p className="text-[11px] font-bold text-ink-faint">{fmtDateTime(o.createdAt)}</p>
                {o.events?.length ? (
                  <p className="text-[10px] font-bold text-lilac-600">
                    آخر تحديث: {fmtDateTime(o.events[o.events.length - 1].createdAt)} — {ORDER_STATUS_META[o.events[o.events.length - 1].toStatus]?.label ?? o.events[o.events.length - 1].toStatus}
                  </p>
                ) : null}
              </div>
              <span className={`rounded-full px-3.5 py-1.5 text-xs font-black ${ORDER_STATUS_TONE[o.status]}`}>{meta.label}</span>
            </div>

            {/* progress */}
            {!["cancelled", "returned"].includes(o.status) && (
              <div className="mt-4 flex items-center" dir="ltr">
                {["قيد التأكيد", "قيد التجهيز", "تم الشحن", "قيد التوصيل", "تم التسليم"].map((s, i) => {
                  const done = i < activeStep;
                  const current = i === activeStep - 1;
                  return (
                    <div key={s} className="flex flex-1 items-center last:flex-none">
                      <div className="flex flex-col items-center">
                        <span className={`grid size-7 place-items-center rounded-full text-[10px] font-black transition-all ${done ? (current ? "bg-lilac-500 text-white ring-4 ring-lilac-100" : "bg-minty-400 text-white") : "bg-ink/8 text-ink-faint"}`}>
                          {done ? <Check size={12} /> : i + 1}
                        </span>
                        <span className={`mt-1.5 hidden text-[9px] font-black sm:block ${done ? "text-ink" : "text-ink-faint"}`}>{s}</span>
                      </div>
                      {i < 4 && <span className={`mx-1 h-1 flex-1 rounded-full ${i < activeStep - 1 ? "bg-minty-400" : "bg-ink/8"}`} />}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-ink/8 pt-3">
              <div className="flex items-center gap-2">
                {o.items.slice(0, 4).map((it) => (
                  it.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={it.id} src={it.image} alt="" className="size-11 rounded-xl object-cover ring-2 ring-paper" />
                  ) : null
                ))}
                {o.items.length > 4 && <span className="text-[10px] font-black text-ink-soft">+{o.items.length - 4}</span>}
                <span className="mr-2 text-xs font-bold text-ink-soft">{o.items.reduce((s, i) => s + i.qty, 0)} قطعة</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-blush-600">{formatIQD(o.total)}</span>
                {(o.refundTotal ?? 0) > 0 && (
                  <span className="rounded-full bg-blush-50 px-2.5 py-1 text-[10px] font-black text-blush-600">
                    مسترد {formatIQD(o.refundTotal ?? 0)}
                  </span>
                )}
                {o.status === "delivered" && (
                  <button onClick={() => requestReturn(o.id)} className="rounded-full bg-butter-100 px-3 py-1.5 text-[11px] font-black text-butter-700 hover:bg-butter-200">
                    طلب إرجاع
                  </button>
                )}
                {o.status === "pending" && (
                  cancelId === o.id ? (
                    <span className="flex items-center gap-1.5">
                      <button onClick={() => cancel(o.id)} className="rounded-full bg-blush-500 px-3 py-1.5 text-[11px] font-black text-white">نعم، إلغاء</button>
                      <button onClick={() => setCancelId(null)} className="rounded-full bg-ink/5 px-3 py-1.5 text-[11px] font-black">تراجع</button>
                    </span>
                  ) : (
                    <button onClick={() => setCancelId(o.id)} className="rounded-full bg-blush-50 px-3 py-1.5 text-[11px] font-black text-blush-600 hover:bg-blush-100">
                      إلغاء الطلب
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FavoritesTab({ favProducts }: { favProducts: Map<number, ProductDTO> }) {
  const { favorites } = useFavorites();
  if (favorites.length === 0)
    return (
      <div className="card-bubble p-10 text-center">
        <Heart className="mx-auto text-blush-400" size={36} />
        <p className="mt-3 font-black">مفضلتج فارغة</p>
        <p className="mt-1 text-sm font-semibold text-ink-soft">دوسي على القلب فوق أي منتج يعجبج حتى ينحفظ هنا</p>
      </div>
    );
  const list = favorites
    .map((f) => favProducts.get(f.productId))
    .filter((x): x is ProductDTO => Boolean(x));
  if (list.length === 0)
    return <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">{favorites.map((f) => <div key={f.productId} className="shimmer aspect-[3/4.6] rounded-[1.75rem]" />)}</div>;
  return (
    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4 md:gap-5">
      {list.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
    </div>
  );
}

function CouponsTab({ coupons }: { coupons: CouponDTO[] }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState("");
  const copy = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(code);
    toast("انحفظ الكود — استخدميه بالسلة!");
    setTimeout(() => setCopied(""), 1600);
  };
  const tones = ["from-blush-200 to-lilac-200", "from-aqua-200 to-minty-200", "from-butter-200 to-blush-200", "from-lilac-200 to-aqua-200"];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {coupons.map((c, i) => (
        <div key={c.id} className={`ticket-edge relative overflow-hidden rounded-2xl bg-gradient-to-l ${tones[i % tones.length]} p-5 shadow-soft`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-black text-ink/60"><TicketPercent size={13} /> كوبون خصم</p>
              <p className="mt-1 text-xl font-black tracking-wider" dir="ltr">{c.code}</p>
              <p className="mt-1 text-[11px] font-bold text-ink/70">
                {c.type === "percent" ? `خصم ${c.value}%` : `خصم ${formatIQD(c.value)}`} — الحد الأدنى {formatIQD(c.minSubtotal)}
              </p>
              {c.description && <p className="mt-1 text-[10px] font-semibold text-ink/55">{c.description}</p>}
            </div>
            <button onClick={() => copy(c.code)} className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-ink shadow-soft transition-transform hover:scale-110 active:scale-90" aria-label="نسخ">
              {copied === c.code ? <Check size={17} className="text-minty-500" /> : <Copy size={17} />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

type Address = {
  id: number;
  governorate: string;
  district: string | null;
  detail: string;
  createdAt: string;
};

function AddressesTab() {
  const { toast } = useToast();
  const [list, setList] = useState<Address[] | null>(null);
  const [gov, setGov] = useState("بغداد");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/customer/addresses")
      .then((r) => r.json())
      .then((d) => setList(d.addresses ?? []))
      .catch(() => setList([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (detail.trim().length < 5) return toast("اكتبي العنوان التفصيلي (5 أحرف على الأقل)", "err");
    setBusy(true);
    try {
      const r = await fetch("/api/customer/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ governorate: gov, detail: detail.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "تعذر حفظ العنوان");
      setDetail("");
      toast("انحفظ العنوان على حسابك");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "تعذر حفظ العنوان", "err");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    const r = await fetch(`/api/customer/addresses?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      toast("انحذف العنوان");
      load();
    } else toast("تعذر حذف العنوان", "err");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        {list === null && <div className="shimmer h-24 rounded-3xl" />}
        {list?.length === 0 && (
          <div className="card-bubble p-8 text-center text-sm font-bold text-ink-soft">ما عندج عناوين محفوظة — ضيفي عنوان البيت أو الشغل</div>
        )}
        {list?.map((a) => (
          <div key={a.id} className="card-bubble flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-aqua-100 text-aqua-600"><MapPin size={18} /></span>
              <div>
                <p className="text-sm font-black">{a.governorate}{a.district ? ` — ${a.district}` : ""}</p>
                <p className="text-xs font-semibold text-ink-soft">{a.detail}</p>
              </div>
            </div>
            <button onClick={() => remove(a.id)} className="text-xs font-black text-blush-600 hover:underline">حذف</button>
          </div>
        ))}
      </div>
      <div className="card-bubble h-fit p-5">
        <h4 className="mb-3 text-sm font-black">إضافة عنوان جديد</h4>
        <select value={gov} onChange={(e) => setGov(e.target.value)} className="field cursor-pointer text-sm font-black">
          {GOVERNORATES.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
        </select>
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} placeholder="الحي / الزقاق / أقرب نقطة دالة" className="field mt-2.5 text-sm" />
        <button
          onClick={add}
          disabled={busy}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3 text-sm font-black text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
          حفظ العنوان
        </button>
        <p className="mt-2 text-[10px] font-bold text-ink-faint">العنوان يُحفظ على حسابك ويظهر بأي جهاز تدخلين منه برقمك</p>
      </div>
    </div>
  );
}

function ProfileTab({ customer }: { customer: { name: string; phone: string } }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="card-bubble p-5">
        <p className="text-xs font-black text-ink-faint">الاسم الكامل</p>
        <p className="mt-1 text-lg font-black">{customer.name}</p>
        <div className="my-4 h-px bg-ink/5" />
        <p className="text-xs font-black text-ink-faint">رقم الهاتف العراقي</p>
        <p className="mt-1 text-lg font-black" dir="ltr">{customer.phone}</p>
        <div className="my-4 h-px bg-ink/5" />
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-minty-600"><ShieldCheck size={13} /> حساب موثق برمز SMS</p>
      </div>
      <div className="card-bubble bg-gradient-to-bl from-minty-100 to-aqua-100 p-5">
        <Truck className="text-aqua-600" size={26} />
        <p className="mt-2 text-sm font-black">الإشعارات والعروض</p>
        <p className="mt-1 text-xs font-semibold leading-6 text-ink-soft">
          راح توصلج رسائل SMS عن عروض العيد ورمضان وموسم المدارس — ونحترم وقيج؛ ما نزعجچ أبداً!
        </p>
        <div className="mt-3 flex items-center gap-1.5 text-[11px] font-black text-aqua-700">
          <Star size={12} className="fill-butter-400 text-butter-400" /> الخصومات تُرسل أولاً لمشتركي الرسائل
        </div>
      </div>
    </div>
  );
}
