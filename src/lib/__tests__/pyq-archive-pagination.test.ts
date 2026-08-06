import { test } from "node:test";
import assert from "node:assert/strict";
import { getPaginatedPyqArchive } from "@/lib/pyq-catalog";

// These exercise the real static catalog (bundled JSON, no network needed)
// merged with the database-backed sources — which gracefully fall back to
// empty arrays when Postgres isn't reachable (see getPyqArchiveIndex /
// getFullDriveArchiveIndex / getFullPyqCatalog try/catch blocks), exactly
// as they do in local dev without a DATABASE_URL configured. That fallback
// is what makes these runnable in CI/sandboxes without a live database.

test("getPaginatedPyqArchive defaults to a page size of 20", async () => {
  const result = await getPaginatedPyqArchive({});
  assert.equal(result.pageSize, 20);
  assert.equal(result.page, 1);
  assert.ok(result.items.length <= 20, "must never return more than one page of items");
  assert.ok(result.total >= result.items.length);
});

test("getPaginatedPyqArchive clamps pageSize to the 50-item maximum", async () => {
  const result = await getPaginatedPyqArchive({ pageSize: 999 });
  assert.equal(result.pageSize, 50);
  assert.ok(result.items.length <= 50, "must never return the complete catalogue in one page");
});

test("getPaginatedPyqArchive filters before paginating, and totalPages matches total/pageSize", async () => {
  // "Another Question Papers" is a real course in the bundled static
  // catalog (src/data/ramanujan-pyq-catalog.json) with 89 rows — a stable
  // fixture that doesn't depend on the database.
  const pageSize = 10;
  const result = await getPaginatedPyqArchive({ programme: "Another Question Papers", pageSize });

  assert.ok(result.total >= 89, `expected at least the 89 known static rows, got ${result.total}`);
  assert.equal(result.items.length, Math.min(pageSize, result.total));
  assert.equal(result.totalPages, Math.max(1, Math.ceil(result.total / pageSize)));
  for (const paper of result.items) {
    assert.equal(paper.course, "Another Question Papers");
  }
});

test("getPaginatedPyqArchive page is clamped into range instead of returning an empty page silently past the end", async () => {
  const result = await getPaginatedPyqArchive({
    programme: "Another Question Papers",
    pageSize: 50,
    page: 9999,
  });
  assert.equal(result.page, result.totalPages);
  assert.ok(result.items.length > 0, "an in-range clamped page should still return items");
});
