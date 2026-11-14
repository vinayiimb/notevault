"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isMissingTable } from "@/lib/paid-notes";

// Admin -> Students -> one student: edit or delete a payment, or delete the student and everything tied to their Gmail.

async function requireAdmin() {
  if (!(await getSession())) throw new Error("Not authorised");
}
const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
const back = (email: string) => {
  revalidatePath("/admin/payments", "layout");
  revalidatePath("/account");
  return `/admin/payments/students?email=${encodeURIComponent(email)}`;
};

export async function updatePurchaseAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const amount = Math.round(Number(formData.get("amount")));
  const status = STATUSES.find((s) => s === formData.get("status"));
  const note = String(formData.get("adminNote") ?? "").trim().slice(0, 500);
  if (!id || !Number.isFinite(amount) || amount < 0 || amount > 100_000 || !status) return;
  const p = await prisma.purchase.update({
    where: { id },
    data: { amount, status, adminNote: note || null, ...(status !== "PENDING" ? { reviewedAt: new Date() } : {}) },
    select: { email: true },
  });
  redirect(back(p.email));
}

/** Deleting a payment removes the access it gave (access is worked out from approved payments). */
export async function deletePurchaseAction(formData: FormData) {
  await requireAdmin();
  if (formData.get("confirm") !== "yes") return;
  const p = await prisma.purchase.delete({ where: { id: String(formData.get("id") ?? "") }, select: { email: true } });
  redirect(back(p.email));
}

/** Removes the student completely: payments, login, devices, reading history, dashboard subjects, tickets. */
export async function deleteStudentAction(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || String(formData.get("confirmEmail") ?? "").trim().toLowerCase() !== email) return;
  const steps: (() => Promise<unknown>)[] = [
    () => prisma.purchase.deleteMany({ where: { email } }),
    () => prisma.notesAccount.deleteMany({ where: { email } }),
    () => prisma.studentDevice.deleteMany({ where: { email } }),
    () => prisma.studentActivity.deleteMany({ where: { email } }),
    () => prisma.studentHour.deleteMany({ where: { email } }),
    () => prisma.studentSubject.deleteMany({ where: { email } }),
    () => prisma.studentSubjectLimit.deleteMany({ where: { email } }),
    () => prisma.supportTicket.deleteMany({ where: { email } }),
  ];
  for (const run of steps) {
    try {
      await run();
    } catch (err) {
      if (!isMissingTable(err)) throw err; // a table whose migration isn't applied simply has nothing to delete
    }
  }
  revalidatePath("/admin/payments", "layout");
  redirect("/admin/payments/students");
}
