import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "بدون اتصال" };

export default function OfflinePage() {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 py-10">
      <div className="card-bubble w-full p-8 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-aqua-100 text-aqua-600">
          <WifiOff size={26} />
        </span>
        <h1 className="mt-4 text-xl font-black">ما عندج اتصال بالإنترنت</h1>
        <p className="mt-2 text-sm font-semibold leading-7 text-ink-soft">
          بمجرد رجوع الشبكة تكمّلين تسوقج من وين وقفتي — السلة والمفضلة محفوظين على جهازج.
        </p>
        <Link href="/" className="mt-5 inline-block rounded-full bg-ink px-6 py-3 text-sm font-black text-white">
          إعادة المحاولة
        </Link>
      </div>
    </div>
  );
}
