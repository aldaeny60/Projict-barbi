import { ShieldCheck } from "lucide-react";

export const metadata = { title: "سياسة الخصوصية" };

/** سياسة تشغيلية أولية — تُراجع قانونياً قبل الإطلاق. تعكس ما يجمعه النظام فعلاً. */
export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <span className="grid size-14 place-items-center rounded-3xl bg-aqua-100 text-aqua-700"><ShieldCheck size={24} /></span>
      <h1 className="mt-4 text-2xl font-black">سياسة الخصوصية</h1>
      <p className="mt-1 text-xs font-bold text-ink-faint">آخر تحديث: نسخة تشغيلية أولية — تُراجع قانونياً قبل الإطلاق</p>

      <div className="card-bubble mt-6 space-y-5 p-6 text-sm font-semibold leading-8 text-ink-soft">
        <section>
          <h2 className="text-base font-black text-ink">ما نجمعه</h2>
          <ul className="mt-1 list-disc space-y-1 pr-5">
            <li>رقم الهاتف العراقي — لتوثيق الدخول برمز SMS ومتابعة الطلبات.</li>
            <li>الاسم والعنوان والمحافظة — لتوصيل الطلب وحساب الأجرة.</li>
            <li>الطلبات والمفضلة والعناوين المحفوظة — داخل حسابك لتسهيل الشراء.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-black text-ink">كيف نحميها</h2>
          <p>البيانات على خوادمنا فقط. جلسات الدخول موقّعة وتنتهي بوقت محدد، ورموز الموظفين تُخزَّن مُجزّأة (scrypt) ولا يستطيع أي موظف رؤية رمز زميله. لا نطلب كلمة سر ولا نرسل الرمز في أي استجابة بالإنتاج.</p>
        </section>
        <section>
          <h2 className="text-base font-black text-ink">المشاركة</h2>
          <p>نشارك الاسم والهاتف والعنوان مع شركة التوصيل (زاجل/أرامكس/ناشيونال/توصيل داخلي) فقط لإيصال طلبك. لا نبيع بياناتك ولا نشاركها لأي غرض تسويقي خارج باربي.</p>
        </section>
        <section>
          <h2 className="text-base font-black text-ink">حقوقك</h2>
          <p>يمكنك حذف العناوين والمفضلة من حسابك في أي وقت. لطلب حذف الحساب كاملاً تواصلي معنا عبر واتساب ونجيبك خلال أيام العمل.</p>
        </section>
        <section>
          <h2 className="text-base font-black text-ink">ملفات تعريف الارتباط</h2>
          <p>نستخدم كوكيز ضرورية فقط (جلسة الدخول، وسلة التسوق محلياً في متصفحك). لا كوكيز إعلانية.</p>
        </section>
      </div>
    </div>
  );
}
