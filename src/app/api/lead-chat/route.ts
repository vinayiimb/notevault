import { NextResponse } from "next/server";
import { seedVisitorChat, visitorChatStatus, visitorThread } from "@/lib/pingchat";
import { validVisitorId } from "@/lib/lead-intent";

// "Did the team write to me?" for a visitor who said Yes and left. The token is their private chat link, so only
// their own browser knows it. Polled by the floating Chat now button.
export const dynamic = "force-dynamic";

const hits = new Map<string, number[]>();
const sends = new Map<string, number[]>();
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ?? "local";
  const now = Date.now();
  if (hits.size > 5_000) hits.clear();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  if (list.length > 20) return NextResponse.json({ unread: 0, last: null });
  const sp = new URL(req.url).searchParams;
  const token = sp.get("t") ?? "";
  if (sp.get("thread")) return NextResponse.json({ messages: await visitorThread(token) });
  return NextResponse.json(await visitorChatStatus(token));
}

// A message typed in the on-site chat panel. It goes into the same PingChat conversation the "Yes" click opened
// (found by the visitor's id), so the team answers from their one inbox. Returns the visitor's private chat link.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ?? "local";
  const now = Date.now();
  const list = (sends.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  sends.set(ip, list);
  if (sends.size > 5_000) sends.clear();
  if (list.length > 12) return NextResponse.json({ ok: false, error: "slow-down" }, { status: 429 });
  const raw = await req.text().catch(() => "");
  if (raw.length > 2_000) return NextResponse.json({ ok: false }, { status: 413 });
  let b: { vid?: unknown; text?: unknown } = {};
  try { b = JSON.parse(raw); } catch {}
  const vid = validVisitorId(b.vid);
  const text = String(b.text ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!vid || !text) return NextResponse.json({ ok: false }, { status: 400 });
  const link = await seedVisitorChat(vid, text);
  return NextResponse.json({ ok: !!link, link });
}
