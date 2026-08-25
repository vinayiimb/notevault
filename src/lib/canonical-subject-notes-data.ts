import "server-only";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

type CanonicalProgrammeRaw = { name: string; subjects: string[] };

let cachedProgrammes: Record<string, CanonicalProgrammeRaw> | null = null;

async function loadProgrammes(): Promise<Record<string, CanonicalProgrammeRaw>> {
  if (cachedProgrammes) return cachedProgrammes;
  try {
    const fs = require("fs");
    const path = require("path");
    const filePath = path.join(process.cwd(), "public", "data", "du-canonical-mapping.json");
    const data = fs.readFileSync(filePath, "utf-8");
    const raw = JSON.parse(data);
    cachedProgrammes = raw.programmes as Record<string, CanonicalProgrammeRaw>;
  } catch (err) {
    console.warn("Failed to load canonical mapping JSON:", err);
    cachedProgrammes = {};
  }
  return cachedProgrammes!;
}

async function programmeList() {
  const programmes = await loadProgrammes();
  return Object.values(programmes)
    .map((p) => ({ name: p.name, slug: slugify(p.name), subjects: p.subjects }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAllCanonicalProgrammeSlugs() {
  const list = await programmeList();
  return list.map((p) => p.slug);
}

export async function findCanonicalProgramme(programmeSlug: string) {
  const list = await programmeList();
  return list.find((p) => p.slug === programmeSlug) ?? null;
}

export async function findCanonicalSubject(programmeSlug: string, subjectSlug: string) {
  const programme = await findCanonicalProgramme(programmeSlug);
  if (!programme) return null;
  const subject = programme.subjects.find((s) => slugify(s) === subjectSlug);
  if (!subject) return null;
  return { programme, subject };
}

export async function getProgrammesWithNotesStatus() {
  let countMap = new Map<string, number>();
  try {
    const counts = await prisma.canonicalSubjectNote.groupBy({
      by: ["programmeSlug"],
      _count: { _all: true },
    });
    countMap = new Map(counts.map((c) => [c.programmeSlug, c._count._all]));
  } catch (err) {
    console.warn("Database unavailable for getProgrammesWithNotesStatus, returning zero counts:", err instanceof Error ? err.message : err);
  }

  const list = await programmeList();
  return list.map((p) => ({
    slug: p.slug,
    name: p.name,
    subjectCount: p.subjects.length,
    notesCount: countMap.get(p.slug) ?? 0,
  }));
}

export async function getProgrammeSubjectsWithNotesStatus(programmeSlug: string) {
  const programme = await findCanonicalProgramme(programmeSlug);
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
  const found = await findCanonicalSubject(programmeSlug, subjectSlug);
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
