import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseIntent } from "@/lib/lead-intent";
import { notifyOwner } from "@/lib/owner-notify";
import { intentAlert } from "@/lib/owner-messages";

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

  try {
    const now = new Date();
    const existing = await prisma.leadIntent.findUnique({ where: { visitorId_key: { visitorId: i.vid, key: i.key } } });
    const first = i.event === "yes" ? !existing : i.event === "chat" ? !existing?.chatAt : !existing?.waAt;
    const stamp = i.event === "chat" ? { chatAt: existing?.chatAt ?? now } : i.event === "wa" ? { waAt: existing?.waAt ?? now } : {};
    await prisma.leadIntent.upsert({
      where: { visitorId_key: { visitorId: i.vid, key: i.key } },
      create: { visitorId: i.vid, key: i.key, source: i.source, programme: i.programme, subject: i.subject, semester: i.semester, ...stamp },
      update: { ...stamp, ...(i.semester ? { semester: i.semester } : {}) },
    });
    // "wa" is shown in the admin only: the lead form's own alert already tells the owner when a number arrives.
    if (first && i.event !== "wa" && !over(alerts, ip, 60 * 60 * 1000, MAX_ALERTS_PER_HOUR)) notifyOwner(intentAlert(i.event, i));
  } catch (err) {
    console.error("lead intent not saved (is the LeadIntent migration applied?):", err);
    // Still tell the owner about a first-time "yes"/"chat" click: the alert matters more than the record.
    if (i.event !== "wa" && !over(alerts, ip, 60 * 60 * 1000, MAX_ALERTS_PER_HOUR)) notifyOwner(intentAlert(i.event, i));
  }
  return ok;
}
