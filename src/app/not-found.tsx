import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <div className="card-bubble max-w-md overflow-hidden p-10 text-center">
        <div className="animate-floaty mx-auto grid size-24 place-items-center rounded-[2rem] bg-gradient-to-br from-butter-200 via-blush-100 to-lilac-200">
          <span className="text-4xl font-black text-ink">404</span>
        </div>
        <h1 className="mt-5 text-2xl font-black">ضعنا شوية بالرفوف!</h1>
        <p className="mt-2 text-sm font-semibold leading-7 text-ink-soft">
          الصفحة اللي تدورين عليها مو موجودة — يمكن انتقلت أو انتهى عرضها. بس أكو أشياء أحلى تنتظرچ بالمتجر.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/" className="rounded-full bg-ink px-6 py-3 text-sm font-black text-white transition-transform hover:scale-105">الرئيسية</Link>
          <Link href="/shop?deals=1&sort=deals" className="rounded-full bg-butter-200 px-6 py-3 text-sm font-black text-butter-700 transition-transform hover:scale-105">عروض اليوم</Link>
        </div>
      </div>
    </div>
  );
}
