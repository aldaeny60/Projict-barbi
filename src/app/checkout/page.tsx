"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2, ChevronRight, Loader2, MessageCircle, MapPin, User, ShieldCheck,
  ShoppingBag, Receipt, Truck,
} from "lucide-react";
import { useCart, useCustomer, useToast } from "@/components/providers";
import { formatIQD, fmtDateTime, isValidIraqiPhone } from "@/lib/format";
import { GOVERNORATES } from "@/lib/data";
import { PAYMENT_GATEWAYS } from "@/lib/payments";
import { newRequestId } from "@/lib/request-id";
import type { DeliveryFeeDTO } from "@/lib/types";

type SavedAddress = {
  id: number;
  governorate: string;
  district: string | null;
  detail: string;
  createdAt: string;
};

type Invoice = {
  code: string;
  customerName: string;
  phone: string;
  governorate: string;
  address: string;
  items: { name: string; qty: number; price: number; size: string | null; color: string | null }[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  createdAt: string;
};

export default function CheckoutPage() {
  const router = useRouter();
  const { lines, subtotal, clear } = useCart();
  const { toast } = useToast();
  const { customer } = useCustomer();

  const [fees, setFees] = useState<DeliveryFeeDTO[]>([]);
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [gov, setGov] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState("cod");
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [mounted, setMounted] = useState(false);
  const [smsState, setSmsState] = useState<string>("skipped");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!requestIdRef.current) requestIdRef.current = newRequestId();
  }, []);

  /* عناوين الزبونة المحفوظة على حسابها + تعبئة الاسم والرقم */
  useEffect(() => {
    if (!customer) { setSavedAddresses([]); return; }
    setName((prev) => prev || customer.name);
    setPhone((prev) => prev || customer.phone);
    fetch("/api/customer/addresses")
      .then((r) => r.json())
      .then((d) => setSavedAddresses(d.addresses ?? []))
      .catch(() => {});
  }, [customer]);

  const applySaved = (a: SavedAddress) => {
    setGov(a.governorate);
    setDistrict(a.district ?? "");
    setAddress(a.detail);
  };

  useEffect(() => {
    setMounted(true);
    fetch("/api/delivery").then((r) => r.json()).then((d) => setFees(d.fees ?? [])).catch(() => {});
    try {
      const pref = JSON.parse(localStorage.getItem("sighar_pref_v1") ?? "null");
      if (pref) {
        setGov(pref.governorate ?? "");
        setDistrict(pref.district ?? "");
        if (pref.couponCode) {
          setCouponCode(pref.couponCode);
          fetch("/api/coupons/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: pref.couponCode, subtotal }),
          }).then((r) => r.json()).then((d) => { if (d.valid) setDiscount(d.discount); }).catch(() => {});
        }
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fee = fees.find((f) => f.governorate === gov);
  const districts = useMemo(() => GOVERNORATES.find((g) => g.name === gov)?.districts ?? [], [gov]);
  const total = Math.max(0, subtotal - discount) + (fee?.fee ?? 0);

  const canSubmit = name.trim().length >= 2 && isValidIraqiPhone(phone) && gov && address.trim().length >= 5 && lines.length > 0;

  const placeOrder = async () => {
    if (!canSubmit) {
      toast("كملي البيانات المطلوبة بالأعلى", "err");
      return;
    }
    setPlacing(true);
    try {
      const requestId = requestIdRef.current ?? newRequestId();
      requestIdRef.current = requestId;
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name.trim(),
          phone: phone.trim(),
          governorate: gov,
          district,
          address: address.trim(),
          notes: notes.trim() || undefined,
          paymentMethod: method,
          couponCode: couponCode || undefined,
          requestId,
          items: lines.map((l) => ({ productId: l.productId, qty: l.qty, size: l.size, color: l.color })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "تعذر إنشاء الطلب");
      setInvoice(d.invoice);
      setSmsState(d.notifications?.sms ?? "skipped");
      // مفتاح جديد للطلب القادم — إعادة إرسال هذا الطلب لن تُنشئ نسخة ثانية
      requestIdRef.current = newRequestId();
      clear();
      localStorage.removeItem("sighar_pref_v1");
    } catch (e) {
      toast(e instanceof Error ? e.message : "تعذر إنشاء الطلب", "err");
    } finally {
      setPlacing(false);
    }
  };

  if (!mounted) return <div className="mx-auto max-w-5xl px-4 py-10"><div className="shimmer h-96 rounded-3xl" /></div>;

  /* ─── success screen ─── */
  if (invoice) {
    const gw = PAYMENT_GATEWAYS.find((g) => g.id === invoice.paymentMethod);
    const waText = encodeURIComponent(
      `فاتورة باربي ${invoice.code}\nالاسم: ${invoice.customerName}\nالمحافظة: ${invoice.governorate}\n` +
        invoice.items.map((i) => `• ${i.name} (${i.size ?? ""}/${i.color ?? ""}) ×${i.qty} = ${(i.price * i.qty).toLocaleString("en-US")} د.ع`).join("\n") +
        `\nالمجموع: ${invoice.subtotal.toLocaleString("en-US")} د.ع\nالخصم: -${invoice.discount.toLocaleString("en-US")} د.ع\nالتوصيل: ${invoice.deliveryFee.toLocaleString("en-US")} د.ع\nالإجمالي: ${invoice.total.toLocaleString("en-US")} د.ع\nطريقة الدفع: ${gw?.name ?? invoice.paymentMethod}\nشكراً لتسوقكم من باربي!`
    );
    return (
      <div className="mx-auto max-w-2xl px-3 py-10 md:px-6">
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} className="card-bubble overflow-hidden">
          <div className="bg-gradient-to-l from-minty-200 to-aqua-100 p-8 text-center">
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.15 }}
              className="mx-auto grid size-20 place-items-center rounded-full bg-white shadow-pop"
            >
              <CheckCircle2 size={40} className="text-minty-500" />
            </motion.span>
            <h1 className="mt-4 text-2xl font-black">طلبج انسجل بنجاح!</h1>
            <p className="mt-1 text-sm font-bold text-ink-soft">
              رقم الفاتورة: <span className="font-black text-ink" dir="ltr">{invoice.code}</span>
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-1.5 text-center text-[11px] font-black text-minty-700">
              <MessageCircle size={12} />
              {smsState === "sent"
                ? <>تم إرسال نسخة الفاتورة SMS إلى {invoice.phone}</>
                : <>احتفظي برقم الفاتورة — شاركيها عبر واتساب وسنتصل بك للتأكيد</>}
            </p>
          </div>

          <div className="p-6">
            <div className="ticket-edge rounded-2xl bg-paper p-4">
              <div className="mb-3 flex items-center justify-between border-b border-dashed border-ink/15 pb-3">
                <span className="flex items-center gap-1.5 text-xs font-black text-ink-soft"><Receipt size={14} /> تفاصيل الفاتورة</span>
                <span className="text-[11px] font-bold text-ink-faint">{fmtDateTime(invoice.createdAt)}</span>
              </div>
              <div className="space-y-2 text-xs font-bold">
                {invoice.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between gap-2">
                    <span className="flex-1">{i.name} <span className="text-ink-faint">({i.size ?? "-"}/{i.color ?? "-"}) ×{i.qty}</span></span>
                    <span className="shrink-0">{formatIQD(i.price * i.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1.5 border-t border-dashed border-ink/15 pt-3 text-xs font-bold">
                <div className="flex justify-between text-ink-soft"><span>المجموع الفرعي</span><span>{formatIQD(invoice.subtotal)}</span></div>
                {invoice.discount > 0 && <div className="flex justify-between text-minty-600"><span>الخصم</span><span>−{formatIQD(invoice.discount)}</span></div>}
                <div className="flex justify-between text-ink-soft"><span>التوصيل</span><span>{formatIQD(invoice.deliveryFee)}</span></div>
                <div className="flex justify-between pt-1 text-base font-black text-ink"><span>الإجمالي</span><span className="text-blush-600">{formatIQD(invoice.total)}</span></div>
                <div className="flex justify-between text-ink-soft"><span>الدفع</span><span>{gw?.name ?? invoice.paymentMethod}</span></div>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <a
                href={`https://wa.me/?text=${waText}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl bg-minty-500 py-3.5 text-sm font-black text-white transition-transform hover:scale-[1.02]"
              >
                <MessageCircle size={16} /> مشاركة الفاتورة واتساب
              </a>
              <Link href="/account" className="flex items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-sm font-black text-white transition-transform hover:scale-[1.02]">
                <ShoppingBag size={16} /> تتبعي طلبج من حسابج
              </Link>
            </div>
            <Link href="/shop" className="mt-3 flex items-center justify-center gap-1 py-2 text-xs font-black text-ink-soft hover:text-ink">
              أكملي التسوق <ChevronRight size={13} />
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-3 py-8 md:px-6">
      {/* steps */}
      <div className="mb-8 flex items-center justify-center gap-2 text-xs font-black">
        {["السلة", "التوصيل والدفع", "الفاتورة"].map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 ${i === 1 ? "bg-ink text-white" : i === 0 ? "bg-minty-100 text-minty-700" : "bg-white text-ink-faint"}`}>
              {i === 0 && <CheckCircle2 size={13} />} {s}
            </span>
            {i < 2 && <ChevronRight size={13} className="text-ink-faint" />}
          </span>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* contact */}
          <div className="card-bubble p-5">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-black"><User size={18} className="text-blush-500" /> معلومات الاستلام</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المستلم/ة الكامل" className="field" />
              <div>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="07XX XXX XXXX"
                  className="field"
                  dir="ltr"
                  inputMode="tel"
                  maxLength={11}
                />
                <p className={`mt-1 pr-1 text-[10px] font-bold ${phone && !isValidIraqiPhone(phone) ? "text-blush-600" : "text-ink-faint"}`}>
                  رقم عراقي — يبدأ بـ 075/077/078/079
                </p>
              </div>
            </div>
          </div>

          {/* address */}
          <div className="card-bubble p-5">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-black"><MapPin size={18} className="text-aqua-500" /> عنوان التوصيل</h3>
            {savedAddresses.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-black text-ink-faint">عناويني المحفوظة:</span>
                {savedAddresses.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => applySaved(a)}
                    className="rounded-full bg-aqua-100 px-3 py-1.5 text-[10px] font-black text-aqua-700 transition-colors hover:bg-aqua-200"
                  >
                    {a.governorate}{a.district ? ` — ${a.district}` : ""}
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={gov} onChange={(e) => { setGov(e.target.value); setDistrict(""); }} className="field cursor-pointer font-black">
                <option value="">المحافظة…</option>
                {fees.map((f) => (
                  <option key={f.id} value={f.governorate}>{f.governorate} — {formatIQD(f.fee)}</option>
                ))}
              </select>
              <select value={district} onChange={(e) => setDistrict(e.target.value)} className="field cursor-pointer" disabled={!gov}>
                <option value="">{gov ? "القضاء / الناحية…" : "اختاري المحافظة أولاً"}</option>
                {districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="العنوان التفصيلي + أقرب نقطة دالة (مثال: المنصور، قرب مول بغداد، زقاق 12)" rows={2} className="field mt-3" />
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات للمندوب (اختياري)" className="field mt-3" />
            {fee && (
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-aqua-50 px-3 py-2 text-[11px] font-bold text-aqua-700">
                <Truck size={13} /> {fee.carrier} — الوصول المتوقع {fee.eta} — الأجرة {formatIQD(fee.fee)}
              </p>
            )}
          </div>

          {/* payment */}
          <div className="card-bubble p-5">
            <h3 className="mb-1 flex items-center gap-2 text-lg font-black"><ShieldCheck size={18} className="text-minty-500" /> طريقة الدفع</h3>
            <p className="mb-4 text-xs font-bold text-ink-faint">
              الدفع عند الاستلام يُؤكَّد هاتفياً. البوابات الإلكترونية معروضة للتحويل — يُنسّق فريق باربي إتمامها معك، والربط المباشر قيد التفعيل.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {PAYMENT_GATEWAYS.map((g) => {
                const active = method === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => setMethod(g.id)}
                    className={`group relative overflow-hidden rounded-2xl border-2 p-3.5 text-right transition-all active:scale-[0.98] ${
                      active ? "border-ink bg-paper shadow-soft" : "border-ink/8 bg-white hover:border-ink/25"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${g.bg} text-white shadow-soft`}>
                        <g.icon size={19} />
                      </span>
                      <div className="flex-1">
                        <p className="flex items-center gap-2 text-sm font-black">
                          {g.name}
                          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[9px] font-black text-ink-soft">{g.chip}</span>
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[10px] font-bold text-ink-soft">{g.desc}</p>
                      </div>
                      <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${active ? "border-ink bg-ink" : "border-ink/20"}`}>
                        {active && <CheckCircle2 size={12} className="text-white" />}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* summary */}
        <div className="card-bubble sticky top-32 p-5">
          <h3 className="text-lg font-black">طلبج باختصار</h3>
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pl-1">
            {lines.length === 0 && <p className="py-6 text-center text-xs font-bold text-ink-faint">السلة فارغة — ارجعي للتسوق</p>}
            {lines.map((l) => (
              <div key={`${l.productId}-${l.size}-${l.color}`} className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.image} alt={l.name} className="size-11 rounded-xl object-cover" />
                <div className="flex-1">
                  <p className="line-clamp-1 text-[11px] font-black">{l.name}</p>
                  <p className="text-[10px] font-bold text-ink-faint">{l.size} • {l.color} • ×{l.qty}</p>
                </div>
                <span className="text-[11px] font-black text-blush-600">{formatIQD(l.price * l.qty)}</span>
              </div>
            ))}
          </div>
          <dl className="mt-4 space-y-2 border-t-2 border-dashed border-ink/10 pt-3 text-xs font-bold">
            <div className="flex justify-between"><dt className="text-ink-soft">المجموع الفرعي</dt><dd>{formatIQD(subtotal)}</dd></div>
            {discount > 0 && <div className="flex justify-between text-minty-600"><dt>خصم {couponCode}</dt><dd>−{formatIQD(discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-ink-soft">التوصيل</dt><dd>{fee ? formatIQD(fee.fee) : "—"}</dd></div>
            <div className="flex justify-between border-t-2 border-dashed border-ink/10 pt-2 text-base font-black">
              <dt>الإجمالي</dt><dd className="text-blush-600">{formatIQD(total)}</dd>
            </div>
          </dl>
          <button
            onClick={placeOrder}
            disabled={placing || lines.length === 0}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-blush-500 to-lilac-500 py-4 text-sm font-black text-white shadow-pop transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
          >
            {placing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {placing ? "جاري تأكيد الطلب…" : "تأكيد الطلب"}
          </button>
          {!canSubmit && lines.length > 0 && (
            <p className="mt-2 text-center text-[10px] font-bold text-blush-600">أكملي الاسم والرقم والعنوان حتى يتفعل التأكيد</p>
          )}
        </div>
      </div>
    </div>
  );
}
