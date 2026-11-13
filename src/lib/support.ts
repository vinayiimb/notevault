import { prisma } from "@/lib/prisma";
import { isMissingTable } from "@/lib/paid-notes";
import { parseKind, parseStatus, type TicketRow } from "@/lib/support-rules";

export * from "@/lib/support-rules";

const asRow = (t: { kind: string; status: string } & Omit<TicketRow, "kind" | "status">): TicketRow => ({
  ...t,
  kind: parseKind(t.kind) ?? "PROBLEM",
  status: parseStatus(t.status) ?? "OPEN",
});

/** A student's own tickets, newest first. `null` = the table isn't there yet (migration not applied). */
export async function listMyTickets(email: string): Promise<TicketRow[] | null> {
  try {
    return (await prisma.supportTicket.findMany({ where: { email }, orderBy: { createdAt: "desc" }, take: 50 })).map(asRow);
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
}
