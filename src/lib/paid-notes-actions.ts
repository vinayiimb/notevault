"use server";

import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { deleteByUrl, putBytes } from "@/lib/storage";
import { currencyIconExtensionFor } from "@/lib/currency-icon";
import { STUDENT_COOKIE, STUDENT_COOKIE_OPTIONS, signStudentSession } from "@/lib/paid-notes";
import { normalizeEmail, normalizePhone, normalizeUtr, priceFor } from "@/lib/paid-notes-pricing";
import { FIREBASE_CONFIG, googleSignInEnabled } from "@/lib/firebase-config";
import { verifyFirebaseIdToken } from "@/lib/firebase-token";

export type FormResult = { ok?: boolean; error?: string };

// ---------- Student ----------

const MAX_ITEMS = 20;

export async function submitPaymentAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const utr = normalizeUtr(String(formData.get("utr") ?? ""));
  const requested = [...new Set(formData.getAll("item").map(String))].slice(0, MAX_ITEMS);

  if (!requested.length) return { error: "Pick at least one subject." };
  if (!email) return { error: "Enter a valid email (your Gmail)." };
  if (!phone) return { error: "Enter a valid 10-digit WhatsApp number." };
  if (!utr) return { error: "Enter the UTR / UPI reference number (12 digits) from your payment app." };

  // Only sell subjects that really have notes.
  const pairs = requested.map((k) => k.split("/")).filter((p) => p.length === 2);
  const existing = await prisma.canonicalSubjectNote.findMany({
    where: { OR: pairs.map(([programmeSlug, subjectSlug]) => ({ programmeSlug, subjectSlug })), NOT: { content: "" } },
    select: { programmeSlug: true, subjectSlug: true },
  });
  const items = existing.map((n) => `${n.programmeSlug}/${n.subjectSlug}`);
  if (items.length !== requested.length) return { error: "Some selected subjects aren't available. Please reselect." };

  try {
    await prisma.purchase.create({ data: { email, phone, utr, items, amount: priceFor(items.length) } });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return { error: "This UTR has already been submitted. If that wasn't you, message us on WhatsApp." };
    }
    throw err;
  }
  revalidatePath("/admin/payments");
  return { ok: true };
}

export async function studentLoginAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  const account = email ? await prisma.notesAccount.findUnique({ where: { email } }) : null;
  if (!account || !(await verifyPassword(password, account.passwordHash))) {
    return { error: "Wrong email or password. Use the login we sent you on WhatsApp." };
  }
  (await cookies()).set(STUDENT_COOKIE, signStudentSession(account.email), STUDENT_COOKIE_OPTIONS);
  // Only same-site paths — never an open redirect.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/paid-notes");
}

// "Continue with Google" (Firebase): the browser signs in with Google and
// sends us the ID token; we verify it and start the same student session the
// password login does. Any verified Google account can sign in — what it
// unlocks is still only the approved purchases for that Gmail.
export async function googleSignInAction(idToken: string, next: string): Promise<FormResult> {
  if (!googleSignInEnabled) return { error: "Google sign-in isn't set up yet." };
  let email: string;
  try {
    ({ email } = await verifyFirebaseIdToken(idToken, FIREBASE_CONFIG.projectId));
  } catch {
    return { error: "Google sign-in failed. Please try again." };
  }
  (await cookies()).set(STUDENT_COOKIE, signStudentSession(email), STUDENT_COOKIE_OPTIONS);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/paid-notes");
}

export async function studentLogoutAction() {
  (await cookies()).delete(STUDENT_COOKIE);
  redirect("/paid-notes");
}

// ---------- Admin ----------

async function requireAdmin() {
  if (!(await getSession())) throw new Error("Unauthorized");
}

// 10 chars, no look-alikes (0/O, 1/l/I) — easy to read off WhatsApp.
function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => alphabet[randomInt(alphabet.length)]).join("");
}

export type ApproveResult = FormResult & { email?: string; phone?: string; password?: string; existingAccount?: boolean };

export async function approvePurchaseAction(_prev: ApproveResult, formData: FormData): Promise<ApproveResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const purchase = await prisma.purchase.findUnique({ where: { id } });
  if (!purchase) return { error: "Payment not found." };

  const account = await prisma.notesAccount.findUnique({ where: { email: purchase.email } });
  let password: string | undefined;
  await prisma.$transaction(async (tx) => {
    await tx.purchase.update({ where: { id }, data: { status: "APPROVED", reviewedAt: new Date(), adminNote: null } });
    if (!account) {
      password = generatePassword();
      await tx.notesAccount.create({ data: { email: purchase.email, passwordHash: await hashPassword(password) } });
    }
  });
  // No revalidatePath here: refreshing would move this card out of the
  // Pending list and unmount it — taking the one-time password with it.
  // The list catches up on the admin's next navigation.
  return { ok: true, email: purchase.email, phone: purchase.phone, password, existingAccount: !!account };
}

export async function resetStudentPasswordAction(_prev: ApproveResult, formData: FormData): Promise<ApproveResult> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const password = generatePassword();
  await prisma.notesAccount.upsert({
    where: { email },
    create: { email, passwordHash: await hashPassword(password) },
    update: { passwordHash: await hashPassword(password) },
  });
  return { ok: true, email, phone, password };
}

export async function rejectPurchaseAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;
  await prisma.purchase.update({ where: { id }, data: { status: "REJECTED", reviewedAt: new Date(), adminNote } });
  revalidatePath("/admin/payments");
}

export async function updatePaymentSettingsAction(formData: FormData) {
  await requireAdmin();
  const data = {
    paywallEnabled: formData.get("paywallEnabled") === "on",
    upiId: String(formData.get("upiId") ?? "").trim() || null,
    upiPayeeName: String(formData.get("upiPayeeName") ?? "").trim() || null,
  };
  await prisma.siteSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
  revalidatePaywall();
}

export async function uploadUpiQrAction(formData: FormData) {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("An image is required.");
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Please upload a PNG, JPEG, or WebP image.");
  }
  const current = await prisma.siteSettings.findUnique({ where: { id: "singleton" }, select: { upiQrUrl: true } });
  await deleteByUrl(current?.upiQrUrl);
  // Timestamped key: a fixed name would keep serving the old QR from caches.
  const key = `images/upi-qr-${Date.now()}.${currencyIconExtensionFor(file.type)}`;
  const upiQrUrl = await putBytes(key, Buffer.from(await file.arrayBuffer()), { allowOverwrite: true });
  await prisma.siteSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", upiQrUrl }, update: { upiQrUrl } });
  revalidatePaywall();
}

export async function removeUpiQrAction() {
  await requireAdmin();
  const current = await prisma.siteSettings.findUnique({ where: { id: "singleton" }, select: { upiQrUrl: true } });
  await deleteByUrl(current?.upiQrUrl);
  await prisma.siteSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", upiQrUrl: null }, update: { upiQrUrl: null } });
  revalidatePaywall();
}

function revalidatePaywall() {
  revalidatePath("/admin/payments");
  revalidatePath("/paid-notes");
  revalidatePath("/notes", "layout");
}
