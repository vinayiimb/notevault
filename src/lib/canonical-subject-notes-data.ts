import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import canonicalMappingData from "@/data/du-canonical-mapping.json";

type CanonicalProgrammeRaw = { name: string; subjects: string[] };

const PROGRAMMES = canonicalMappingData.programmes as Record<string, CanonicalProgrammeRaw>;

function programmeList() {
  return Object.values(PROGRAMMES)
    .map((p) => ({ name: p.name, slug: slugify(p.name), subjects: p.subjects }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getAllCanonicalProgrammeSlugs() {
  return programmeList().map((p) => p.slug);
}

export function findCanonicalProgramme(programmeSlug: string) {
  return programmeList().find((p) => p.slug === programmeSlug) ?? null;
}

export function findCanonicalSubject(programmeSlug: string, subjectSlug: string) {
  const programme = findCanonicalProgramme(programmeSlug);
  if (!programme) return null;
  const subject = programme.subjects.find((s) => slugify(s) === subjectSlug);
  if (!subject) return null;
  return { programme, subject };
}

export async function getProgrammesWithNotesStatus() {
  const counts = await prisma.canonicalSubjectNote.groupBy({
    by: ["programmeSlug"],
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((c) => [c.programmeSlug, c._count._all]));

  return programmeList().map((p) => ({
    slug: p.slug,
    name: p.name,
    subjectCount: p.subjects.length,
    notesCount: countMap.get(p.slug) ?? 0,
  }));
}

export async function getProgrammeSubjectsWithNotesStatus(programmeSlug: string) {
  const programme = findCanonicalProgramme(programmeSlug);
  if (!programme) return null;

  const notes = await prisma.canonicalSubjectNote.findMany({
    where: { programmeSlug },
    select: { subjectSlug: true, updatedAt: true },
  });
  const noteMap = new Map(notes.map((n) => [n.subjectSlug, n.updatedAt]));

  const subjects = programme.subjects.map((name) => {
    const slug = slugify(name);
    return { name, slug, hasNotes: noteMap.has(slug), updatedAt: noteMap.get(slug) ?? null };
  });

  return { name: programme.name, slug: programme.slug, subjects };
}

export async function getCanonicalNote(programmeSlug: string, subjectSlug: string) {
  const found = findCanonicalSubject(programmeSlug, subjectSlug);
  if (!found) return null;

  const existing = await prisma.canonicalSubjectNote.findUnique({
    where: { programmeSlug_subjectSlug: { programmeSlug, subjectSlug } },
  });

  return {
    programmeName: found.programme.name,
    subjectName: found.subject,
    content: existing?.content ?? "",
    theme: existing?.theme ?? "sky",
    updatedAt: existing?.updatedAt ?? null,
  };
}
