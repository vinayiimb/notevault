// Client-safe (no Prisma): pricing + free-preview rules for paid subject
// notes, shared by the checkout page, the notes paywall and the papers nudge.

// Packs a student can combine. priceFor() always picks the cheapest mix, so
// 4 subjects = 3-pack + single, 6 = 5-pack + single, etc.
export const PACKS = [
  { subjects: 1, price: 49, name: "Single Subject", badge: null },
  { subjects: 3, price: 99, name: "3 Subjects", badge: "Most popular" },
  { subjects: 5, price: 149, name: "Full Semester", badge: "Best value" },
] as const;

export const SINGLE_PRICE = PACKS[0].price;

// Packs as plans on /paid-notes and the checkout. "listPrice"
// is just the pack's subjects at the single-subject price — the real
// saving, not an invented MRP.
export const PLANS = PACKS.map((p) => ({ ...p, listPrice: p.subjects * SINGLE_PRICE }));

export type Plan = (typeof PLANS)[number];

export function planFor(subjects: number): Plan {
  return PLANS.find((p) => p.subjects === subjects) ?? PLANS[0];
}

// What every paid plan includes, per subject.
export const PAID_FEATURES = [
  "Complete unit-wise notes",
  "Full worked answers to PYQs",
  "Diagrams, tables & flowcharts",
  "Download as PDF",
  "Sign in on any device",
] as const;

export function priceFor(count: number): number {
  if (count <= 0) return 0;
  const best = [0];
  for (let n = 1; n <= count; n++) {
    best[n] = Math.min(...PACKS.filter((p) => p.subjects <= n).map((p) => best[n - p.subjects] + p.price));
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

// The free part of a note: whole markdown blocks up to ~30% of the text
// (never inside a ``` fence, so a half Mermaid/code block can't leak or
// break rendering). Every note is gated, short ones included; only a note
// with no block boundary after the 30% mark (one giant block) stays whole.
export const PREVIEW_RATIO = 0.3;

export function previewOf(markdown: string): { preview: string; truncated: boolean } {
  const target = markdown.length * PREVIEW_RATIO;
  const lines = markdown.split("\n");
  let inFence = false;
  let length = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) inFence = !inFence;
    length += lines[i].length + 1;
    // Cut only on a blank line outside a fence — a block boundary.
    if (length >= target && !inFence && lines[i].trim() === "") {
      const preview = lines.slice(0, i).join("\n").trimEnd();
      // Only whitespace left after the cut = nothing to lock.
      if (!markdown.slice(preview.length).trim()) break;
      return { preview, truncated: true };
    }
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
