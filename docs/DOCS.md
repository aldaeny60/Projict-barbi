# باربي — نظام التجارة الإلكترونية المتكامل

منصة موحّدة لعلامة عراقية لملابس الأطفال (ولادة → 16 سنة) تعمل على أربع قنوات بتزامن لحظي على **نفس قاعدة البيانات** و**نفس لوحة التحكم**:

| القناة | المسار | الجمهور |
|---|---|---|
| موقع ويب متجاوب + PWA | `/`, `/shop`, `/product/[id]`, `/cart`, `/checkout`, `/account` | العملاء |
| تطبيق آيفون/أندرويد | نفس الـ APIs عبر PWA الآن، وتطبيقات المتاجر لاحقاً | العملاء |
| صفحة الكاشير POS | `/pos` | موظفو الفروع (تابلت/شاشة لمس) |
| لوحة التحكم الإدارية | `/admin` (رمز تجريبي: `2024`) | الإدارة المركزية |

---

## 1. البنية التقنية

- **Next.js 16 (App Router)** — SSR + API Routes، تطبيق واحد يخدم الويب والكاشير والإدارة.
- **PostgreSQL + Drizzle ORM** — `src/db/schema.ts`:
  `categories, products, reviews, customers, orders, order_items, coupons, delivery_fees, branches, shifts`.
- **Redis (اختياري للإنتاج)** — تخزين مؤقت لنتائج `/api/products` وجلسات OTP.
- **التزامن اللحظي**: كل القنوات تقرأ/تكتب نفس الجداول؛ أي خصم مخزون من الكاشير يظهر فوراً على الويب.
- **الصور**: Pexels CDN حالياً — في الإنتاج تُرفع إلى AWS S3 / Cloudflare R2 وتُحفظ الروابط في `products.images`.
- **RTL كامل** بخط Cairo، أسعار بالدينار العراقي `25,000 د.ع`، توقيت بغداد `Asia/Baghdad`.

## 2. التشغيل محلياً

```bash
npm install
npx drizzle-kit push    # إنشاء الجداول على PostgreSQL المحلي
npm run build && npm start
curl -X POST http://localhost:3000/api/seed   # تعبئة 25 تصنيف + 32 منتج + كوبونات + طلبات تجريبية
```

يغطي البذر أيضاً: رسوم التوصيل للمحافظات الـ18، 3 فروع (المنصور/زيونة/العشار)، وردية مفتوحة، 46 طلباً موزعاً على 30 يوماً.

## 3. توثيق API

### الكتالوج
| Method | Path | الوصف |
|---|---|---|
| GET | `/api/products?section=boys|girls|newborn&category=slug&q=&sort=newest|best|rating|price_asc|price_desc|deals&deals=1&new=1&limit=` | قائمة المنتجات |
| GET | `/api/products/[idOrSlug]` | منتج + مشابهات + تقييمات |
| POST/PATCH/DELETE | `/api/products`, `/api/products/[id]` | إدارة المنتجات (إدارة) |
| GET/POST | `/api/categories` | التصنيفات |
| GET | `/api/search?q=` | اقتراحات البحث الفوري |
| POST | `/api/reviews` | `{productId, author, rating, comment}` |

### الطلبات (ويب)
| Method | Path | الوصف |
|---|---|---|
| POST | `/api/orders` | إنشاء طلب — `{customerName, phone(07XXXXXXXXX), governorate, district?, address, paymentMethod, couponCode?, items:[{productId,qty,size,color}]}` → يرجع فاتورة رقمية + إشعارات SMS/واتساب |
| GET | `/api/orders` | طلبات الزبون الحالي — بجلسة OTP موقّعة فقط (لا رقم هاتف في الرابط) |
| PATCH | `/api/orders/[id]` | تحديث حالة: `pending processing shipped out_for_delivery delivered cancelled returned` |
| POST | `/api/coupons/validate` | `{code, subtotal}` → `{valid, discount, message}` |
| GET/POST/PATCH/DELETE | `/api/coupons` | إدارة الكوبونات |
| GET/PATCH | `/api/delivery` | رسوم التوصيل لكل محافظة |

### المصادقة
- `POST /api/auth/otp {action:'send', phone}` — يرسل SMS. في التطوير (أو `OTP_DEV_ECHO=1`) يرجع `devCode`؛ في الإنتاج بلا مزود SMS يرجع 503 ولا يكشف الرمز.
- `POST /api/auth/otp {action:'verify', phone, code, name?}` — ينشئ/يرجع الحساب ويضبط كوكي جلسة موقّعة.
- `GET /api/customer/me` — الزبون الحالي من الجلسة أو `{customer:null}`. `DELETE` — خروج.
- `GET/POST/DELETE /api/customer/addresses` — عناوين محفوظة على الخادم (تتبع الزبونة بين الأجهزة).
- `GET/POST /api/customer/favorites` — مفضلة على الخادم بالأسعار الحالية.

### الكاشير POS
| Method | Path | الوصف |
|---|---|---|
| GET | `/api/pos/shift?branchId=` | الوردية المفتوحة + الفروع + حسابات موظفي الفرع (بلا رموز) + الجلسة |
| POST | `/api/pos/shift` | `{action:'open', staffId, pin, openingCash}` — يشتق الاسم والدور من الحساب. `{action:'close', shiftId, closingCash}` لمشرف/مدير |
| POST | `/api/pos/sale` | فاتورة بيع مع **دفع مقسّم** `{payments:[{method:'cash'|zaincash|fib|qicard|asiahawala|fastpay|huaweipay, amount}]}`، خصم يدوي `{mode,value}` (مشرف+)، كوبون — يخصم المخزون فوراً |
| GET | `/api/pos/sale?branchId=` | آخر فواتير الفرع (للمرتجعات) |
| GET | `/api/pos/report?date=YYYY-MM-DD&branchId=` | تقرير يومي: عدد الفواتير، الإجمالي، تفصيل البوابات، المرتجعات، الصافي |

### الإدارة
- `GET /api/admin/stats` — بطاقات + سلسلة 14 يوم + بوابات الدفع + المحافظات + أفضل المنتجات + مخزون منخفض.
- `POST /api/admin/stats {status}` — قائمة الطلبات المفلترة. `PATCH` — `{productId, add}` لإعادة التخزين.
- `GET/POST/PATCH/DELETE /api/admin/staff` — حسابات الموظفين: الاسم والدور والفرع ورمز PIN (4–8 أرقام، يُخزَّن scrypt). لا يُعاد أي hash.
- `GET /api/admin/audit?limit=&q=` — سجل التدقيق (الأحدث أولاً، للقراءة فقط).
- `POST /api/uploads` — رفع صورة منتج (multipart، JPG/PNG/WebP حتى 6MB) → `/api/uploads/[id]`.

### رصد السوق (Google Search عبر Serper)
- `POST /api/web-search` — `{q, range?: day|week|month|year|all, gl?="iq", hl?="ar", num?=10}` → نتائج عضوية + People Also Ask + عمليات بحث مرتبطة. يظهر للإدارة في تبويب **رصد السوق** داخل `/admin`.
- يتطلب المتغير `SERPER_API_KEY` في `.env` (يبقى بالخادم فقط ولا يصل للمتصفح إطلاقاً).

## 4. بوابات الدفع العراقية

الواجهة جاهزة للربط الفعلي؛ تُضاف مفاتيح الإنتاج كمتغيرات بيئة ويُستدعى كل مزود من route خادم (حتى لا تتسرب الأسرار للمتصفح):

| البوابة | متغيرات البيئة | الملاحظات |
|---|---|---|
| زين كاش (رئيسية) | `ZAINCASH_MSISDN`, `ZAINCASH_MERCHANT_ID`, `ZAINCASH_SECRET` | POST initiation إلى `test.zaincash.iq/transaction/init` ثم إعادة توجيه |
| FIB | `FIB_CLIENT_ID`, `FIB_CLIENT_SECRET` | OAuth بسيط + QR/payment API على `fib.iq` |
| كي كارد | `QICARD_API_KEY`, `QICARD_TERMINAL_ID` | بوابة MasterCard Iraq |
| آسيا حوالة | `ASIAHAWALA_MERCHANT`, `ASIAHAWALA_SECRET` | تحويل رصيد مع رقم مرجع |
| فاست باي | `FASTPAY_STORE_ID`, `FASTPAY_PASSWORD` | Payment request + callback |
| هواوي باي | `HUAWEI_PAY_MERCHANT_ID`, `HUAWEI_PAY_KEY_ID` | تكامل In-App/NFC |
| الدفع عند الاستلام | — | الخيار الافتراضي الأكثر شيوعاً؛ تأكيد هاتفي قبل الشحن |

كل عملية ناجحة: فاتورة فورية → SMS عبر مزود عراقي محلي + نسخة واتساب (`wa.me` جاهز، أو WhatsApp Business API داخلياً).

## 5. خطة النشر

1. **سيرفر**: VPS العراق/المنطقة (أو AWS me-south) — Docker: Next.js + Postgres خلف Nginx مع SSL (Let's Encrypt) — البودات كلها HTTPS. صورة `Dockerfile` جاهزة.
2. **سكالبج**: نسخة واحدة تكفي في البداية؛ عند التعدد اضبط `UPSTASH_REDIS_REST_URL/TOKEN` ليكون حد المعدل مشتركاً، ثم Kubernetes.
3. **iOS/Android**: كود Flutter موحد يستهلك نفس الـ API ويفتح عبر App Store Connect وPlay Console (أسماء: "باربي BARBI"). حتى الإطلاق، الـ PWA يعطي نفس التجربة: "إضافة إلى الشاشة الرئيسية".
4. **إشعارات Push**: لم تُنفّذ بعد — تحتاج مفاتيح Firebase وكود إرسال (لا توجد متغيرات معلنة بلا كود).
5. **النسخ الاحتياطي**: `pg_dump` يومي إلى تخزين خارجي.
6. **المراقبة**: Sentry/uptime + تنبيه على `audit_logs` (محاولات دخول فاشلة متكررة).

## 6. خصوصية السوق العراقي (مطبقة)

- أسعار IQD حصراً، أرقام هواتف `075X/077X/078X/079X` (11 رقم)، توقيت بغداد GMT+3.
- شركات توصيل: زاجل، أرامكس العراق، ناشيونال اكسبرس، توصيل داخلي بغداد — مع أجرة وزمن وصول لكل محافظة قابلة للتعديل من `/admin`.
- عروض المناسبات: رمضان، عيدا الفطر والأضحى، موسم المدارس، رأس السنة، أعياد الميلاد.
- تسجيل SMS-OTP سهل للأمهات الجدد على التسوق الإلكتروني، وواجهات كبيرة الأزرار واضحة.
