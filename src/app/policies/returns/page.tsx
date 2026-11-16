import Link from "next/link";
import { RefreshCcw } from "lucide-react";

export const metadata = { title: "الاستبدال والإرجاع" };

/**
 * سياسة تشغيلية أولية — تُراجع قانونياً قبل الإطلاق.
 * تعكس ما ينفّذه النظام فعلاً: طلب إرجاع من الحساب بعد التسليم، وموافقة الإدارة،
 * وإرجاع جزئي أو كامل مع استعادة المخزون.
 */
export default function ReturnsPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <span className="grid size-14 place-items-center rounded-3xl bg-blush-100 text-blush-600"><RefreshCcw size={24} /></span>
      <h1 className="mt-4 text-2xl font-black">الاستبدال والإرجاع</h1>
      <p className="mt-1 text-xs font-bold text-ink-faint">آخر تحديث: نسخة تشغيلية أولية — تُراجع قانونياً قبل الإطلاق</p>

      <div className="card-bubble mt-6 space-y-5 p-6 text-sm font-semibold leading-8 text-ink-soft">
        <section>
          <h2 className="text-base font-black text-ink">مدة الإرجاع</h2>
          <p>يمكن طلب الإرجاع خلال 7 أيام من استلام الطلب، بشرط أن تكون القطع غير مستخدمة وبطاقاتها الأصلية سليمة.</p>
        </section>
        <section>
          <h2 className="text-base font-black text-ink">كيف أطلب الإرجاع؟</h2>
          <ol className="mt-1 list-decimal space-y-1 pr-5">
            <li>افتحي <Link href="/account" className="font-black text-lilac-600 underline">حسابك</Link> ← الطلبات ← «طلب إرجاع» على الطلب المُسلَّم.</li>
            <li>يتواصل فريق باربي معك لتأكيد القطع والسبب.</li>
            <li>تسجّل الإدارة الإرجاع (كلياً أو جزئياً)، ويُعاد المخزون تلقائياً في النظام.</li>
          </ol>
        </section>
        <section>
          <h2 className="text-base font-black text-ink">المبلغ المسترد</h2>
          <p>يُحسب من سعر القطع المُرجَعة كما في الفاتورة. أجرة التوصيل تُعاد كاملة إذا أُرجع الطلب بكامله، ولا تُعاد في الإرجاع الجزئي.</p>
        </section>
        <section>
          <h2 className="text-base font-black text-ink">القطع غير القابلة للإرجاع</h2>
          <p>الملابس الداخلية ومنتجات العناية الشخصية المفتوحة، والقطع التي عليها آثار استخدام أو غسيل.</p>
        </section>
        <section>
          <h2 className="text-base font-black text-ink">الاستبدال</h2>
          <p>الاستبدال بمقاس أو لون آخر يتبع نفس الخطوات: إرجاع القطعة ثم طلب جديد. إذا كان الخطأ منّا (مقاس أو لون مختلف عن الفاتورة) نتحمّل أجرة التوصيل كاملة.</p>
        </section>
      </div>
    </div>
  );
}
