import { NextResponse } from "next/server";
import { leadWantsChatAction } from "@/lib/note-lead-actions";

// "Message me on WhatsApp first" in the purchase step (a plain POST for the same reason as ../route.ts).
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const b = (await req.json().catch(() => null)) as { phone?: unknown } | null;
    return NextResponse.json(await leadWantsChatAction({ phone: String(b?.phone ?? "") }));
  } catch (err) {
    console.error("chat request failed:", err);
    return NextResponse.json({ ok: false });
  }
}
