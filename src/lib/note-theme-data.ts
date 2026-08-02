import { prisma } from "@/lib/prisma";
import { DEFAULT_THEME, ThemeValuesSchema, resolveEffectiveTheme, type ThemeValues } from "@/lib/note-theme";

function parseFullTheme(json: unknown): ThemeValues | null {
  const parsed = ThemeValuesSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

function parsePartialTheme(json: unknown): Partial<ThemeValues> | null {
  if (json == null) return null;
  const parsed = ThemeValuesSchema.partial().safeParse(json);
  return parsed.success ? parsed.data : null;
}

/** The live (published-only) theme for one note, walking GLOBAL default ->
 * SUBJECT override -> NOTE override — this is what the public subject page
 * renders. Never falls through to a draft: an unpublished override simply
 * doesn't apply yet. `subjectNotesId` is optional so this also works as a
 * subject-level preview (e.g. the admin editor) before any SubjectNotes row
 * exists yet — it just skips the NOTE-scope layer in that case. */
export async function getResolvedThemeForNote(subjectId: string, subjectNotesId?: string | null): Promise<ThemeValues> {
  const [globalTheme, subjectTheme, noteTheme] = await Promise.all([
    prisma.noteTheme.findFirst({ where: { scope: "GLOBAL", isDefaultGlobal: true } }),
    prisma.noteTheme.findFirst({ where: { scope: "SUBJECT", subjectId } }),
    subjectNotesId ? prisma.noteTheme.findUnique({ where: { subjectNotesId } }) : Promise.resolve(null),
  ]);

  const globalDefault = (globalTheme && parseFullTheme(globalTheme.publishedJson)) ?? DEFAULT_THEME;
  return resolveEffectiveTheme({
    globalDefault,
    subjectTheme: subjectTheme ? parsePartialTheme(subjectTheme.publishedJson) : null,
    noteTheme: noteTheme ? parsePartialTheme(noteTheme.publishedJson) : null,
  });
}

export function listNoteThemes() {
  return prisma.noteTheme.findMany({
    orderBy: [{ scope: "asc" }, { name: "asc" }],
    include: { subject: { select: { id: true, name: true } } },
  });
}

export function getNoteThemeById(id: string) {
  return prisma.noteTheme.findUnique({
    where: { id },
    include: { versions: { orderBy: { createdAt: "desc" } }, subject: { select: { id: true, name: true } } },
  });
}
