import { test } from "node:test";
import assert from "node:assert/strict";
import { CACHE_TAGS } from "@/lib/cache-tags";

test("CACHE_TAGS only contains shared, non-personalized cache keys", () => {
  const values = Object.values(CACHE_TAGS);
  assert.ok(values.length > 0);
  for (const tag of values) {
    assert.equal(typeof tag, "string");
    assert.ok(tag.length > 0);
    // Regression guard: a tag containing "user"/"session"/"admin" would be a
    // strong signal someone tried to cache personalized data under a tag
    // meant for shared public content (see docs/PHASE_2_QUERY_REMEDIATION.md
    // — admin/user data must never be cached publicly).
    assert.ok(
      !/user|session|admin|student/i.test(tag),
      `cache tag "${tag}" looks user/session-scoped, which should never be publicly cached`,
    );
  }
});
