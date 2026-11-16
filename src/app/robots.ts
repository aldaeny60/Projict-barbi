import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/shop", "/product", "/track"], disallow: ["/admin", "/pos", "/api", "/account", "/cart", "/checkout"] },
    ],
  };
}
