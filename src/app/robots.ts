import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Replaces the old static public/robots.txt so the sitemap URL and the
 * disallow list stay in sync with the canonical host in one place.
 *
 * Private / non-SEO surfaces are blocked. The public content hierarchy —
 * /papers, /paper, /paper-code and everything under it — is deliberately
 * left crawlable, as are all static assets.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/dashboard/",
          "/login",
          "/api/",
          "/search", // internal search results — not SEO landing pages
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
