// Support tickets raised by signed-in students (Problem / Subject missing / Suggestion / Error).
// Pure rules and types only (no I/O), so they can be unit-tested; the DB read is in support.ts.

export const TICKET_KINDS = [
  { id: "PROBLEM", label: "Problem", hint: "Something isn't working for me" },
  { id: "SUBJECT_MISSING", label: "Subject missing", hint: "A subject, unit or paper I need isn't here" },
  { id: "ERROR", label: "Report an error", hint: "Wrong or missing content, a typo, a broken page" },
  { id: "SUGGESTION", label: "Suggestion", hint: "An idea to make DU PYQ better" },
] as const;
export type TicketKind = (typeof TICKET_KINDS)[number]["id"];

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const STATUS_LABEL: Record<TicketStatus, string> = { OPEN: "Open", IN_PROGRESS: "Looking into it", RESOLVED: "Resolved" };

export const MAX_SUBJECT = 120;
export const MAX_MESSAGE = 3000;
export const MAX_TICKETS_PER_DAY = 5;
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

export function parseKind(v: unknown): TicketKind | null {
  return TICKET_KINDS.find((k) => k.id === v)?.id ?? null;
}

export function parseStatus(v: unknown): TicketStatus | null {
  return TICKET_STATUSES.find((s) => s === v) ?? null;
}

/** Only keep same-site paths ("/notes/..."), so a hidden field can't smuggle in an arbitrary link. */
export function cleanPageUrl(v: unknown): string | null {
  const s = String(v ?? "").trim().slice(0, 300);
  return s.startsWith("/") && !s.startsWith("//") ? s : null;
}

export type TicketRow = {
  id: string;
  email: string;
  kind: TicketKind;
  subject: string;
  message: string;
  pageUrl: string | null;
  userAgent: string | null;
  screenshotUrl: string | null;
  status: TicketStatus;
  reply: string | null;
  repliedAt: Date | null;
  createdAt: Date;
};
