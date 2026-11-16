# باربي — Barbi Kids Commerce Platform

نظام تجارة إلكتروني موحّد لعلامة عراقية لملابس الأطفال (ولادة → 16 سنة): **متجر ويب PWA + كاشير POS + لوحة تحكم إدارية + API عام للتطبيقات** — كلها على قاعدة PostgreSQL واحدة بتزامن لحظي.

## البدء السريع

```bash
git clone <رابط-المستودع-عندك>
cd barbi-kids
npm install
cp .env.example .env        # ثم عبّي DATABASE_URL على الأقل
npx drizzle-kit push        # إنشاء الجداول (يقرأ DATABASE_URL من .env)
npm run build && npm start
curl -X POST http://localhost:3000/api/seed   # بذر البيانات: منتجات + كوبونات + طلبات
```

## الخريطة

| المسار | لمن |
|---|---|
| `/` `/shop` `/product/[id]` `/cart` `/checkout` `/account` | المتجر (PWA قابل للتثبيت، RTL، دينار عراقي) |
| `/track` | تتبع الطلب برقم الهاتف بدون تسجيل دخول — خط زمني للحالة والقطع والإجمالي |
| `/pos` | شاشة الكاشير للفروع (باركود، دفع مقسّم، إيصال حراري 80mm، وضع Offline) |
| `/admin` | لوحة التحكم (الرمز التجريبي `2024`) — منتجات، طلبات، كوبونات، توصيل، مخزون، **رصد السوق (جوجل/Serper)** |

## PWA والعمل بدون اتصال

- `public/sw.js` — عامل خدمة: التنقل شبكة أولاً مع نسخة محفوظة، الأصول الثابتة كاش أولاً، و`/offline` صفحة احتياطية.
- تسجيل العامل + دعوة التثبيت (`beforeinstallprompt`) في `src/components/PwaSetup.tsx`، وأيقونات 192/512 + `apple-touch-icon`.
- الـ API لا يُخزَّن أبداً: الأسعار والمخزون دائماً من الخادم.

## مفاتيح البيئة

كل الأسرار تُوضع في `.env` (محظور رفعها عبر `.gitignore`). راجع `.env.example` للقائمة الكاملة: قاعدة البيانات، هوية المتجر العامة (`NEXT_PUBLIC_BASE_URL` / `NEXT_PUBLIC_SUPPORT_PHONE` / `NEXT_PUBLIC_WHATSAPP_PHONE`)، Serper، زين كاش، FIB، كي كارد، آسيا حوالة، فاست باي، هواوي باي، FCM، SMS. إعداد Drizzle (`drizzle.config.ts`) يقرأ `DATABASE_URL` من البيئة فقط.

## الوثائق

- `docs/DOCS.md` — توثيق API الكامل، إعداد بوابات الدفع، خطة النشر على App Store/Google Play/السيرفر.
