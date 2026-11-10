import test from "node:test";
import assert from "node:assert/strict";
import { buildOrderMeta, parseOrderMeta } from "../order-meta";

test("old Gmail-only notes still parse", () => {
  assert.deepEqual(parseOrderMeta("Gmail: a@gmail.com"), { text: "", gmail: "a@gmail.com", under: "" });
});

test("text, Under and Gmail round-trip", () => {
  const note = buildOrderMeta({ text: "Added by admin", under: "ck1", gmail: "a@gmail.com" });
  assert.equal(note, "Added by admin | Under: ck1 | Gmail: a@gmail.com");
  assert.deepEqual(parseOrderMeta(note), { text: "Added by admin", gmail: "a@gmail.com", under: "ck1" });
});

test("empty notes", () => {
  assert.equal(buildOrderMeta({}), null);
  assert.deepEqual(parseOrderMeta(null), { text: "", gmail: "", under: "" });
});
