import Link from "next/link";
import { Truck, ShieldCheck, RefreshCcw, MessageCircle, Phone, MapPin, Star } from "lucide-react";
import { Logo } from "./Logo";
import { PAYMENT_GATEWAYS } from "@/lib/payments";
import { SITE, whatsappLink } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-16 overflow-hidden rounded-t-[2.5rem] bg-ink text-white">
      {/* trust strip */}
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 border-b border-white/10 px-6 py-8 md:grid-cols-4">
        {[
          { icon: Truck, t: "توصيل 18 محافظة", d: "زاجل • أرامكس • ناشيونال" },
          { icon: ShieldCheck, t: "جودة مضمونة", d: "أقمشة آمنة قطن 100%" },
          { icon: RefreshCcw, t: "إرجاع 7 أيام", d: "استبدال واسترجاع مجاني" },
          { icon: MessageCircle, t: "دعم واتساب", d: "رد سريع من 9ص إلى 11م" },
        ].map((f) => (
          <div key={f.t} className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10">
              <f.icon size={20} className="text-butter-300" />
            </span>
            <span>
              <span className="block text-sm font-black">{f.t}</span>
              <span className="block text-[11px] font-semibold text-white/60">{f.d}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <div className="inline-flex rounded-2xl bg-paper/95 p-3">
            <Logo />
          </div>
          <p className="mt-4 max-w-xs text-sm font-semibold leading-7 text-white/70">
            علامة عراقية لأزياء الأطفال من الولادة حتى 16 سنة. نلبّس أطفالكم البهجة بأقمشة آمنة وألوان باستيل محببة، وبتوصيل يوصل لكل بيت بالعراق.
          </p>
          <div className="mt-5 space-y-2 text-sm font-bold text-white/80">
            <p className="flex items-center gap-2">
              <Phone size={15} className="text-blush-300" />
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" dir="ltr" className="hover:text-butter-300">
                {SITE.supportPhone}
              </a>
              (واتساب واتصال)
            </p>
            <p className="flex items-center gap-2"><MapPin size={15} className="text-blush-300" /> بغداد — المنصور، شارع الأمير</p>
          </div>
        </div>

        <div className="md:col-span-2">
          <h4 className="mb-4 flex items-center gap-1.5 text-sm font-black"><Star size={14} className="fill-butter-300 text-butter-300" /> تسوق</h4>
          <ul className="space-y-2.5 text-sm font-semibold text-white/70">
            <li><Link href="/shop?section=boys" className="hover:text-butter-300">ملابس أولاد</Link></li>
            <li><Link href="/shop?section=girls" className="hover:text-butter-300">ملابس بنات</Link></li>
            <li><Link href="/shop?section=newborn" className="hover:text-butter-300">مواليد 0-24 شهر</Link></li>
            <li><Link href="/shop?deals=1&sort=deals" className="hover:text-butter-300">عروض وخصومات</Link></li>
            <li><Link href="/shop?new=1" className="hover:text-butter-300">وصل حديثاً</Link></li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <h4 className="mb-4 flex items-center gap-1.5 text-sm font-black"><Star size={14} className="fill-butter-300 text-butter-300" /> حسابك</h4>
          <ul className="space-y-2.5 text-sm font-semibold text-white/70">
            <li><Link href="/track" className="hover:text-butter-300">تتبع الطلبات</Link></li>
            <li><Link href="/account?tab=favorites" className="hover:text-butter-300">قائمة المفضلة</Link></li>
            <li><Link href="/cart" className="hover:text-butter-300">سلة المشتريات</Link></li>
            <li><Link href="/pos" className="hover:text-butter-300">صفحة الكاشير (الفروع)</Link></li>
            <li><Link href="/admin" className="hover:text-butter-300">لوحة التحكم</Link></li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <h4 className="mb-4 flex items-center gap-1.5 text-sm font-black"><Star size={14} className="fill-butter-300 text-butter-300" /> طرق الدفع العراقية</h4>
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_GATEWAYS.map((g) => (
              <span key={g.id} className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/85">
                {g.name}
              </span>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-5 font-semibold text-white/50">
            الدفع عند الاستلام هو الخيار المتاح الآن ويُؤكَّد هاتفياً قبل الشحن. بوابات الدفع الإلكتروني معروضة للتحويل ويُنسّق فريقنا إتمامها معك — الربط المباشر قيد التفعيل.
          </p>
        </div>
      </div>

      <div className="border-t border-white/10 py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-6 text-xs font-bold text-white/60">
          <Link href="/policies/returns" className="hover:text-butter-300">الاستبدال والإرجاع</Link>
          <Link href="/policies/privacy" className="hover:text-butter-300">سياسة الخصوصية</Link>
          <Link href="/policies/terms" className="hover:text-butter-300">شروط الاستخدام</Link>
          <Link href="/track" className="hover:text-butter-300">تتبع طلب</Link>
        </div>
        <p className="mt-3 text-center text-xs font-bold text-white/40">
          باربي © {new Date().getFullYear()} — صُنع بحب في بغداد، بتوقيت بغداد (GMT+3)
        </p>
      </div>
    </footer>
  );
}
