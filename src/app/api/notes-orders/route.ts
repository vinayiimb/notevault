import { NextResponse, type NextRequest } from "next/server";
import { createNotesOrder } from "@/lib/notes-orders-server";

export const dynamic = "force-dynamic";

// Starts a pop-up purchase: creates the Razorpay order with a server-decided price. Each call creates an
// order at Razorpay, so a visitor gets a handful per window (in memory per instance, like the lead form).
const MAX_PER_WINDOW = 10;
const WINDOW_MS = 10 * 60 * 1000;
const recent = new Map<string, number[]>();

function throttled(ip: string) {
  const now = Date.now();
  if (recent.size > 5_000) recent.clear();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > MAX_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ?? "local";
  if (throttled(ip)) {
    return NextResponse.json({ error: "Too many attempts. Please try again in a few minutes." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const result = await createNotesOrder(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ orderId: result.orderId, amount: result.amount, keyId: result.keyId });
}
