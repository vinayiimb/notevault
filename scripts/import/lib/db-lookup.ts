// Bounded, keyed lookups against the target database — every query here
// filters by an explicit `in:` list of candidate keys from the current
// import batch. No unrestricted findMany() anywhere in this file (Phase 2C
// item 4's explicit requirement), and no locking/pooling risk from a
// giant scan of a table that (per Phase 2B) is currently empty anyway but
// won't stay that way after apply mode runs.
import type { PrismaClient } from "@/generated/prisma";

const CHUNK_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function findExistingProgramSlugs(prisma: PrismaClient, slugs: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (const batch of chunk([...new Set(slugs)], CHUNK_SIZE)) {
    const rows = await prisma.program.findMany({ where: { slug: { in: batch } }, select: { slug: true } });
    for (const r of rows) found.add(r.slug);
  }
  return found;
}

export async function getProgramIdsBySlug(prisma: PrismaClient, slugs: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const batch of chunk([...new Set(slugs)], CHUNK_SIZE)) {
    const rows = await prisma.program.findMany({ where: { slug: { in: batch } }, select: { id: true, slug: true } });
    for (const r of rows) map.set(r.slug, r.id);
  }
  return map;
}

/** Existing (programId, order) Term pairs, returned as a Set of "programId::order" keys. */
export async function findExistingTermKeys(
  prisma: PrismaClient,
  programIds: string[],
): Promise<Set<string>> {
  const found = new Set<string>();
  for (const batch of chunk([...new Set(programIds)], CHUNK_SIZE)) {
    const rows = await prisma.term.findMany({
      where: { programId: { in: batch } },
      select: { programId: true, order: true, id: true },
    });
    for (const r of rows) found.add(`${r.programId}::${r.order}`);
  }
  return found;
}

export async function getTermIdsByProgramAndOrder(
  prisma: PrismaClient,
  programIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const batch of chunk([...new Set(programIds)], CHUNK_SIZE)) {
    const rows = await prisma.term.findMany({
      where: { programId: { in: batch } },
      select: { id: true, programId: true, order: true },
    });
    for (const r of rows) map.set(`${r.programId}::${r.order}`, r.id);
  }
  return map;
}

/** Existing (termId, slug) Subject pairs, as a Set of "termId::slug" keys. */
export async function findExistingSubjectKeys(prisma: PrismaClient, termIds: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (const batch of chunk([...new Set(termIds)], CHUNK_SIZE)) {
    const rows = await prisma.subject.findMany({ where: { termId: { in: batch } }, select: { termId: true, slug: true } });
    for (const r of rows) found.add(`${r.termId}::${r.slug}`);
  }
  return found;
}

export async function findExistingExamSessionLabels(prisma: PrismaClient, labels: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (const batch of chunk([...new Set(labels)], CHUNK_SIZE)) {
    const rows = await prisma.examSession.findMany({ where: { label: { in: batch } }, select: { label: true } });
    for (const r of rows) found.add(r.label);
  }
  return found;
}

export async function getExamSessionIdsByLabel(prisma: PrismaClient, labels: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const batch of chunk([...new Set(labels)], CHUNK_SIZE)) {
    const rows = await prisma.examSession.findMany({ where: { label: { in: batch } }, select: { id: true, label: true } });
    for (const r of rows) map.set(r.label, r.id);
  }
  return map;
}

/** Existing SessionProgramLink rows, as a Set of "sessionId::programId::variantLabel" keys. */
export async function findExistingSessionLinkKeys(
  prisma: PrismaClient,
  sessionIds: string[],
): Promise<Set<string>> {
  const found = new Set<string>();
  for (const batch of chunk([...new Set(sessionIds)], CHUNK_SIZE)) {
    const rows = await prisma.sessionProgramLink.findMany({
      where: { sessionId: { in: batch } },
      select: { sessionId: true, programId: true, variantLabel: true },
    });
    for (const r of rows) found.add(`${r.sessionId}::${r.programId}::${r.variantLabel}`);
  }
  return found;
}
