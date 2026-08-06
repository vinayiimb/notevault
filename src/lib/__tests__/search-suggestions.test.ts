import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/search-suggestions/route";

function requestFor(q: string | null) {
  const url = new URL("http://localhost/api/search-suggestions");
  if (q !== null) url.searchParams.set("q", q);
  return new NextRequest(url);
}

test("search-suggestions rejects queries shorter than 2 characters without querying subjects", async () => {
  for (const q of [null, "", " ", "a", " a "]) {
    const res = await GET(requestFor(q));
    const body = await res.json();
    assert.deepEqual(body, { results: [] }, `expected no results for q=${JSON.stringify(q)}`);
  }
});

test("search-suggestions accepts a 2-character query and returns a bounded result set", async () => {
  const res = await GET(requestFor("ma"));
  const body = (await res.json()) as { results: unknown[] };
  assert.ok(Array.isArray(body.results));
  assert.ok(body.results.length <= 8, "typeahead must stay within its 8-result cap");
});
