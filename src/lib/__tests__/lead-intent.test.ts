import test from "node:test";
import assert from "node:assert/strict";
import { intentScore, isSeedMessage, parseIntent, seedText, validVisitorId } from "../lead-intent";
import { notesAskText, notesWhatsAppLink } from "../note-leads";
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
  assert.match(intentAlert("yes", { programme: "B.Com", subject: "Management", semester: 1 }), /💎[\s\S]*Yes, I need notes[\s\S]*WhatsApp opened/);
  assert.match(intentAlert("chat", { programme: "", subject: "", semester: null, source: "chat-button" }), /live chat/);
  assert.match(intentAlert("chat", { programme: "", subject: "", semester: null, source: "pyq-page" }), /⭐/);
});

test("team-side seeds carry 💎 / ⭐ and are recognised so the visitor never sees them", () => {
  const i = { programme: "B.Com", subject: "Management", semester: 1 };
  assert.ok(seedText("yes", i).startsWith("💎") && seedText("no", i).startsWith("⭐"));
  assert.ok(isSeedMessage(seedText("yes", i)) && isSeedMessage(seedText("no", i)));
  assert.equal(isSeedMessage("Hi, I need notes"), false);
});

test("the WhatsApp message is pre-filled with subject, course and semester", () => {
  assert.equal(notesAskText({ subject: "Microeconomics", programme: "B.A. (Hons) Economics", semester: 3 }), "Microeconomics (B.A. (Hons) Economics), Semester 3");
  assert.equal(notesAskText({ programme: "B.Com", semester: 2 }), "B.Com, Semester 2");
  assert.equal(notesAskText({}), "my DU subject");
  const url = new URL(notesWhatsAppLink({ subject: "Microeconomics", programme: "B.A. (Hons) Economics", semester: 3 }));
  assert.equal(url.pathname, "/919376180015");
  assert.equal(url.searchParams.get("text"), "💎 Hi! I would like the notes for Microeconomics (B.A. (Hons) Economics), Semester 3. Please share the details.");
});
