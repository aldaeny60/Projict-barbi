#!/usr/bin/env node
/**
 * BARBI — اختبارات سير العمل الحرجة (LAW 015: لا سير عمل حرجاً بدون اختبار)
 * تشغيل: node scripts/api-tests.mjs   (يتطلب خادماً يعمل على BASE_URL)
 * يقرأ .env المحلي تلقائياً (ADMIN_PIN) إن وُجد — ومتغيرات البيئة المضبوطة تبقى أولى.
 */
import "dotenv/config";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const ADMIN_PIN = process.env.ADMIN_PIN || "2024";
// أرقام عشوائية صالحة لكل تشغيل — تعزل الاختبار عن حدود المعدل وعمليات التشغيل السابقة
const rndPhone = (p3) => p3 + String(Math.floor(10000000 + Math.random() * 89999999));
const QA_PHONE = rndPhone("077");
const QA_PHONE2 = rndPhone("078");
const QA_PHONE3 = rndPhone("079");

let passed = 0, failed = 0;
const rows = [];
async function test(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    passed++;
    rows.push({ name, result: "PASS ✅", ms: Date.now() - t0, detail: detail || "" });
  } catch (e) {
    failed++;
    rows.push({ name, result: "FAIL ❌", ms: Date.now() - t0, detail: String(e.message || e) });
  }
}
const j = (r) => r.json();
const assert = (c, msg) => { if (!c) throw new Error(msg); };

/* جلسات الاختبار: الزبون بعد توثيق OTP، والكاشير بعد فتح وردية، والإدارة بعد الدخول */
let custCookie = "", staffCookie = "", orderCode = "";
const jsonHeaders = { "Content-Type": "application/json" };
async function loginCustomer(phone) {
  const s = await fetch(`${BASE}/api/auth/otp`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ action: "send", phone }) }).then(j);
  const res = await fetch(`${BASE}/api/auth/otp`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ action: "verify", phone, code: s.devCode, name: "عميل QA" }) });
  return (res.headers.get("set-cookie") || "").split(";")[0];
}

async function run() {
  console.log(`🧪 BARBI QA — ${BASE}\n`);

  // 1) تسجيل عميل: OTP عشوائي (ليس ثابتاً) — LAW 005
  await test("OTP توليد عشوائي غير ثابت", async () => {
    const send = (phone) => fetch(`${BASE}/api/auth/otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", phone }) }).then(j);
    const r1 = await send(QA_PHONE);
    assert(r1.ok, JSON.stringify(r1));
    await new Promise((s) => setTimeout(s, 300));
    const r2 = await send(QA_PHONE3);
    assert(r2.ok, JSON.stringify(r2));
    assert(r1.devCode && r2.devCode && r1.devCode !== "1234" && r2.devCode !== "1234", "legacy fixed code detected");
    assert(r1.devCode !== r2.devCode, `suspicious identical codes ${r1.devCode}`);
    return `codes: ${r1.devCode} / ${r2.devCode}`;
  });

  // 2) رمز خاطئ مرفوض
  await test("OTP رمز خاطئ مرفوض", async () => {
    await fetch(`${BASE}/api/auth/otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", phone: QA_PHONE }) });
    const r = await fetch(`${BASE}/api/auth/otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", phone: QA_PHONE, code: "0000" }) }).then(j);
    assert(r.error, `expected error, got ${JSON.stringify(r)}`);
    return "400 expected ✓";
  });

  // 3) تسجيل/دخول صحيح
  await test("تسجيل عميل برمز صحيح", async () => {
    const s = await fetch(`${BASE}/api/auth/otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", phone: QA_PHONE }) }).then(j);
    const r = await fetch(`${BASE}/api/auth/otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", phone: QA_PHONE, code: s.devCode, name: "عميل QA" }) }).then(j);
    assert(r.customer?.phone === QA_PHONE, JSON.stringify(r));
    return `customer #${r.customer.id}`;
  });

  let product, leadSize;
  // 4) تصفح المنتجات
  await test("تصفح الكتالوج", async () => {
    const r = await fetch(`${BASE}/api/products?limit=100`).then(j);
    assert(r.products.length >= 20, "catalog too small");
    product = r.products.find((p) => (p.sizeStock ?? []).some((s) => s.stock >= 4)) || r.products[0];
    // المقاس الأوفر — به تُختبر الكميات الكبيرة بدل الاعتماد على أول مقاس
    leadSize = (product.sizeStock ?? []).slice().sort((a, b) => b.stock - a.stock)[0]?.size ?? product.sizes[0];
    assert(product.images.length >= 4, "need >=4 images");
    return `${r.products.length} منتج`;
  });

  // 5) تفاصيل الـVariant
  await test("تنويعات المنتج (مقاس/لون/مخزون)", async () => {
    const r = await fetch(`${BASE}/api/products/${product.id}`).then(j);
    assert(r.product.sizes.length > 0 && r.product.colors.length > 0, "missing variants");
    return `sku=${r.product.barcode}`;
  });

  // 6) بحث ذكي
  await test("اقتراحات البحث العربي", async () => {
    const r = await fetch(`${BASE}/api/search?q=فستان`).then(j);
    assert(Array.isArray(r.suggestions), "no suggestions");
    return `${r.suggestions.length} نتائج`;
  });

  // 7) كوبون صالح/باطل
  await test("كوبون صالح وباطل", async () => {
    const ok = await fetch(`${BASE}/api/coupons/validate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "WELCOME10", subtotal: 30000 }) }).then(j);
    assert(ok.valid && ok.discount === 3000, JSON.stringify(ok));
    const bad = await fetch(`${BASE}/api/coupons/validate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "FAKE123", subtotal: 30000 }) }).then(j);
    assert(!bad.valid, "bogus coupon accepted!");
    return "WELCOME10 → -3,000 د.ع";
  });

  // 8) رقم هاتف غير صالح مرفوض
  await test("رفض طلب برقم غير عراقي", async () => {
    const r = await fetch(`${BASE}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName: "QA", phone: "0501234567", governorate: "بغداد", address: "اختبار", items: [{ productId: product.id, qty: 1 }] }) }).then(j);
    assert(r.error, "invalid phone accepted");
    return "400 ✓";
  });

  let orderId, stockBefore, lead;
  // 9) إنشاء طلب + توازن الحسابات
  await test("إنشاء طلب (حسابات متوازنة)", async () => {
    const det = await fetch(`${BASE}/api/products/${product.id}`).then(j);
    stockBefore = det.product.stock;
    lead = det;
    const r = await fetch(`${BASE}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      customerName: "عميل QA", phone: QA_PHONE, governorate: "بغداد", district: "المنصور",
      address: "قرب QA", paymentMethod: "cod", couponCode: "WELCOME10",
      items: [{ productId: product.id, qty: 2, size: leadSize, color: product.colors[0].name }],
    }) }).then(j);
    assert(r.ok, r.error);
    const inv = r.invoice;
    const expected = inv.subtotal - inv.discount + inv.deliveryFee;
    assert(Math.abs(expected - inv.total) <= 1, `totals mismatch ${expected} vs ${inv.total}`);
    orderId = r.order.id;
    orderCode = r.order.code;
    return `${r.order.code} = ${inv.total.toLocaleString()} د.ع`;
  });

  // 10) تحديث المخزون بعد البيع
  await test("خصم المخزون ذرّياً", async () => {
    const det = await fetch(`${BASE}/api/products/${product.id}`).then(j);
    assert(det.product.stock === stockBefore - 2, `stock ${det.product.stock} != ${stockBefore - 2}`);
    return `${stockBefore} → ${det.product.stock}`;
  });

  // 11) تتبع الطلب برقم الهاتف
  await test("تتبع الطلب بالهاتف", async () => {
    custCookie = await loginCustomer(QA_PHONE);
    const r = await fetch(`${BASE}/api/orders`, { headers: { cookie: custCookie } }).then(j);
    const mine = r.orders.find((o) => o.id === orderId);
    assert(mine && mine.status === "pending", "order not tracked");
    return `status: ${mine.status}`;
  });



  // 13) إلغاء الطلب ⇒ استعادة المخزون
  await test("إلغاء طلب + استرداد المخزون", async () => {
    const r = await fetch(`${BASE}/api/orders/${orderId}`, { method: "PATCH", headers: { "Content-Type": "application/json", cookie: custCookie }, body: JSON.stringify({ status: "cancelled" }) }).then(j);
    assert(r.ok, JSON.stringify(r));
    const det = await fetch(`${BASE}/api/products/${product.id}`).then(j);
    assert(det.product.stock === stockBefore, "stock not restored");
    return `stock: ${det.product.stock} ✓`;
  });

  // 14) API الإدارة محمية بدون جلسة — LAW 006
  await test("حظر /api/admin/stats بدون جلسة", async () => {
    const r = await fetch(`${BASE}/api/admin/stats`);
    assert(r.status === 401, `got ${r.status}`);
    return "401 ✓";
  });

  // 15) PIN خاطئ مرفوض
  await test("رفض دخول إدارة برمز خاطئ", async () => {
    const r = await fetch(`${BASE}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: "999999" }) });
    assert(r.status === 401, `got ${r.status}`);
    return "401 ✓";
  });

  let adminCookie = "";
  // 16) دخول إدارة صحيح ⇒ بيانات فعلية
  await test("دخول إدارة ناجح + إحصاءات حية", async () => {
    const r = await fetch(`${BASE}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: ADMIN_PIN }) });
    assert(r.ok, `login ${r.status}`);
    adminCookie = r.headers.get("set-cookie")?.split(";")[0] || "";
    assert(adminCookie.includes("barbi_admin="), "no cookie");
    const st = await fetch(`${BASE}/api/admin/stats`, { headers: { cookie: adminCookie } }).then(j);
    assert(st.cards && typeof st.cards.monthRevenue === "number", "no stats");
    return `شهر: ${st.cards.monthRevenue.toLocaleString()} د.ع`;
  });

  // 16ب) منع بيع فوق المخزون: نضبط المخزون على 2 عبر API الإدارة المحمية ثم نتوقع 409 ونعيده
  await test("حارس المخزون الجزيئي (409)", async () => {
    const all = await fetch(`${BASE}/api/products?limit=100`).then(j);
    const victim = all.products.find((p) => p.stock > 2);
    const original = victim.stock;
    const set2 = await fetch(`${BASE}/api/products/${victim.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", cookie: adminCookie }, body: JSON.stringify({ stock: 2 }) });
    assert(set2.ok, "admin stock patch failed");
    const r = await fetch(`${BASE}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      customerName: "QA Overflow", phone: QA_PHONE, governorate: "بغداد", address: "QA",
      items: [{ productId: victim.id, qty: 10 }],
    }) });
    await fetch(`${BASE}/api/products/${victim.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", cookie: adminCookie }, body: JSON.stringify({ stock: original }) });
    assert(r.status === 409, `expected 409 got ${r.status}`);
    return `409 — «${victim.name}» بمخزون 2`;
  });

  // 16ج) فتح وردية كاشير: البيع يتطلب جلسة موظف موقّعة
  await test("فتح وردية كاشير بجلسة موقّعة", async () => {
    const r = await fetch(`${BASE}/api/pos/shift`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ action: "open", branchId: 1, staffName: "QA-BOT", role: "cashier", openingCash: 0 }) });
    const d = await r.json();
    assert(r.ok && d.shift?.id, JSON.stringify(d));
    staffCookie = (r.headers.get("set-cookie") || "").split(";")[0];
    assert(staffCookie.startsWith("barbi_staff="), "no staff cookie");
    return `وردية #${d.shift.id}`;
  });

  // 16د) البيع بلا وردية مرفوض
  await test("بيع POS بلا وردية مرفوض (401)", async () => {
    const r = await fetch(`${BASE}/api/pos/sale`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ items: [{ productId: 1, qty: 1 }], payments: [] }) });
    assert(r.status === 401, `got ${r.status}`);
    return "401 ✓";
  });

  let posOrderId, posStockBefore;
  // 17) بيع كاشير بدفعة مقسّمة
  await test("بيع POS بدفع مقسّم", async () => {
    const det = await fetch(`${BASE}/api/products/${product.id}`).then(j);
    posStockBefore = det.product.stock;
    const qty = 1;
    const total = product.price * qty;
    const half = Math.ceil(total / 2);
    const r = await fetch(`${BASE}/api/pos/sale`, { method: "POST", headers: { "Content-Type": "application/json", cookie: staffCookie }, body: JSON.stringify({
      branchId: 1, staffName: "QA-BOT",
      items: [{ productId: product.id, qty, size: leadSize, color: product.colors[0].name }],
      payments: [{ method: "cash", amount: half }, { method: "zaincash", amount: total - half }],
    }) }).then(j);
    assert(r.ok, r.error);
    posOrderId = r.invoice.code;
    return `${posOrderId}: نقدي ${half.toLocaleString()} + زين كاش ${(total - half).toLocaleString()}`;
  });

  // 18) مرتجع POS ⇒ مخزون + حالة
  await test("مرتجع POS + استرداد", async () => {
    const list = await fetch(`${BASE}/api/pos/sale?branchId=1&take=20`, { headers: { cookie: staffCookie } }).then(j);
    const sale = list.sales.find((s) => s.code === posOrderId);
    assert(sale, "sale not found");
    const r = await fetch(`${BASE}/api/orders/${sale.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", cookie: staffCookie }, body: JSON.stringify({ status: "returned" }) }).then(j);
    assert(r.ok, JSON.stringify(r));
    const det = await fetch(`${BASE}/api/products/${product.id}`).then(j);
    assert(det.product.stock === posStockBefore, "stock not restored after return");
    return "returned ✓ stock restored ✓";
  });

  // 19) رسوم التوصيل: 18 محافظة
  await test("رسوم توصيل 18 محافظة", async () => {
    const r = await fetch(`${BASE}/api/delivery`).then(j);
    assert(r.fees.length === 18, `got ${r.fees.length}`);
    return "18/18 ✓";
  });

  // 20) Rate limiting على OTP
  await test("حد معدل OTP (429)", async () => {
    let last = null;
    for (let i = 0; i < 6; i++) {
      last = await fetch(`${BASE}/api/auth/otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", phone: QA_PHONE2 }) });
    }
    assert(last.status === 429, `expected 429 got ${last.status}`);
    return "429 على المحاولة 6/5";
  });

  // 21) صفحة تتبع الطلب العامة (بدون تسجيل دخول)
  await test("صفحة /track لتتبع الطلب", async () => {
    const r = await fetch(`${BASE}/track?phone=${QA_PHONE}`);
    const html = await r.text();
    assert(r.status === 200, `got ${r.status}`);
    assert(html.includes("وين وصل طلبي"), "track page markup missing");
    return `200 ✓ — ${QA_PHONE}`;
  });

  // 22) صفحة الاحتياط عند انقطاع الشبكة
  await test("صفحة /offline بدون اتصال", async () => {
    const r = await fetch(`${BASE}/offline`);
    const html = await r.text();
    assert(r.status === 200 && html.includes("ما عندج اتصال"), `got ${r.status}`);
    return "200 ✓";
  });

  // 23) عامل الخدمة + أيقونات PWA (تثبيت حقيقي على الشاشة الرئيسية)
  await test("عامل خدمة PWA + أيقونات 192/512", async () => {
    const sw = await fetch(`${BASE}/sw.js`);
    const swBody = await sw.text();
    assert(sw.ok && swBody.includes("barbi-v1") && swBody.includes("/offline"), "service worker missing");
    const man = await (await fetch(`${BASE}/manifest.webmanifest`)).json();
    const sizes = (man.icons ?? []).map((i) => i.sizes);
    assert(sizes.includes("192x192") && sizes.includes("512x512"), `icons: ${sizes.join(",")}`);
    const icon = await fetch(`${BASE}/icons/icon-192.png`);
    assert(icon.ok && (icon.headers.get("content-type") || "").includes("image/png"), "png icon missing");
    return "sw + 192/512 ✓";
  });

  // 24) ربط المتجر بصفحة التتبع وزر واتساب (من متغيرات البيئة)
  await test("روابط /track وواتساب بالمتجر", async () => {
    const html = await (await fetch(`${BASE}/`)).text();
    assert(html.includes('href="/track"'), "no /track link in store markup");
    assert(html.includes("wa.me/964"), "no whatsapp link from env phone");
    return "/track + wa.me ✓";
  });

  // 25) تتبع بلا جلسة: رد مخفّف بلا اسم أو عنوان أو إجمالي أو قطع كاملة
  await test("تتبع بلا جلسة يُخفي الاسم والعنوان والإجمالي", async () => {
    assert(orderCode, "no order code captured");
    const r = await fetch(`${BASE}/api/track?phone=${QA_PHONE}&code=${orderCode}`);
    assert(r.status === 200, `got ${r.status}`);
    const d = await r.json();
    const o = d.orders?.[0];
    assert(o && o.code === orderCode, "order missing");
    assert(!("customerName" in o) && !("total" in o) && !("address" in o) && !("items" in o), "private fields leaked");
    return "الحالة والقطع فقط ✓";
  });

  // 26) قائمة الطلبات بالهاتف بلا جلسة مرفوضة
  await test("الطلبات بلا جلسة مرفوضة (401)", async () => {
    const r = await fetch(`${BASE}/api/orders`);
    assert(r.status === 401, `got ${r.status}`);
    return "401 ✓";
  });

  // 27) جلسة الزبون الحقيقية من الخادم + محفظة العناوين
  await test("جلسة الزبون من الخادم + عنوان محفوظ", async () => {
    const anon = await fetch(`${BASE}/api/customer/me`).then(j);
    assert(anon.customer === null, `anonymous leaked customer: ${JSON.stringify(anon)}`);
    const me = await fetch(`${BASE}/api/customer/me`, { headers: { cookie: custCookie } }).then(j);
    assert(me.customer?.phone === QA_PHONE, JSON.stringify(me));

    const add = await fetch(`${BASE}/api/customer/addresses`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: custCookie },
      body: JSON.stringify({ governorate: "بغداد", detail: "المنصور — قرب حديقة QA" }),
    }).then(j);
    assert(add.ok && add.address?.id, JSON.stringify(add));

    const list = await fetch(`${BASE}/api/customer/addresses`, { headers: { cookie: custCookie } }).then(j);
    assert(list.addresses.some((a) => a.id === add.address.id), "address missing");

    const del = await fetch(`${BASE}/api/customer/addresses?id=${add.address.id}`, {
      method: "DELETE",
      headers: { cookie: custCookie },
    });
    assert(del.ok, "address delete failed");
    return "me + عنوان CRUD ✓";
  });

  // 28) المفضلة على الخادم
  await test("المفضلة تُحفظ على الخادم", async () => {
    const add = await fetch(`${BASE}/api/customer/favorites`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: custCookie },
      body: JSON.stringify({ productId: product.id }),
    }).then(j);
    assert(add.ok, JSON.stringify(add));
    const list = await fetch(`${BASE}/api/customer/favorites`, { headers: { cookie: custCookie } }).then(j);
    assert(list.favorites.some((p) => p.id === product.id), "favorite missing");
    return `${list.favorites.length} مفضلة ✓`;
  });

  // 29) حد استخدام الكوبون محفوظ ويُحتسب
  await test("حد استخدام الكوبون محفوظ ومحتسب", async () => {
    const list = await fetch(`${BASE}/api/coupons`, { headers: { cookie: adminCookie } }).then(j);
    const w = list.coupons.find((c) => c.code === "WELCOME10");
    assert(w && typeof w.usedCount === "number", "no usedCount for admin");
    assert(w.usedCount >= 1, `usedCount ${w.usedCount}`);
    assert("maxUses" in w, "no maxUses field");
    const created = await fetch(`${BASE}/api/coupons`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ code: `QAONCE${Date.now().toString().slice(-5)}`, type: "fixed", value: 1000, maxUses: 1 }),
    }).then(j);
    assert(created.coupon?.maxUses === 1, "maxUses not persisted");
    return `WELCOME10 استُخدم ${w.usedCount} مرة`;
  });

  // 30) حسابات الموظفين (RBAC): إنشاء + فتح وردية بالرمز
  await test("RBAC — حساب موظف وفتح وردية برمز PIN", async () => {
    const staffPin = "4821";
    const created = await fetch(`${BASE}/api/admin/staff`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ name: "QA كاشير", role: "cashier", branchId: 1, pin: staffPin }),
    }).then(j);
    assert(created.staff?.id, JSON.stringify(created));

    const bad = await fetch(`${BASE}/api/pos/shift`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ action: "open", branchId: 1, staffId: created.staff.id, pin: "0000" }),
    });
    assert(bad.status === 401, `wrong pin got ${bad.status}`);

    const ok = await fetch(`${BASE}/api/pos/shift`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ action: "open", branchId: 1, staffId: created.staff.id, pin: staffPin, openingCash: 25000 }),
    });
    const d = await ok.json();
    assert(ok.ok && d.shift?.staffName === "QA كاشير", JSON.stringify(d));
    assert(d.shift.role === "cashier", "role not derived from account");
    staffCookie = (ok.headers.get("set-cookie") || "").split(";")[0] || staffCookie;

    // الاسم وحده لم يعد يكفي لفرع له حسابات
    const byName = await fetch(`${BASE}/api/pos/shift`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ action: "open", branchId: 1, staffName: "متحايل", role: "cashier" }),
    });
    assert(byName.status === 403, `name-only shift got ${byName.status}`);
    return `وردية #${d.shift.id} بالرمز ✓ والاسم وحده مرفوض`;
  });

  // 31) رفع الصور محمي بالإدارة
  await test("رفع الصور محمي بجلسة الإدارة (401)", async () => {
    const fd = new FormData();
    fd.append("file", new Blob(["qa"], { type: "image/png" }), "qa.png");
    const r = await fetch(`${BASE}/api/uploads`, { method: "POST", body: fd });
    assert(r.status === 401, `got ${r.status}`);
    return "401 ✓";
  });

  // 32) سجل التدقيق يسجّل العمليات الحسّاسة ولا يُقرأ بلا إدارة
  await test("سجل التدقيق يسجّل العمليات الحسّاسة", async () => {
    const r = await fetch(`${BASE}/api/admin/audit?limit=200`, { headers: { cookie: adminCookie } }).then(j);
    const actions = new Set((r.entries ?? []).map((e) => e.action));
    for (const a of ["admin.login", "order.status", "pos.sale", "staff.create"]) {
      assert(actions.has(a), `missing audit action: ${a}`);
    }
    const anon = await fetch(`${BASE}/api/admin/audit`);
    assert(anon.status === 401, `audit readable without admin: ${anon.status}`);
    return `${r.entries.length} سجل ✓`;
  });

  // 33) idempotency: نفس المفتاح لا يُنشئ طلبين ولا يخصم المخزون مرتين
  let idemOrderId = null, idemStockBefore = 0, idemP = null, idemSize = null, deliveredStock = 0;
  await test("منع تكرار الطلب (idempotency)", async () => {
    const all = await fetch(`${BASE}/api/products?limit=100`).then(j);
    idemP = all.products.find((x) => (x.sizeStock ?? []).some((s) => s.stock >= 2)) || product;
    idemSize = (idemP.sizeStock ?? []).find((s) => s.stock >= 2)?.size ?? idemP.sizes[0];
    idemStockBefore = idemP.stock;
    const payload = {
      customerName: "QA idem",
      phone: QA_PHONE,
      governorate: "بغداد",
      address: "QA idem",
      requestId: `QA-IDEM-${Date.now()}`,
      items: [{ productId: idemP.id, qty: 2, size: idemSize, color: idemP.colors[0]?.name }],
    };
    const a = await fetch(`${BASE}/api/orders`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }).then(j);
    const b = await fetch(`${BASE}/api/orders`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }).then(j);
    assert(a.ok && b.ok, JSON.stringify({ a, b }));
    assert(a.order.id === b.order.id, `two orders: ${a.order.id} / ${b.order.id}`);
    assert(b.duplicate === true, "second not flagged duplicate");
    idemOrderId = a.order.id;
    const after = (await fetch(`${BASE}/api/products/${idemP.id}`).then(j)).product.stock;
    assert(after === idemStockBefore - 2, `stock ${idemStockBefore} -> ${after}`);
    return `${a.order.code} مرة واحدة ✓`;
  });

  // 34) قواعد انتقال الحالة — لا قفز ولا عودة
  await test("قواعد انتقال حالة الطلب", async () => {
    assert(idemOrderId, "no order for transitions");
    const patch = (status) =>
      fetch(`${BASE}/api/orders/${idemOrderId}`, {
        method: "PATCH",
        headers: { ...jsonHeaders, cookie: adminCookie },
        body: JSON.stringify({ status }),
      });
    const jump = await patch("delivered");
    assert(jump.status === 409, `pending->delivered got ${jump.status}`);
    for (const s of ["processing", "shipped", "out_for_delivery", "delivered"]) {
      const r = await patch(s);
      assert(r.ok, `${s} -> ${r.status}`);
    }
    const back = await patch("processing");
    assert(back.status === 409, `delivered->processing got ${back.status}`);
    return "409 على القفز والعودة ✓";
  });

  // 35) سجل الحالات يُسجَّل لكل انتقال
  await test("سجل حالات الطلب (timeline)", async () => {
    const d = await fetch(`${BASE}/api/orders/${idemOrderId}`, { headers: { cookie: adminCookie } }).then(j);
    const ev = d.order?.events ?? [];
    assert(ev.length >= 5, `events: ${ev.length}`);
    assert(ev[0].fromStatus === null && ev[0].toStatus === "pending", "creation event missing");
    assert(ev.some((e) => e.toStatus === "delivered"), "delivered event missing");
    deliveredStock = (await fetch(`${BASE}/api/products/${idemP.id}`).then(j)).product.stock;
    return `${ev.length} حدث ✓`;
  });

  // 36) إرجاع جزئي: الكمية مرتين، والمخزون يُعاد للجزء المسترجع فقط
  await test("إرجاع جزئي + استعادة مخزون", async () => {
    const d = await fetch(`${BASE}/api/orders/${idemOrderId}`, { headers: { cookie: adminCookie } }).then(j);
    const item = d.order.items[0];
    assert(item && item.qty === 2, "order item missing/incorrect qty");

    const partial = await fetch(`${BASE}/api/orders/${idemOrderId}/returns`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ items: [{ orderItemId: item.id, qty: 1 }], reason: "QA partial" }),
    }).then(j);
    assert(partial.ok && partial.fullyReturned === false, JSON.stringify(partial));
    assert(partial.refund === item.price, `refund ${partial.refund} != ${item.price}`);
    const afterPartial = (await fetch(`${BASE}/api/products/${idemP.id}`).then(j)).product.stock;
    assert(afterPartial === deliveredStock + 1, `partial stock ${deliveredStock} -> ${afterPartial}`);

    const tooMany = await fetch(`${BASE}/api/orders/${idemOrderId}/returns`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ items: [{ orderItemId: item.id, qty: 5 }] }),
    });
    assert(tooMany.status === 409, `over-return got ${tooMany.status}`);

    const full = await fetch(`${BASE}/api/orders/${idemOrderId}/returns`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ items: [{ orderItemId: item.id, qty: 1 }], reason: "QA rest" }),
    }).then(j);
    assert(full.ok && full.fullyReturned === true && full.order.status === "returned", JSON.stringify(full));
    const afterFull = (await fetch(`${BASE}/api/products/${idemP.id}`).then(j)).product.stock;
    assert(afterFull === deliveredStock + 2, `full stock ${afterFull}`);
    return `استرداد ${partial.refund.toLocaleString("en-US")} د.ع ✓`;
  });

  // 37) صفحة الزبائن في الإدارة مع مؤشراتهم
  await test("قائمة الزبائن في الإدارة", async () => {
    // طلب جديد غير ملغي حتى يكون الإنفاق الصافي أكبر من صفر
    const placed = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        customerName: "QA spent",
        phone: QA_PHONE,
        governorate: "بغداد",
        address: "QA spent",
        items: [{ productId: idemP.id, qty: 1 }],
      }),
    }).then(j);
    assert(placed.ok, JSON.stringify(placed));

    const r = await fetch(`${BASE}/api/admin/customers`, { headers: { cookie: adminCookie } }).then(j);
    const me = (r.customers ?? []).find((c) => c.phone === QA_PHONE);
    assert(me, "QA customer missing");
    assert(me.ordersCount >= 2, JSON.stringify(me));
    assert(me.totalSpent > 0, `totalSpent ${me.totalSpent}`);
    const anon = await fetch(`${BASE}/api/admin/customers`);
    assert(anon.status === 401, `anon got ${anon.status}`);
    return `${r.customers.length} زبون ✓`;
  });

  // 38) فلاتر السعر/المقاس/اللون
  await test("فلاتر المتجر (سعر/مقاس/لون)", async () => {
    const byPrice = await fetch(`${BASE}/api/products?minPrice=${idemP.price}&maxPrice=${idemP.price}&limit=100`).then(j);
    assert(byPrice.products.length > 0, "price filter emptied catalog");
    assert(byPrice.products.every((p) => p.price === idemP.price), "price filter leaked");

    const size = idemP.sizes[0];
    const bySize = await fetch(`${BASE}/api/products?size=${encodeURIComponent(size)}&limit=100`).then(j);
    assert(bySize.products.length > 0, "size filter emptied catalog");
    assert(bySize.products.every((p) => p.sizes.includes(size)), "size filter leaked");

    const color = idemP.colors[0]?.name;
    if (color) {
      const byColor = await fetch(`${BASE}/api/products?color=${encodeURIComponent(color)}&limit=100`).then(j);
      assert(byColor.products.every((p) => p.colors.some((c) => c.name === color)), "color filter leaked");
    }
    return `سعر/مقاس${color ? "/لون" : ""} ✓`;
  });

  // 39) صفحات السياسات + رابط الفوتر
  await test("صفحات السياسات وروابطها", async () => {
    for (const p of ["/policies/returns", "/policies/privacy", "/policies/terms"]) {
      const r = await fetch(`${BASE}${p}`);
      assert(r.status === 200, `${p} -> ${r.status}`);
    }
    const home = await (await fetch(`${BASE}/`)).text();
    assert(home.includes('href="/policies/privacy"'), "footer policy link missing");
    return "3 صفحات + رابط الفوتر ✓";
  });

  // 40) idempotency الكاشير: إعادة إرسال الفاتورة من طابور الأوفلاين لا تبيع مرتين
  await test("منع تكرار فاتورة الكاشير (idempotency)", async () => {
    assert(staffCookie, "no staff session");
    const all = await fetch(`${BASE}/api/products?limit=100`).then(j);
    const p = all.products.find((x) => (x.sizeStock ?? []).some((s) => s.stock >= 1));
    assert(p, "no stock for pos idempotency");
    const sz = (p.sizeStock ?? []).find((s) => s.stock >= 1).size;
    const before = p.stock;
    const payload = {
      requestId: `QA-POS-${Date.now()}`,
      items: [{ productId: p.id, qty: 1, size: sz, color: p.colors[0]?.name }],
      payments: [{ method: "cash", amount: 999999999 }],
    };
    const a = await fetch(`${BASE}/api/pos/sale`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: staffCookie },
      body: JSON.stringify(payload),
    }).then(j);
    const b = await fetch(`${BASE}/api/pos/sale`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: staffCookie },
      body: JSON.stringify(payload),
    }).then(j);
    assert(a.ok && b.ok, JSON.stringify({ a, b }));
    assert(a.invoice.code === b.invoice.code, `two invoices ${a.invoice.code} / ${b.invoice.code}`);
    assert(b.duplicate === true, "second pos sale not duplicate");
    const after = (await fetch(`${BASE}/api/products/${p.id}`).then(j)).product.stock;
    assert(after === before - 1, `pos stock ${before} -> ${after}`);
    return `${a.invoice.code} مرة واحدة ✓`;
  });

  // 43) مخزون المقاس يمنع بيع كمية أكبر من المتاح له
  await test("مخزون المقاس يمنع البيع الزائد", async () => {
    const all = await fetch(`${BASE}/api/products?limit=100`).then(j);
    const p = all.products.find((x) => (x.sizeStock ?? []).some((s) => s.stock > 0 && s.stock <= 8));
    assert(p, "no product with size stock");
    const det = await fetch(`${BASE}/api/products/${p.id}`).then(j);
    const st = (det.product.sizeStock ?? []).find((s) => s.stock > 0 && s.stock <= 8);
    assert(st, "size stock missing in product detail");

    const over = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        customerName: "QA size",
        phone: QA_PHONE,
        governorate: "بغداد",
        address: "QA size",
        items: [{ productId: p.id, qty: Math.min(10, st.stock + 1), size: st.size, color: p.colors[0]?.name }],
      }),
    });
    assert(over.status === 409, `over-size got ${over.status}`);

    const okRes = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        customerName: "QA size",
        phone: QA_PHONE,
        governorate: "بغداد",
        address: "QA size",
        items: [{ productId: p.id, qty: 1, size: st.size, color: p.colors[0]?.name }],
      }),
    }).then(j);
    assert(okRes.ok, JSON.stringify(okRes));

    const after = (await fetch(`${BASE}/api/products/${p.id}`).then(j)).product;
    const st2 = after.sizeStock.find((s) => s.size === st.size);
    assert(st2.stock === st.stock - 1, `size ${st.stock} -> ${st2.stock}`);
    assert(after.stock === det.product.stock - 1, "total not decremented with size");
    return `${st.size}: ${st.stock} → ${st2.stock} ✓`;
  });

  // 44) لوحة التحكم تضبط مخزون كل مقاس ويُحدَّث الإجمالي
  await test("تعديل مخزون المقاسات من الإدارة", async () => {
    const all = await fetch(`${BASE}/api/products?limit=100`).then(j);
    const p = all.products.find((x) => (x.sizeStock ?? []).length >= 2);
    assert(p, "no multi-size product");
    const original = p.sizeStock;
    const target = [
      { size: original[0].size, stock: 1 },
      ...original.slice(1).map((s) => ({ size: s.size, stock: 0 })),
    ];
    const r = await fetch(`${BASE}/api/products/${p.id}`, {
      method: "PATCH",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ sizeStock: target }),
    }).then(j);
    assert(r.product?.stock === 1, `total ${r.product?.stock}`);

    await fetch(`${BASE}/api/products/${p.id}`, {
      method: "PATCH",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ sizeStock: original }),
    });
    const back = (await fetch(`${BASE}/api/products/${p.id}`).then(j)).product;
    assert(back.stock === original.reduce((s, x) => s + x.stock, 0), "restore failed");
    return "الإجمالي = مجموع المقاسات ✓";
  });

  // 45) سعر التكلفة للإدارة فقط — لا يتسرب للكتالوج العام
  await test("التكلفة لا تتسرب للكتالوج العام", async () => {
    const pub = await fetch(`${BASE}/api/products?limit=5`).then(j);
    assert(pub.products.length > 0, "empty catalog");
    assert(pub.products.every((p) => p.costPrice === undefined), "costPrice leaked publicly");

    const adm = await fetch(`${BASE}/api/products?limit=5`, { headers: { cookie: adminCookie } }).then(j);
    assert(adm.products.every((p) => typeof p.costPrice === "number"), "costPrice missing for admin");
    return "عام: مخفي • إدارة: ظاهر ✓";
  });

  // 46) الربح التقديري وهامشه في لوحة التحكم
  await test("الربح التقديري وهامشه", async () => {
    const st = await fetch(`${BASE}/api/admin/stats`, { headers: { cookie: adminCookie } }).then(j);
    assert(typeof st.cards.profit === "number", "no profit field");
    assert(st.cards.profit > 0, `profit ${st.cards.profit}`);
    assert(st.cards.marginPct > 0 && st.cards.marginPct < 100, `margin ${st.cards.marginPct}`);
    const anon = await fetch(`${BASE}/api/admin/stats`);
    assert(anon.status === 401, `stats leaked ${anon.status}`);
    return `ربح ${st.cards.profit.toLocaleString("en-US")} د.ع — هامش ${st.cards.marginPct}%`;
  });

  // 47) تغيير الحالة يُرجع نتيجة إشعار الزبون صريحة
  await test("إشعار الزبون عند تغيير الحالة", async () => {
    const all = await fetch(`${BASE}/api/products?limit=100`).then(j);
    const p = all.products.find((x) => (x.sizeStock ?? []).some((s) => s.stock >= 2));
    assert(p, "no stock");
    const sz = (p.sizeStock ?? []).find((s) => s.stock >= 2).size;
    const created = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        customerName: "QA notify",
        phone: QA_PHONE,
        governorate: "بغداد",
        address: "QA notify",
        items: [{ productId: p.id, qty: 1, size: sz, color: p.colors[0]?.name }],
      }),
    }).then(j);
    assert(created.ok, JSON.stringify(created));
    const r = await fetch(`${BASE}/api/orders/${created.order.id}`, {
      method: "PATCH",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ status: "processing" }),
    }).then(j);
    assert(r.ok, JSON.stringify(r));
    assert(["sent", "skipped", "failed"].includes(r.notified), `notified=${r.notified}`);
    return `notified=${r.notified} ✓`;
  });

  // 48) كوبون «مرة واحدة لكل زبون»
  await test("كوبون مرة واحدة لكل زبون", async () => {
    const code = `QACUST${Date.now().toString().slice(-6)}`;
    const created = await fetch(`${BASE}/api/coupons`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ code, type: "fixed", value: 500, oncePerCustomer: true }),
    }).then(j);
    assert(created.coupon?.oncePerCustomer === true, JSON.stringify(created));

    const all = await fetch(`${BASE}/api/products?limit=100`).then(j);
    const p = all.products.find((x) => (x.sizeStock ?? []).some((s) => s.stock >= 3));
    assert(p, "no stock for coupon test");
    const sz = (p.sizeStock ?? []).find((s) => s.stock >= 3).size;
    const order = () =>
      fetch(`${BASE}/api/orders`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          customerName: "QA coupon",
          phone: QA_PHONE,
          governorate: "بغداد",
          address: "QA coupon",
          couponCode: code,
          items: [{ productId: p.id, qty: 1, size: sz, color: p.colors[0]?.name }],
        }),
      }).then(j);

    const first = await order();
    assert(first.ok && first.invoice, JSON.stringify(first).slice(0, 300));
    assert(first.invoice.discount === 500, `first discount ${first.invoice.discount}`);
    const second = await order();
    assert(second.ok && second.invoice, JSON.stringify(second).slice(0, 300));
    assert(second.invoice.discount === 0, `second discount ${second.invoice.discount}`);

    const v = await fetch(`${BASE}/api/coupons/validate`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ code, subtotal: 50000, phone: QA_PHONE }),
    }).then(j);
    assert(v.valid === false, "validate accepted a used once-per-customer coupon");
    return "خصم أول 500 ثم 0 ✓";
  });

  // 49) تصدير CSV محمي بالإدارة ويحتوي بيانات فعلية
  await test("تصدير CSV محمي ويحتوي بيانات", async () => {
    const anon = await fetch(`${BASE}/api/admin/export?type=orders`);
    assert(anon.status === 401, `anon export got ${anon.status}`);

    const r = await fetch(`${BASE}/api/admin/export?type=orders`, { headers: { cookie: adminCookie } });
    assert(r.ok, `export got ${r.status}`);
    const body = await r.text();
    assert(body.includes("الكود") && body.includes("SG-"), "orders csv missing data");
    assert((r.headers.get("content-type") || "").includes("text/csv"), "wrong content-type");

    const c = await fetch(`${BASE}/api/admin/export?type=customers`, { headers: { cookie: adminCookie } }).then((x) => x.text());
    assert(c.includes("الهاتف") && c.includes(QA_PHONE), "customers csv missing QA phone");
    return `${body.split("\r\n").length - 1} صف طلبات ✓`;
  });

  // 50) سجل الحالات متاح للتتبع: كامل للجلسة، مخفّف برقم الطلب
  await test("سجل حالات الطلب في التتبع", async () => {
    const mine = await fetch(`${BASE}/api/track`, { headers: { cookie: custCookie } }).then(j);
    const withEvents = (mine.orders ?? []).find((o) => Array.isArray(o.events) && o.events.length);
    assert(withEvents, "no events for verified tracking");

    const pub = await fetch(`${BASE}/api/track?phone=${QA_PHONE}&code=${orderCode}`).then(j);
    const o = pub.orders?.[0];
    assert(o && Array.isArray(o.history) && o.history.length > 0, "no public history");
    assert(!("total" in o) && !("customerName" in o), "public history leaked private fields");
    return `${withEvents.events.length} حدث موثّق • ${o.history.length} مخفّف ✓`;
  });

  // 51) حسابات الإدارة: مدير يدخل باسمه، ولا يملك إدارة الحسابات
  await test("حسابات الإدارة ودور المدير", async () => {
    const pin = "1379";
    const created = await fetch(`${BASE}/api/admin/users`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ name: "QA-ADMIN", role: "manager", pin }),
    }).then(j);
    assert(created.user?.id, JSON.stringify(created));

    const login = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name: "QA-ADMIN", pin }),
    });
    assert(login.ok, `manager login ${login.status}`);
    const lj = await login.json();
    assert(lj.role === "manager", JSON.stringify(lj));
    const managerCookie = (login.headers.get("set-cookie") || "").split(";")[0];

    const forbidden = await fetch(`${BASE}/api/admin/users`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: managerCookie },
      body: JSON.stringify({ name: "QA-ESCAPE", role: "owner", pin: "1234" }),
    });
    assert(forbidden.status === 403, `manager created account: ${forbidden.status}`);

    const statsOk = await fetch(`${BASE}/api/admin/stats`, { headers: { cookie: managerCookie } });
    assert(statsOk.ok, "manager cannot read stats");

    const del = await fetch(`${BASE}/api/admin/users?id=${created.user.id}`, {
      method: "DELETE",
      headers: { cookie: adminCookie },
    });
    assert(del.ok, "owner could not delete account");

    const after = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name: "QA-ADMIN", pin }),
    });
    assert(after.status === 401, `deleted account still logs in: ${after.status}`);
    return "مدير بلا صلاحية حسابات ✓";
  });

  // 52) البحث العربي يتجاوز اختلاف الهمزة والتاء المربوطة
  await test("البحث العربي المتسامح (همزات/تاء مربوطة)", async () => {
    const cats = await fetch(`${BASE}/api/categories`).then(j);
    const cat = (cats.categories ?? [])[0];
    assert(cat, "no categories");

    // منتج اختبار معروف الاسم — لا نعتمد على أسماء البذر
    const created = await fetch(`${BASE}/api/products`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({
        name: "فستان أطفال تجريبي للبحث",
        description: "قطعة اختبار للتحقق من تطبيع الهمزات",
        price: 12345,
        stock: 3,
        categoryId: cat.id,
        sizes: ["2-3 سنوات"],
        colors: [{ name: "وردي", hex: "#F4A9C6" }],
      }),
    }).then(j);
    assert(created.product?.id, JSON.stringify(created));

    try {
      const withHamza = await fetch(`${BASE}/api/products?q=${encodeURIComponent("أطفال")}&limit=100`).then(j);
      const plain = await fetch(`${BASE}/api/products?q=${encodeURIComponent("اطفال")}&limit=100`).then(j);
      assert(withHamza.products.some((p) => p.id === created.product.id), "hamza spelling missed the product");
      assert(plain.products.some((p) => p.id === created.product.id), "plain spelling missed the product");
      assert(
        plain.products.length === withHamza.products.length,
        `variants differ: ${withHamza.products.length} vs ${plain.products.length}`
      );

      const suggest = await fetch(`${BASE}/api/search?q=${encodeURIComponent("اطفال")}`).then(j);
      assert(Array.isArray(suggest.suggestions), "suggestions missing");
      return `«أطفال» = «اطفال» → ${plain.products.length} نتيجة ✓`;
    } finally {
      await fetch(`${BASE}/api/products/${created.product.id}`, { method: "DELETE", headers: { cookie: adminCookie } });
    }
  });

  // 53) التقييم: بعد استلام الطلب فقط، وباسم الحساب، ومرة واحدة لكل زبون
  await test("تقييم موثّق بعد الشراء (مرة واحدة)", async () => {
    const anon = await fetch(`${BASE}/api/reviews`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ productId: idemP.id, rating: 5, comment: "بدون حساب" }),
    });
    assert(anon.status === 401, `anon review got ${anon.status}`);

    const notBought = await fetch(`${BASE}/api/reviews`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: custCookie },
      body: JSON.stringify({ productId: 999999, rating: 5, comment: "منتج غير مشترى" }),
    });
    assert(notBought.status === 403, `unbought review got ${notBought.status}`);

    const ok = await fetch(`${BASE}/api/reviews`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: custCookie },
      body: JSON.stringify({ productId: idemP.id, rating: 5, comment: "خامة ممتازة والمقاس مضبوط" }),
    }).then(j);
    assert(ok.ok && ok.author, JSON.stringify(ok));

    const again = await fetch(`${BASE}/api/reviews`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: custCookie },
      body: JSON.stringify({ productId: idemP.id, rating: 4, comment: "تعديل التقييم بعد التجربة" }),
    }).then(j);
    assert(again.ok, JSON.stringify(again));
    assert(again.reviewsCount === ok.reviewsCount, `duplicate review counted: ${ok.reviewsCount} -> ${again.reviewsCount}`);
    return `تقييم باسم ${ok.author} بدون تكرار ✓`;
  });

  // 54) قيم سالبة أو تالفة في تعديل المنتج لا تُحفظ
  await test("رفض القيم السالبة في المنتج", async () => {
    const r = await fetch(`${BASE}/api/products/${idemP.id}`, {
      method: "PATCH",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ price: -500, stock: -20, costPrice: -1 }),
    }).then(j);
    assert(r.product, JSON.stringify(r));
    assert(r.product.price === 0, `price ${r.product.price}`);
    assert(r.product.stock === 0, `stock ${r.product.stock}`);
    assert(r.product.costPrice === 0, `cost ${r.product.costPrice}`);

    // إعادة القيم الأصلية حتى لا تؤثر على بقية التشغيل
    await fetch(`${BASE}/api/products/${idemP.id}`, {
      method: "PATCH",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({
        price: idemP.price,
        stock: idemP.stock,
        costPrice: idemP.costPrice ?? 0,
        sizeStock: idemP.sizeStock,
      }),
    });
    return "السعر والمخزون والتكلفة ≥ 0 ✓";
  });

  // 55) مفاتيح API: مفتاح للقراءة فقط، بلا تكلفة ولا بيانات زبائن، ويُبطَل فوراً
  await test("مفاتيح API العامة (قراءة فقط)", async () => {
    const anon = await fetch(`${BASE}/api/v1/products`);
    assert(anon.status === 401, `anon v1 got ${anon.status}`);

    const created = await fetch(`${BASE}/api/admin/api-keys`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ name: "QA app key" }),
    }).then(j);
    assert(created.secret?.startsWith("barbi_"), JSON.stringify(created));
    const key = created.secret;

    const list = await fetch(`${BASE}/api/v1/products?limit=5`, {
      headers: { Authorization: `Bearer ${key}` },
    }).then(j);
    assert(Array.isArray(list.products) && list.products.length > 0, "v1 products empty");
    assert(list.products.every((p) => p.costPrice === undefined), "costPrice leaked via API key");

    const cats = await fetch(`${BASE}/api/v1/categories`, { headers: { "x-api-key": key } }).then(j);
    assert(Array.isArray(cats.categories) && cats.categories.length > 0, "v1 categories empty");

    const bad = await fetch(`${BASE}/api/v1/products`, { headers: { "x-api-key": "barbi_wrong_key_1234567890" } });
    assert(bad.status === 401, `bogus key got ${bad.status}`);

    await fetch(`${BASE}/api/admin/api-keys?id=${created.key.id}`, {
      method: "DELETE",
      headers: { cookie: adminCookie },
    });
    const revoked = await fetch(`${BASE}/api/v1/products`, { headers: { "x-api-key": key } });
    assert(revoked.status === 401, `revoked key still works: ${revoked.status}`);
    return "قراءة فقط + إبطال فوري ✓";
  });

  // 56) بحث الطلبات في الإدارة (كود/هاتف/اسم)
  await test("بحث الطلبات في الإدارة", async () => {
    const byCode = await fetch(`${BASE}/api/admin/stats`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ status: "all", q: orderCode }),
    }).then(j);
    assert(byCode.orders?.length === 1 && byCode.orders[0].code === orderCode, `code search: ${byCode.orders?.length}`);

    const byPhone = await fetch(`${BASE}/api/admin/stats`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ status: "all", q: QA_PHONE }),
    }).then(j);
    assert(byPhone.orders?.length >= 1, "phone search found nothing");
    assert(byPhone.orders.every((o) => o.phone === QA_PHONE), "phone search leaked other customers");

    const none = await fetch(`${BASE}/api/admin/stats`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ status: "all", q: "ZZZ-NO-SUCH-ORDER" }),
    }).then(j);
    assert(none.orders?.length === 0, "bogus query returned rows");
    return `${byPhone.orders.length} طلب برقم الهاتف ✓`;
  });

  // 57) الدفع: بلا اعتماد تاجر يرفض بوضوح، ومزوّد الاختبار يمرّ بتوقيع صحيح فقط
  await test("الدفع الإلكتروني (رفض صريح + تحقق توقيع)", async () => {
    const all = await fetch(`${BASE}/api/products?limit=100`).then(j);
    const p = all.products.find((x) => (x.sizeStock ?? []).some((s) => s.stock >= 1));
    assert(p, "no stock for payment test");
    const sz = (p.sizeStock ?? []).find((s) => s.stock >= 1).size;

    const order = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        customerName: "QA pay",
        phone: QA_PHONE,
        governorate: "بغداد",
        address: "QA pay",
        paymentMethod: "zaincash",
        items: [{ productId: p.id, qty: 1, size: sz, color: p.colors[0]?.name }],
      }),
    }).then(j);
    assert(order.ok && order.order?.id, JSON.stringify(order));

    // زين كاش غير مهيّأ في CI → 503 برسالة صريحة، ولا سجل دفع
    const notConfigured = await fetch(`${BASE}/api/payments/init`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ orderId: order.order.id, provider: "zaincash" }),
    });
    assert(notConfigured.status === 503, `unconfigured provider got ${notConfigured.status}`);

    // مزوّد وهمي غير مفعّل → 503 أيضاً
    const sandboxOff = await fetch(`${BASE}/api/payments/init`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ orderId: order.order.id, provider: "sandbox" }),
    });
    assert(sandboxOff.status === 503, `sandbox off got ${sandboxOff.status}`);

    // إشعار بتوكن مزوّر يجب ألا يُغيّر الحالة
    const forged = await fetch(`${BASE}/api/payments/callback/sandbox?token=abc.def.ghi`, { redirect: "manual" });
    assert(forged.status === 303, `forged callback status ${forged.status}`);
    const loc = forged.headers.get("location") || "";
    assert(loc.includes("status=invalid"), `forged callback not rejected: ${loc}`);

    const after = await fetch(`${BASE}/api/orders/${order.order.id}`, { headers: { cookie: custCookie } }).then(j);
    assert(after.order.paymentStatus !== "paid", "forged callback marked order paid");
    return "503 بلا اعتماد + توقيع مزوّر مرفوض ✓";
  });

  // 58) التحقق بخطوتين: بدء التفعيل، رمز خاطئ مرفوض، رمز صحيح يفعّل، والدخول يطلبه
  await test("التحقق بخطوتين لحساب الإدارة", async () => {
    const name = `QA-2FA-${Date.now().toString().slice(-5)}`;
    const pin = "4820";
    const created = await fetch(`${BASE}/api/admin/users`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ name, role: "manager", pin }),
    }).then(j);
    assert(created.user?.id, JSON.stringify(created));

    const login = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name, pin }),
    });
    assert(login.ok, `login ${login.status}`);
    const userCookie = (login.headers.get("set-cookie") || "").split(";")[0];

    const start = await fetch(`${BASE}/api/admin/2fa`, { method: "POST", headers: { cookie: userCookie } }).then(j);
    assert(start.secret && start.otpauth?.startsWith("otpauth://"), JSON.stringify(start).slice(0, 200));

    // حساب TOTP داخل الاختبار بلا اعتماد على TS (نفس خوارزمية lib/totp.ts)
    const { createHmac } = await import("node:crypto");
    const b32 = (s) => {
      const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
      let bits = 0, value = 0; const out = [];
      for (const ch of s.replace(/=+$/, "").toUpperCase()) {
        const idx = A.indexOf(ch); if (idx < 0) continue;
        value = (value << 5) | idx; bits += 5;
        if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
      }
      return Buffer.from(out);
    };
    const codeAt = (offsetSteps = 0) => {
      const counter = Math.floor(Date.now() / 1000 / 30) + offsetSteps;
      const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter));
      const d = createHmac("sha1", b32(start.secret)).update(buf).digest();
      const o = d[d.length - 1] & 0x0f;
      const n = ((d[o] & 0x7f) << 24) | ((d[o + 1] & 0xff) << 16) | ((d[o + 2] & 0xff) << 8) | (d[o + 3] & 0xff);
      return String(n % 1_000_000).padStart(6, "0");
    };

    const wrong = await fetch(`${BASE}/api/admin/2fa`, {
      method: "PUT",
      headers: { ...jsonHeaders, cookie: userCookie },
      body: JSON.stringify({ code: "000000" }),
    });
    assert(wrong.status === 400, `wrong code got ${wrong.status}`);

    const ok = await fetch(`${BASE}/api/admin/2fa`, {
      method: "PUT",
      headers: { ...jsonHeaders, cookie: userCookie },
      body: JSON.stringify({ code: codeAt() }),
    }).then(j);
    assert(ok.ok && ok.twoFactor === true, JSON.stringify(ok));

    // الدخول الآن يتطلب الرمز
    const noCode = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name, pin }),
    }).then(j);
    assert(noCode.needs2fa === true, JSON.stringify(noCode));

    const withCode = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name, pin, code: codeAt() }),
    });
    assert(withCode.ok, `login with 2fa got ${withCode.status}`);

    // المالك يصفّر التحقق لمن فقد جهازه
    const reset = await fetch(`${BASE}/api/admin/users`, {
      method: "PATCH",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ id: created.user.id, resetTwoFactor: true }),
    }).then(j);
    assert(reset.user?.twoFactor === false, JSON.stringify(reset));

    await fetch(`${BASE}/api/admin/users?id=${created.user.id}`, { method: "DELETE", headers: { cookie: adminCookie } });
    return "بدء + رمز خاطئ 400 + تفعيل + دخول بالرمز + تصفير ✓";
  });

  // 59) روابط المنتجات بالـslug: الصفحة والميتا تعملان بالرابط الدلالي
  await test("روابط المنتجات الدلالية (slug)", async () => {
    const all = await fetch(`${BASE}/api/products?limit=5`).then(j);
    const p = all.products.find((x) => x.slug);
    assert(p, "no slugged product");
    const r = await fetch(`${BASE}/product/${p.slug}`);
    assert(r.status === 200, `slug page ${r.status}`);
    const html = await r.text();
    assert(html.includes(`/product/${p.slug}`), "canonical/slug link missing in HTML");
    assert(html.includes("BreadcrumbList"), "breadcrumb structured data missing");
    const byId = await fetch(`${BASE}/product/${p.id}`);
    assert(byId.status === 200, "id link stopped working");
    const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
    assert(sitemap.includes(`/product/${p.slug}`), "sitemap lacks slug URL");
    return `/${p.slug} + canonical + breadcrumb ✓`;
  });

  // 60) المطابقة اليدوية للدفع: للمالك فقط، بسبب إلزامي، ومنسوبة في سجل الطلب
  await test("مطابقة الدفع يدوياً (للمالك فقط)", async () => {
    const all = await fetch(`${BASE}/api/products?limit=100`).then(j);
    const p = all.products.find((x) => (x.sizeStock ?? []).some((s) => s.stock >= 1));
    assert(p, "no stock");
    const sz = (p.sizeStock ?? []).find((s) => s.stock >= 1).size;
    const created = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        customerName: "QA reconcile",
        phone: QA_PHONE,
        governorate: "بغداد",
        address: "QA reconcile",
        paymentMethod: "zaincash",
        items: [{ productId: p.id, qty: 1, size: sz, color: p.colors[0]?.name }],
      }),
    }).then(j);
    assert(created.ok, JSON.stringify(created));

    const anon = await fetch(`${BASE}/api/admin/payments`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ orderId: created.order.id, status: "paid", note: "محاولة بلا جلسة" }),
    });
    assert(anon.status === 401, `anon reconcile got ${anon.status}`);

    const noNote = await fetch(`${BASE}/api/admin/payments`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ orderId: created.order.id, status: "paid" }),
    });
    assert(noNote.status === 400, `missing note got ${noNote.status}`);

    const ok = await fetch(`${BASE}/api/admin/payments`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({
        orderId: created.order.id,
        status: "paid",
        note: "وصل مبلغ زين كاش ولا يصل إشعار",
        providerRef: "QA-MANUAL-1",
      }),
    }).then(j);
    assert(ok.ok && ok.order.paymentStatus === "paid", JSON.stringify(ok));

    const detail = await fetch(`${BASE}/api/orders/${created.order.id}`, { headers: { cookie: adminCookie } }).then(j);
    assert(detail.order.paymentStatus === "paid", "order paymentStatus not updated");
    assert(
      detail.order.events.some((e) => (e.note ?? "").includes("مطابقة دفع يدوية")),
      "manual reconciliation not recorded in order events"
    );

    const again = await fetch(`${BASE}/api/admin/payments`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ orderId: created.order.id, status: "paid", note: "تكرار المطابقة" }),
    });
    assert(again.status === 409, `repeat reconcile got ${again.status}`);
    return "401 بلا جلسة • 400 بلا سبب • مدفوع + سجل + 409 للتكرار ✓";
  });

  // 61) إعادة محاولة الدفع: الطلب بالكود لصاحبه فقط
  await test("جلب الطلب بالكود لإعادة الدفع (لصاحبه)", async () => {
    const anon = await fetch(`${BASE}/api/orders/by-code/${encodeURIComponent(orderCode)}`);
    assert(anon.status === 401, `anon by-code got ${anon.status}`);

    const mine = await fetch(`${BASE}/api/orders/by-code/${encodeURIComponent(orderCode)}`, {
      headers: { cookie: custCookie },
    }).then(j);
    assert(mine.order?.id, JSON.stringify(mine));

    const other = await fetch(`${BASE}/api/orders/by-code/${encodeURIComponent(orderCode)}`, {
      headers: { cookie: staffCookie },
    });
    assert(other.status === 401 || other.status === 404, `staff/other got ${other.status}`);

    const missing = await fetch(`${BASE}/api/orders/by-code/ZZZ-000`, { headers: { cookie: custCookie } });
    assert(missing.status === 404, `unknown code got ${missing.status}`);
    return "لصاحبه فقط + 404 لغير الموجود ✓";
  });

  // 62) لا بدء دفع لطلب ليس لك
  await test("حماية بدء الدفع (ملكية الطلب)", async () => {
    const all = await fetch(`${BASE}/api/products?limit=100`).then(j);
    const p = all.products.find((x) => (x.sizeStock ?? []).some((s) => s.stock >= 1));
    assert(p, "no stock");
    const sz = (p.sizeStock ?? []).find((s) => s.stock >= 1).size;
    const created = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        customerName: "QA pay", phone: QA_PHONE, governorate: "بغداد", address: "QA pay",
        paymentMethod: "zaincash",
        items: [{ productId: p.id, qty: 1, size: sz, color: p.colors[0]?.name }],
      }),
    }).then(j);
    assert(created.ok, JSON.stringify(created));

    const anon = await fetch(`${BASE}/api/payments/init`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ orderId: created.order.id, provider: "sandbox" }),
    });
    assert(anon.status === 401, `anon init got ${anon.status}`);

    const wrongPhone = await fetch(`${BASE}/api/payments/init`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ orderId: created.order.id, provider: "sandbox", phone: QA_PHONE2 }),
    });
    assert(wrongPhone.status === 401, `wrong phone got ${wrongPhone.status}`);

    const rightPhone = await fetch(`${BASE}/api/payments/init`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ orderId: created.order.id, provider: "sandbox", phone: QA_PHONE }),
    }).then(j);
    assert(rightPhone.ok && rightPhone.redirectUrl, JSON.stringify(rightPhone));
    return "بلا هاتف/بهاتف خاطئ 401 ✓";
  });

  // 63) مسار دفع كامل عبر مزوّد الاختبار: init → callback → الطلب مدفوع
  await test("مسار الدفع الكامل (مزوّد اختبار)", async () => {
    const all = await fetch(`${BASE}/api/products?limit=100`).then(j);
    const p = all.products.find((x) => (x.sizeStock ?? []).some((s) => s.stock >= 1));
    const sz = (p.sizeStock ?? []).find((s) => s.stock >= 1).size;
    const created = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        customerName: "QA fullpay", phone: QA_PHONE, governorate: "بغداد", address: "QA fullpay",
        paymentMethod: "zaincash",
        items: [{ productId: p.id, qty: 1, size: sz, color: p.colors[0]?.name }],
      }),
    }).then(j);
    assert(created.ok, JSON.stringify(created));

    const init = await fetch(`${BASE}/api/payments/init`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ orderId: created.order.id, provider: "sandbox", phone: QA_PHONE }),
    }).then(j);
    assert(init.ok && init.redirectUrl, JSON.stringify(init));

    const cb = await fetch(init.redirectUrl, { redirect: "manual" });
    assert(cb.status === 303 || cb.status === 307, `callback status ${cb.status}`);
    const location = cb.headers.get("location") ?? "";
    assert(location.includes("status=paid"), `callback location ${location}`);

    const after = await fetch(`${BASE}/api/admin/stats`, {
      method: "POST",
      headers: { ...jsonHeaders, cookie: adminCookie },
      body: JSON.stringify({ status: "all", q: created.order.code }),
    }).then(j);
    const row = after.orders?.find((o) => o.code === created.order.code);
    assert(row?.paymentStatus === "paid", `paymentStatus ${row?.paymentStatus}`);

    // إعادة إرسال نفس الإشعار لا تغيّر شيئاً (idempotent)
    const again = await fetch(init.redirectUrl, { redirect: "manual" });
    assert(again.status === 303 || again.status === 307, "repeat callback failed");
    return `${created.order.code} → مدفوع ✓`;
  });

  // ── النتائج ──
  console.log("\n| # | سير العمل | النتيجة | الدليل |");
  console.log("|---|---|---|---|");
  rows.forEach((r, i) => console.log(`| ${i + 1} | ${r.name} | ${r.result} | ${r.detail} |`));
  console.log(`\n✅ ${passed} ناجح — ❌ ${failed} فاشل من ${rows.length}`);
  if (failed > 0) process.exit(1);
}
run().catch((e) => { console.error("FATAL", e); process.exit(1); });
