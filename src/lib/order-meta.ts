// The admin note on a NotesOrder carries a little structure, so the delivery tracker needs no schema change:
//   "Added by admin | Under: <packOrderId> | Gmail: name@gmail.com"
// free text first, then optional `Under` (this subject belongs to a whole-semester order) and `Gmail` tokens.
// Older rows hold just "Gmail: x".
export type OrderMeta = { text: string; gmail: string; under: string };

export function parseOrderMeta(note: string | null | undefined): OrderMeta {
  const meta: OrderMeta = { text: "", gmail: "", under: "" };
  const text: string[] = [];
  for (const part of (note ?? "").split("|").map((s) => s.trim()).filter(Boolean)) {
    const m = /^(Gmail|Under):\s*(\S+)$/.exec(part);
    if (!m) text.push(part);
    else if (m[1] === "Gmail") meta.gmail = m[2];
    else meta.under = m[2];
  }
  meta.text = text.join(" | ");
  return meta;
}

export function buildOrderMeta(m: Partial<OrderMeta>): string | null {
  const parts = [m.text, m.under && `Under: ${m.under}`, m.gmail && `Gmail: ${m.gmail}`].filter(Boolean);
  return parts.length ? parts.join(" | ") : null;
}
