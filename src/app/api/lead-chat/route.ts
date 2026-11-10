import { NextResponse } from "next/server";
import { visitorChatStatus } from "@/lib/pingchat";

// "Did the team write to me?" for a visitor who said Yes and left. The token is their private chat link, so only
// their own browser knows it. Polled by the floating Chat now button.
export const dynamic = "force-dynamic";

const hits = new Map<string, number[]>();
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ?? "local";
  const now = Date.now();
  if (hits.size > 5_000) hits.clear();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  if (list.length > 20) return NextResponse.json({ unread: 0, last: null });
  const token = new URL(req.url).searchParams.get("t") ?? "";
  return NextResponse.json(await visitorChatStatus(token));
}
