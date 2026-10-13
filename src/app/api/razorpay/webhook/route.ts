import { NextResponse, type NextRequest } from "next/server";
import { getRazorpayOrder, verifyWebhookSignature } from "@/lib/razorpay";
import { completeRazorpayPurchase } from "@/lib/paid-notes-actions";

// Durable backstop for /api/razorpay/verify: Razorpay calls this
// server-to-server, so even if the student's browser never gets back to us
// (closed tab, network drop after paying) the purchase still gets recorded.
// Configure in the Razorpay dashboard: Settings → Webhooks → this URL,
// event `payment.captured`.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const event = JSON.parse(rawBody);
  if (event.event !== "payment.captured") return NextResponse.json({ ok: true });

  const payment = event.payload?.payment?.entity;
  if (!payment?.order_id || !payment?.id) return NextResponse.json({ ok: true });

  // email/items live on the order's notes, not the payment's.
  const order = await getRazorpayOrder(payment.order_id);
  if (!order) return NextResponse.json({ error: "Order lookup failed." }, { status: 502 }); // non-2xx → Razorpay retries
  const notes = order.notes;
  if (!notes?.email || !notes.items) {
    return NextResponse.json({ ok: true }); // not one of our checkout orders; ack so Razorpay stops retrying
  }

  await completeRazorpayPurchase({
    orderId: payment.order_id,
    paymentId: payment.id,
    email: notes.email,
    phone: notes.phone ?? "",
    items: String(notes.items).split(","),
    amount: Number(notes.amount),
  });

  return NextResponse.json({ ok: true });
}
