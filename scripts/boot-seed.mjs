/**
 * بذر بيانات العرض التجريبي عند إقلاع الحاوية (وضع DEMO_MODE فقط).
 * يدخل بحساب الإدارة ثم ينادي /api/seed — نفس المسار المحمي، بلا استثناءات أمنية.
 */
const BASE = process.env.APP_URL || "http://127.0.0.1:3000";
const PIN = process.env.ADMIN_PIN || "2024";

async function waitForHealth(timeoutMs = 150_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch {
      /* الخادم لم يفتح المنفذ بعد */
    }
    await new Promise((s) => setTimeout(s, 2000));
  }
  return false;
}

(async () => {
  if (!(await waitForHealth())) {
    console.error("boot-seed: الخادم لم يستجب — تخطّي البذر");
    return;
  }
  const login = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: PIN }),
  });
  if (!login.ok) {
    console.error("boot-seed: تعذّر دخول الإدارة", login.status);
    return;
  }
  const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
  const seed = await fetch(`${BASE}/api/seed`, { method: "POST", headers: { cookie } });
  const data = await seed.json().catch(() => ({}));
  console.log("boot-seed:", JSON.stringify(data).slice(0, 200));
})();
