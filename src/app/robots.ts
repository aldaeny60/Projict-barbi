import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = SITE.baseUrl.replace(/\/+$/, "");
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/shop", "/product", "/track"], disallow: ["/admin", "/pos", "/api", "/account", "/cart", "/checkout"] },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
