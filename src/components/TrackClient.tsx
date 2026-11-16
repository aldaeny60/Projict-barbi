"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Loader2, MessageCircle, Package, Phone, Search, ShieldCheck, ShoppingBag } from "lucide-react";
import { useCustomer } from "./providers";
import { fmtDateTime, formatIQD, isValidIraqiPhone } from "@/lib/format";
import { ORDER_STATUS_META, ORDER_STATUS_TONE } from "@/lib/data";
import { gatewayById } from "@/lib/payments";
import { whatsappLink } from "@/lib/site";

const STEPS = ["قيد التأكيد", "قيد التجهيز", "تم الشحن", "قيد التوصيل", "تم التسليم"];

type TrackItem = {
  id: number;
  name: string;
  image: string | null;
  price: number;
  qty: number;
  size: string | null;
  color: string | null;
};

type TrackOrder = {
  id?: number;
  code: string;
  status: string;
  createdAt: string;
  governorate: string | null;
  phone?: string;
  address?: string | null;
  paymentMethod?: string;
  subtotal?: number;
  discountTotal?: number;
  couponCode?: string | null;
  deliveryFee?: number;
  total?: number;
  items?: TrackItem[];
  pieces?: number;
  itemsPreview?: { name: string; qty: number }[];
};

/**
 * تتبع الطلب — مستويان:
 *  1) جلسة موثّقة (OTP): كل الطلبات بالتفاصيل والإجمالي.
 *  2) بلا جلسة: يلزم رقم الهاتف + رقم الطلب، والرد مخفّف (بلا اسم/عنوان/إجمالي).
 * الخادم هو من يفرض ذلك؛ الواجهة فقط تعرض ما وصلها.
 */
export function TrackClient() {
  const sp = useSearchParams();
  const { customer } = useCustomer();

  const [phone, setPhone] = useState((sp.get("phone") ?? "").replace(/\s/g, ""));
  const [code, setCode] = useState(sp.get("code") ?? "");
  const [orders, setOrders] = useState<TrackOrder[] | null>(null);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  const search = useCallback(async (rawPhone: string, rawCode: string) => {
    const p = rawPhone.replace(/\s/g, "");
    const c = rawCode.trim();
    if (!isValidIraqiPhone(p)) {
      setError("رقم عراقي غير صالح — لازم يبدأ بـ 07 ويتكون من 11 رقماً");
      setOrders(null);
      return;
    }
    setError("");
    setHint("");
    setBusy(true);
    try {
      const qs = new URLSearchParams({ phone: p });
      if (c) qs.set("code", c);
      const r = await fetch(`/api/track?${qs}`);
      const d = await r.json();
      if (r.status === 401) {
        setOrders([]);
        setVerified(false);
        setHint(d.message ?? "أضيفي رقم الطلب أو وثّقي رقمك برمز SMS");
        return;
      }
      if (!r.ok) throw new Error(d.error ?? "تعذر جلب الطلبات");
      setOrders(Array.isArray(d.orders) ? (d.orders as TrackOrder[]) : []);
      setVerified(Boolean(d.verified));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الاتصال بالخادم");
      setOrders(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const initialPhone = (sp.get("phone") ?? "").replace(/\s/g, "") || customer?.phone || "";
    if (!initialPhone) return;
    setPhone(initialPhone);
    void search(initialPhone, sp.get("code") ?? "");
  }, [sp, customer, search]);

  const sorted = orders
    ? [...orders].sort((a, b) => (a.code === code ? -1 : b.code === code ? 1 : 0))
    : null;

  return (
    <>
      <div className="card-bubble mt-4 p-5">
        <div className="relative">
          <Phone size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blush-400" />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && search(phone, code)}
            placeholder="07XX XXX XXXX"
            dir="ltr"
            inputMode="tel"
            maxLength={11}
            className="field pr-11 text-center text-lg tracking-widest"
          />
        </div>
        <div className="relative mt-2.5">
          <Package size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-lilac-400" />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && search(phone, code)}
            placeholder="رقم الطلب — مثل SG-10047"
            dir="ltr"
            className="field pr-11 text-center text-sm tracking-wider"
          />
        </div>
        {error && <p className="mt-2 text-center text-[11px] font-black text-blush-600">{error}</p>}
        <button
          onClick={() => search(phone, code)}
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-sm font-black text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          تتبعي الطلب
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[10px] font-bold text-ink-soft">
          <ShieldCheck size={12} className="text-minty-500" />
          بلا تسجيل دخول نطلب رقم الطلب لحماية خصوصيتك — وثّقي رقمك برمز SMS لتشوفي كل طلباتك.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        {busy && (
          <div className="space-y-3">
            <div className="shimmer h-40 rounded-3xl" />
            <div className="shimmer h-40 rounded-3xl" />
          </div>
        )}

        {!busy && hint && (
          <div className="card-bubble bg-butter-50 p-5 text-center">
            <p className="text-sm font-black text-butter-700">{hint}</p>
            <Link
              href="/account"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-xs font-black text-white"
            >
              <ShieldCheck size={13} /> توثيق الرقم برمز SMS
            </Link>
          </div>
        )}

        {!busy && sorted && sorted.length === 0 && !hint && (
          <div className="card-bubble p-10 text-center">
            <Package className="mx-auto text-lilac-400" size={36} />
            <p className="mt-3 font-black">ما لكينا طلبات مطابقة</p>
            <p className="mt-1 text-sm font-semibold text-ink-soft">
              تأكدي من رقم الهاتف والرقم نفسه المكتوب بالفاتورة — أو راسلي فريق باربي.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Link href="/shop" className="rounded-full bg-ink px-5 py-2.5 text-xs font-black text-white">
                تسوقي هسة
              </Link>
              <a
                href={whatsappLink("مرحباً باربي، ما لكيت طلبي في صفحة التتبع")}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-minty-100 px-5 py-2.5 text-xs font-black text-minty-700"
              >
                راسلي الدعم
              </a>
            </div>
          </div>
        )}

        {!busy &&
          sorted &&
          sorted.map((o) => (
            <OrderTrackCard key={o.code} order={o} highlight={o.code === code} verified={verified} />
          ))}

        {!busy && !sorted && !error && (
          <p className="text-center text-[11px] font-bold text-ink-faint">
            الطلبات تظهر هنا بعد البحث برقم الهاتف ورقم الطلب.
          </p>
        )}
      </div>
    </>
  );
}

function OrderTrackCard({
  order: o,
  highlight,
  verified,
}: {
  order: TrackOrder;
  highlight: boolean;
  verified: boolean;
}) {
  const meta = ORDER_STATUS_META[o.status] ?? ORDER_STATUS_META.pending;
  const step = meta.step;
  const stopped = ["cancelled", "returned", "return_requested"].includes(o.status);
  const items = o.items ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card-bubble overflow-hidden ${highlight ? "ring-4 ring-blush-200" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed border-ink/8 px-5 py-4">
        <div>
          <p className="text-sm font-black" dir="ltr">{o.code}</p>
          <p className="text-[11px] font-bold text-ink-faint">{fmtDateTime(o.createdAt)}</p>
        </div>
        <span className={`rounded-full px-3.5 py-1.5 text-xs font-black ${ORDER_STATUS_TONE[o.status] ?? "bg-ink/5 text-ink-soft"}`}>
          {meta.label}
        </span>
      </div>

      {!stopped && step > 0 && (
        <div className="px-5 pt-4">
          <div className="flex items-center" dir="ltr">
            {STEPS.map((s, i) => {
              const done = i < step;
              const current = i === step - 1;
              return (
                <div key={s} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center">
                    <span
                      className={`grid size-7 place-items-center rounded-full text-[10px] font-black transition-all ${
                        done
                          ? current
                            ? "bg-lilac-500 text-white ring-4 ring-lilac-100"
                            : "bg-minty-400 text-white"
                          : "bg-ink/8 text-ink-faint"
                      }`}
                    >
                      {done ? <Check size={12} /> : i + 1}
                    </span>
                    <span className={`mt-1.5 hidden text-[9px] font-black sm:block ${done ? "text-ink" : "text-ink-faint"}`}>{s}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <span className={`mx-1 h-1 flex-1 rounded-full ${i < step - 1 ? "bg-minty-400" : "bg-ink/8"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2 px-5 py-4">
        {items.length > 0
          ? items.map((it) => (
              <div key={it.id} className="flex items-center gap-3">
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt="" className="size-12 rounded-xl object-cover ring-2 ring-paper" />
                ) : (
                  <span className="grid size-12 place-items-center rounded-xl bg-ink/5 text-ink-faint">
                    <Package size={16} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-black leading-snug">{it.name}</p>
                  <p className="text-[10px] font-bold text-ink-faint">
                    {[it.size, it.color].filter(Boolean).join(" • ")} • الكمية {it.qty}
                  </p>
                </div>
                {verified && <span className="text-xs font-black text-ink-soft">{formatIQD(it.price * it.qty)}</span>}
              </div>
            ))
          : (o.itemsPreview ?? []).map((it, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2">
                <span className="flex items-center gap-2 text-[12px] font-black">
                  <ShoppingBag size={13} className="text-lilac-400" /> {it.name}
                </span>
                <span className="text-[11px] font-black text-ink-soft">×{it.qty}</span>
              </div>
            ))}
      </div>

      {verified && o.subtotal !== undefined && (
        <div className="space-y-1.5 border-t-2 border-dashed border-ink/8 px-5 py-4 text-[12px] font-bold text-ink-soft">
          <div className="flex items-center justify-between">
            <span>المجموع الفرعي</span>
            <span className="font-black text-ink">{formatIQD(o.subtotal)}</span>
          </div>
          {(o.discountTotal ?? 0) > 0 && (
            <div className="flex items-center justify-between text-minty-600">
              <span>الخصم {o.couponCode ? `(${o.couponCode})` : ""}</span>
              <span className="font-black">− {formatIQD(o.discountTotal ?? 0)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span>التوصيل</span>
            <span className="font-black text-ink">{(o.deliveryFee ?? 0) > 0 ? formatIQD(o.deliveryFee ?? 0) : "مجاني"}</span>
          </div>
          <div className="flex items-center justify-between border-t border-ink/8 pt-1.5 text-sm">
            <span className="font-black">الإجمالي</span>
            <span className="font-black text-blush-600">{formatIQD(o.total ?? 0)}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 bg-paper/70 px-5 py-3 text-[11px] font-bold text-ink-soft">
        <span>
          {verified ? (
            <>
              {o.paymentMethod ? gatewayById(o.paymentMethod).name : ""}
              {o.governorate ? ` • ${o.governorate}` : ""}
              {o.phone ? ` • ${o.phone}` : ""}
            </>
          ) : (
            <>
              {o.governorate ? `${o.governorate} • ` : ""}
              {(o.itemsPreview ?? []).reduce((s, i) => s + i.qty, 0)} قطعة
            </>
          )}
        </span>
        <a
          href={whatsappLink(`مرحباً باربي، بخصوص الطلب ${o.code}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full bg-minty-100 px-3.5 py-1.5 font-black text-minty-700 transition-transform hover:scale-105"
        >
          <MessageCircle size={13} /> استفسار
        </a>
      </div>
    </motion.div>
  );
}
