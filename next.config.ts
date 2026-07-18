import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js's worker + font files are referenced via constructed path
  // strings (src/lib/pdf-server.ts), not static imports, so Next's file
  // tracer can't find them on its own — without this, the Paper Analysis
  // feature 404s on its worker file in a deployed (Vercel) build even
  // though it works locally against the full node_modules tree.
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
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
