import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { notifyOwner, ownerNotifyProvider, sendOwnerWhatsApp } from "../owner-notify";
import { chatAlert, feedbackAlert, leadAlert, orderAlert, paymentAlert } from "../owner-messages";

type Hit = { method: string; url: string; auth: string | undefined; body: string };

// A stand-in for CallMeBot / the WhatsApp Cloud API that records what it receives.
async function stub(status = 200) {
  const hits: Hit[] = [];
  const server = createServer(async (req: IncomingMessage, res) => {
    let body = "";
    for await (const c of req) body += c;
    hits.push({ method: req.method ?? "", url: req.url ?? "", auth: req.headers.authorization, body });
    res.statusCode = status;
    res.end("{}");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { hits, base, close: () => new Promise<void>((r) => server.close(() => r())) };
}

const ENV_KEYS = ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "OWNER_WHATSAPP", "WHATSAPP_TEMPLATE", "WHATSAPP_TEMPLATE_LANG", "WHATSAPP_GRAPH_URL", "CALLMEBOT_PHONE", "CALLMEBOT_APIKEY", "CALLMEBOT_URL", "OWNER_NOTIFY_GAP_MS"];
function clean() {
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.OWNER_NOTIFY_GAP_MS = "0";
}

test("no provider configured: alerts are skipped and nothing throws", async () => {
  clean();
  assert.equal(ownerNotifyProvider(), null);
  assert.equal(await sendOwnerWhatsApp("hi"), "skipped");
  notifyOwner("hi"); // must be a silent no-op
});

test("CallMeBot: a GET with the owner's number, the text and the key", async () => {
  clean();
  const s = await stub();
  Object.assign(process.env, { CALLMEBOT_URL: s.base + "/whatsapp.php", CALLMEBOT_PHONE: "+91 93761 80015", CALLMEBOT_APIKEY: "key123" });
  assert.equal(ownerNotifyProvider(), "callmebot");
  assert.equal(await sendOwnerWhatsApp("🔔 New lead\nline two"), "sent");
  const u = new URL("http://x" + s.hits[0].url);
  assert.equal(s.hits[0].method, "GET");
  assert.equal(u.searchParams.get("phone"), "919376180015");
  assert.equal(u.searchParams.get("apikey"), "key123");
  assert.equal(u.searchParams.get("text"), "🔔 New lead\nline two");
  await s.close();
});

test("Cloud API: bearer token, plain text message; wins when both providers are set", async () => {
  clean();
  const s = await stub();
  Object.assign(process.env, { WHATSAPP_GRAPH_URL: s.base, WHATSAPP_TOKEN: "tok", WHATSAPP_PHONE_NUMBER_ID: "555", OWNER_WHATSAPP: "919376180015", CALLMEBOT_PHONE: "1", CALLMEBOT_APIKEY: "k" });
  assert.equal(ownerNotifyProvider(), "cloud");
  assert.equal(await sendOwnerWhatsApp("hello"), "sent");
  assert.equal(s.hits[0].method, "POST");
  assert.equal(s.hits[0].url, "/555/messages");
  assert.equal(s.hits[0].auth, "Bearer tok");
  const b = JSON.parse(s.hits[0].body);
  assert.deepEqual([b.to, b.type, b.text.body], ["919376180015", "text", "hello"]);
  await s.close();
});

test("Cloud API with a template: one variable, and no line breaks in it", async () => {
  clean();
  const s = await stub();
  Object.assign(process.env, { WHATSAPP_GRAPH_URL: s.base, WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1", OWNER_WHATSAPP: "919376180015", WHATSAPP_TEMPLATE: "new_lead", WHATSAPP_TEMPLATE_LANG: "en_IN" });
  await sendOwnerWhatsApp("line one\nline two\n\nline three");
  const b = JSON.parse(s.hits[0].body);
  assert.equal(b.type, "template");
  assert.equal(b.template.name, "new_lead");
  assert.equal(b.template.language.code, "en_IN");
  const text = b.template.components[0].parameters[0].text as string;
  assert.ok(!/\n/.test(text));
  assert.equal(text, "line one | line two | line three");
  await s.close();
});

test("a failing provider returns 'failed' and never throws; an unreachable one too", async () => {
  clean();
  const bad = await stub(500);
  Object.assign(process.env, { CALLMEBOT_URL: bad.base, CALLMEBOT_PHONE: "919376180015", CALLMEBOT_APIKEY: "k" });
  assert.equal(await sendOwnerWhatsApp("x"), "failed");
  await bad.close();
  process.env.CALLMEBOT_URL = "http://127.0.0.1:9/never";
  assert.equal(await sendOwnerWhatsApp("x"), "failed");
});

test("notifyOwner is fire-and-forget, in order, one at a time", async () => {
  clean();
  const s = await stub();
  Object.assign(process.env, { CALLMEBOT_URL: s.base, CALLMEBOT_PHONE: "919376180015", CALLMEBOT_APIKEY: "k" });
  for (const t of ["one", "two", "three"]) notifyOwner(t);
  for (let i = 0; i < 50 && s.hits.length < 3; i++) await new Promise((r) => setTimeout(r, 40));
  assert.deepEqual(s.hits.map((h) => new URL("http://x" + h.url).searchParams.get("text")), ["one", "two", "three"]);
  await s.close();
});

test("lead alert: who, what, where from, and a tap-to-reply link to that student", () => {
  const t = leadAlert({ phone: "919876543210", programme: "B.A. (Hons) Economics", semester: 3, subject: "Microeconomics", hasNotes: false, source: "paper-pdf" });
  for (const part of ["New lead", "+91 98765 43210", "Microeconomics", "Sem 3", "No notes yet", "opening a free paper", "https://wa.me/919876543210?text="]) assert.ok(t.includes(part), part);
});

test("chat, order and payment alerts carry the amount, the plan and who to reply to", () => {
  const lead = { phone: "919876543210", programme: "B.A. Eco", semester: 3, subject: "Micro", hasNotes: false };
  assert.ok(chatAlert(lead).includes("message them first") && chatAlert(lead).includes("wa.me/919876543210"));
  const o = orderAlert({ phone: "919876543210", plan: "semester", subject: "", semester: 3, programme: "B.A. Eco", amount: 149 });
  for (const part of ["₹149 paid", "Whole Semester 3", "within 24 hours", "wa.me/919876543210", "/admin/leads"]) assert.ok(o.includes(part), part);
  const p = paymentAlert({ phone: "919876543210", email: "a@b.com", amount: 99, utr: "123456789012" });
  for (const part of ["₹99", "a@b.com", "UTR 123456789012", "/admin/payments"]) assert.ok(p.includes(part), part);
});

test("feedback alert: long messages are cut, a screenshot becomes a full link", () => {
  const long = feedbackAlert("word ".repeat(300), "/uploads/feedback/x.png");
  assert.ok(long.length < 700 && long.includes("…"));
  assert.ok(long.includes("https://www.dupyq.online/uploads/feedback/x.png"));
  assert.ok(feedbackAlert("short", null).includes('"short"'));
});
