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
const DISALLOW = [
  "/admin/",
  "/dashboard/",
  "/login",
  "/api/",
  "/search", // internal search results — not SEO landing pages
  "/*?_rsc=", // Next.js RSC prefetch payloads — were 53% of Googlebot's requests (GSC crawl stats)
  "/pyq-notes$", // ~15MB of HTML (whole archive inlined); /papers is the indexable hub
];

// Read-only APIs that public pages call while rendering. Blocking them made
// Googlebot render pages without that data (URL Inspection: "blocked by
// robots.txt" page resources). Longest match wins, so these beat "/api/".
const ALLOW = ["/", "/api/feature-flags", "/api/catalog-overrides", "/api/pyp-grid", "/api/notes-available"];

// Search / AI-answer crawlers named explicitly: a bot with its own group
// ignores the "*" group, so each gets the same disallow list.
const NAMED_BOTS = [
  "Googlebot",
  "Bingbot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot",
  "DuckDuckBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ALLOW, disallow: DISALLOW },
      { userAgent: NAMED_BOTS, allow: ALLOW, disallow: DISALLOW },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
