import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DEFAULT_MAX_SUBJECTS, type SubjectInput } from "@/lib/feathers";
import { istDay } from "@/lib/student-activity-format";

// Data behind the /account dashboard: "My subjects" and the weekly-readers count. Every read degrades to empty when the table isn't there yet
// (migration not applied), so shipping code before migrating can't break /account.

const isMissing = (err: unknown) => ["P2021", "P2022"].includes((err as { code?: string } | null)?.code ?? "");

export type SubjectRow = { id: string; type: string; name: string; code: string | null; course: string | null; semester: number | null };

/** null = the StudentSubject table doesn't exist yet (hide the Add form). */
export async function listSubjects(email: string): Promise<SubjectRow[] | null> {
  try {
    return await prisma.studentSubject.findMany({
      where: { email },
      orderBy: { createdAt: "asc" },
      select: { id: true, type: true, name: true, code: true, course: true, semester: true },
    });
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
}

/** How many subjects this student may list: the admin's override, else the default. Never throws. */
export async function getSubjectLimit(email: string): Promise<number> {
  try {
    return (await prisma.studentSubjectLimit.findUnique({ where: { email } }))?.maxSubjects ?? DEFAULT_MAX_SUBJECTS;
  } catch {
    return DEFAULT_MAX_SUBJECTS; // table missing before the migration
  }
}

/** Admin: set a student's limit; null removes the override (back to the default). */
export async function setSubjectLimit(email: string, limit: number | null) {
  if (limit === null) await prisma.studentSubjectLimit.deleteMany({ where: { email } });
  else await prisma.studentSubjectLimit.upsert({ where: { email }, create: { email, maxSubjects: limit }, update: { maxSubjects: limit } });
}

export async function addSubject(email: string, s: SubjectInput): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const limit = await getSubjectLimit(email);
    const already = await prisma.studentSubject.findUnique({ where: { email_name: { email, name: s.name } } });
    if (!already && (await prisma.studentSubject.count({ where: { email } })) >= limit) {
      return { ok: false, error: `You can list up to ${limit} subjects. Remove one first, or ask us on WhatsApp to raise your limit.` };
    }
    await prisma.studentSubject.upsert({
      where: { email_name: { email, name: s.name } },
      create: { email, ...s },
      update: { type: s.type, code: s.code, course: s.course, semester: s.semester },
    });
    return { ok: true };
  } catch (err) {
    if (isMissing(err)) return { ok: false, error: "Subjects aren't switched on yet. Try again soon." };
    throw err;
  }
}

export async function removeSubject(email: string, id: string) {
  // deleteMany + email filter: a student can only remove their own rows.
  await prisma.studentSubject.deleteMany({ where: { id, email } }).catch((err) => {
    if (!isMissing(err)) throw err;
  });
}

// How many students read notes in the last 7 days (shown on the dashboard's community card). Cached 10 min.
export const getWeeklyReaders = unstable_cache(
  async (): Promise<number> => {
    try {
      const since = istDay(new Date(Date.now() - 6 * 86_400_000));
      const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT email)::bigint AS n FROM "StudentActivity" WHERE seconds > 0 AND day >= ${since}`;
      return Number(rows[0]?.n ?? 0);
    } catch (err) {
      if (isMissing(err)) return 0;
      throw err;
    }
  },
  ["weekly-readers"],
  { revalidate: 600 },
);
