import { Suspense } from "react";
import { Package } from "lucide-react";
import { TrackClient } from "@/components/TrackClient";

export const metadata = {
  title: "تتبع طلبك",
  description: "تتبعي حالة طلبك من باربي برقم هاتفك — من التأكيد حتى التسليم.",
};

export default function TrackPage() {
  return (
    <div className="mx-auto max-w-3xl px-3 py-8 md:px-6">
      {/* العنوان مرسوم من الخادم، والبحث التفاعلي داخل TrackClient */}
      <div className="card-bubble overflow-hidden bg-gradient-to-l from-aqua-100 via-blush-50 to-lilac-100 p-6 text-center">
        <span className="mx-auto grid size-16 animate-floaty place-items-center rounded-3xl bg-white shadow-soft">
          <Package className="text-lilac-500" size={27} />
        </span>
        <h1 className="mt-3 text-xl font-black">وين وصل طلبي؟</h1>
        <p className="mt-1 text-xs font-bold text-ink-soft">
          أدخلي رقم الهاتف اللي طلبتي بيه — يطلعلك كل طلباتج وحالتها لحظة بلحظة.
        </p>
      </div>

      <Suspense fallback={<div className="shimmer mt-4 h-60 rounded-3xl" />}>
        <TrackClient />
      </Suspense>
    </div>
  );
}
