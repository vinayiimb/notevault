"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { findCanonicalProgramme, findCanonicalSubject } from "@/lib/canonical-subject-notes-data";
import { slugify } from "@/lib/utils";
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
  let hasNotes = false;
  try {
    hasNotes = (await prisma.canonicalSubjectNote.count({ where: { programmeSlug, subjectSlug, NOT: { content: "" } } })) > 0;
    // The same person tapping twice (or retrying) is one lead, not several.
    const duplicate = await prisma.noteLead.findFirst({
      where: { phone, programmeSlug, subjectSlug, createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { id: true },
    });
    if (!duplicate) {
      await prisma.noteLead.create({
        data: {
          phone, programmeSlug, programme: programmeName, semester, subjectSlug, subject: subjectName, hasNotes, source,
        },
      });
    }
  } catch (err) {
    // Never block a student from their notes because the lead couldn't be saved.
    console.error("note lead not saved:", err);
  }
  return { ok: true, hasNotes, subject: subjectName, subjectSlug, programme: programmeName, programmeSlug, semester, phone };
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
}

export async function setLeadNoteAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim().slice(0, 500) || null;
  if (!id) return;
  await prisma.noteLead.update({ where: { id }, data: { adminNote } });
  revalidatePath("/admin/leads");
}
