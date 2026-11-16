#!/usr/bin/env node
/**
 * BARBI — اختبارات سير العمل الحرجة (LAW 015: لا سير عمل حرجاً بدون اختبار)
 * تشغيل: node scripts/api-tests.mjs   (يتطلب خادماً يعمل على BASE_URL)
 */
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

  let product;
  // 4) تصفح المنتجات
  await test("تصفح الكتالوج", async () => {
    const r = await fetch(`${BASE}/api/products?limit=100`).then(j);
    assert(r.products.length >= 20, "catalog too small");
    product = r.products.find((p) => p.stock > 3) || r.products[0];
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
      items: [{ productId: product.id, qty: 2, size: product.sizes[0], color: product.colors[0].name }],
    }) }).then(j);
    assert(r.ok, r.error);
    const inv = r.invoice;
    const expected = inv.subtotal - inv.discount + inv.deliveryFee;
    assert(Math.abs(expected - inv.total) <= 1, `totals mismatch ${expected} vs ${inv.total}`);
    orderId = r.order.id;
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
    const r = await fetch(`${BASE}/api/orders?phone=${QA_PHONE}`).then(j);
    const mine = r.orders.find((o) => o.id === orderId);
    assert(mine && mine.status === "pending", "order not tracked");
    return `status: ${mine.status}`;
  });



  // 13) إلغاء الطلب ⇒ استعادة المخزون
  await test("إلغاء طلب + استرداد المخزون", async () => {
    const r = await fetch(`${BASE}/api/orders/${orderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) }).then(j);
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

  let posOrderId, posStockBefore;
  // 17) بيع كاشير بدفعة مقسّمة
  await test("بيع POS بدفع مقسّم", async () => {
    const det = await fetch(`${BASE}/api/products/${product.id}`).then(j);
    posStockBefore = det.product.stock;
    const qty = 1;
    const total = product.price * qty;
    const half = Math.ceil(total / 2);
    const r = await fetch(`${BASE}/api/pos/sale`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      branchId: 1, staffName: "QA-BOT",
      items: [{ productId: product.id, qty, size: product.sizes[0], color: product.colors[0].name }],
      payments: [{ method: "cash", amount: half }, { method: "zaincash", amount: total - half }],
    }) }).then(j);
    assert(r.ok, r.error);
    posOrderId = r.invoice.code;
    return `${posOrderId}: نقدي ${half.toLocaleString()} + زين كاش ${(total - half).toLocaleString()}`;
  });

  // 18) مرتجع POS ⇒ مخزون + حالة
  await test("مرتجع POS + استرداد", async () => {
    const list = await fetch(`${BASE}/api/pos/sale?branchId=1&take=20`).then(j);
    const sale = list.sales.find((s) => s.code === posOrderId);
    assert(sale, "sale not found");
    const r = await fetch(`${BASE}/api/orders/${sale.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "returned" }) }).then(j);
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

  // ── النتائج ──
  console.log("\n| # | سير العمل | النتيجة | الدليل |");
  console.log("|---|---|---|---|");
  rows.forEach((r, i) => console.log(`| ${i + 1} | ${r.name} | ${r.result} | ${r.detail} |`));
  console.log(`\n✅ ${passed} ناجح — ❌ ${failed} فاشل من ${rows.length}`);
  if (failed > 0) process.exit(1);
}
run().catch((e) => { console.error("FATAL", e); process.exit(1); });
