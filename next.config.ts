import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
      // canonical-subject-notes-data.ts reads this via fs.readFileSync at a
      // constructed path (see its comment) rather than a static import, so
      // — same reasoning as the pdf.js entries above — Next's automatic
      // file tracer can't find it on its own without this being explicit.
      "./src/data/du-canonical-mapping.json",
      // du-question-bank-raw-data.ts reads this via fs.readFileSync at a
      // constructed path (see its comment) rather than a static import —
      // same reasoning as the entries above.
    ],
  },
  experimental: {
    // Server Actions default to a 1MB request body — silently too small
    // for a real hero image or a scanned multi-page PYQ PDF (routinely
    // several MB), which is why uploads for those appeared to just fail.
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
