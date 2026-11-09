import { NextResponse, type NextRequest } from "next/server";
import { getRazorpayOrder, verifyCheckoutSignature } from "@/lib/razorpay";
import { completeRazorpayPurchase } from "@/lib/paid-notes-actions";
import { startStudentSession } from "@/lib/student-devices";

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

  // Sign them in on this device — unless both of their device slots are already in use,
  // in which case the purchase still stands and they pick a device to replace at /login.
  const started = await startStudentSession(notes.email);
  return NextResponse.json({ ok: true, signedIn: started.ok });
}
