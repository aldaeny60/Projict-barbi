"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, Trash2, TicketPercent, Truck, ShoppingBag, ArrowLeft, PartyPopper } from "lucide-react";
import { lineKey, useCart, useToast } from "@/components/providers";
import { formatIQD } from "@/lib/format";
import { GOVERNORATES } from "@/lib/data";
import type { DeliveryFeeDTO } from "@/lib/types";

export default function CartPage() {
  const router = useRouter();
  const { lines, setQty, remove, subtotal, clear } = useCart();
  const { toast } = useToast();

  const [fees, setFees] = useState<DeliveryFeeDTO[]>([]);
  const [gov, setGov] = useState("");
  const [district, setDistrict] = useState("");
  const [coupon, setCoupon] = useState("");
  const [couponState, setCouponState] = useState<{ code: string; discount: number; message: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    fetch("/api/delivery").then((r) => r.json()).then((d) => setFees(d.fees ?? [])).catch(() => {});
    try {
      const pref = JSON.parse(localStorage.getItem("sighar_pref_v1") ?? "null");
      if (pref) {
        setGov(pref.governorate ?? "");
        setDistrict(pref.district ?? "");
        if (pref.couponCode) setCoupon(pref.couponCode);
      }
    } catch { /* ignore */ }
  }, []);

  const fee = fees.find((f) => f.governorate === gov);
  const savings = lines.reduce((s, l) => s + (l.compareAtPrice ? (l.compareAtPrice - l.price) * l.qty : 0), 0);
  const discount = couponState?.discount ?? 0;
  const total = Math.max(0, subtotal - discount) + (fee?.fee ?? 0);

  const districts = useMemo(() => GOVERNORATES.find((g) => g.name === gov)?.districts ?? [], [gov]);

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    setChecking(true);
    try {
      const r = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: coupon.trim(), subtotal }),
      });
      const d = await r.json();
      if (d.valid) {
        setCouponState({ code: d.code, discount: d.discount, message: d.message });
        toast(d.message);
      } else {
        setCouponState(null);
        toast(d.message ?? "الكود غير صالح", "err");
      }
    } catch {
      toast("تعذر التحقق من الكود", "err");
    } finally {
      setChecking(false);
    }
  };

  const goCheckout = () => {
    localStorage.setItem(
      "sighar_pref_v1",
      JSON.stringify({ governorate: gov, district, couponCode: couponState?.code ?? "" })
    );
    router.push("/checkout");
  };

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-4 md:grid-cols-[1fr_340px]">
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="shimmer h-28 rounded-3xl" />)}</div>
          <div className="shimmer h-72 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-lg place-items-center px-4">
        <div className="card-bubble relative overflow-hidden p-10 text-center">
          <span className="mx-auto grid size-20 animate-floaty place-items-center rounded-[1.7rem] bg-gradient-to-br from-blush-100 to-lilac-100">
            <ShoppingBag className="text-blush-500" size={34} />
          </span>
          <h2 className="mt-5 text-2xl font-black">سلتج فارغة بعدج!</h2>
          <p className="mt-2 text-sm font-semibold text-ink-soft">خزينة صغارج تستاهل شوية بهجة… شوفي الجديد والعروض</p>
          <Link href="/shop" className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-black text-white transition-transform hover:scale-105">
            ابدئي التسوق <ArrowLeft size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-8 md:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black md:text-3xl">سلة المشتريات</h1>
        <button onClick={() => { clear(); toast("تم تفريغ السلة"); }} className="text-xs font-black text-blush-600 hover:underline">
          تفريغ السلة
        </button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        {/* items */}
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {lines.map((l) => {
              const key = lineKey(l);
              return (
                <motion.div
                  key={key}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 60, height: 0, marginBottom: 0 }}
                  className="card-bubble flex gap-3 overflow-hidden p-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.image} alt={l.name} className="size-24 shrink-0 rounded-2xl object-cover md:size-28" />
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/product/${l.slug || l.productId}`} className="line-clamp-2 text-sm font-black leading-snug hover:text-blush-600">
                        {l.name}
                      </Link>
                      <button onClick={() => { remove(key); toast("انحذف من السلة"); }} className="grid size-8 shrink-0 place-items-center rounded-full bg-blush-50 text-blush-600 transition-transform hover:scale-110" aria-label="حذف">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-aqua-100 px-2.5 py-0.5 text-[10px] font-black text-aqua-700">{l.size}</span>
                      <span className="rounded-full bg-lilac-100 px-2.5 py-0.5 text-[10px] font-black text-lilac-700">{l.color}</span>
                    </div>
                    <div className="mt-auto flex items-end justify-between pt-2">
                      <div className="flex items-center rounded-xl border-2 border-ink/8 bg-paper">
                        <button onClick={() => setQty(key, l.qty - 1)} className="px-3 py-1.5 font-black text-ink-soft hover:text-blush-600"><Minus size={14} /></button>
                        <span className="w-7 text-center text-sm font-black tabular-nums">{l.qty}</span>
                        <button onClick={() => setQty(key, l.qty + 1)} className="px-3 py-1.5 font-black text-ink-soft hover:text-blush-600"><Plus size={14} /></button>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black text-blush-600">{formatIQD(l.price * l.qty)}</p>
                        {l.compareAtPrice && (
                          <p className="text-[10px] font-bold text-ink-faint line-through">{formatIQD(l.compareAtPrice * l.qty)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {savings > 0 && (
            <div className="flex items-center gap-2 rounded-2xl bg-minty-100 px-4 py-3 text-xs font-black text-minty-700">
              <PartyPopper size={15} /> وفّرتي {formatIQD(savings)} من العروض الحالية على هاي القطع!
            </div>
          )}
        </div>

        {/* summary */}
        <div className="card-bubble sticky top-32 p-5">
          <h3 className="text-lg font-black">ملخص الطلب</h3>

          {/* coupon */}
          <div className="mt-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <TicketPercent size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-lilac-400" />
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                  placeholder="كود الخصم — جربي WELCOME10"
                  className="field pr-10 text-sm uppercase"
                  dir="ltr"
                />
              </div>
              <button onClick={applyCoupon} disabled={checking} className="rounded-2xl bg-lilac-500 px-4 text-sm font-black text-white transition-transform hover:scale-105 disabled:opacity-60">
                {checking ? "…" : "تطبيق"}
              </button>
            </div>
            {couponState && (
              <p className="mt-2 rounded-xl bg-minty-100 px-3 py-2 text-[11px] font-black text-minty-700">
                {couponState.message} (−{formatIQD(couponState.discount)})
              </p>
            )}
          </div>

          {/* governorate */}
          <div className="mt-4 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-black text-ink-soft">
              <Truck size={13} /> محافظة التوصيل
            </label>
            <select value={gov} onChange={(e) => { setGov(e.target.value); setDistrict(""); }} className="field cursor-pointer text-sm font-black">
              <option value="">اختاري المحافظة…</option>
              {fees.map((f) => (
                <option key={f.id} value={f.governorate}>
                  {f.governorate} — {formatIQD(f.fee)} ({f.eta})
                </option>
              ))}
            </select>
            {gov && districts.length > 0 && (
              <select value={district} onChange={(e) => setDistrict(e.target.value)} className="field cursor-pointer text-sm">
                <option value="">القضاء / الناحية (اختياري)…</option>
                {districts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}
            {fee && (
              <p className="rounded-xl bg-aqua-50 px-3 py-2 text-[11px] font-bold text-aqua-700">
                التوصيل عبر {fee.carrier} — الوصول المتوقع: {fee.eta}
              </p>
            )}
          </div>

          {/* totals */}
          <dl className="mt-5 space-y-2.5 border-t-2 border-dashed border-ink/10 pt-4 text-sm font-bold">
            <div className="flex justify-between">
              <dt className="text-ink-soft">المجموع الفرعي</dt>
              <dd>{formatIQD(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-minty-600">
                <dt>خصم الكوبون ({couponState?.code})</dt>
                <dd>−{formatIQD(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-ink-soft">التوصيل</dt>
              <dd>{gov ? formatIQD(fee?.fee ?? 0) : "حسب المحافظة"}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t-2 border-dashed border-ink/10 pt-3 text-lg font-black">
              <dt>الإجمالي</dt>
              <dd className="text-blush-600">{formatIQD(total)}</dd>
            </div>
          </dl>

          <button
            onClick={goCheckout}
            disabled={!gov}
            className="mt-5 w-full rounded-2xl bg-gradient-to-l from-blush-500 to-lilac-500 py-4 text-sm font-black text-white shadow-pop transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {gov ? "إتمام الطلب والدفع" : "اختاري المحافظة أولاً"}
          </button>
          <p className="mt-3 text-center text-[11px] font-bold text-ink-faint">دفع آمن • فاتورة رقمية فورية عبر SMS وواتساب</p>
        </div>
      </div>
    </div>
  );
}
