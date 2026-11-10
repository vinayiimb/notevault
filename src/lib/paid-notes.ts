import "server-only";
import { cache } from "react";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession, jwtSecret } from "@/lib/auth";
import { findCanonicalSubject } from "@/lib/canonical-subject-notes-data";
import { slugify } from "@/lib/utils";
import { isAccessActive, itemKey } from "@/lib/paid-notes-pricing";
import { DEVICE_IDLE_DAYS } from "@/lib/student-device-policy";
import raw from "../../public/data/canonical-programmes.json";

// Paid subject notes: students pay by UPI, submit email + UTR, an admin
// approves in /admin/payments, which issues a login (NotesAccount). A signed
// cookie then unlocks the subjects from that email's approved purchases.

export const STUDENT_COOKIE = "notevault_student";
const STUDENT_SESSION_DAYS = 60;

export type PaymentSettings = {
  paywallEnabled: boolean;
  upiId: string | null;
  upiPayeeName: string | null;
  upiQrUrl: string | null;
  /** Paywall is really on: enabled AND there's a way to pay. */
  active: boolean;
};

export async function getPaymentSettings(): Promise<PaymentSettings> {
  try {
    const s = await prisma.siteSettings.findUnique({
      where: { id: "singleton" },
      select: { paywallEnabled: true, upiId: true, upiPayeeName: true, upiQrUrl: true },
    });
    const settings = {
      paywallEnabled: s?.paywallEnabled ?? false,
      upiId: s?.upiId || null,
      upiPayeeName: s?.upiPayeeName || null,
      upiQrUrl: s?.upiQrUrl || null,
    };
    // Razorpay keys count as "a way to pay" too, so clearing the old UPI
    // fields can't silently switch the paywall off.
    const canPay = !!(settings.upiId || settings.upiQrUrl || process.env.RAZORPAY_KEY_ID);
    return { ...settings, active: settings.paywallEnabled && canPay };
  } catch {
    // DB down or the migration not applied yet — fail open (notes stay
    // free) rather than locking every note behind a broken checkout.
    return { paywallEnabled: false, upiId: null, upiPayeeName: null, upiQrUrl: null, active: false };
  }
}

/** `deviceId` ties the session to a StudentDevice row (see student-devices.ts); omitted only while that table is missing. */
export function signStudentSession(email: string, deviceId?: string) {
  return jwt.sign({ studentEmail: email, ...(deviceId && { did: deviceId }) }, jwtSecret(), { expiresIn: `${STUDENT_SESSION_DAYS}d` });
}

export const STUDENT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * STUDENT_SESSION_DAYS,
};

const TOUCH_EVERY_MS = 60 * 60 * 1000;

// The signed-in student, re-checked against their device row on every request
// so signing a device out (or an admin reset) takes effect at once. Sessions
// issued before devices existed have no `did` and stay valid until they
// expire; if the table itself is missing (migration not applied yet) the
// signature alone is trusted, so a deploy can never lock students out.
export const getStudentSession = cache(async (): Promise<{ email: string; deviceId: string | null } | null> => {
  try {
    const token = (await cookies()).get(STUDENT_COOKIE)?.value;
    if (!token) return null;
    const payload = jwt.verify(token, jwtSecret()) as { studentEmail?: string; did?: string };
    const email = payload.studentEmail;
    if (!email) return null;
    if (!payload.did) return { email, deviceId: null };
    try {
      const device = await prisma.studentDevice.findUnique({ where: { id: payload.did } });
      const now = Date.now();
      if (!device || device.email !== email || device.revokedAt || now - device.lastSeenAt.getTime() > DEVICE_IDLE_DAYS * 86_400_000) return null;
      if (now - device.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
        await prisma.studentDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date(now) } }).catch(() => {});
      }
      return { email, deviceId: device.id };
    } catch (err) {
      if (isMissingTable(err)) return { email, deviceId: null };
      throw err;
    }
  } catch {
    return null;
  }
});

export async function getStudentEmail(): Promise<string | null> {
  return (await getStudentSession())?.email ?? null;
}

/** Prisma "table/column does not exist" — the migration hasn't been applied to this database yet. */
export function isMissingTable(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "P2021" || code === "P2022";
}

export async function getUnlockedItems(email: string): Promise<Set<string>> {
  const purchases = await prisma.purchase.findMany({
    where: { email, status: "APPROVED" },
    select: { items: true, createdAt: true, reviewedAt: true, amount: true, utr: true },
  });
  // Paid purchases run out 6 months after the purchase date (see accessExpiry).
  return new Set(purchases.filter((p) => isAccessActive(p)).flatMap((p) => p.items));
}

export type NoteAccess = "free" | "admin" | "owner" | "locked";

// Why (or whether) this visitor may read the full note: "free" = the paywall
// is off or the note is free for everyone, "admin", "owner" = a signed-in
// student with an approved purchase, "locked" = preview only.
export async function getNoteAccess(programmeSlug: string, subjectSlug: string): Promise<NoteAccess> {
  const settings = await getPaymentSettings();
  if (!settings.active) return "free";
  if (await getSession()) return "admin"; // admins always see everything
  const note = await prisma.canonicalSubjectNote.findUnique({
    where: { programmeSlug_subjectSlug: { programmeSlug, subjectSlug } },
    select: { isFree: true },
  });
  if (note?.isFree) return "free"; // admin opted this subject out of the paywall
  const email = await getStudentEmail();
  if (!email) return "locked";
  return (await getUnlockedItems(email)).has(itemKey(programmeSlug, subjectSlug)) ? "owner" : "locked";
}

// Paid-only perks (e.g. "Download all" ZIPs, which cost Railway egress): an
// admin, or a signed-in student with a real (₹ > 0) approved purchase. Admin
// ₹0 grants don't count. Fails closed — unlike the notes paywall.
export async function hasPaidAccess(): Promise<boolean> {
  try {
    if (await getSession()) return true;
    const email = await getStudentEmail();
    if (!email) return false;
    const paid = await prisma.purchase.findMany({
      where: { email, status: "APPROVED", amount: { gt: 0 } },
      select: { createdAt: true, reviewedAt: true, amount: true, utr: true },
    });
    return paid.some((p) => isAccessActive(p));
  } catch {
    return false;
  }
}

// Paid pages that are not a CanonicalSubjectNote row (hand-built interactive notes, e.g. /sample/probability-statistics).
// Admins can grant them like any subject; they are not on sale in the public checkout.
export const EXTRA_ITEMS = [
  { programmeSlug: "bsc-hons-mathematics", programme: "B.Sc. (Hons.) Mathematics", subjectSlug: "probability-and-statistics", subject: "Probability and Statistics (interactive notes)", semester: 1 },
] as const;
export const isExtraItem = (programmeSlug: string, subjectSlug: string) =>
  EXTRA_ITEMS.some((e) => e.programmeSlug === programmeSlug && e.subjectSlug === subjectSlug);

export type NotesCatalogProgramme = {
  slug: string;
  name: string;
  subjects: { slug: string; name: string; semester: number | null }[];
};

// Every programme/subject that actually has published notes — what the
// checkout lets a student buy.
export async function getNotesCatalog(): Promise<NotesCatalogProgramme[]> {
  const notes = await prisma.canonicalSubjectNote.findMany({
    where: { NOT: { content: "" } },
    select: { programmeSlug: true, subjectSlug: true, semester: true },
  });
  const programmes = Object.values(raw as Record<string, { name: string; subjects: string[] }>);
  const bySlug = new Map(programmes.map((p) => [slugify(p.name), p]));

  const result = new Map<string, NotesCatalogProgramme>();
  for (const n of notes) {
    const programme = bySlug.get(n.programmeSlug);
    const subjectName = programme?.subjects.find((s) => slugify(s) === n.subjectSlug);
    if (!programme || !subjectName) continue;
    const entry = result.get(n.programmeSlug) ?? { slug: n.programmeSlug, name: programme.name, subjects: [] };
    entry.subjects.push({ slug: n.subjectSlug, name: subjectName, semester: n.semester });
    result.set(n.programmeSlug, entry);
  }
  return [...result.values()]
    .map((p) => ({ ...p, subjects: p.subjects.sort((a, b) => (a.semester ?? 99) - (b.semester ?? 99) || a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// "bcom-p/risk-management" -> "Risk Management (B.Com (P))" for admin and
// student-facing purchase lists.
export async function describeItems(items: string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    items.map(async (key) => {
      const [programmeSlug, subjectSlug] = key.split("/");
      const found = await findCanonicalSubject(programmeSlug, subjectSlug);
      return [key, found ? `${found.subject} (${found.programme.name})` : key] as const;
    }),
  );
  return Object.fromEntries(entries);
}
