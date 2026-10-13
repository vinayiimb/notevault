import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRazorpayOrder } from "@/lib/razorpay";
import { normalizeEmail, normalizePhone, priceFor } from "@/lib/paid-notes-pricing";

const MAX_ITEMS = 20;

// Creates a Razorpay order for the items a student picked at checkout.
// Price is always computed here from the item count — never trust a
// client-supplied amount.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = normalizeEmail(String(body?.email ?? ""));
  const phone = normalizePhone(String(body?.phone ?? ""));
  const rawItems: unknown[] = Array.isArray(body?.items) ? body.items : [];
  const requested: string[] = [...new Set(rawItems.map(String))].slice(0, MAX_ITEMS);

  if (!requested.length) return NextResponse.json({ error: "Pick at least one subject." }, { status: 400 });
  if (!email) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "Enter a valid 10-digit WhatsApp number." }, { status: 400 });

  const pairs = requested.map((k) => k.split("/")).filter((p): p is [string, string] => p.length === 2);
  const existing = await prisma.canonicalSubjectNote.findMany({
    where: { OR: pairs.map(([programmeSlug, subjectSlug]) => ({ programmeSlug, subjectSlug })), NOT: { content: "" } },
    select: { programmeSlug: true, subjectSlug: true },
  });
  const items = existing.map((n) => `${n.programmeSlug}/${n.subjectSlug}`);
  if (items.length !== requested.length) {
    return NextResponse.json({ error: "Some selected subjects aren't available. Please reselect." }, { status: 400 });
  }

  const amount = priceFor(items.length);
  const order = await createRazorpayOrder(amount * 100, { email, phone, items: items.join(","), amount: String(amount) });
  return NextResponse.json({ orderId: order.id, amount, keyId: process.env.RAZORPAY_KEY_ID });
}
