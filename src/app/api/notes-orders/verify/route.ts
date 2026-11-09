import { NextResponse, type NextRequest } from "next/server";
import { getRazorpayOrder, verifyCheckoutSignature } from "@/lib/razorpay";
import { recordNotesOrderFromRazorpay } from "@/lib/notes-orders-server";

export const dynamic = "force-dynamic";

// Called by the browser right after Razorpay Checkout reports success. Checks the payment really happened
// (HMAC signature, not just "the window closed") and records the order for the admin. The webhook is the
// durable backstop if this call never lands (tab closed, network drop).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body ?? {};
  if (!orderId || !paymentId || !signature) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
  }
  if (!verifyCheckoutSignature(String(orderId), String(paymentId), String(signature))) {
    return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
  }

  const order = await getRazorpayOrder(String(orderId));
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 400 });
  const result = await recordNotesOrderFromRazorpay(order, String(paymentId));
  if (result !== "recorded") return NextResponse.json({ error: "Order not found." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
