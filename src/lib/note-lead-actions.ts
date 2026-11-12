"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { findCanonicalProgramme, findCanonicalSubject } from "@/lib/canonical-subject-notes-data";
import { slugify } from "@/lib/utils";
import { normalizeEmail, normalizePhone } from "@/lib/paid-notes-pricing";
import { grantSubjectsAction, revokeSubjectAction } from "@/lib/paid-notes-actions";
import { buildOrderMeta, parseOrderMeta } from "@/lib/order-meta";
import { validVisitorId } from "@/lib/lead-intent";
import { fillPackFromSyllabus, notesOrdersReady } from "@/lib/notes-orders-server";
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
  // The pop-up's "No" form asks for the number only: course / subject / semester are whatever the page knew.
  const phoneOnly = formData.get("phoneOnly") === "1" && isPaperSource(source);
  if (phoneOnly && !target) {
    const programmeName = typed("programmeName") || "Not specified";
    const subjectName = typed("subjectName") || ANY_SUBJECT;
    target = { programmeSlug: slugify(programmeName), programmeName, subjectSlug: typed("subjectName") ? slugify(subjectName) : ANY_SUBJECT_SLUG, subjectName };
  }
  if (!target) return { error: anySubject ? "Pick your course." : "Pick your course and subject." };
  if (!semester && !phoneOnly) return { error: "Pick your semester." };
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
      notifyOwner(returningLeadAlert({ phone, programme: programmeName, semester: semester ?? null, subject: subjectName, hasNotes }));
    } else {
      await prisma.noteLead.create({
        data: {
          phone, programmeSlug, programme: programmeName, semester: semester ?? null, subjectSlug, subject: subjectName, hasNotes, source,
        },
      });
      // Tell the owner on WhatsApp (fire and forget; a failure here never touches the student's request).
      notifyOwner(leadAlert({ phone, programme: programmeName, semester: semester ?? null, subject: subjectName, hasNotes, source }));
    }
  } catch (err) {
    // Never block a student from their notes because the lead couldn't be saved.
    console.error("note lead not saved:", err);
    notifyOwner(leadLostAlert({ phone, programme: programmeName, subject: subjectName })); // never lose the number
  }
  const canBuy = await notesOrdersReady().catch(() => false);
  return { ok: true, hasNotes, subject: subjectName, subjectSlug, programme: programmeName, programmeSlug, semester: semester ?? undefined, phone, canBuy };
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
const back = (msg: string): never => redirect(`/admin/leads/delivery?msg=${encodeURIComponent(msg)}`);

/**
 * Fields of the admin edit / add forms on the delivery tracker. Only the subject name (for a one-subject row) is
 * required: a blank course is stored as "" and a blank semester as 0 ("not set").
 */
function readOrderForm(fd: FormData) {
  const plan = fd.get("plan") === "semester" ? "semester" : "subject";
  const programme = text120(fd.get("programme"));
  const rawSem = String(fd.get("semester") ?? "").trim();
  const semester = rawSem === "" ? 0 : parseLeadSemester(rawSem);
  if (semester === null) return back("Semester must be a number from 1 to 8, or left blank.");
  const subject = plan === "subject" ? text120(fd.get("subject")) : "";
  if (plan === "subject" && !subject) return back("Type the subject name.");
  const amount = Math.max(0, Math.min(100000, Math.round(Number(fd.get("amount")) || 0)));
  return { plan, programme, semester, subject, subjectSlug: slugify(subject), amount };
}

/** Best effort: the profile table may not exist until its migration is applied, and that must never break an order. */
async function rememberStudent(key: string, data: { name?: string; gmail?: string }) {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v));
  if (!key || !Object.keys(clean).length) return;
  try {
    await prisma.notesStudent.upsert({ where: { phone: key }, create: { phone: key, ...clean }, update: clean });
  } catch (err) {
    console.error("notes student not saved (migration add_notes_student applied?):", err);
  }
}

export async function updateOrderAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const f = readOrderForm(formData);
  if (!id) return;
  const old = await prisma.notesOrder.findUnique({ where: { id }, select: { programme: true, programmeSlug: true, adminNote: true } });
  if (!old) return;
  // Keep the original programme slug unless the name was changed, so the order still links to its notes.
  const programmeSlug = f.programme === old.programme ? old.programmeSlug : slugify(f.programme);
  const meta = parseOrderMeta(old.adminNote);
  if (formData.get("hasPaid") === "1") {
    meta.unpaid = formData.get("paid") !== "on";
    meta.paid = null;
  }
  await prisma.notesOrder.update({ where: { id }, data: { ...f, programmeSlug, adminNote: buildOrderMeta(meta) } });
  revalidatePath("/admin/leads/delivery");
  revalidatePath("/admin/leads");
}

/**
 * Add a purchase by hand: a student bought outside the pop-up (UPI / cash), one more subject for a student, or (with
 * `under`) one subject that belongs to a whole-semester order, so it can be delivered and tracked on its own.
 */
export async function addOrderAction(formData: FormData) {
  await requireAdmin();
  // A student already on the tracker is identified by `skey` (a phone, or "mail:<gmail>" when they have none);
  // a new one by the phone and/or Gmail typed in the form.
  const skey = String(formData.get("skey") ?? "");
  let phone: string | null = "";
  let gmail = "";
  if (skey.startsWith("mail:")) gmail = skey.slice(5);
  else if (skey) phone = normalizePhone(skey);
  else {
    const rawPhone = String(formData.get("phone") ?? "").trim();
    phone = rawPhone ? normalizePhone(rawPhone) : "";
    gmail = normalizeEmail(String(formData.get("gmail") ?? "")) ?? "";
    if (rawPhone && !phone) return back("That WhatsApp number is not a valid 10-digit number.");
  }
  if (phone === null || (!phone && !gmail)) return back("Enter a WhatsApp number or a Gmail address for the student.");
  const f = readOrderForm(formData);
  const under = String(formData.get("under") ?? "").replace(/[^\w-]/g, "");
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
      adminNote: buildOrderMeta({ text: "Added by admin", under, gmail, unpaid: formData.get("hasPaid") === "1" && formData.get("paid") !== "on" }),
    },
  });
  if (!skey) await rememberStudent(phone || `mail:${gmail}`, { name: text120(formData.get("name")), gmail });
  revalidatePath("/admin/leads/delivery");
  revalidatePath("/admin/leads");
  return back("Added.");
}

/** "1. Law, 2) Accounts; Stats" -> ["Law", "Accounts", "Stats"]: names split on new lines, commas or semicolons. */
function parseSubjectNames(raw: string) {
  return [
    ...new Set(
      raw
        .split(/[\n;,]/)
        .map((n) => n.replace(/^\s*\d+\s*[.)\-:]\s*/, "").trim().slice(0, 120))
        .filter(Boolean),
    ),
  ].slice(0, 15);
}

/**
 * The short "add subject" box: just type the name(s) and press Enter. With `under` the subjects join that whole-semester
 * order (same student, course and semester); with `skey` they join that student and copy the course and semester of
 * their latest entry. The "Access given" tick saves them already ticked.
 */
export async function quickAddSubjectsAction(formData: FormData) {
  await requireAdmin();
  const names = parseSubjectNames(String(formData.get("subjects") ?? ""));
  if (!names.length) return back("Type a subject name.");
  const delivered = formData.get("delivered") === "on";
  const underId = String(formData.get("under") ?? "");
  const skey = String(formData.get("skey") ?? "");

  let phone = "";
  let gmail = "";
  let programme = "";
  let semester = 0;
  let under = "";
  if (underId) {
    const pack = await prisma.notesOrder.findUnique({ where: { id: underId } });
    if (!pack || pack.plan !== "semester") return back("That semester order was not found.");
    ({ phone, programme, semester } = pack);
    gmail = parseOrderMeta(pack.adminNote).gmail;
    under = pack.id;
  } else {
    if (skey.startsWith("mail:")) gmail = skey.slice(5);
    else phone = normalizePhone(skey) ?? "";
    if (!phone && !gmail) return back("Student not found.");
    const mine = await prisma.notesOrder.findMany({
      where: phone ? { phone } : { phone: "", adminNote: { contains: gmail, mode: "insensitive" } },
      orderBy: { paidAt: "desc" },
      select: { programme: true, semester: true },
    });
    const ref = mine.find((m) => m.programme) ?? mine[0];
    programme = ref?.programme ?? "";
    semester = ref?.semester ?? 0;
  }
  await prisma.notesOrder.createMany({
    data: names.map((subject) => {
      const ref = `manual-${crypto.randomUUID()}`;
      return {
        phone, plan: "subject", programmeSlug: slugify(programme), programme, semester, subject, subjectSlug: slugify(subject), amount: 0,
        razorpayOrderId: ref, razorpayPaymentId: ref, status: delivered ? "DELIVERED" : "PAID", deliveredAt: delivered ? new Date() : null,
        adminNote: buildOrderMeta({ text: "Added by admin", under, gmail }),
      } as const;
    }),
  });
  revalidatePath("/admin/leads/delivery");
  return back(`Added ${names.length} subject${names.length === 1 ? "" : "s"}.`);
}

/** "Fill in from the syllabus": list the DSC papers of this whole-semester order's course + semester under it. */
export async function fillPackFromSyllabusAction(formData: FormData) {
  await requireAdmin();
  const pack = await prisma.notesOrder.findUnique({ where: { id: String(formData.get("id") ?? "") } });
  if (!pack || pack.plan !== "semester") return back("That semester order was not found.");
  if (!pack.programme || !pack.semester) return back("Set this order's course and semester first (Edit).");
  const n = await fillPackFromSyllabus(pack);
  revalidatePath("/admin/leads/delivery");
  return back(n ? `Listed ${n} subject${n === 1 ? "" : "s"} from the syllabus.` : `No new DSC subjects found in the syllabus for ${pack.programme}, Semester ${pack.semester}. You can type them yourself.`);
}

/**
 * The per-student payment line in the overview: purchase type, total price and amount paid, typed once.
 *  - "Full semester" turns their loose subjects into a semester pack and moves the payment onto it; "subjects" dissolves a
 *    pack back into its subjects. Only hand-entered rows are rearranged, never a Razorpay payment.
 *  - The price and the paid amount are put on one primary row (the pack, else the first purchase); every other
 *    hand-entered purchase of the student goes to 0, so totals add up to exactly what was typed. Rest = price - paid.
 */
export async function saveStudentPaymentAction(formData: FormData) {
  await requireAdmin();
  const skey = String(formData.get("skey") ?? "");
  const type = formData.get("type") === "semester" ? "semester" : "subjects";
  const price = Math.max(0, Math.min(1_000_000, Math.round(Number(formData.get("price")) || 0)));
  const paid = Math.max(0, Math.min(1_000_000, Math.round(Number(formData.get("paid")) || 0)));
  if (paid > price) return back("The amount paid can't be more than the total price.");
  const gmailKey = skey.startsWith("mail:") ? skey.slice(5) : "";
  const phone = gmailKey ? "" : normalizePhone(skey) ?? "";
  if (!gmailKey && !phone) return back("Student not found.");

  const load = () =>
    prisma.notesOrder.findMany({
      where: phone ? { phone } : { phone: "", adminNote: { contains: gmailKey, mode: "insensitive" } },
      orderBy: { paidAt: "asc" },
    });
  const isManual = (o: { razorpayPaymentId: string }) => o.razorpayPaymentId.startsWith("manual-");
  const underOf = (o: { adminNote: string | null }) => parseOrderMeta(o.adminNote).under;
  let rows = await load();
  let top = rows.filter((o) => isManual(o) && !underOf(o));

  if (type === "semester" && !top.some((o) => o.plan === "semester")) {
    const subs = top.filter((o) => o.plan === "subject");
    const ref = subs.find((o) => o.programme) ?? subs[0];
    if (!ref) return back("Add at least one subject for this student first.");
    const refId = `manual-${crypto.randomUUID()}`;
    const pack = await prisma.notesOrder.create({
      data: {
        phone: ref.phone, plan: "semester", programme: ref.programme, programmeSlug: ref.programmeSlug, semester: ref.semester, subject: "", subjectSlug: "",
        amount: 0, razorpayOrderId: refId, razorpayPaymentId: refId, adminNote: buildOrderMeta({ text: "Added by admin", gmail: parseOrderMeta(ref.adminNote).gmail }),
      },
    });
    for (const o of subs) {
      const meta = parseOrderMeta(o.adminNote);
      await prisma.notesOrder.update({ where: { id: o.id }, data: { amount: 0, adminNote: buildOrderMeta({ ...meta, under: pack.id, unpaid: false, paid: null }) } });
    }
  } else if (type === "subjects") {
    const pack = top.find((o) => o.plan === "semester");
    if (pack) {
      if (!isManual(pack)) return back("This semester was paid through Razorpay, so it can't be changed to individual subjects here.");
      const kids = rows.filter((o) => underOf(o) === pack.id);
      if (!kids.length) return back("Type the subject names under this semester first, then switch it to subjects.");
      for (const k of kids) {
        const meta = parseOrderMeta(k.adminNote);
        await prisma.notesOrder.update({ where: { id: k.id }, data: { adminNote: buildOrderMeta({ ...meta, under: "" }) } });
      }
      await prisma.notesOrder.delete({ where: { id: pack.id } });
    }
  }

  rows = await load();
  top = rows.filter((o) => isManual(o) && !underOf(o));
  const real = rows.filter((o) => !isManual(o)); // Razorpay payments keep their recorded amounts
  const realAmount = real.reduce((n, o) => n + o.amount, 0);
  const primary = top.find((o) => o.plan === "semester") ?? top[0];
  if (!primary) {
    if (real.length) {
      revalidatePath("/admin/leads/delivery");
      return back(price || paid ? "This student's payment came through Razorpay and can't be edited here." : "Saved.");
    }
    // Known only from site access: start a hand-entered purchase from the first subject they can open.
    if (!price) return back("Nothing to save.");
    const email = gmailKey || (await prisma.notesStudent.findUnique({ where: { phone: skey } }).catch(() => null))?.gmail || "";
    const access = email ? await prisma.purchase.findFirst({ where: { email, status: "APPROVED", NOT: { items: { isEmpty: true } } }, select: { items: true }, orderBy: { createdAt: "asc" } }) : null;
    const [pSlug = "", sSlug = ""] = (access?.items[0] ?? "").split("/");
    const name = sSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Notes";
    const ref = `manual-${crypto.randomUUID()}`;
    await prisma.notesOrder.create({
      data: { phone, plan: "subject", programme: "", programmeSlug: pSlug, semester: 0, subject: name, subjectSlug: sSlug || slugify(name), amount: 0, razorpayOrderId: ref, razorpayPaymentId: ref, adminNote: buildOrderMeta({ text: "Added by admin", gmail: email }) },
    });
    return saveStudentPaymentAction(formData); // run again, now there is a row to carry the payment
  }
  const myPrice = Math.max(0, price - realAmount);
  const myPaid = Math.max(0, Math.min(myPrice, paid - realAmount));
  for (const o of top) {
    const meta = parseOrderMeta(o.adminNote);
    meta.unpaid = false;
    meta.paid = null;
    if (o.id === primary.id) {
      if (myPaid === 0 && myPrice > 0) meta.unpaid = true;
      else if (myPaid < myPrice) meta.paid = myPaid;
      await prisma.notesOrder.update({ where: { id: o.id }, data: { amount: myPrice, adminNote: buildOrderMeta(meta) } });
    } else {
      await prisma.notesOrder.update({ where: { id: o.id }, data: { amount: 0, adminNote: buildOrderMeta(meta) } });
    }
  }
  revalidatePath("/admin/leads/delivery");
  revalidatePath("/admin/leads");
  return back(`Saved: total ₹${price}, paid ₹${paid}, rest ₹${price - paid}.`);
}

/** "Payment received" tick on a purchase, separate from whether access has been given. */
export async function setOrderPaidAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const order = id ? await prisma.notesOrder.findUnique({ where: { id }, select: { adminNote: true } }) : null;
  if (!order) return;
  const meta = parseOrderMeta(order.adminNote);
  meta.unpaid = formData.get("paid") !== "yes"; // the button sends what the state should become
  meta.paid = null;
  await prisma.notesOrder.update({ where: { id }, data: { adminNote: buildOrderMeta(meta) } });
  revalidatePath("/admin/leads/delivery");
}

/**
 * Edit a row that comes from site access ("auto"): the edit is saved as a normal entry for the student, tagged with the
 * access it stands for, so it replaces the auto row in the list. The access on the site is not changed; deleting the
 * entry later brings the auto row back.
 */
export async function editAutoOrderAction(formData: FormData) {
  await requireAdmin();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const site = String(formData.get("site") ?? "").replace(/[^\w/.-]/g, "");
  const skey = String(formData.get("skey") ?? "");
  const phone = skey.startsWith("mail:") ? "" : normalizePhone(skey) ?? "";
  if (!email || !site.includes("/")) return back("That row could not be edited.");
  const f = readOrderForm(formData);
  const ref = `manual-${crypto.randomUUID()}`;
  const paid = formData.get("paid") === "on";
  await prisma.notesOrder.create({
    data: {
      ...f,
      phone,
      programmeSlug: site.split("/")[0],
      subjectSlug: site.split("/")[1] ?? slugify(f.subject),
      razorpayOrderId: ref,
      razorpayPaymentId: ref,
      status: "DELIVERED", // they can already open it on the site
      deliveredAt: new Date(),
      adminNote: buildOrderMeta({ text: "Added by admin", gmail: email, site, unpaid: !paid }),
    },
  });
  revalidatePath("/admin/leads/delivery");
  return back("Saved. This entry is now fully editable.");
}

/** Delete one purchase row from the tracker (hand-entered or a recorded payment). A whole-semester order takes the subjects listed under it too. */
export async function deleteOrderAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const order = await prisma.notesOrder.findUnique({ where: { id }, select: { id: true, plan: true } });
  if (!order) return;
  const ids = [id];
  if (order.plan === "semester") {
    const kids = await prisma.notesOrder.findMany({ where: { adminNote: { contains: `Under: ${id}` } }, select: { id: true } });
    ids.push(...kids.map((k) => k.id));
  }
  await prisma.notesOrder.deleteMany({ where: { id: { in: ids } } });
  revalidatePath("/admin/leads/delivery");
  revalidatePath("/admin/leads");
  return back(ids.length > 1 ? `Deleted the semester and its ${ids.length - 1} subjects.` : "Deleted.");
}

/** Delete a student from the tracker: every purchase row of theirs and their details. Site access is not touched. */
export async function deleteStudentAction(formData: FormData) {
  await requireAdmin();
  const skey = String(formData.get("skey") ?? "");
  const gmailKey = skey.startsWith("mail:") ? skey.slice(5) : "";
  const phone = gmailKey ? "" : normalizePhone(skey) ?? "";
  if (!gmailKey && !phone) return back("Student not found.");
  const rows = await prisma.notesOrder.deleteMany({
    where: phone ? { phone } : { phone: "", adminNote: { contains: gmailKey, mode: "insensitive" } },
  });
  await prisma.notesStudent.deleteMany({ where: { phone: skey } }).catch(() => undefined);
  revalidatePath("/admin/leads/delivery");
  revalidatePath("/admin/leads");
  return back(`Deleted the student and ${rows.count} purchase row${rows.count === 1 ? "" : "s"}. Their access on the site was not changed.`);
}

/** Take a subject's access away from a Gmail (the row in the tracker that came from site access). */
export async function removeSiteAccessAction(formData: FormData) {
  await requireAdmin();
  await revokeSubjectAction(formData);
  revalidatePath("/admin/leads/delivery");
  return back("Access removed for that subject.");
}

/**
 * Edit a student: name, WhatsApp number, a second number and Gmail. Nothing is locked.
 *  - Changing the WhatsApp number moves all their rows to the new number; adding one to a student known only by Gmail
 *    does the same. If that number already belongs to another student, the two become one.
 *  - Changing the Gmail updates it on all their rows. A Gmail that already has access on the site joins this student.
 */
export async function saveStudentAction(formData: FormData) {
  await requireAdmin();
  const key = String(formData.get("key") ?? "");
  const oldMail = key.startsWith("mail:") ? key.slice(5) : "";
  const oldPhone = oldMail ? "" : normalizePhone(key) ?? "";
  if (!oldMail && !oldPhone) return back("Student not found.");

  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const newPhone = phoneRaw ? normalizePhone(phoneRaw) : oldPhone || "";
  if (phoneRaw && !newPhone) return back("The WhatsApp number is not a valid 10-digit number.");
  const altRaw = String(formData.get("altPhone") ?? "").trim();
  const altPhone = altRaw ? normalizePhone(altRaw) : null;
  if (altRaw && !altPhone) return back("The extra number is not a valid 10-digit number.");
  const gmailRaw = String(formData.get("gmail") ?? "").trim();
  const newGmail = gmailRaw ? normalizeEmail(gmailRaw) : oldMail || null;
  if (gmailRaw && !newGmail) return back("That Gmail address is not valid.");
  if (!newPhone && !newGmail) return back("A student needs a WhatsApp number or a Gmail address.");

  // Their rows: by phone, or (Gmail-only student) by the Gmail noted on them.
  const rows = await prisma.notesOrder.findMany({
    where: oldPhone ? { phone: oldPhone } : { phone: "", adminNote: { contains: oldMail, mode: "insensitive" } },
    select: { id: true, adminNote: true },
  });
  for (const r of rows) {
    const meta = parseOrderMeta(r.adminNote);
    if (newGmail) meta.gmail = newGmail;
    await prisma.notesOrder.update({ where: { id: r.id }, data: { phone: newPhone || "", adminNote: buildOrderMeta(meta) } });
  }

  const newKey = newPhone || `mail:${newGmail}`;
  const data = { name: text120(formData.get("name")) || null, altPhone, gmail: newGmail };
  try {
    if (newKey !== key) await prisma.notesStudent.deleteMany({ where: { phone: key } });
    await prisma.notesStudent.upsert({ where: { phone: newKey }, create: { phone: newKey, ...data }, update: data });
  } catch (err) {
    console.error("notes student not saved:", err);
    return back("Student details can't be saved yet: the add_notes_student database update has not been applied.");
  }
  revalidatePath("/admin/leads/delivery");
  revalidatePath("/admin/leads");
  return back("Saved.");
}

/**
 * "Notes are ready": unlock the order's subject(s) for the student's Gmail (they read them after signing in),
 * remember the Gmail and mark the order delivered. A whole-semester order unlocks every published subject of that
 * semester. Nothing is granted for a subject whose notes are not published yet.
 */
export async function giveNotesAccessAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const order = id ? await prisma.notesOrder.findUnique({ where: { id } }) : null;
  if (!order) return back("Order not found.");
  if (!email) return back("Enter a valid Gmail address.");
  const isPack = order.plan === "semester";
  if (isPack && !order.semester) return back("Set this order's semester first (Edit), so I know which subjects to unlock.");
  const notes = await prisma.canonicalSubjectNote.findMany({
    where: {
      NOT: { content: "" },
      ...(order.programmeSlug ? { programmeSlug: order.programmeSlug } : {}),
      ...(isPack ? { semester: order.semester } : { subjectSlug: order.subjectSlug }),
    },
    select: { programmeSlug: true, subjectSlug: true },
  });
  const what = isPack ? `Semester ${order.semester}` : order.subject;
  if (!notes.length) return back(`Notes for ${what} are not published yet, so nothing was unlocked.`);
  if (!isPack && !order.programmeSlug && notes.length > 1) return back(`More than one course has "${order.subject}". Add the course (Edit) so I unlock the right one.`);
  const fd = new FormData();
  fd.set("email", email);
  for (const n of notes) fd.append("item", `${n.programmeSlug}/${n.subjectSlug}`);
  await grantSubjectsAction(fd);
  const meta = parseOrderMeta(order.adminNote);
  await prisma.notesOrder.update({
    where: { id },
    data: { adminNote: buildOrderMeta({ ...meta, gmail: email }), status: "DELIVERED", deliveredAt: order.deliveredAt ?? new Date() },
  });
  await rememberStudent(order.phone || `mail:${email}`, { gmail: email });
  revalidatePath("/admin/leads/delivery");
  revalidatePath("/admin/leads");
  return back(`Unlocked ${notes.length} subject${notes.length === 1 ? "" : "s"} for ${email}. Now send them the WhatsApp message.`);
}

export async function setLeadNoteAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim().slice(0, 500) || null;
  if (!id) return;
  await prisma.noteLead.update({ where: { id }, data: { adminNote } });
  revalidatePath("/admin/leads");
}
