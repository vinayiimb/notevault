"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { clearLoginFailures, generatePassword, getSession, hashPassword, isLoginLocked, loginThrottleKey, recordLoginFailure, verifyPassword } from "@/lib/auth";
import { deleteByUrl, putBytes } from "@/lib/storage";
import { currencyIconExtensionFor } from "@/lib/currency-icon";
import { getStudentEmail, isExtraItem } from "@/lib/paid-notes";
import { endCurrentStudentSession, resetStudentDevices, revokeStudentDevice, startStudentSession, type DeviceInfo } from "@/lib/student-devices";
import { isAccessActive, normalizeEmail, normalizePhone, normalizeUtr, priceFor } from "@/lib/paid-notes-pricing";
import { FIREBASE_CONFIG, googleSignInEnabled } from "@/lib/firebase-config";
import { PROMOTER_COOKIE, PROMOTER_COOKIE_OPTIONS, getPromoter, promoterUtrPrefix, signPromoterSession } from "@/lib/promoter";
import { verifyFirebaseIdToken } from "@/lib/firebase-token";
import { notifyOwner } from "@/lib/owner-notify";
import { paymentAlert } from "@/lib/owner-messages";

// `devices` is set when a sign-in is refused because both device slots are taken.
export type FormResult = { ok?: boolean; error?: string; devices?: DeviceInfo[] };

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
  notifyOwner(paymentAlert({ phone, email, amount: priceFor(items.length), utr }));
  revalidatePath("/admin/payments");
  return { ok: true };
}

export async function studentLoginAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  const throttleKey = await loginThrottleKey(email ?? "");
  if (isLoginLocked(throttleKey)) return { error: "Too many attempts. Try again in 15 minutes." };
  const account = email ? await prisma.notesAccount.findUnique({ where: { email } }) : null;
  if (!account || !(await verifyPassword(password, account.passwordHash))) {
    recordLoginFailure(throttleKey);
    return { error: "Wrong email or password. Use the login we sent you on WhatsApp." };
  }
  clearLoginFailures(throttleKey);
  const started = await startStudentSession(account.email, { replaceDeviceId: String(formData.get("replace") ?? "") || undefined });
  if (!started.ok) return { error: started.error, devices: started.devices };
  // Only same-site paths — never an open redirect.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/account");
}

// "Continue with Google" (Firebase): the browser signs in with Google and
// sends us the ID token; we verify it and start the same student session the
// password login does. Any verified Google account can sign in — what it
// unlocks is still only the approved purchases for that Gmail.
export async function googleSignInAction(idToken: string, next: string, replaceDeviceId?: string): Promise<FormResult> {
  if (!googleSignInEnabled) return { error: "Google sign-in isn't set up yet." };
  let email: string;
  try {
    ({ email } = await verifyFirebaseIdToken(idToken, FIREBASE_CONFIG.projectId));
  } catch {
    return { error: "Google sign-in failed. Please try again." };
  }
  const started = await startStudentSession(email, { replaceDeviceId });
  if (!started.ok) return { error: started.error, devices: started.devices };
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/account");
}

export async function studentLogoutAction() {
  await endCurrentStudentSession();
  redirect("/");
}

// Account → Devices: sign one of your own other devices out.
export async function signOutDeviceAction(formData: FormData) {
  const email = await getStudentEmail();
  if (!email) redirect("/login?next=/account");
  const result = await revokeStudentDevice(email, String(formData.get("id") ?? ""));
  revalidatePath("/account");
  if (!result.ok) redirect(`/account?tab=devices&error=${encodeURIComponent(result.error ?? "")}`);
}

// ---------- Admin ----------

async function requireAdmin() {
  if (!(await getSession())) throw new Error("Unauthorized");
}

// ---------- Razorpay (auto-approved) ----------

// Shared by the checkout verify endpoint and the webhook: turn a captured
// Razorpay payment into an APPROVED Purchase + NotesAccount, same shape as a
// manually-approved UPI purchase. Idempotent on razorpayOrderId so whichever
// of the two call sites gets there first wins; the other is a no-op.
export async function completeRazorpayPurchase(input: {
  orderId: string;
  paymentId: string;
  email: string;
  phone: string;
  items: string[];
  amount: number;
}): Promise<void> {
  const existing = await prisma.purchase.findUnique({ where: { razorpayOrderId: input.orderId } });
  if (existing) return;

  const account = await prisma.notesAccount.findUnique({ where: { email: input.email } });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.purchase.create({
        data: {
          email: input.email,
          phone: input.phone,
          utr: input.paymentId,
          amount: input.amount,
          items: input.items,
          status: "APPROVED",
          reviewedAt: new Date(),
          provider: "razorpay",
          razorpayOrderId: input.orderId,
        },
      });
      if (!account) {
        await tx.notesAccount.upsert({
          where: { email: input.email },
          create: { email: input.email, passwordHash: await hashPassword(generatePassword()) },
          update: {},
        });
      }
    });
  } catch (err) {
    // verify + webhook land together: the loser hits the unique order/payment
    // id. The winner already recorded it, so that's success, not a 500.
    if ((err as { code?: string }).code === "P2002") return;
    throw err;
  }
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

// Admin → Leads → a paid pop-up order. The pop-up only records a phone number, so the order alone unlocks nothing on the
// site. This ties it to the student's Gmail: it adds the notes they paid for to that login (a real, paid purchase that
// expires after ACCESS_MONTHS like any other), creates the login if there isn't one, and marks the order delivered.
export async function grantOrderAccessAction(_prev: ApproveResult, formData: FormData): Promise<ApproveResult> {
  await requireAdmin();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { error: "Enter the student's Gmail." };
  const order = await prisma.notesOrder.findUnique({ where: { id: String(formData.get("id") ?? "") } });
  if (!order) return { error: "Order not found." };

  const notes = await prisma.canonicalSubjectNote.findMany({
    where:
      order.plan === "semester"
        ? { programmeSlug: order.programmeSlug, semester: order.semester, NOT: { content: "" } }
        : { programmeSlug: order.programmeSlug, subjectSlug: order.subjectSlug, NOT: { content: "" } },
    select: { programmeSlug: true, subjectSlug: true },
  });
  if (!notes.length) return { error: "No notes are published for this order yet. Publish them first, then give access." };

  const utr = `order-${order.razorpayPaymentId}`; // unique, so pressing twice can never grant twice
  const already = await prisma.purchase.findUnique({ where: { utr }, select: { email: true } });
  if (already) return { error: `Access for this order was already given to ${already.email}.` };

  const account = await prisma.notesAccount.findUnique({ where: { email } });
  let password: string | undefined;
  await prisma.$transaction(async (tx) => {
    await tx.purchase.create({
      data: {
        email,
        phone: order.phone,
        utr,
        amount: order.amount,
        items: notes.map((n) => `${n.programmeSlug}/${n.subjectSlug}`),
        status: "APPROVED",
        reviewedAt: new Date(),
        provider: "razorpay",
        adminNote: "Pop-up order",
      },
    });
    if (!account) {
      password = generatePassword();
      await tx.notesAccount.create({ data: { email, passwordHash: await hashPassword(password) } });
    }
    await tx.notesOrder.update({ where: { id: order.id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
  });
  // No revalidatePath: the card would leave the "to send" list and take the one-time password with it.
  return { ok: true, email, phone: order.phone, password, existingAccount: !!account };
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

// Admin → Payments → Students: forget a student's devices (lost phone, hit the swap limit).
export async function resetStudentDevicesAction(formData: FormData) {
  await requireAdmin();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return;
  await resetStudentDevices(email);
  revalidatePath("/admin/payments/students");
}

export async function rejectPurchaseAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;
  await prisma.purchase.update({ where: { id }, data: { status: "REJECTED", reviewedAt: new Date(), adminNote } });
  revalidatePath("/admin/payments");
}

// Admin edits a student's access (Admin → Payments → Students). Access is the
// union of their APPROVED purchases, so a grant is a ₹0 approved purchase
// (no schema change) and a removal strips the subject from those purchases.
// Promoters grant through the same path, tagged by utr prefix.
async function grantItems(formData: FormData, by: { utr: string; adminNote: string }) {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) throw new Error("Enter a valid email.");
  const pairs = formData.getAll("item").map(String).map((k) => k.split("/")).filter((p) => p.length === 2);
  if (!pairs.length) return;
  const [notes, approved, latest] = await Promise.all([
    prisma.canonicalSubjectNote.findMany({
      where: { OR: pairs.map(([programmeSlug, subjectSlug]) => ({ programmeSlug, subjectSlug })), NOT: { content: "" } },
      select: { programmeSlug: true, subjectSlug: true },
    }),
    prisma.purchase.findMany({ where: { email, status: "APPROVED" }, select: { items: true, createdAt: true, reviewedAt: true, amount: true, utr: true } }),
    prisma.purchase.findFirst({ where: { email }, orderBy: { createdAt: "desc" }, select: { phone: true } }),
  ]);
  const owned = new Set(approved.filter((p) => isAccessActive(p)).flatMap((p) => p.items));
  const items = [
    ...new Set([
      ...notes.map((n) => `${n.programmeSlug}/${n.subjectSlug}`),
      ...pairs.filter(([p, s]) => isExtraItem(p, s)).map(([p, s]) => `${p}/${s}`),
    ]),
  ].filter((k) => !owned.has(k));
  if (!items.length) return;
  await prisma.purchase.create({
    data: {
      email,
      phone: latest?.phone ?? "",
      utr: by.utr,
      amount: 0,
      items,
      status: "APPROVED",
      reviewedAt: new Date(),
      adminNote: by.adminNote,
    },
  });
  revalidatePath("/admin/payments", "layout");
  revalidatePath("/promoter");
}

export async function grantSubjectsAction(formData: FormData) {
  await requireAdmin();
  await grantItems(formData, { utr: `admin-${randomUUID()}`, adminNote: "Added by admin" });
}

export async function revokeSubjectAction(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "");
  const item = String(formData.get("item") ?? "");
  const purchases = await prisma.purchase.findMany({
    where: { email, status: "APPROVED", items: { has: item } },
    select: { id: true, items: true },
  });
  await prisma.$transaction(
    purchases.map((p) => prisma.purchase.update({ where: { id: p.id }, data: { items: p.items.filter((k) => k !== item) } })),
  );
  revalidatePath("/admin/payments", "layout");
}

// ---------- Promoters (sub-admins, /promoter) ----------

export async function promoterLoginAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const throttleKey = await loginThrottleKey(`promoter:${email ?? ""}`);
  if (isLoginLocked(throttleKey)) return { error: "Too many attempts. Try again in 15 minutes." };
  const promoter = email ? await prisma.promoter.findUnique({ where: { email } }) : null;
  if (!promoter?.active || !(await verifyPassword(password, promoter.passwordHash))) {
    recordLoginFailure(throttleKey);
    return { error: "Wrong email or password." };
  }
  clearLoginFailures(throttleKey);
  (await cookies()).set(PROMOTER_COOKIE, signPromoterSession(promoter.id), PROMOTER_COOKIE_OPTIONS);
  redirect("/promoter");
}

export async function promoterLogoutAction() {
  (await cookies()).delete(PROMOTER_COOKIE);
  redirect("/promoter");
}

async function requirePromoter() {
  const promoter = await getPromoter();
  if (!promoter) throw new Error("Unauthorized");
  return promoter;
}

export async function promoterGrantAction(formData: FormData) {
  const promoter = await requirePromoter();
  await grantItems(formData, { utr: `${promoterUtrPrefix(promoter.id)}${randomUUID()}`, adminNote: `Added by promoter ${promoter.name}` });
}

// A promoter can only take back what they themselves gave — never a paid or admin grant.
export async function promoterRevokeAction(formData: FormData) {
  const promoter = await requirePromoter();
  const email = String(formData.get("email") ?? "");
  const item = String(formData.get("item") ?? "");
  const purchases = await prisma.purchase.findMany({
    where: { email, status: "APPROVED", items: { has: item }, utr: { startsWith: promoterUtrPrefix(promoter.id) } },
    select: { id: true, items: true },
  });
  await prisma.$transaction(
    purchases.map((p) => prisma.purchase.update({ where: { id: p.id }, data: { items: p.items.filter((k) => k !== item) } })),
  );
  revalidatePath("/promoter");
  revalidatePath("/admin/payments", "layout");
}

// Admin → Payments → Promoters: creates the promoter, or for an existing
// email issues a new password and re-activates them. Password shown once.
export async function issuePromoterLoginAction(_prev: ApproveResult, formData: FormData): Promise<ApproveResult> {
  await requireAdmin();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  if (!email) return { error: "Enter a valid email." };
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  await prisma.promoter.upsert({
    where: { email },
    create: { email, name: name || email.split("@")[0], passwordHash },
    update: { passwordHash, active: true, ...(name && { name }) },
  });
  revalidatePath("/admin/payments/promoters");
  return { ok: true, email, password };
}

export async function setPromoterActiveAction(formData: FormData) {
  await requireAdmin();
  await prisma.promoter.update({
    where: { id: String(formData.get("id") ?? "") },
    data: { active: formData.get("active") === "true" },
  });
  revalidatePath("/admin/payments/promoters");
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
