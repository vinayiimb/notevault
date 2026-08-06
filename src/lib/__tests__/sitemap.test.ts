import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// sitemap.ts transitively imports src/lib/blog.ts, which imports the
// `server-only` package — a real guard against accidentally bundling
// server code into the client, but one that throws when loaded directly
// under plain `node --test` (no Next.js server runtime present to satisfy
// its bundler-detection trick). So this checks the route's source text
// instead of importing and executing it; the actual runtime behavior
// (dedupe logic, static-route fallback when the DB is unreachable) is
// covered by manual verification against a running `next dev` — see
// docs/PHASE_2_QUERY_REMEDIATION.md.
const sitemapSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../../app/sitemap.ts"),
  "utf-8",
);

test("sitemap route declares a positive numeric revalidate window", () => {
  // Previously missing entirely, so every crawler hit re-ran all 7
  // full-table queries — see docs/PHASE_2_QUERY_REMEDIATION.md item 5.
  const match = sitemapSource.match(/export const revalidate\s*=\s*(\d+)\s*;/);
  assert.ok(match, "expected `export const revalidate = <number>;` in src/app/sitemap.ts");
  assert.ok(Number(match![1]) > 0);
});

test("sitemap route selects only slug/id/timestamp fields, never large text columns", () => {
  assert.ok(!/ocrText:\s*true/.test(sitemapSource), "sitemap must never select the ocrText field");
  assert.ok(!/include:/.test(sitemapSource), "sitemap should use narrow `select`, not `include`");
});
