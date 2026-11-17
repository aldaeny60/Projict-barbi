import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Chrome } from "@/components/Chrome";
import { env } from "@/lib/env";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo" });

export const metadata: Metadata = {
  title: {
    default: "باربي — أزياء أطفال عراقية | أولاد • بنات • مواليد",
    template: "%s | باربي",
  },
  description:
    "متجر باربي العراقي لملابس الأطفال من الولادة حتى 16 سنة: أطقم، فساتين، جينز، أحذية وأطقم هدايا مواليد. توصيل لكل محافظات العراق مع الدفع عند الاستلام وزين كاش وFIB وكي كارد.",
  keywords: ["ملابس اطفال العراق", "فساتين بنات", "ملابس مواليد", "زين كاش", "توصيل بغداد"],
  manifest: "/manifest.webmanifest",
  icons: { icon: ["/icon.svg", "/icons/icon-192.png"], apple: "/icons/apple-touch-icon.png" },
  openGraph: {
    title: "باربي — أزياء أطفال عراقية",
    description: "كل ما يحتاجه طفلك من الولادة حتى 16 سنة، بتوصيل لكل العراق والدفع عند الاستلام.",
    locale: "ar_IQ",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFE4EC",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="bg-paper text-ink antialiased">
        {env.demoMode && (
          <div className="bg-butter-300 px-3 py-1.5 text-center text-[11px] font-black text-ink">
            نسخة عرض تجريبية — بيانات توضيحية تُصفَّر عند إعادة التشغيل، والدفع الإلكتروني غير مفعّل
          </div>
        )}
        <Providers>
          <Chrome>{children}</Chrome>
        </Providers>
      </body>
    </html>
  );
}
