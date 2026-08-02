// Guarantees 100% of a program's real Drive-matched papers are attached to
// some catalog Subject, so nothing is invisible on the public site (subject
// page / Course Coverage). The conservative auto-linker
// (link-drive-subjects-to-catalog.ts) only links at >=0.85 confidence and
// leaves the rest for manual review — correct when a program's catalog is
// syllabus-accurate (the two B.Com programs), but most other programs still
// have a thin/generic placeholder catalog with nothing real for most Drive
// subjects to match against at all. This script closes that gap:
//   1. Try matching each still-unlinked DriveSubject against the catalog at
//      a relaxed 0.5 bar (still requires real signal, just not near-exact).
//   2. Anything left over gets a brand-new catalog Subject created for it,
//      under a per-program "Unsorted" term (created once, reused) rather than
//      guessing a semester we have no evidence for.
//   3. Newly-created subjects are matched against each other as they're
//      created (same clustering idea as rebuild-drive-subjects.ts), so 20
//      near-identical DriveSubject spellings collapse into one new catalog
//      entry instead of 20 near-duplicate ones.
// Every DriveSubject ends up with a subjectId — zero left unlinked.
// Safe to re-run: only touches DriveSubjects with subjectId still null.
import { config } from "dotenv";
import path from "path";
config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

import { PrismaClient } from "../src/generated/prisma";
import { matchDriveSubjectName } from "../src/lib/subject-quality";

const prisma = new PrismaClient();
const CODE_PREFIX = /^[A-Za-z]{2,4}-\d+\.\d+\s*[—–-]\s*/;
const LINK_CONFIDENCE = 0.5;
const UNSORTED_TERM_NAME = "Unsorted";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-");
}

async function uniqueSlug(base: string, termId: string) {
  const root = slugify(base) || "subject";
  let candidate = root;
  let i = 1;
  while (await prisma.subject.findUnique({ where: { termId_slug: { termId, slug: candidate } } })) {
    i += 1;
    candidate = `${root}-${i}`;
  }
  return candidate;
}

async function runForProgram(programId: string, programName: string) {
  const catalogSubjects = await prisma.subject.findMany({
    where: { term: { programId } },
    select: { id: true, name: true },
  });
  const candidates = catalogSubjects.map((s) => ({ id: s.id, name: s.name.replace(CODE_PREFIX, "").trim() }));

  const unlinked = await prisma.driveSubject.findMany({
    where: { programId, subjectId: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (unlinked.length === 0) return { linked: 0, created: 0, total: 0 };

  let unsortedTerm: { id: string } | null = await prisma.term.findFirst({
    where: { programId, name: UNSORTED_TERM_NAME },
    select: { id: true },
  });

  let linked = 0;
  let created = 0;

  for (const ds of unlinked) {
    const { subject, confidence } = matchDriveSubjectName(candidates, ds.name);
    if (subject && confidence >= LINK_CONFIDENCE) {
      await prisma.driveSubject.update({ where: { id: ds.id }, data: { subjectId: subject.id } });
      linked++;
      continue;
    }

    if (!unsortedTerm) {
      unsortedTerm = await prisma.term.create({
        data: { programId, name: UNSORTED_TERM_NAME, order: 999 },
      });
    }
    const slug = await uniqueSlug(ds.name, unsortedTerm.id);
    const newSubject = await prisma.subject.create({
      data: { termId: unsortedTerm.id, name: ds.name, slug },
    });
    candidates.push({ id: newSubject.id, name: ds.name });
    await prisma.driveSubject.update({ where: { id: ds.id }, data: { subjectId: newSubject.id } });
    created++;
  }

  console.log(`${programName}: ${linked} linked to existing catalog, ${created} new subject(s) created — 100% now linked (${unlinked.length} total).`);
  return { linked, created, total: unlinked.length };
}

async function main() {
  const onlySlug = process.argv[2];
  const programs = onlySlug
    ? await prisma.program.findMany({ where: { slug: onlySlug } })
    : await prisma.program.findMany({ where: { driveSubjects: { some: { subjectId: null } } } });

  let totalLinked = 0;
  let totalCreated = 0;
  for (const program of programs) {
    const result = await runForProgram(program.id, program.name);
    totalLinked += result.linked;
    totalCreated += result.created;
  }

  console.log(`\nDone. ${totalLinked} linked to existing subjects, ${totalCreated} new subjects created across ${programs.length} program(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
