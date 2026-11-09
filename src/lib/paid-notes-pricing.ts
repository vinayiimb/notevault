// Client-safe (no Prisma): pricing + free-preview rules for paid subject
// notes, shared by the checkout page, the notes paywall and the papers nudge.

// Packs a student can combine. priceFor() always picks the cheapest mix, so
// 2 subjects = 2 singles, 4 = 3-pack + single, 5 = the 6-pack (a bigger pack
// is allowed when it costs less), 7 = 6-pack + single, etc.
export const PACKS = [
  { subjects: 1, price: 49, name: "Single Subject", badge: null },
  { subjects: 3, price: 119, name: "3 Subjects", badge: "Most popular" },
  { subjects: 6, price: 199, name: "Whole Semester", badge: "Best value" },
] as const;

// Paid access lasts this long from the purchase date (not "lifetime").
export const ACCESS_MONTHS = 6;

// Purchases made before this moment were sold as "lifetime" and stay that way.
export const EXPIRY_STARTS = new Date("2026-11-09T16:49:00Z");

/**
 * When a purchase's access ends, or null = never (old lifetime purchases, free
 * admin/promoter grants). Counted from approval (UPI) / payment (Razorpay), so a
 * slow manual verification never eats into the student's 6 months.
 */
export function accessExpiry(p: { createdAt: Date; reviewedAt?: Date | null; amount: number; utr: string }): Date | null {
  if (p.amount <= 0 || /^(admin|promoter)-/.test(p.utr) || p.createdAt < EXPIRY_STARTS) return null;
  const end = new Date(p.reviewedAt ?? p.createdAt);
  end.setUTCMonth(end.getUTCMonth() + ACCESS_MONTHS);
  return end;
}

export function isAccessActive(p: Parameters<typeof accessExpiry>[0], now = new Date()): boolean {
  const end = accessExpiry(p);
  return !end || end > now;
}

export const SINGLE_PRICE = PACKS[0].price;

// Packs as plans on /paid-notes and the checkout. "listPrice"
// is just the pack's subjects at the single-subject price — the real
// saving, not an invented MRP.
export const PLANS = PACKS.map((p) => ({ ...p, listPrice: p.subjects * SINGLE_PRICE }));

export type Plan = (typeof PLANS)[number];

export function planFor(subjects: number): Plan {
  return PLANS.find((p) => p.subjects === subjects) ?? PLANS[0];
}

// Whether signed-in students get a "Download PDF" button. Off on purpose: a
// PDF is the one thing that can be forwarded to a whole class, which is how a
// single sale turns into zero. Notes are read inside the student dashboard,
// on up to 2 devices. Admins always see the button. Flip this to bring it back
// (the marketing list below follows it).
export const STUDENT_PDF_DOWNLOAD = false;

// What every paid plan includes, per subject.
export const PAID_FEATURES = [
  "Complete unit-wise notes",
  "Full worked answers to PYQs",
  "Diagrams, tables & flowcharts",
  ...(STUDENT_PDF_DOWNLOAD ? ["Download as PDF"] : []),
  "Read on your phone and laptop (2 devices)",
] as const;

export function priceFor(count: number): number {
  if (count <= 0) return 0;
  const best = [0];
  for (let n = 1; n <= count; n++) {
    // A pack bigger than what's needed is fine if it's cheaper (5 subjects = the 6-pack).
    best[n] = Math.min(...PACKS.map((p) => best[Math.max(0, n - p.subjects)] + p.price));
  }
  return best[count];
}

// "Add 1 more subject for ₹X" — the next count that costs barely more (or
// nothing more) than the current one, so a student picking 2 sees that a
// 3rd costs ₹1. Null when the next subject costs a full single price.
export function upsellFor(count: number): { extra: number; nextCount: number } | null {
  if (count <= 0) return null;
  const extra = priceFor(count + 1) - priceFor(count);
  return extra < SINGLE_PRICE ? { extra, nextCount: count + 1 } : null;
}

export function itemKey(programmeSlug: string, subjectSlug: string) {
  return `${programmeSlug}/${subjectSlug}`;
}

// The free part of a note: the lines up to ~30% of the text. Every note is
// gated, short ones included. The cut goes at the first line break past
// 30% — never inside a ``` fence (a half Mermaid/code block) or between two
// table rows. Not "blank lines only": live notes often have none at all
// (heading, bullets, heading…), and that left a whole note unlocked.
export const PREVIEW_RATIO = 0.3;

const isTableRow = (line: string | undefined) => !!line && /^\s*\|/.test(line);

export function previewOf(markdown: string): { preview: string; truncated: boolean } {
  const target = markdown.length * PREVIEW_RATIO;
  const lines = markdown.split("\n");
  let inFence = false;
  let length = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) inFence = !inFence;
    length += lines[i].length + 1;
    if (length < target || inFence || (isTableRow(lines[i]) && isTableRow(lines[i + 1]))) continue;
    if (/^\s*#/.test(lines[i])) continue; // don't end on a heading with nothing under it
    const preview = lines.slice(0, i + 1).join("\n").trimEnd();
    // Only whitespace left after the cut = nothing to lock.
    if (!markdown.slice(preview.length).trim()) break;
    return { preview, truncated: true };
  }
  return { preview: markdown, truncated: false };
}

// Indian UPI reference numbers are 12 digits; some apps show longer
// alphanumeric transaction IDs, so accept 10–22 letters/digits.
export function normalizeUtr(raw: string): string | null {
  const utr = raw.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z0-9]{10,22}$/.test(utr) ? utr : null;
}

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

// 10-digit Indian mobile, with or without +91/0 — stored as 91XXXXXXXXXX
// so it drops straight into a wa.me link.
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? `91${digits}` : null;
}

export function upiPayLink(upiId: string, payeeName: string | null, amount: number) {
  const params = new URLSearchParams({ pa: upiId, am: String(amount), cu: "INR", tn: "DU PYQ notes" });
  if (payeeName) params.set("pn", payeeName);
  return `upi://pay?${params.toString()}`;
}
