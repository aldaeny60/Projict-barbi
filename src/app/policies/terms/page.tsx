import { FileText } from "lucide-react";

export const metadata = { title: "شروط الاستخدام" };

/** شروط تشغيلية أولية — تُراجع قانونياً قبل الإطلاق. */
export default function TermsPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <span className="grid size-14 place-items-center rounded-3xl bg-lilac-100 text-lilac-700"><FileText size={24} /></span>
      <h1 className="mt-4 text-2xl font-black">شروط الاستخدام</h1>
      <p className="mt-1 text-xs font-bold text-ink-faint">آخر تحديث: نسخة تشغيلية أولية — تُراجع قانونياً قبل الإطلاق</p>

      <div className="card-bubble mt-6 space-y-5 p-6 text-sm font-semibold leading-8 text-ink-soft">
        <section>
          <h2 className="text-base font-black text-ink">الأسعار</h2>
          <p>كل الأسعار بالدينار العراقي وتشمل التغليف. أجرة التوصيل تُحسب حسب المحافظة وتظهر بوضوح قبل تأكيد الطلب.</p>
        </section>
        <section>
          <h2 className="text-base font-black text-ink">تأكيد الطلب</h2>
          <p>الطلب يُسجَّل بحالة «قيد التأكيد» ثم نتصل بك لتأكيد العنوان والقطع. لا يُعتبر الطلب نهائياً إلا بعد التأكيد الهاتفي.</p>
        </section>
        <section>
          <h2 className="text-base font-black text-ink">الدفع</h2>
          <p>الخيار المتاح الآن هو الدفع عند الاستلام. بوابات الدفع الإلكتروني معروضة للتحويل، ويُنسّق فريقنا إتمامها معك حتى تفعيل الربط المباشر — لا يُخصم أي مبلغ إلكترونياً قبل ذلك.</p>
        </section>
        <section>
          <h2 className="text-base font-black text-ink">المخزون</h2>
          <p>نحجز المخزون لحظة تأكيد الطلب. إذا نفدت قطعة أثناء الحجز نبلغك ونرشّح بديلاً أو نلغي الطلب دون أي رسوم.</p>
        </section>
        <section>
          <h2 className="text-base font-black text-ink">استخدام الحساب</h2>
          <p>الحساب مرتبط برقم هاتف واحد. أنت مسؤولة عن أي طلب يُنشأ من حسابك، ويمكنك إلغاء أي طلب قبل الشحن من صفحة الطلبات.</p>
        </section>
      </div>
    </div>
  );
}
