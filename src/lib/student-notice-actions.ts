"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { MAX_NOTICE_BODY, MAX_NOTICE_TITLE, MAX_REPLY, parseAudience } from "@/lib/student-notices";
import { getStudentEmail } from "@/lib/paid-notes";

async function requireAdmin() {
  if (!(await getSession())) throw new Error("Not authorised");
}
const done = () => {
  revalidatePath("/admin/payments/students");
  revalidatePath("/account");
};

export async function sendNoticeAction(formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim().slice(0, MAX_NOTICE_TITLE);
  const body = String(formData.get("body") ?? "").trim().slice(0, MAX_NOTICE_BODY);
  if (!title || !body) return;
  await prisma.studentNotice.create({ data: { title, body, audience: parseAudience(formData.get("audience")) } });
  done();
}

/** Hide (stop showing) or show again. */
export async function toggleNoticeAction(formData: FormData) {
  await requireAdmin();
  await prisma.studentNotice.update({ where: { id: String(formData.get("id") ?? "") }, data: { active: formData.get("active") === "1" } });
  done();
}

export async function deleteNoticeAction(formData: FormData) {
  await requireAdmin();
  await prisma.studentNotice.delete({ where: { id: String(formData.get("id") ?? "") } });
  done();
}

/** Admin read the replies under a message: clears the unread badge. */
export async function markRepliesSeenAction(formData: FormData) {
  await requireAdmin();
  await prisma.studentNoticeReply.updateMany({ where: { noticeId: String(formData.get("id") ?? ""), seen: false }, data: { seen: true } });
  done();
}

// ---------- Student ----------

const REPLIES_PER_DAY = 20;
export type ReplyResult = { ok?: boolean; error?: string };

/** A signed-in student answers a message from the team. Only live messages meant for them can be answered. */
export async function replyNoticeAction(_prev: ReplyResult, formData: FormData): Promise<ReplyResult> {
  const email = await getStudentEmail();
  if (!email) return { error: "Please sign in again." };
  const noticeId = String(formData.get("noticeId") ?? "");
  const body = String(formData.get("body") ?? "").replace(/\r/g, "").trim();
  if (!body) return { error: "Write a reply first." };
  if (body.length > MAX_REPLY) return { error: `Keep it under ${MAX_REPLY} characters.` };
  const notice = await prisma.studentNotice.findFirst({ where: { id: noticeId, active: true }, select: { id: true } });
  if (!notice) return { error: "This message is no longer open for replies." };
  const since = new Date(Date.now() - 86_400_000);
  if ((await prisma.studentNoticeReply.count({ where: { email, createdAt: { gte: since } } })) >= REPLIES_PER_DAY) return { error: "That's a lot of replies today. Try again tomorrow." };
  await prisma.studentNoticeReply.create({ data: { noticeId, email, body } });
  revalidatePath("/account");
  revalidatePath("/admin/payments/students");
  return { ok: true };
}
