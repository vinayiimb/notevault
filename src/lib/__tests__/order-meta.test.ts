import test from "node:test";
import assert from "node:assert/strict";
import { buildOrderMeta, parseOrderMeta, receivedOf } from "../order-meta";

test("old Gmail-only notes still parse", () => {
  assert.deepEqual(parseOrderMeta("Gmail: a@gmail.com"), { text: "", gmail: "a@gmail.com", under: "", unpaid: false, paid: null, site: "" });
});

test("text, Under and Gmail round-trip", () => {
  const note = buildOrderMeta({ text: "Added by admin", under: "ck1", gmail: "a@gmail.com" });
  assert.equal(note, "Added by admin | Under: ck1 | Gmail: a@gmail.com");
  assert.deepEqual(parseOrderMeta(note), { text: "Added by admin", gmail: "a@gmail.com", under: "ck1", unpaid: false, paid: null, site: "" });
});

test("empty notes", () => {
  assert.equal(buildOrderMeta({}), null);
  assert.deepEqual(parseOrderMeta(null), { text: "", gmail: "", under: "", unpaid: false, paid: null, site: "" });
});

test("unpaid flag round-trips", () => {
  const note = buildOrderMeta({ text: "Added by admin", gmail: "a@gmail.com", unpaid: true });
  assert.equal(note, "Added by admin | Gmail: a@gmail.com | Unpaid");
  assert.equal(parseOrderMeta(note).unpaid, true);
  assert.equal(parseOrderMeta("Added by admin").unpaid, false);
});

test("part payments", () => {
  const note = buildOrderMeta({ text: "Added by admin", paid: 100 });
  assert.equal(note, "Added by admin | Paid: 100");
  const meta = parseOrderMeta(note);
  assert.equal(meta.paid, 100);
  assert.equal(receivedOf(199, meta), 100);
  assert.equal(receivedOf(199, parseOrderMeta("Added by admin")), 199);
  assert.equal(receivedOf(199, parseOrderMeta("Unpaid")), 0);
  assert.equal(receivedOf(50, parseOrderMeta("Paid: 80")), 50);
});

test("site marker round-trips", () => {
  const note = buildOrderMeta({ text: "Added by admin", gmail: "a@gmail.com", site: "bcom-p/risk-management" });
  assert.equal(note, "Added by admin | Gmail: a@gmail.com | Site: bcom-p/risk-management");
  assert.equal(parseOrderMeta(note).site, "bcom-p/risk-management");
});
