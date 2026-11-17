import type { NextConfig } from "next";

/*
 * ترويسات أمان على كل الصفحات والـ API.
 * الكاميرا غير محجوبة لأن ماسح الباركود في الكاشير قد يحتاجها.
 * CSP هنا لا يحجب السكربتات السطرية التي يحتاجها Next للترطيب (لا nonce)،
 * لكنه يمنع تأطير الموقع، وتضمين كائنات، وتغيير base/form-action، ويحدّث المصادر.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
