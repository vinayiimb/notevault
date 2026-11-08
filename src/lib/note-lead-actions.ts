"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { findCanonicalSubject } from "@/lib/canonical-subject-notes-data";
import { slugify } from "@/lib/utils";
import { LEAD_STATUSES, parseLeadPhone, parseLeadSemester, parseLeadSource, type LeadStatusName } from "@/lib/note-leads";

export type LeadResult = { ok?: boolean; error?: string; subject?: string; hasNotes?: boolean };

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
  const found = await findCanonicalSubject(String(formData.get("programme") ?? ""), String(formData.get("subject") ?? ""));
  // /papers names subjects as printed on the paper, which isn't always a notes subject. A student
  // opening such a paper is still a lead, so keep it under the names they were looking at.
  const typed = (key: string) => String(formData.get(key) ?? "").trim().slice(0, 120);
  const paperTarget =
    !found && source === "paper-pdf" && typed("programmeName") && typed("subjectName")
      ? { programme: typed("programmeName"), subject: typed("subjectName") }
      : null;
  if (!found && !paperTarget) return { error: "Pick your course and subject." };
  if (!semester) return { error: "Pick your semester." };
  if (!phone) return { error: "Enter a valid 10-digit mobile number." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",").pop()?.trim() ?? "local";
  if (throttled(ip)) return { error: "Too many requests. Please try again in a few minutes." };

  const programmeSlug = found ? found.programme.slug : slugify(paperTarget!.programme);
  const programmeName = found ? found.programme.name : paperTarget!.programme;
  const subjectName = found ? found.subject : paperTarget!.subject;
  const subjectSlug = found ? String(formData.get("subject")) : slugify(paperTarget!.subject);
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
  return { ok: true, hasNotes, subject: subjectName };
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

export async function setLeadNoteAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim().slice(0, 500) || null;
  if (!id) return;
  await prisma.noteLead.update({ where: { id }, data: { adminNote } });
  revalidatePath("/admin/leads");
}
