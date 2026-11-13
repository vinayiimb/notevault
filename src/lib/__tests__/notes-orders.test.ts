import test from "node:test";
import assert from "node:assert/strict";
import { PACKS } from "../paid-notes-pricing";
import {
  NOTES_ORDER_KIND,
  ORDER_PRICE,
  fromRazorpayNotes,
  orderPlanLabel,
  orderWhatsAppText,
  parseOrderPlan,
  parseOrderRequest,
  toRazorpayNotes,
} from "../notes-orders";

const subjectReq = {
  plan: "subject",
  phone: "919876543210",
  programme: "B.A. (Hons) Economics",
  programmeSlug: "ba-hons-economics",
  semester: 3,
  subject: "Microeconomics",
  subjectSlug: "microeconomics",
};

test("prices come from the /paid-notes packs: one subject and the Whole Semester pack", () => {
  assert.equal(ORDER_PRICE.subject, PACKS[0].price);
  assert.equal(ORDER_PRICE.semester, PACKS.find((p) => p.name === "Whole Semester")!.price);
  assert.ok(ORDER_PRICE.semester > ORDER_PRICE.subject);
});

test("plan: only the two known plans", () => {
  assert.equal(parseOrderPlan("subject"), "subject");
  assert.equal(parseOrderPlan("semester"), "semester");
  for (const bad of ["", "free", "SEMESTER", null, undefined, 3]) assert.equal(parseOrderPlan(bad), null, String(bad));
});

test("order request: a subject order keeps its subject, and any client-sent price is ignored", () => {
  const r = parseOrderRequest({ ...subjectReq, amount: 1, price: 1 });
  assert.ok(r);
  assert.equal(r.plan, "subject");
  assert.equal(r.subject, "Microeconomics");
  assert.ok(!("amount" in r) && !("price" in r));
});

test("order request: a semester order drops the subject", () => {
  const r = parseOrderRequest({ ...subjectReq, plan: "semester" });
  assert.ok(r);
  assert.equal(r.subject, "");
  assert.equal(r.subjectSlug, "");
});

test("order request: rejects missing or invalid details", () => {
  const bad = [
    { ...subjectReq, phone: "12345" },
    { ...subjectReq, phone: "" },
    { ...subjectReq, semester: 9 },
    { ...subjectReq, semester: undefined },
    { ...subjectReq, programme: "" },
    { ...subjectReq, programmeSlug: "" },
    { ...subjectReq, plan: "gold" },
    { ...subjectReq, subject: "" },
    { ...subjectReq, subjectSlug: "" },
    null,
    "nope",
  ];
  for (const b of bad) assert.equal(parseOrderRequest(b), null, JSON.stringify(b));
});

test("order request: normalises the phone and trims long text", () => {
  const r = parseOrderRequest({ ...subjectReq, phone: "+91 98765-43210", programme: "x".repeat(500) });
  assert.ok(r);
  assert.equal(r.phone, "919876543210");
  assert.equal(r.programme.length, 120);
});

test("Razorpay notes: round trip, and stamped as this flow's orders", () => {
  const req = parseOrderRequest(subjectReq)!;
  const notes = toRazorpayNotes({ ...req, amount: ORDER_PRICE.subject });
  assert.equal(notes.kind, NOTES_ORDER_KIND);
  for (const v of Object.values(notes)) assert.ok(typeof v === "string" && v.length <= 256);
  assert.deepEqual(fromRazorpayNotes(notes), { ...req, amount: ORDER_PRICE.subject });
});

test("Razorpay notes: other orders and damaged notes are not ours", () => {
  const req = parseOrderRequest(subjectReq)!;
  const good = toRazorpayNotes({ ...req, amount: 49 });
  assert.equal(fromRazorpayNotes(undefined), null);
  assert.equal(fromRazorpayNotes({ email: "a@b.com", items: "x/y", amount: "49" }), null); // an old checkout order
  assert.equal(fromRazorpayNotes({ ...good, kind: "other" }), null);
  for (const amount of ["0", "-5", "49.5", "abc", "", "99999"]) assert.equal(fromRazorpayNotes({ ...good, amount }), null, amount);
  assert.equal(fromRazorpayNotes({ ...good, phone: "123" }), null);
  assert.equal(fromRazorpayNotes({ ...good, semester: "12" }), null);
});

test("labels: whole semester vs subject, and the buyer message names what they bought", () => {
  assert.equal(orderPlanLabel({ plan: "semester", subject: "", semester: 3 }), "Whole Semester 3");
  assert.equal(orderPlanLabel({ plan: "subject", subject: "Micro", semester: 3 }), "Micro");
  const t = orderWhatsAppText({ plan: "semester", subject: "", semester: 3, programme: "B.A. Eco" });
  assert.ok(t.includes("Whole Semester 3") && t.includes("B.A. Eco"));
});

test("a pay-first chat order needs only a phone and a plan, semester 0", () => {
  const sub = parseOrderRequest({ plan: "subject", phone: "9876543210", programmeSlug: "chat" });
  assert.equal(sub?.semester, 0);
  assert.equal(sub?.programmeSlug, "chat");
  assert.equal(parseOrderRequest({ plan: "semester", phone: "9876543210", programmeSlug: "chat" })?.subject, "");
  assert.equal(parseOrderRequest({ plan: "semester", phone: "123", programmeSlug: "chat" }), null);
  assert.equal(parseOrderRequest({ plan: "semester", phone: "9876543210", programmeSlug: "other", programme: "X" }), null); // a real course still needs its semester
  const back = fromRazorpayNotes(toRazorpayNotes({ ...sub!, amount: 99 }));
  assert.equal(back?.amount, 99);
});

test("the 3-subject pack exists only as a chat order, at its pack price", () => {
  assert.equal(ORDER_PRICE.three, PACKS[1].price);
  assert.equal(parseOrderRequest({ plan: "three", phone: "9876543210", programmeSlug: "chat" })?.plan, "three");
  assert.equal(parseOrderRequest({ plan: "three", phone: "9876543210", programmeSlug: "bcom-hons", programme: "B.Com", semester: 3 }), null);
  assert.equal(orderPlanLabel({ plan: "three", subject: "", semester: 0 }), "3 subjects");
});

test("MRQ and Notes pricing-sheet plans are pay-first only, at their sheet prices", () => {
  assert.deepEqual([ORDER_PRICE.mrq1, ORDER_PRICE.mrq7, ORDER_PRICE.notes1, ORDER_PRICE.notes7], [49, 249, 99, 449]);
  assert.equal(7 * ORDER_PRICE.notes1, 693); // list price of 7 Notes, sold at ₹449
  for (const plan of ["mrq1", "mrq7", "notes1", "notes7"]) {
    assert.equal(parseOrderPlan(plan), plan);
    const o = parseOrderRequest({ plan, phone: "9876543210", programmeSlug: "chat" });
    assert.equal(o?.plan, plan);
    assert.equal(o?.semester, 0);
    assert.equal(parseOrderRequest({ plan, phone: "9876543210", programmeSlug: "bcom-hons", programme: "B.Com", semester: 3 }), null);
  }
  assert.equal(orderPlanLabel({ plan: "mrq7", subject: "", semester: 0 }), "MRQ · 7 subjects");
  assert.equal(orderPlanLabel({ plan: "notes1", subject: "", semester: 0 }), "Notes · 1 subject");
  const back = fromRazorpayNotes(toRazorpayNotes({ ...parseOrderRequest({ plan: "notes7", phone: "9876543210", programmeSlug: "chat" })!, amount: ORDER_PRICE.notes7 }));
  assert.equal(back?.amount, 449);
});
