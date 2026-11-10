import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/paid-notes-pricing";
import { buildOrderMeta, parseOrderMeta } from "@/lib/order-meta";

export const dynamic = "force-dynamic";

// After paying, the student tells us which Gmail they will read the notes with (and their name). The Razorpay order id +
// payment id in the request are the proof that this is the buyer: only someone who just paid has both.
export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const orderId = String(b?.orderId ?? "");
  const paymentId = String(b?.paymentId ?? "");
  const email = normalizeEmail(String(b?.email ?? ""));
  const name = String(b?.name ?? "").trim().slice(0, 80);
  if (!orderId || !paymentId || !email) return NextResponse.json({ error: "Enter a valid Gmail address." }, { status: 400 });

  const order = await prisma.notesOrder
    .findFirst({ where: { razorpayOrderId: orderId, razorpayPaymentId: paymentId }, select: { id: true, phone: true, adminNote: true } })
    .catch(() => null);
  if (!order) return NextResponse.json({ error: "We could not find your payment yet. Please try again in a minute." }, { status: 404 });

  // Kept on the order itself (always works) and on the student's profile (when its table exists).
  await prisma.notesOrder.update({ where: { id: order.id }, data: { adminNote: buildOrderMeta({ ...parseOrderMeta(order.adminNote), gmail: email }) } });
  await prisma.notesStudent
    .upsert({ where: { phone: order.phone }, create: { phone: order.phone, gmail: email, name: name || null }, update: { gmail: email, ...(name ? { name } : {}) } })
    .catch((err) => console.error("student profile not saved:", err));
  return NextResponse.json({ ok: true });
}
