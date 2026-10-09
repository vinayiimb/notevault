import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Admin-uploaded hero/landing images live on Cloudflare R2.
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "*.r2.dev" }],
  },
  // Railway runs `next start` (or the standalone server.js) as a
  // long-lived Node process, not Vercel's per-route serverless functions.
  // "standalone" makes `next build` emit a minimal, self-contained
  // .next/standalone/ (traced node_modules + server.js) instead of
  // requiring the full repo + node_modules tree in the runtime image —
  // the same oversized-deploy problem this file's tracing options above
  // were already written to avoid on Netlify.
  output: "standalone",
  // Prisma's generated client (src/generated/prisma) resolves its query
  // engine binary via a dynamic path Next's file tracer can't follow
  // statically ("Encountered unexpected file in NFT list... indicates the
  // whole project was traced unintentionally" build warning). Without this,
  // the tracer falls back to including the entire repo root in every
  // function's trace — hundreds of MB of unrelated PDFs/CSVs/scratch files
  // that no server code actually reads, which is what pushed Netlify's
  // single collapsed function past its 250MB limit. Marking the package
  // external stops Next from trying to statically trace through it at all;
  // it's just require()'d at runtime via normal Node module resolution.
  serverExternalPackages: ["@prisma/client"],
  // The dynamic-path warning above makes Turbopack's tracer fall back to
  // sweeping in the whole repo root, not just node_modules — most of it is
  // not read by any server code (confirmed by grepping src/ for references)
  // and has no business in a deployed function: public/ is served as static
  // assets by the platform directly (132MB), data/ and organized_qps/ are
  // scratch working directories from one-off scrapers/scripts (40MB + 20MB).
  // This is what pushed Netlify's single collapsed function past 250MB.
  outputFileTracingExcludes: {
    "/*": ["./public/**", "./data/**", "./organized_qps/**", "./scratch/**"],
  },
  // pdf.js's worker + font files are referenced via constructed path
  // strings (src/lib/pdf-server.ts), not static imports, so Next's file
  // tracer can't find them on its own — without this, the Paper Analysis
  // feature 404s on its worker file in a deployed (Vercel) build even
  // though it works locally against the full node_modules tree.
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
      // Include all JSONs so fs.readFileSync works in Netlify serverless functions
      "./public/data/du-canonical-mapping.json",
      "./public/data/canonical-programmes.json",
      "./public/data/du-question-bank-full-mapped.json",
      "./public/data/ramanujan-pyq-catalog.json",
      "./public/data/papers-catalog.json",
      "./public/data/papers-noncore-catalog.json",
    ],
  },
  // Old/scraper-era course slugs (pre-dating the current papers-catalog.json
  // programme names) that crawlers (Amazonbot, PetalBot, SemrushBot — seen
  // in Railway HTTP logs 2026-10-03) still request from stale sitemaps or
  // backlinks. None of these patterns exist in the current catalog, so they
  // 404; redirect the pattern once here instead of 404ing per-URL forever.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Full Archive hub removed 2026-10-09 (its ~120MB in-memory catalogue cost Railway RAM); /papers replaces it.
      { source: "/pyq-notes", destination: "/papers", permanent: true },
      {
        source: "/papers/:slug((?:department-of-|aecc|.*-bah-?gesec|.*-bah-?bap(?:gesec)?|.*-bsch-bapgesec).*)",
        destination: "/previous-year-papers",
        permanent: false,
      },
    ];
  },
  experimental: {
    // Server Actions default to a 1MB request body — silently too small
    // for a real hero image or a scanned multi-page PYQ PDF (routinely
    // several MB), which is why uploads for those appeared to just fail.
    serverActions: {
      bodySizeLimit: "25mb",
    },
    // Restrict the number of worker threads to prevent OOM errors during
    // static generation of hundreds of pages that load massive 100MB+ JSON catalogs
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;
