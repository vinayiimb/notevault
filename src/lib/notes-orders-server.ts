import { prisma } from "@/lib/prisma";
import { createRazorpayOrder, type RazorpayOrder } from "@/lib/razorpay";
import { ORDER_PRICE, fromRazorpayNotes, parseOrderRequest, toRazorpayNotes } from "@/lib/notes-orders";
import { notifyOwner } from "@/lib/owner-notify";
import { orderAlert } from "@/lib/owner-messages";
import { dscSubjects } from "@/lib/syllabus-subjects";
import { buildOrderMeta, parseOrderMeta } from "@/lib/order-meta";
import { slugify } from "@/lib/utils";

let readyCache: { at: number; ok: boolean } | null = null;

/**
 * True when a payment can be taken AND recorded: Razorpay is configured and the NotesOrder table exists (its
 * migration is applied). Until then the pop-up skips the payment step, so nobody can pay into a table that
 * can't record it. Checked at most once a minute.
 */
export async function notesOrdersReady(): Promise<boolean> {
  if (readyCache && Date.now() - readyCache.at < 60_000) return readyCache.ok;
  let ok = false;
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    try {
      await prisma.notesOrder.findFirst({ select: { id: true } });
      ok = true;
    } catch {
      ok = false;
    }
  }
  readyCache = { at: Date.now(), ok };
  return ok;
}

export type CreateOrderResult =
  | { ok: true; orderId: string; amount: number; keyId: string }
  | { ok: false; status: number; error: string };

/** Creates the Razorpay order for a pop-up purchase. The price comes from ORDER_PRICE, never from the client. */
export async function createNotesOrder(body: unknown): Promise<CreateOrderResult> {
  const req = parseOrderRequest(body);
  if (!req) return { ok: false, status: 400, error: "Some details are missing. Please try again." };
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId || !process.env.RAZORPAY_KEY_SECRET || !(await notesOrdersReady())) {
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
  let created: { id: string; phone: string; programme: string; programmeSlug: string; semester: number; adminNote: string | null } | null = null;
  try {
    created = await prisma.notesOrder.create({
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

  // Only the call that actually recorded the order gets here, so the owner is told exactly once.
  notifyOwner(orderAlert(notes));

  // A whole-semester buyer's subjects (the syllabus's DSC papers) are listed under the order for the delivery tracker.
  // Never allowed to affect the payment: any failure here is only logged.
  if (created && notes.plan === "semester" && notes.semester) await fillPackFromSyllabus(created).catch((err) => console.error("pack subjects not listed:", err));

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

/**
 * Lists the syllabus's DSC papers for the pack's course + semester as separate rows under it (one per subject, to be
 * ticked off on the delivery tracker), skipping any the pack already has. Returns how many were added.
 */
export async function fillPackFromSyllabus(pack: { id: string; phone: string; programme: string; programmeSlug: string; semester: number; adminNote: string | null }): Promise<number> {
  const names = await dscSubjects(pack.programme, pack.semester);
  if (!names.length) return 0;
  const have = await prisma.notesOrder.findMany({ where: { phone: pack.phone, adminNote: { contains: `Under: ${pack.id}` } }, select: { subjectSlug: true } });
  const taken = new Set(have.map((h) => h.subjectSlug));
  const fresh = names.filter((n) => !taken.has(slugify(n)));
  if (!fresh.length) return 0;
  const note = buildOrderMeta({ text: "From the syllabus", under: pack.id, gmail: parseOrderMeta(pack.adminNote).gmail });
  await prisma.notesOrder.createMany({
    data: fresh.map((subject) => {
      const ref = `manual-${crypto.randomUUID()}`;
      return {
        phone: pack.phone, plan: "subject", programmeSlug: pack.programmeSlug, programme: pack.programme, semester: pack.semester,
        subject, subjectSlug: slugify(subject), amount: 0, razorpayOrderId: ref, razorpayPaymentId: ref, adminNote: note,
      };
    }),
  });
  return fresh.length;
}
