import "server-only";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession, jwtSecret } from "@/lib/auth";
import { findCanonicalSubject } from "@/lib/canonical-subject-notes-data";
import { slugify } from "@/lib/utils";
import { itemKey } from "@/lib/paid-notes-pricing";
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
    return { ...settings, active: settings.paywallEnabled && !!(settings.upiId || settings.upiQrUrl) };
  } catch {
    // DB down or the migration not applied yet — fail open (notes stay
    // free) rather than locking every note behind a broken checkout.
    return { paywallEnabled: false, upiId: null, upiPayeeName: null, upiQrUrl: null, active: false };
  }
}

export function signStudentSession(email: string) {
  return jwt.sign({ studentEmail: email }, jwtSecret(), { expiresIn: `${STUDENT_SESSION_DAYS}d` });
}

export const STUDENT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * STUDENT_SESSION_DAYS,
};

export async function getStudentEmail(): Promise<string | null> {
  try {
    const token = (await cookies()).get(STUDENT_COOKIE)?.value;
    if (!token) return null;
    const payload = jwt.verify(token, jwtSecret()) as { studentEmail?: string };
    return payload.studentEmail ?? null;
  } catch {
    return null;
  }
}

export async function getUnlockedItems(email: string): Promise<Set<string>> {
  const purchases = await prisma.purchase.findMany({
    where: { email, status: "APPROVED" },
    select: { items: true },
  });
  return new Set(purchases.flatMap((p) => p.items));
}

export async function canReadFullNote(programmeSlug: string, subjectSlug: string): Promise<boolean> {
  const settings = await getPaymentSettings();
  if (!settings.active) return true;
  if (await getSession()) return true; // admins always see everything
  const note = await prisma.canonicalSubjectNote.findUnique({
    where: { programmeSlug_subjectSlug: { programmeSlug, subjectSlug } },
    select: { isFree: true },
  });
  if (note?.isFree) return true; // admin opted this subject out of the paywall
  const email = await getStudentEmail();
  if (!email) return false;
  return (await getUnlockedItems(email)).has(itemKey(programmeSlug, subjectSlug));
}

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
