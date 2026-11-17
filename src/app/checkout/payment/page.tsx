import Link from "next/link";
import { CheckCircle2, XCircle, AlertTriangle, Receipt } from "lucide-react";

export const metadata = { title: "نتيجة الدفع" };

/**
 * صفحة نتيجة الدفع — يوجّه إليها إشعار البوابة.
 * تعرض الحالة فقط؛ لا تعتبر الدفع ناجحاً من تلقاء نفسها (الخادم هو من يقرر).
 */
export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; code?: string }>;
}) {
  const { status, code } = await searchParams;
  const paid = status === "paid";
  const invalid = status === "invalid" || status === "unknown";
  const Icon = paid ? CheckCircle2 : invalid ? AlertTriangle : XCircle;

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <div className="card-bubble p-8 text-center">
        <span
          className={`mx-auto grid size-20 place-items-center rounded-full ${
            paid ? "bg-minty-100 text-minty-600" : invalid ? "bg-butter-100 text-butter-700" : "bg-blush-100 text-blush-600"
          }`}
        >
          <Icon size={38} />
        </span>
        <h1 className="mt-4 text-xl font-black">
          {paid ? "تم الدفع بنجاح" : invalid ? "لم نتحقق من الدفع" : "لم يكتمل الدفع"}
        </h1>
        <p className="mt-2 text-sm font-semibold leading-7 text-ink-soft">
          {paid
            ? "وصلنا تأكيد الدفع من البوابة، وطلبك الآن مدفوع. سنتصل بك لتأكيد التوصيل."
            : invalid
              ? "رابط العودة غير صالح أو منتهي. إذا خُصم المبلغ تواصل معنا برقم الطلب ونتحقق فوراً."
              : "لم يُكمل الدفع أو لم يطابق المبلغ. يمكنك إعادة المحاولة أو اختيار الدفع عند الاستلام."}
        </p>
        {code && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-paper px-4 py-1.5 text-[11px] font-black" dir="ltr">
            <Receipt size={12} /> {code}
          </p>
        )}
        <div className="mt-6 grid gap-2">
          <Link href="/account?tab=orders" className="rounded-2xl bg-ink py-3 text-sm font-black text-white">
            طلباتي
          </Link>
          <Link href="/shop" className="rounded-2xl bg-paper py-3 text-sm font-black text-ink ring-1 ring-ink/10">
            متابعة التسوق
          </Link>
        </div>
      </div>
    </div>
  );
}
