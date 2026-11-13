import { NextResponse } from "next/server";
import { notesOrdersReady } from "@/lib/notes-orders-server";

export const dynamic = "force-dynamic";

// Tells the pricing sheet whether paying on the site works right now (Razorpay set up and the orders table there).
// Cached a minute inside notesOrdersReady(); no data about anyone.
export async function GET() {
  return NextResponse.json({ ready: await notesOrdersReady() });
}
