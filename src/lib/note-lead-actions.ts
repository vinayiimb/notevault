"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { findCanonicalProgramme, findCanonicalSubject } from "@/lib/canonical-subject-notes-data";
import { slugify } from "@/lib/utils";
import { normalizePhone } from "@/lib/paid-notes-pricing";
import { validVisitorId } from "@/lib/lead-intent";
import { notesOrdersReady } from "@/lib/notes-orders-server";
import { notifyOwner } from "@/lib/owner-notify";
import { chatAlert, leadAlert, leadLostAlert, returningLeadAlert } from "@/lib/owner-messages";
import {
  ANY_SUBJECT,
  ANY_SUBJECT_SLUG,
  LEAD_STATUSES,
  isPaperSource,
  parseLeadPhone,
  parseLeadSemester,
  parseLeadSource,
  type LeadStatusName,
} from "@/lib/note-leads";

export type LeadResult = {
  ok?: boolean;
  error?: string;
  subject?: string;
  hasNotes?: boolean;
  // What the student asked for, so the pop-up can offer to buy it. Absent for the bot honeypot's fake "ok".
  phone?: string;
  programme?: string;
  programmeSlug?: string;
  subjectSlug?: string;
  semester?: number;
  /** The payment step can be offered (Razorpay configured and the orders table exists). */
  canBuy?: boolean;
};

// A few submissions per visitor is plenty; this only stops a script flooding the table.
// In memory per instance, which is enough while there is one server.
const MAX_PER_WINDOW = 6;
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

// ---------- Student ----------

export async function submitNoteLeadAction(_prev: LeadResult, formData: FormData): Promise<LeadResult> {
  // Honeypot: real visitors never see this field, bots fill it. Answer "ok" so they move on.
  if (String(formData.get("website") ?? "")) return { ok: true };

  const phone = parseLeadPhone(String(formData.get("phone") ?? ""));
  const semester = parseLeadSemester(formData.get("semester"));
  const source = parseLeadSource(formData.get("source"));
  const programmeIn = String(formData.get("programme") ?? "");
  const subjectIn = String(formData.get("subject") ?? "");
  // The PYQ pages name courses and subjects as printed on the papers, which isn't always a notes
  // subject. A student on those pages is still a lead, so keep them under the names they were looking at.
  const typed = (key: string) => String(formData.get(key) ?? "").trim().slice(0, 120);
  const anySubject = source === "pyq-page" && !subjectIn; // "I need notes for this course", subject not picked

  let target: { programmeSlug: string; programmeName: string; subjectSlug: string; subjectName: string } | null = null;
  if (anySubject) {
    const programme = await findCanonicalProgramme(programmeIn);
    const name = programme?.name ?? (isPaperSource(source) ? typed("programmeName") : "");
    if (name) {
      target = { programmeSlug: programme?.slug ?? slugify(name), programmeName: name, subjectSlug: ANY_SUBJECT_SLUG, subjectName: ANY_SUBJECT };
    }
  } else {
    const found = await findCanonicalSubject(programmeIn, subjectIn);
    if (found) {
      target = { programmeSlug: found.programme.slug, programmeName: found.programme.name, subjectSlug: subjectIn, subjectName: found.subject };
    } else if (isPaperSource(source) && typed("programmeName") && typed("subjectName")) {
      target = {
        programmeSlug: slugify(typed("programmeName")),
        programmeName: typed("programmeName"),
        subjectSlug: slugify(typed("subjectName")),
        subjectName: typed("subjectName"),
      };
    }
  }
  if (!target) return { error: anySubject ? "Pick your course." : "Pick your course and subject." };
  if (!semester) return { error: "Pick your semester." };
  if (!phone) return { error: "Enter a valid 10-digit mobile number." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",").pop()?.trim() ?? "local";
  if (throttled(ip)) return { error: "Too many requests. Please try again in a few minutes." };

  const { programmeSlug, programmeName, subjectSlug, subjectName } = target;
  // Tie this browser's earlier "Yes" / chat clicks to the number it just gave, so /admin/leads can show the flags.
  const vid = validVisitorId(formData.get("vid"));
  if (vid) {
    await prisma.leadIntent
      .updateMany({ where: { visitorId: vid, phone: null }, data: { phone } })
      .catch(() => undefined); // the LeadIntent table may not exist yet
  }
  let hasNotes = false;
  try {
    hasNotes = (await prisma.canonicalSubjectNote.count({ where: { programmeSlug, subjectSlug, NOT: { content: "" } } })) > 0;
    // The same person tapping twice (or retrying) is one lead, not several.
    const duplicate = await prisma.noteLead.findFirst({
      where: { phone, programmeSlug, subjectSlug, createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { id: true },
    });
    if (duplicate) {
      // Asking again within a week is a stronger signal, so it must not pass in silence.
      notifyOwner(returningLeadAlert({ phone, programme: programmeName, semester, subject: subjectName, hasNotes }));
    } else {
      await prisma.noteLead.create({
        data: {
          phone, programmeSlug, programme: programmeName, semester, subjectSlug, subject: subjectName, hasNotes, source,
        },
      });
      // Tell the owner on WhatsApp (fire and forget; a failure here never touches the student's request).
      notifyOwner(leadAlert({ phone, programme: programmeName, semester, subject: subjectName, hasNotes, source }));
    }
  } catch (err) {
    // Never block a student from their notes because the lead couldn't be saved.
    console.error("note lead not saved:", err);
    notifyOwner(leadLostAlert({ phone, programme: programmeName, subject: subjectName })); // never lose the number
  }
  const canBuy = await notesOrdersReady().catch(() => false);
  return { ok: true, hasNotes, subject: subjectName, subjectSlug, programme: programmeName, programmeSlug, semester, phone, canBuy };
}

/**
 * The student chose "Message me on WhatsApp first" in the purchase step. Only acts for a number that just left a
 * lead (so it can't be used to send the owner arbitrary alerts): marks the lead and pings the owner.
 */
export async function leadWantsChatAction(input: { phone: string }): Promise<{ ok: boolean }> {
  const phone = parseLeadPhone(String(input?.phone ?? ""));
  if (!phone) return { ok: false };
  const ip = (await headers()).get("x-forwarded-for")?.split(",").pop()?.trim() ?? "local";
  if (throttled(ip)) return { ok: false };
  try {
    const lead = await prisma.noteLead.findFirst({
      where: { phone, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
    });
    if (!lead) return { ok: false };
    if (!lead.adminNote) await prisma.noteLead.update({ where: { id: lead.id }, data: { adminNote: "Asked you to message them first" } });
    notifyOwner(chatAlert(lead));
    return { ok: true };
  } catch (err) {
    console.error("chat request not recorded:", err);
    return { ok: false };
  }
}

// ---------- Admin ----------

async function requireAdmin() {
  if (!(await getSession())) throw new Error("Not authorised");
}

export async function setLeadStatusAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = LEAD_STATUSES.find((s) => s === formData.get("status")) as LeadStatusName | undefined;
  if (!id || !status) return;
  await prisma.noteLead.update({
    where: { id },
    data: { status, contactedAt: status === "NEW" ? null : new Date() },
  });
  revalidatePath("/admin/leads");
}

// A paid pop-up order: the admin has sent the notes on WhatsApp (or takes that back).
export async function markOrderDeliveredAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const delivered = formData.get("status") !== "PAID";
  await prisma.notesOrder.updateMany({
    where: { id, status: delivered ? "PAID" : "DELIVERED" },
    data: delivered ? { status: "DELIVERED", deliveredAt: new Date() } : { status: "PAID", deliveredAt: null },
  });
  revalidatePath("/admin/leads");
  revalidatePath("/admin/leads/delivery");
}

const text120 = (v: FormDataEntryValue | null) => String(v ?? "").trim().slice(0, 120);

/** Fields of the admin edit / add forms on the delivery tracker. null = something required is missing. */
function readOrderForm(fd: FormData) {
  const plan = fd.get("plan") === "semester" ? "semester" : "subject";
  const programme = text120(fd.get("programme"));
  const semester = parseLeadSemester(fd.get("semester"));
  const subject = plan === "subject" ? text120(fd.get("subject")) : "";
  const amount = Math.max(0, Math.min(100000, Math.round(Number(fd.get("amount")) || 0)));
  if (!programme || !semester || (plan === "subject" && !subject)) return null;
  return { plan, programme, semester, subject, subjectSlug: slugify(subject), amount };
}

export async function updateOrderAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const f = readOrderForm(formData);
  if (!id || !f) return;
  const old = await prisma.notesOrder.findUnique({ where: { id }, select: { programme: true, programmeSlug: true } });
  if (!old) return;
  // Keep the original programme slug unless the name was changed, so the order still links to its notes.
  const programmeSlug = f.programme === old.programme ? old.programmeSlug : slugify(f.programme);
  await prisma.notesOrder.update({ where: { id }, data: { ...f, programmeSlug } });
  revalidatePath("/admin/leads/delivery");
  revalidatePath("/admin/leads");
}

/** Add a purchase by hand: a subject bought outside the pop-up (UPI / cash) or one more subject for a student. */
export async function addOrderAction(formData: FormData) {
  await requireAdmin();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const f = readOrderForm(formData);
  if (!phone || !f) return;
  const ref = `manual-${crypto.randomUUID()}`; // both Razorpay ids are unique columns
  const delivered = formData.get("delivered") === "on";
  await prisma.notesOrder.create({
    data: {
      ...f,
      phone,
      programmeSlug: slugify(f.programme),
      razorpayOrderId: ref,
      razorpayPaymentId: ref,
      status: delivered ? "DELIVERED" : "PAID",
      deliveredAt: delivered ? new Date() : null,
      adminNote: "Added by admin",
    },
  });
  revalidatePath("/admin/leads/delivery");
  revalidatePath("/admin/leads");
}

/** Only hand-added rows can be removed; a real Razorpay payment is never deleted from here. */
export async function deleteManualOrderAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.notesOrder.deleteMany({ where: { id, razorpayPaymentId: { startsWith: "manual-" } } });
  revalidatePath("/admin/leads/delivery");
  revalidatePath("/admin/leads");
}

export async function setLeadNoteAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim().slice(0, 500) || null;
  if (!id) return;
  await prisma.noteLead.update({ where: { id }, data: { adminNote } });
  revalidatePath("/admin/leads");
}
