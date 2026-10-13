import { NextResponse, type NextRequest } from "next/server";
import { getRazorpayOrder, verifyCheckoutSignature } from "@/lib/razorpay";
import { completeRazorpayPurchase } from "@/lib/paid-notes-actions";
import { STUDENT_COOKIE, STUDENT_COOKIE_OPTIONS, signStudentSession } from "@/lib/paid-notes";

// Called by the browser right after Razorpay Checkout's success handler.
// Verifies the payment really happened (HMAC signature, not just "the popup
// closed"), then logs the student in immediately. The webhook is the
// durable backstop if this call never lands (tab closed, network drop).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body ?? {};
  if (!orderId || !paymentId || !signature) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
  }
  if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
    return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
  }

  const order = await getRazorpayOrder(orderId);
  const notes = order?.notes;
  if (!notes?.email || !notes.items) return NextResponse.json({ error: "Order not found." }, { status: 400 });

  await completeRazorpayPurchase({
    orderId,
    paymentId,
    email: notes.email,
    phone: notes.phone,
    items: notes.items.split(","),
    amount: Number(notes.amount),
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(STUDENT_COOKIE, signStudentSession(notes.email), STUDENT_COOKIE_OPTIONS);
  return res;
}
