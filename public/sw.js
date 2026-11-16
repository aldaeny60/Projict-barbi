/* باربي — عامل الخدمة: تصفح بدون اتصال + تحميل أسرع للزيارات المتكررة */
const VERSION = "barbi-v1";
/* الهيكل الأساسي فقط — لا نُخزّن الصفحة الرئيسية مسبقاً لأنها حيّة force-dynamic */
const SHELL = ["/offline", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // نطاقنا فقط: خطوط وصور الخارجية تبقى للمتصفح، والـ API دائماً من الشبكة (بيانات حيّة)
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // التنقل: شبكة أولاً → آخر نسخة محفوظة → صفحة بدون اتصال
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("/offline") || Response.error())
        )
    );
    return;
  }

  // الأصول الثابتة: كاش أولاً مع تحديث بالخلفية
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit || Response.error());
      return hit || network;
    })
  );
});
