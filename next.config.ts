import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
      "./src/data/du-question-bank-full-mapped.json",
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
