import { prisma } from "@/lib/prisma";
import { createRazorpayOrder, type RazorpayOrder } from "@/lib/razorpay";
import { ORDER_PRICE, fromRazorpayNotes, parseOrderRequest, toRazorpayNotes } from "@/lib/notes-orders";

export type CreateOrderResult =
  | { ok: true; orderId: string; amount: number; keyId: string }
  | { ok: false; status: number; error: string };

/** Creates the Razorpay order for a pop-up purchase. The price comes from ORDER_PRICE, never from the client. */
export async function createNotesOrder(body: unknown): Promise<CreateOrderResult> {
  const req = parseOrderRequest(body);
  if (!req) return { ok: false, status: 400, error: "Some details are missing. Please try again." };
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId || !process.env.RAZORPAY_KEY_SECRET) {
    return { ok: false, status: 503, error: "Online payment isn't available right now. We'll WhatsApp you instead." };
  }
  const amount = ORDER_PRICE[req.plan];
  try {
    const order = await createRazorpayOrder(amount * 100, toRazorpayNotes({ ...req, amount }));
    return { ok: true, orderId: order.id, amount, keyId };
  } catch (err) {
    console.error("notes order not created:", err);
    return { ok: false, status: 502, error: "Could not start the payment. Please try again." };
  }
}

export type SettleResult = "recorded" | "not-ours" | "bad-order";

/**
 * Records a paid pop-up order from the Razorpay order it belongs to. Called by both the browser's verify
 * step and the webhook, which can land together, so it is safe to run twice: the second call finds the
 * order already recorded (or loses the unique-id race) and does nothing.
 */
export async function recordNotesOrderFromRazorpay(order: RazorpayOrder, paymentId: string): Promise<SettleResult> {
  const notes = fromRazorpayNotes(order.notes);
  if (!notes) return "not-ours";
  // The order was created here with this exact amount; anything else means the order was tampered with.
  if (order.amount !== notes.amount * 100) return "bad-order";

  const existing = await prisma.notesOrder.findUnique({ where: { razorpayOrderId: order.id }, select: { id: true } });
  if (existing) return "recorded";
  try {
    await prisma.notesOrder.create({
      data: {
        phone: notes.phone,
        plan: notes.plan,
        programmeSlug: notes.programmeSlug,
        programme: notes.programme,
        semester: notes.semester,
        subjectSlug: notes.subjectSlug,
        subject: notes.subject,
        amount: notes.amount,
        razorpayOrderId: order.id,
        razorpayPaymentId: paymentId,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return "recorded";
    throw err;
  }

  // They bought what they asked for, so those asks are no longer open leads.
  await prisma.noteLead
    .updateMany({
      where: {
        phone: notes.phone,
        programmeSlug: notes.programmeSlug,
        status: { in: ["NEW", "CONTACTED"] },
        ...(notes.plan === "subject" ? { subjectSlug: notes.subjectSlug } : { semester: notes.semester }),
      },
      data: { status: "CONVERTED", contactedAt: new Date() },
    })
    .catch((err) => console.error("leads not marked converted:", err));
  return "recorded";
}
