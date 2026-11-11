import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseIntent, seedText } from "@/lib/lead-intent";
import { notifyOwner } from "@/lib/owner-notify";
import { intentAlert } from "@/lib/owner-messages";
import { seedVisitorChat } from "@/lib/pingchat";

// Public beacon from the notes pop-up (and the floating "Chat now"): records that a visitor clicked Yes / opened the
// chat / chose WhatsApp, and tells the owner the first time. Never throws at the visitor and never blocks them.
export const dynamic = "force-dynamic";

// Per IP, in memory: enough to stop a script from filling the table or spamming the owner's phone.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_EVENTS = 30;
const MAX_ALERTS_PER_HOUR = 6;
const hits = new Map<string, number[]>();
const alerts = new Map<string, number[]>();
function over(map: Map<string, number[]>, ip: string, windowMs: number, max: number) {
  const now = Date.now();
  if (map.size > 5_000) map.clear();
  const list = (map.get(ip) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  map.set(ip, list);
  return list.length > max;
}

export async function POST(req: Request) {
  const ok = NextResponse.json({ ok: true });
  const ip = req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ?? "local";
  if (over(hits, ip, WINDOW_MS, MAX_EVENTS)) return ok;
  const raw = await req.text().catch(() => "");
  if (raw.length > 2_000) return ok;
  let body: unknown = null;
  try { body = JSON.parse(raw); } catch {}
  const i = parseIntent(body);
  if (!i) return ok;

  let existed = false;
  let first = true; // if the record can't be read or written, still treat it as new: the alert matters more than the record
  try {
    const now = new Date();
    const existing = await prisma.leadIntent.findUnique({ where: { visitorId_key: { visitorId: i.vid, key: i.key } } });
    existed = !!existing;
    first = i.event === "yes" ? !existing : i.event === "chat" ? !existing?.chatAt : !existing?.waAt;
    const stamp = i.event === "chat" ? { chatAt: existing?.chatAt ?? now } : i.event === "wa" ? { waAt: existing?.waAt ?? now } : {};
    await prisma.leadIntent.upsert({
      where: { visitorId_key: { visitorId: i.vid, key: i.key } },
      create: { visitorId: i.vid, key: i.key, source: i.source, programme: i.programme, subject: i.subject, semester: i.semester, ...stamp },
      update: { ...stamp, ...(i.semester ? { semester: i.semester } : {}) },
    });
  } catch (err) {
    console.error("lead intent not saved (is the LeadIntent migration applied?):", err);
  }
  // "wa" is shown in the admin only: the lead form's own alert already tells the owner when a number arrives.
  let chat: string | null = null;
  if (first && i.event !== "wa" && !over(alerts, ip, 60 * 60 * 1000, MAX_ALERTS_PER_HOUR)) notifyOwner(intentAlert(i.event as "yes" | "chat", i));
  // Put this visitor in the chat inbox now, so the team can say hi even if they close the tab. The reply is found
  // through the private link the browser keeps (see chat-now-fab). Not tied to the alert limit above: many students on
  // one college Wi-Fi share an IP, and each of them must still land in the inbox.
  // 💎 = clicked Yes (WhatsApp opens for them). ⭐ = said No to the pop-up and the chat opened instead; the plain
  // "Chat now" button seeds nothing, and nobody who already said Yes gets a second, lower-tier line.
  const tone = i.event === "yes" ? "yes" : i.event === "chat" && i.source !== "chat-button" && !existed ? "no" : null;
  if (first && tone) chat = await seedVisitorChat(i.vid, seedText(tone, i));
  return NextResponse.json({ ok: true, chat });
}
