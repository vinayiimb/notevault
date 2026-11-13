"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getStudentEmail, isMissingTable } from "@/lib/paid-notes";
import { deleteByUrl, saveUploadedFile } from "@/lib/storage";
import { notifyOwner } from "@/lib/owner-notify";
import { ticketAlert } from "@/lib/owner-messages";
import type { FormResult } from "@/lib/paid-notes-actions";
import { MAX_MESSAGE, MAX_SCREENSHOT_BYTES, MAX_SUBJECT, MAX_TICKETS_PER_DAY, cleanPageUrl, parseKind, parseStatus } from "@/lib/support-rules";

// ---------- Student ----------

export async function submitTicketAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const email = await getStudentEmail();
  if (!email) return { error: "Please sign in again, then send your ticket." };

  const kind = parseKind(formData.get("kind"));
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (!kind) return { error: "Choose what this is about." };
  if (!subject) return { error: "Add a short title." };
  if (subject.length > MAX_SUBJECT) return { error: `Keep the title under ${MAX_SUBJECT} characters.` };
  if (message.length < 10) return { error: "Tell us a little more so we can help." };
  if (message.length > MAX_MESSAGE) return { error: `Keep the details under ${MAX_MESSAGE} characters.` };

  const shot = formData.get("screenshot");
  const screenshot = shot instanceof File && shot.size > 0 ? shot : null;
  if (screenshot && !screenshot.type.startsWith("image/")) return { error: "The screenshot must be an image." };
  if (screenshot && screenshot.size > MAX_SCREENSHOT_BYTES) return { error: "That screenshot is over 5 MB." };

  try {
    const since = new Date(Date.now() - 86_400_000);
    if ((await prisma.supportTicket.count({ where: { email, createdAt: { gte: since } } })) >= MAX_TICKETS_PER_DAY) {
      return { error: `You can send ${MAX_TICKETS_PER_DAY} tickets a day. Reply to your open ones on WhatsApp if it's urgent.` };
    }
    const screenshotUrl = screenshot ? (await saveUploadedFile(screenshot, "feedback")).fileUrl : null;
    await prisma.supportTicket.create({
      data: {
        email,
        kind,
        subject,
        message,
        screenshotUrl,
        pageUrl: cleanPageUrl(formData.get("pageUrl")),
        userAgent: String(formData.get("userAgent") ?? "").slice(0, 300) || null,
      },
    });
  } catch (err) {
    if (isMissingTable(err)) return { error: "Support tickets are being switched on — please try again in a little while." };
    throw err;
  }

  notifyOwner(ticketAlert({ email, kind, subject, message }));
  revalidatePath("/account/support");
  revalidatePath("/admin/support");
  return { ok: true };
}

// ---------- Admin ----------

async function requireAdmin() {
  if (!(await getSession())) throw new Error("Not authorised");
}

export async function replyTicketAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const reply = String(formData.get("reply") ?? "").trim().slice(0, MAX_MESSAGE);
  const status = parseStatus(formData.get("status")) ?? "OPEN";
  await prisma.supportTicket.update({
    where: { id },
    data: { status, ...(reply ? { reply, repliedAt: new Date() } : {}) },
  });
  revalidatePath("/admin/support");
  revalidatePath("/account/support");
}

export async function deleteTicketAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const t = await prisma.supportTicket.findUnique({ where: { id } });
  if (t?.screenshotUrl) await deleteByUrl(t.screenshotUrl);
  await prisma.supportTicket.delete({ where: { id } });
  revalidatePath("/admin/support");
  revalidatePath("/account/support");
}
