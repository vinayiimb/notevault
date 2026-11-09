import "server-only";
import { prisma } from "@/lib/prisma";
import { accessExpiry } from "@/lib/paid-notes-pricing";

// Everything the student dashboard (/account) shows, from the student's
// purchases. Access is the union of their APPROVED purchases (see paid-notes.ts).

export type OwnedNote = {
  key: string;
  programmeSlug: string;
  subjectSlug: string;
  subject: string;
  semester: number | null;
  /** When access ends; null = never (old lifetime purchases, gifts). */
  expiresAt: Date | null;
};
export type OwnedGroup = { programmeSlug: string; programme: string; notes: OwnedNote[] };
export type PurchaseRow = {
  id: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  /** "Razorpay" | "UPI" | "Gift" (admin or promoter grant) */
  via: string;
  reference: string | null;
  items: { key: string; name: string }[];
};

export type PortalData = {
  groups: OwnedGroup[];
  /** Subjects whose 6 months ran out — shown with a "Renew" link. */
  expired: { key: string; name: string; programmeSlug: string; subjectSlug: string; expiredAt: Date }[];
  ownedCount: number;
  totalPaid: number;
  pendingCount: number;
  purchases: PurchaseRow[];
};

export async function getPortalData(email: string): Promise<PortalData> {
  const purchases = await prisma.purchase.findMany({ where: { email }, orderBy: { createdAt: "desc" } });
  // Per subject, the latest end date across all its approved purchases (null = lifetime wins).
  const now = new Date();
  const endOf = new Map<string, Date | null>();
  for (const p of purchases) {
    if (p.status !== "APPROVED") continue;
    const end = accessExpiry(p);
    for (const key of p.items) {
      const prev = endOf.get(key);
      if (prev === null) continue;
      endOf.set(key, end === null || prev === undefined || end > prev ? end : prev);
    }
  }
  const isLive = (end: Date | null | undefined) => end === null || (end !== undefined && end > now);
  const ownedKeys = [...endOf.keys()].filter((k) => isLive(endOf.get(k)));
  const allKeys = [...new Set(purchases.flatMap((p) => p.items))];
  const pairs = allKeys.map((k) => k.split("/")).filter((p) => p.length === 2);

  const notes = pairs.length
    ? await prisma.canonicalSubjectNote.findMany({
        where: { OR: pairs.map(([programmeSlug, subjectSlug]) => ({ programmeSlug, subjectSlug })) },
        select: { programmeSlug: true, programme: true, subjectSlug: true, subject: true, semester: true },
      })
    : [];
  const byKey = new Map(notes.map((n) => [`${n.programmeSlug}/${n.subjectSlug}`, n]));

  const groups = new Map<string, OwnedGroup>();
  for (const key of ownedKeys) {
    const n = byKey.get(key);
    if (!n) continue; // note was unpublished since — nothing to open
    const g = groups.get(n.programmeSlug) ?? { programmeSlug: n.programmeSlug, programme: n.programme, notes: [] };
    g.notes.push({ key, programmeSlug: n.programmeSlug, subjectSlug: n.subjectSlug, subject: n.subject, semester: n.semester, expiresAt: endOf.get(key) ?? null });
    groups.set(n.programmeSlug, g);
  }
  const sorted = [...groups.values()]
    .map((g) => ({ ...g, notes: g.notes.sort((a, b) => (a.semester ?? 99) - (b.semester ?? 99) || a.subject.localeCompare(b.subject)) }))
    .sort((a, b) => a.programme.localeCompare(b.programme));

  const expired = [...endOf.entries()]
    .filter(([k, end]) => !isLive(end) && byKey.has(k))
    .map(([key, end]) => {
      const n = byKey.get(key)!;
      return { key, name: n.subject, programmeSlug: n.programmeSlug, subjectSlug: n.subjectSlug, expiredAt: end as Date };
    });

  return {
    groups: sorted,
    expired,
    ownedCount: sorted.reduce((n, g) => n + g.notes.length, 0),
    totalPaid: purchases.filter((p) => p.status === "APPROVED").reduce((sum, p) => sum + p.amount, 0),
    pendingCount: purchases.filter((p) => p.status === "PENDING").length,
    purchases: purchases.map((p) => {
      const gift = p.utr.startsWith("admin-") || p.utr.startsWith("promoter-");
      return {
        id: p.id,
        amount: p.amount,
        status: p.status,
        createdAt: p.createdAt,
        via: gift ? "Gift" : p.provider === "razorpay" ? "Razorpay" : "UPI",
        reference: gift ? null : p.utr,
        items: p.items.map((key) => ({ key, name: byKey.get(key)?.subject ?? key })),
      };
    }),
  };
}
