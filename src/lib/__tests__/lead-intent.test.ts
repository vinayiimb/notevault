import test from "node:test";
import assert from "node:assert/strict";
import { intentScore, parseIntent, validVisitorId } from "../lead-intent";
import { intentAlert } from "../owner-messages";

const vid = "a1b2c3d4-e5f6-4789-a012-b3c4d5e6f708";

test("parseIntent accepts a real click and normalises it", () => {
  const i = parseIntent({ vid, event: "yes", source: "pyq-page", programme: "  B.Com (H) ", subject: "Management  Principles", semester: "1" });
  assert.ok(i);
  assert.equal(i.semester, 1);
  assert.equal(i.subject, "Management Principles");
  assert.equal(i.key, "pyq-page|b.com (h)|management principles");
});

test("parseIntent rejects junk: bad id, unknown event, non-object", () => {
  assert.equal(parseIntent({ vid: "short", event: "yes" }), null);
  assert.equal(parseIntent({ vid, event: "buy" }), null);
  assert.equal(parseIntent(null), null);
  assert.equal(parseIntent({ vid: vid + "<script>", event: "yes" }), null);
  assert.equal(parseIntent({ vid, event: "yes", semester: 99 })?.semester, null);
});

test("chat outranks WhatsApp outranks a bare Yes", () => {
  assert.ok(intentScore({ chatAt: new Date() }) > intentScore({ waAt: new Date() }));
  assert.ok(intentScore({ waAt: new Date() }) > intentScore({}));
});

test("validVisitorId only passes well-formed ids", () => {
  assert.equal(validVisitorId(vid), vid);
  assert.equal(validVisitorId("x"), "");
  assert.equal(validVisitorId(undefined), "");
});

test("intent alerts say what happened and that there is no number", () => {
  assert.match(intentAlert("yes", { programme: "B.Com", subject: "Management", semester: 1 }), /Yes, I need notes[\s\S]*No number yet/);
  assert.match(intentAlert("chat", { programme: "", subject: "", semester: null }), /live chat/);
});
