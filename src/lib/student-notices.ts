import { prisma } from "@/lib/prisma";
import { isMissingTable } from "@/lib/paid-notes";

export const NOTICE_AUDIENCES = [
  { id: "ALL", label: "Every signed-in student" },
  { id: "PAID", label: "Only students with notes" },
] as const;
export type NoticeAudience = (typeof NOTICE_AUDIENCES)[number]["id"];
export const parseAudience = (v: unknown): NoticeAudience => (v === "PAID" ? "PAID" : "ALL");
export const MAX_NOTICE_TITLE = 100;
export const MAX_NOTICE_BODY = 1500;

export const MAX_REPLY = 1000;
export type ReplyRow = { id: string; email: string; body: string; seen: boolean; createdAt: Date };
export type NoticeRow = { id: string; title: string; body: string; audience: NoticeAudience; active: boolean; createdAt: Date; replies: ReplyRow[] };

/** What this student sees on /account, newest first, with only their own replies. Empty while the tables are missing. */
export async function noticesFor(hasNotes: boolean, email: string): Promise<NoticeRow[]> {
  try {
    const rows = await prisma.studentNotice.findMany({
      where: { active: true, ...(hasNotes ? {} : { audience: "ALL" }) },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { replies: { where: { email }, orderBy: { createdAt: "asc" }, take: 20 } },
    });
    return rows.map((r) => ({ ...r, audience: parseAudience(r.audience) }));
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

/** Admin list (all, newest first). `null` = the table isn't there yet. */
export async function listNotices(): Promise<NoticeRow[] | null> {
  try {
    const rows = await prisma.studentNotice.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { replies: { orderBy: { createdAt: "desc" }, take: 100 } } });
    return rows.map((r) => ({ ...r, audience: parseAudience(r.audience) }));
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
}
