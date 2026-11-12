// The admin note on a NotesOrder carries a little structure, so the delivery tracker needs no schema change:
//   "Added by admin | Under: <packOrderId> | Gmail: name@gmail.com | Paid: 100"
// free text first, then optional `Under` (this subject belongs to a whole-semester order), `Gmail`, and the payment
// state: `Unpaid` (nothing received yet) or `Paid: N` (N rupees of the amount received so far); neither = paid in full.
// Older rows hold just "Gmail: x".
// `Site: <programme>/<subject>` marks an entry that stands for a subject unlocked on the site (an "auto" row you edited).
export type OrderMeta = { text: string; gmail: string; under: string; unpaid: boolean; paid: number | null; site: string };

export function parseOrderMeta(note: string | null | undefined): OrderMeta {
  const meta: OrderMeta = { text: "", gmail: "", under: "", unpaid: false, paid: null, site: "" };
  const text: string[] = [];
  for (const part of (note ?? "").split("|").map((s) => s.trim()).filter(Boolean)) {
    if (part === "Unpaid") {
      meta.unpaid = true;
      continue;
    }
    const part2 = /^Paid:\s*(\d+)$/.exec(part);
    if (part2) {
      meta.paid = Number(part2[1]);
      continue;
    }
    const m = /^(Gmail|Under|Site):\s*(\S+)$/.exec(part);
    if (!m) text.push(part);
    else if (m[1] === "Gmail") meta.gmail = m[2];
    else if (m[1] === "Site") meta.site = m[2];
    else meta.under = m[2];
  }
  meta.text = text.join(" | ");
  return meta;
}

export function buildOrderMeta(m: Partial<OrderMeta>): string | null {
  const parts = [m.text, m.under && `Under: ${m.under}`, m.gmail && `Gmail: ${m.gmail}`, m.site && `Site: ${m.site}`, m.unpaid ? "Unpaid" : m.paid != null && `Paid: ${m.paid}`].filter(Boolean);
  return parts.length ? parts.join(" | ") : null;
}

/** Rupees received for one purchase: all of it, none (Unpaid), or the part noted by `Paid: N`. */
export function receivedOf(amount: number, meta: Pick<OrderMeta, "unpaid" | "paid">): number {
  if (meta.unpaid) return 0;
  return meta.paid == null ? amount : Math.min(meta.paid, amount);
}
