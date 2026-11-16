import type { LucideIcon } from "lucide-react";
import {
  Wallet,
  Landmark,
  CreditCard,
  Send,
  Smartphone,
  ScanLine,
  Banknote,
} from "lucide-react";

export type PaymentGateway = {
  id: string;
  name: string;
  nameEn: string;
  desc: string;
  icon: LucideIcon;
  bg: string; // tailwind gradient classes
  chip: string;
  badge?: string;
  online: boolean; // electronic vs COD
};

export const PAYMENT_GATEWAYS: PaymentGateway[] = [
  {
    id: "cod",
    name: "الدفع عند الاستلام",
    nameEn: "Cash on Delivery",
    desc: "ادفع نقداً عند وصول طلبك إلى باب الدار — الأكثر شيوعاً في العراق",
    icon: Banknote,
    bg: "from-minty-300 to-minty-500",
    chip: "الأكثر استخداماً",
    badge: "COD",
    online: false,
  },
  {
    id: "zaincash",
    name: "زين كاش",
    nameEn: "Zain Cash",
    desc: "ادفع بمحفظة زين كاش فورياً عبر رقم هاتفك — بوابتنا الرئيسية",
    icon: Wallet,
    bg: "from-blush-300 to-blush-500",
    chip: "دفع فوري",
    badge: "زی",
    online: true,
  },
  {
    id: "fib",
    name: "المصرف العراقي للتجارة",
    nameEn: "First Iraq Bank (FIB)",
    desc: "امسح رمز QR من تطبيق FIB وأكمل الدفع بثوانٍ",
    icon: Landmark,
    bg: "from-aqua-300 to-aqua-500",
    chip: "QR سريع",
    badge: "FIB",
    online: true,
  },
  {
    id: "qicard",
    name: "كي كارد",
    nameEn: "Qi Card",
    desc: "بطاقة كي كارد / ماستركارد العراق — أدخل بيانات بطاقتك بأمان",
    icon: CreditCard,
    bg: "from-lilac-300 to-lilac-500",
    chip: "بطاقة",
    badge: "Qi",
    online: true,
  },
  {
    id: "asiahawala",
    name: "آسيا حوالة",
    nameEn: "Asia Hawala",
    desc: "حوّل من رصيد آسيا حوالة مباشرة إلى حساب المتجر",
    icon: Send,
    bg: "from-butter-300 to-butter-500",
    chip: "تحويل",
    badge: "AH",
    online: true,
  },
  {
    id: "fastpay",
    name: "فاست باي",
    nameEn: "FastPay",
    desc: "محفظة فاست باي الإلكترونية — تأكيد فوري داخل التطبيق",
    icon: Smartphone,
    bg: "from-minty-300 to-aqua-400",
    chip: "محفظة",
    badge: "FP",
    online: true,
  },
  {
    id: "huaweipay",
    name: "هواوي باي",
    nameEn: "Huawei Pay",
    desc: "ادفع بلمسة واحدة عبر أجهزة هواوي المتوافقة",
    icon: ScanLine,
    bg: "from-blush-400 to-lilac-400",
    chip: "NFC",
    badge: "HW",
    online: true,
  },
];

export function gatewayById(id: string): PaymentGateway {
  return PAYMENT_GATEWAYS.find((g) => g.id === id) ?? PAYMENT_GATEWAYS[0];
}

export const DELIVERY_CARRIERS = ["زاجل", "أرامكس العراق", "ناشيونال اكسبرس", "توصيل داخلي"] as const;
