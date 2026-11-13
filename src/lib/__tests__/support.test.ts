import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPageUrl, parseKind, parseStatus } from "../support-rules";

test("only known kinds and statuses are accepted", () => {
  assert.equal(parseKind("ERROR"), "ERROR");
  assert.equal(parseKind("nope"), null);
  assert.equal(parseStatus("RESOLVED"), "RESOLVED");
  assert.equal(parseStatus(""), null);
});

test("pageUrl keeps same-site paths only", () => {
  assert.equal(cleanPageUrl("/account/notes/a/b"), "/account/notes/a/b");
  assert.equal(cleanPageUrl("https://evil.com"), null);
  assert.equal(cleanPageUrl("//evil.com"), null);
});
